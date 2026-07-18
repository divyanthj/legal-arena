import "server-only";
import mongoose from "mongoose";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import CaseSession from "@/models/CaseSession";
import {
  getAdminOpsConfig,
  getFreeGameplayCampaignStatus,
  getTimedSoloCampaignStatus,
} from "@/libs/adminOps";
import {
  FREE_GAMEPLAY_PAYWALL_MESSAGE,
  resolveSoloGameplayAccessDecision,
  resolveTimedSoloLoginEnrollment,
} from "@/libs/freeGameplayCampaignAccess";

const normalizeEmail = (value = "") => value.trim().toLowerCase();

const parseEmailList = (rawValue = "") => {
  const raw = rawValue?.trim();

  if (!raw) {
    return [];
  }

  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(normalizeEmail).filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  }

  return raw.split(",").map(normalizeEmail).filter(Boolean);
};

const parseAdmins = () => parseEmailList(process.env.ADMINS);
const parseGrantedAccess = () => parseEmailList(process.env.ACCESS_GRANTED);

export const getAdminEmails = () => parseAdmins();
export const getGrantedAccessEmails = () => parseGrantedAccess();

export const isAdminEmail = (email) =>
  Boolean(email) && parseAdmins().includes(normalizeEmail(email));

export const hasGameAccess = (email) =>
  Boolean(email) &&
  (isAdminEmail(email) || parseGrantedAccess().includes(normalizeEmail(email)));

export const userCanAccessArena = async (session) => {
  if (!session?.user?.id) {
    return false;
  }

  if (hasGameAccess(session.user?.email)) {
    return true;
  }

  await connectMongo();
  const selectors = [];
  const normalizedEmail = normalizeEmail(session.user?.email || "");

  if (mongoose.Types.ObjectId.isValid(session.user.id)) {
    selectors.push({ _id: session.user.id });
  }

  if (normalizedEmail) {
    selectors.push({ email: normalizedEmail });
  }

  if (!selectors.length) {
    return false;
  }

  const users = await User.find({ $or: selectors }).select(
    "_id email hasAccess freeAccessGranted freeAccessGrantedAt freeAccessGrantedBy"
  );
  const grantingUser = users.find(
    (user) => user?.hasAccess || user?.freeAccessGranted
  );

  if (!grantingUser) {
    return false;
  }

  const sessionUser = users.find(
    (user) => user?._id?.toString() === session.user.id
  );

  if (
    sessionUser &&
    !sessionUser.freeAccessGranted &&
    grantingUser.freeAccessGranted &&
    normalizedEmail &&
    normalizeEmail(grantingUser.email || "") === normalizedEmail
  ) {
    await User.updateOne(
      { _id: session.user.id },
      {
        $set: {
          freeAccessGranted: true,
          freeAccessGrantedAt: grantingUser.freeAccessGrantedAt || new Date(),
          freeAccessGrantedBy: grantingUser.freeAccessGrantedBy || "email-grant",
        },
      }
    );
  }

  return true;
};

export const getFullArenaAccessForSession = async (session) =>
  userCanAccessArena(session);

const getUserForAccess = async (session) => {
  if (!session?.user?.id) {
    return null;
  }

  await connectMongo();
  return User.findById(session.user.id).select(
    "_id email hasAccess freeAccessGranted progression timedSoloCampaignAccess soloTrial"
  );
};

const getSoloTrialResolution = (caseSession = {}) => {
  if (!caseSession) return "";
  if (caseSession.status === "settled") return "settled";
  if (caseSession.status === "verdict") {
    return caseSession.verdict?.summary?.toLowerCase().includes("quit")
      ? "forfeit"
      : "verdict";
  }
  if (caseSession.status === "exited") return "exited";
  return "";
};

const toSoloTrialPayload = (soloTrial = {}) => ({
  state: soloTrial?.state || "available",
  caseSessionId: soloTrial?.caseSessionId
    ? String(soloTrial.caseSessionId)
    : "",
  claimedAt: soloTrial?.claimedAt || null,
  resolvedAt: soloTrial?.resolvedAt || null,
  resolution: soloTrial?.resolution || "",
});

const reconcileSoloTrialForUser = async (user) => {
  if (!user?._id) return toSoloTrialPayload();

  let trial = toSoloTrialPayload(user.soloTrial);
  let trialCase = trial.caseSessionId
    ? await CaseSession.findOne({
        _id: trial.caseSessionId,
        userId: user._id,
      }).select("_id status createdAt completedAt verdict.summary")
    : null;

  if (!trial.caseSessionId && trial.state === "available") {
    trialCase = await CaseSession.findOne({ userId: user._id })
      .sort({ createdAt: 1 })
      .select("_id status createdAt completedAt verdict.summary");
  }

  const legacyCompletion = Number(user.progression?.completedCases || 0) > 0;
  const resolution = getSoloTrialResolution(trialCase);
  const nextTrial = trialCase
    ? {
        state: resolution ? "resolved" : "active",
        caseSessionId: trialCase._id,
        claimedAt: trial.claimedAt || trialCase.createdAt || new Date(),
        resolvedAt: resolution
          ? trial.resolvedAt || trialCase.completedAt || new Date()
          : null,
        resolution: resolution || "",
      }
    : legacyCompletion
    ? {
        state: "resolved",
        caseSessionId: null,
        claimedAt: trial.claimedAt || null,
        resolvedAt: trial.resolvedAt || new Date(),
        resolution: "legacy",
      }
    : {
        state: "available",
        caseSessionId: null,
        claimedAt: null,
        resolvedAt: null,
        resolution: "",
      };

  if (JSON.stringify(toSoloTrialPayload(user.soloTrial)) !== JSON.stringify(toSoloTrialPayload(nextTrial))) {
    await User.updateOne({ _id: user._id }, { $set: { soloTrial: nextTrial } });
  }

  return toSoloTrialPayload(nextTrial);
};

export const claimEvergreenSoloTrial = async ({ userId, caseSessionId }) => {
  await connectMongo();
  const user = await User.findById(userId).select("_id progression soloTrial");
  const trial = await reconcileSoloTrialForUser(user);
  if (trial.state !== "available") return null;

  const claimedAt = new Date();
  const claimed = await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { "soloTrial.state": "available" },
        { "soloTrial.state": { $exists: false } },
      ],
      "soloTrial.caseSessionId": null,
    },
    {
      $set: {
        soloTrial: {
          state: "active",
          caseSessionId,
          claimedAt,
          resolvedAt: null,
          resolution: "",
        },
      },
    },
    { new: true }
  ).select("soloTrial");

  return claimed ? toSoloTrialPayload(claimed.soloTrial) : null;
};

export const releaseEvergreenSoloTrialClaim = async ({ userId, caseSessionId }) => {
  await User.updateOne(
    {
      _id: userId,
      "soloTrial.state": "active",
      "soloTrial.caseSessionId": caseSessionId,
    },
    {
      $set: {
        soloTrial: {
          state: "available",
          caseSessionId: null,
          claimedAt: null,
          resolvedAt: null,
          resolution: "",
        },
      },
    }
  );
};

export const resolveEvergreenSoloTrial = async ({
  userId,
  caseSessionId,
  resolution,
  resolvedAt = new Date(),
}) => {
  if (!userId || !caseSessionId) return;
  await User.updateOne(
    {
      _id: userId,
      "soloTrial.caseSessionId": caseSessionId,
    },
    {
      $set: {
        "soloTrial.state": "resolved",
        "soloTrial.resolvedAt": resolvedAt,
        "soloTrial.resolution": resolution,
      },
    }
  );
};

export const recordTimedSoloCampaignLogin = async ({
  userId,
  email = "",
  nowInput = new Date(),
} = {}) => {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  if (!userId || Number.isNaN(now.getTime()) || hasGameAccess(email)) {
    return null;
  }

  const config = await getAdminOpsConfig();
  const status = getTimedSoloCampaignStatus(config.timedSoloCampaign, now);
  const campaign = status.campaign || {};
  if (!status.active || campaign.mode !== "after_login") {
    return null;
  }

  await connectMongo();
  const selectors = [];
  const normalizedEmail = normalizeEmail(email);
  if (mongoose.Types.ObjectId.isValid(userId)) selectors.push({ _id: userId });
  if (normalizedEmail) selectors.push({ email: normalizedEmail });
  if (!selectors.length) return null;

  const user = await User.findOne({ $or: selectors }).select(
    "_id hasAccess freeAccessGranted timedSoloCampaignAccess"
  );
  if (!user) return null;
  const enrollment = resolveTimedSoloLoginEnrollment({
    campaignStatus: status,
    currentAccess: user.timedSoloCampaignAccess,
    hasFullAccess: user.hasAccess || user.freeAccessGranted,
    loginAtInput: now,
  });
  if (!enrollment) return null;
  if (user.timedSoloCampaignAccess?.campaignId === campaign.campaignId) {
    return enrollment;
  }

  const result = await User.findOneAndUpdate(
    {
      _id: user._id,
      "timedSoloCampaignAccess.campaignId": { $ne: campaign.campaignId },
      hasAccess: { $ne: true },
      freeAccessGranted: { $ne: true },
    },
    {
      $set: {
        timedSoloCampaignAccess: {
          campaignId: enrollment.campaignId,
          startedAt: enrollment.startedAt,
          endsAt: enrollment.endsAt,
        },
      },
    },
    { new: true }
  ).select("timedSoloCampaignAccess");

  return result?.timedSoloCampaignAccess || null;
};

const buildFreeCampaignGrant = (campaign) => ({
  grantedAt: new Date(),
  campaignStartsAt: campaign.startsAt ? new Date(campaign.startsAt) : null,
  campaignEndsAt: campaign.endsAt ? new Date(campaign.endsAt) : null,
});

const buildCaseAccessQuery = ({ userId, caseId }) => {
  const normalizedCaseId = String(caseId || "").trim();

  if (mongoose.Types.ObjectId.isValid(normalizedCaseId)) {
    return {
      userId,
      $or: [{ _id: normalizedCaseId }, { slug: normalizedCaseId }],
    };
  }

  return { userId, slug: normalizedCaseId };
};

export const getSoloGameplayAccessForSession = async ({
  session,
  caseId = "",
  action = "play",
} = {}) => {
  if (!session?.user?.id) {
    return resolveSoloGameplayAccessDecision({ signedIn: false });
  }

  const hasFullAccess = await userCanAccessArena(session);
  if (hasFullAccess) {
    return resolveSoloGameplayAccessDecision({ hasFullAccess: true });
  }

  const [user, config] = await Promise.all([
    getUserForAccess(session),
    getAdminOpsConfig(),
  ]);
  const campaignStatus = getFreeGameplayCampaignStatus(
    config.freeGameplayCampaign
  );
  const timedCampaignStatus = getTimedSoloCampaignStatus(
    config.timedSoloCampaign
  );
  const soloTrial = await reconcileSoloTrialForUser(user);

  let caseSession = null;
  if (caseId) {
    caseSession = await CaseSession.findOne(
      buildCaseAccessQuery({ userId: session.user.id, caseId })
    ).select("_id status freeGameplayCampaignAccess");
  }

  const decision = resolveSoloGameplayAccessDecision({
    signedIn: true,
    hasFullAccess,
    progression: user?.progression,
    caseSession,
    campaignStatus,
    timedCampaignStatus,
    timedCampaignAccess: user?.timedSoloCampaignAccess,
    soloTrial,
    action,
    buildCampaignGrant: buildFreeCampaignGrant,
  });

  return {
    ...decision,
    message: decision.message || FREE_GAMEPLAY_PAYWALL_MESSAGE,
    caseSession,
    soloTrial,
  };
};

export const getCaseGeneratorApiKey = () =>
  process.env.CASE_GENERATOR_API_KEY?.trim() || "";

export const hasValidCaseGeneratorApiKey = (req) => {
  const expected = getCaseGeneratorApiKey();
  if (!expected) {
    return false;
  }

  const bearer = req.headers.get("authorization") || "";
  const headerKey = req.headers.get("x-case-generator-key") || "";
  const bearerKey = bearer.startsWith("Bearer ") ? bearer.slice(7).trim() : "";

  return headerKey === expected || bearerKey === expected;
};
