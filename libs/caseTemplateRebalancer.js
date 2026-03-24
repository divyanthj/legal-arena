import "server-only";

import connectMongo from "@/libs/mongoose";
import CaseTemplate from "@/models/CaseTemplate";
import InternalJobLock from "@/models/InternalJobLock";
import { LEGAL_CASE_CATEGORIES } from "@/libs/game/categories";

export const DEFAULT_CASE_TEMPLATE_TARGET_PER_CATEGORY = 15;
export const CASE_TEMPLATE_COMPLEXITY_LEVELS = [1, 2, 3, 4, 5];
export const CASE_TEMPLATE_REBALANCER_LOCK_KEY = "case-template-rebalancer";
export const CASE_TEMPLATE_REBALANCER_LOCK_TTL_MS = 20 * 60 * 1000;

export const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["1", "true", "yes", "y", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "n", "off"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
};

export const parseCaseTemplateTargetPerCategory = (
  rawValue = process.env.CASE_TEMPLATE_TARGET_PER_CATEGORY
) => {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return DEFAULT_CASE_TEMPLATE_TARGET_PER_CATEGORY;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (Number.isNaN(parsed) || parsed < 0) {
    return DEFAULT_CASE_TEMPLATE_TARGET_PER_CATEGORY;
  }

  return parsed;
};

export const deriveComplexityTargets = (targetPerCategory) => {
  const normalizedTarget = Math.max(0, Number(targetPerCategory) || 0);
  const baseTarget = Math.floor(
    normalizedTarget / CASE_TEMPLATE_COMPLEXITY_LEVELS.length
  );
  let remainder = normalizedTarget % CASE_TEMPLATE_COMPLEXITY_LEVELS.length;

  return CASE_TEMPLATE_COMPLEXITY_LEVELS.map((complexity) => {
    const target = baseTarget + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);

    return {
      complexity,
      target,
    };
  });
};

export const hasValidCaseTemplateRebalanceSecret = ({
  headers = {},
  secret = "",
  query = {},
  body = {},
} = {}) => {
  if (!secret) {
    return false;
  }

  const authorization = headers.authorization || headers.Authorization || "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  const headerToken =
    headers["x-case-template-rebalance-secret"] ||
    headers["X-Case-Template-Rebalance-Secret"] ||
    "";
  const queryToken = query.secret || "";
  const bodyToken = body.secret || "";

  return [bearerToken, headerToken, queryToken, bodyToken].includes(secret);
};

export const parseCaseTemplateRebalanceOptions = ({ query = {}, body = {} } = {}) => ({
  dryRun: normalizeBoolean(body.dryRun ?? query.dryRun, false),
});

const buildCountsLookup = (rows = []) => {
  const counts = new Map();

  rows.forEach((row) => {
    const categorySlug = String(row?._id?.primaryCategory || "").trim();
    const complexity = Number(row?._id?.complexity || 0);
    const count = Number(row?.count || 0);

    if (!categorySlug || !CASE_TEMPLATE_COMPLEXITY_LEVELS.includes(complexity)) {
      return;
    }

    counts.set(`${categorySlug}:${complexity}`, count);
  });

  return counts;
};

export const selectNextCaseTemplateGenerationTarget = ({
  targetPerCategory = DEFAULT_CASE_TEMPLATE_TARGET_PER_CATEGORY,
  counts = [],
  categories = LEGAL_CASE_CATEGORIES,
} = {}) => {
  const derivedTargets = deriveComplexityTargets(targetPerCategory);
  const countsLookup = buildCountsLookup(counts);

  for (const { complexity, target } of derivedTargets) {
    if (target <= 0) {
      continue;
    }

    let bestCandidate = null;

    categories.forEach((category, categoryIndex) => {
      const currentCount =
        countsLookup.get(`${category.slug}:${complexity}`) || 0;

      if (currentCount >= target) {
        return;
      }

      const candidate = {
        categorySlug: category.slug,
        categoryTitle: category.title,
        complexity,
        currentCount,
        targetCount: target,
        deficit: target - currentCount,
        categoryIndex,
      };

      if (
        !bestCandidate ||
        candidate.currentCount < bestCandidate.currentCount ||
        (candidate.currentCount === bestCandidate.currentCount &&
          candidate.categoryIndex < bestCandidate.categoryIndex)
      ) {
        bestCandidate = candidate;
      }
    });

    if (bestCandidate) {
      return {
        targetPerCategory,
        derivedTargets,
        selectedTarget: bestCandidate,
      };
    }
  }

  return {
    targetPerCategory,
    derivedTargets,
    selectedTarget: null,
  };
};

export const listActiveTemplateCoverageCounts = async () => {
  await connectMongo();

  return CaseTemplate.aggregate([
    {
      $match: {
        status: "active",
      },
    },
    {
      $group: {
        _id: {
          primaryCategory: "$primaryCategory",
          complexity: "$complexity",
        },
        count: { $sum: 1 },
      },
    },
  ]);
};

export const getCaseTemplateRebalanceSnapshot = async ({
  targetPerCategory = parseCaseTemplateTargetPerCategory(),
} = {}) => {
  const counts = await listActiveTemplateCoverageCounts();

  return {
    counts,
    ...selectNextCaseTemplateGenerationTarget({
      targetPerCategory,
      counts,
    }),
  };
};

export const acquireInternalJobLock = async ({
  key,
  owner,
  ttlMs = CASE_TEMPLATE_REBALANCER_LOCK_TTL_MS,
} = {}) => {
  if (!key || !owner) {
    return null;
  }

  await connectMongo();

  const now = new Date();
  const lockedUntil = new Date(now.getTime() + ttlMs);

  const existingLock = await InternalJobLock.findOneAndUpdate(
    {
      key,
      lockedUntil: { $lte: now },
    },
    {
      $set: {
        owner,
        lockedAt: now,
        lockedUntil,
      },
    },
    {
      new: true,
    }
  );

  if (existingLock) {
    return existingLock;
  }

  try {
    return await InternalJobLock.create({
      key,
      owner,
      lockedAt: now,
      lockedUntil,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return null;
    }

    throw error;
  }
};

export const releaseInternalJobLock = async ({ key, owner } = {}) => {
  if (!key || !owner) {
    return;
  }

  await connectMongo();

  await InternalJobLock.updateOne(
    {
      key,
      owner,
    },
    {
      $set: {
        lockedUntil: new Date(0),
      },
    }
  );
};
