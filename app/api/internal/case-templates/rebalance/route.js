import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createGeneratedCaseTemplate,
  GenerationDeferredError,
} from "@/libs/game/generation";
import {
  CASE_TEMPLATE_REBALANCER_LOCK_KEY,
  acquireInternalJobLock,
  getCaseTemplateRebalanceSnapshot,
  hasValidCaseTemplateRebalanceSecret,
  parseCaseTemplateRebalanceOptions,
  parseCaseTemplateTargetPerCategory,
  releaseInternalJobLock,
} from "@/libs/caseTemplateRebalancer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const safeJson = async (req) => {
  try {
    return await req.json();
  } catch {
    return {};
  }
};

const buildResponsePayload = ({
  action,
  snapshot,
  dryRun = false,
  template = null,
  artifactId = null,
  reason = "",
  stage = "",
} = {}) => ({
  action,
  dryRun,
  reason,
  stage,
  targetPerCategory: snapshot?.targetPerCategory ?? null,
  derivedComplexityTargets: snapshot?.derivedTargets || [],
  selectedTarget: snapshot?.selectedTarget || null,
  templateId: template?.id || template?._id || null,
  artifactId: artifactId || null,
});

const handleRequest = async (req, body = {}) => {
  const { searchParams } = new URL(req.url);
  const query = Object.fromEntries(searchParams.entries());
  const headers = Object.fromEntries(req.headers.entries());

  if (
    !hasValidCaseTemplateRebalanceSecret({
      headers,
      query,
      body,
      secret: process.env.CRON_SECRET,
    })
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const options = parseCaseTemplateRebalanceOptions({ query, body });
  const targetPerCategory = parseCaseTemplateTargetPerCategory();
  const lockOwner = randomUUID();
  const lock = await acquireInternalJobLock({
    key: CASE_TEMPLATE_REBALANCER_LOCK_KEY,
    owner: lockOwner,
  });

  if (!lock) {
    return NextResponse.json(
      {
        action: "locked",
        dryRun: options.dryRun,
        error: "Another case template rebalance run is already in progress.",
      },
      { status: 409 }
    );
  }

  let snapshot = null;

  try {
    snapshot = await getCaseTemplateRebalanceSnapshot({
      targetPerCategory,
    });

    if (targetPerCategory === 0) {
      return NextResponse.json(
        buildResponsePayload({
          action: "noop",
          dryRun: options.dryRun,
          snapshot,
          reason: "CASE_TEMPLATE_TARGET_PER_CATEGORY is 0, so generation is disabled.",
        })
      );
    }

    if (!snapshot.selectedTarget) {
      return NextResponse.json(
        buildResponsePayload({
          action: "noop",
          dryRun: options.dryRun,
          snapshot,
          reason: "All category and complexity targets are currently satisfied.",
        })
      );
    }

    if (options.dryRun) {
      return NextResponse.json(
        buildResponsePayload({
          action: "noop",
          dryRun: true,
          snapshot,
          reason: "Dry run only. No case template was generated.",
        })
      );
    }

    const { template, artifactId } = await createGeneratedCaseTemplate({
      categorySlug: snapshot.selectedTarget.categorySlug,
      complexity: snapshot.selectedTarget.complexity,
      prompt: "",
      userId: "cron-rebalancer",
      model: process.env.OPENAI_REBALANCE_MODEL?.trim() || "gpt-5.4-mini",
      generationProfile: "rebalance",
      timeBudgetMs: 4 * 60 * 1000,
    });

    return NextResponse.json(
      buildResponsePayload({
        action: "generated",
        dryRun: false,
        snapshot,
        template,
        artifactId,
      }),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof GenerationDeferredError) {
      snapshot = await getCaseTemplateRebalanceSnapshot({
        targetPerCategory,
      });

      return NextResponse.json(
        buildResponsePayload({
          action: "running",
          dryRun: options.dryRun,
          snapshot,
          artifactId: error.artifactId || null,
          stage: error.stage || "",
          reason: "Generation checkpoint saved. The next rebalance invocation will resume from the artifact.",
        }),
        { status: 202 }
      );
    }

    console.error("Case template rebalance run failed:", error);

    return NextResponse.json(
      {
        error: error.message || "Failed to rebalance case templates.",
      },
      { status: 500 }
    );
  } finally {
    await releaseInternalJobLock({
      key: CASE_TEMPLATE_REBALANCER_LOCK_KEY,
      owner: lockOwner,
    });
  }
};

export async function GET(req) {
  return handleRequest(req, {});
}

export async function POST(req) {
  const body = await safeJson(req);
  return handleRequest(req, body);
}
