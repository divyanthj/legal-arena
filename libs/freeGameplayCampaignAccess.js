export const FREE_GAMEPLAY_PAYWALL_MESSAGE =
  "Legal Arena is still in development. Access is currently limited.";

export const caseWasCreatedUnderFreeGameplayCampaign = (caseSession) =>
  Boolean(caseSession?.freeGameplayCampaignAccess?.grantedAt);

export const userHasCompletedFreeSoloVerdict = (userOrProgression) => {
  const progression = userOrProgression?.progression || userOrProgression || {};
  return (progression.completedCases || 0) >= 1;
};

export const resolveTimedSoloCampaignStatus = (
  campaign = {},
  nowInput = new Date()
) => {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  if (!campaign.enabled) {
    return { state: "inactive", active: false, campaign };
  }
  if (Number.isNaN(now.getTime())) {
    return { state: "invalid", active: false, campaign };
  }

  if (campaign.mode === "after_login") {
    const launchedAt = campaign.launchedAt ? new Date(campaign.launchedAt) : null;
    const validLaunch =
      campaign.campaignId &&
      launchedAt &&
      !Number.isNaN(launchedAt.getTime()) &&
      Number(campaign.durationHours) > 0;
    return validLaunch
      ? { state: "active", active: true, campaign }
      : { state: "not_launched", active: false, campaign };
  }

  const startsAt = campaign.startsAt ? new Date(campaign.startsAt) : null;
  const endsAt = campaign.endsAt ? new Date(campaign.endsAt) : null;
  const validWindow =
    startsAt &&
    endsAt &&
    !Number.isNaN(startsAt.getTime()) &&
    !Number.isNaN(endsAt.getTime()) &&
    startsAt < endsAt;
  if (!validWindow) return { state: "invalid", active: false, campaign };
  if (now < startsAt) return { state: "scheduled", active: false, campaign };
  if (now >= endsAt) return { state: "expired", active: false, campaign };
  return { state: "active", active: true, campaign };
};

export const resolveTimedSoloLoginEnrollment = ({
  campaignStatus,
  currentAccess = null,
  hasFullAccess = false,
  loginAtInput = new Date(),
} = {}) => {
  const campaign = campaignStatus?.campaign || {};
  const loginAt =
    loginAtInput instanceof Date ? loginAtInput : new Date(loginAtInput);
  const launchedAt = campaign.launchedAt ? new Date(campaign.launchedAt) : null;

  if (
    hasFullAccess ||
    !campaignStatus?.active ||
    campaign.mode !== "after_login" ||
    !launchedAt ||
    Number.isNaN(launchedAt.getTime()) ||
    Number.isNaN(loginAt.getTime()) ||
    loginAt < launchedAt
  ) {
    return null;
  }

  if (currentAccess?.campaignId === campaign.campaignId) {
    return currentAccess;
  }

  return {
    campaignId: campaign.campaignId,
    startedAt: loginAt,
    endsAt: new Date(
      loginAt.getTime() + Number(campaign.durationHours) * 60 * 60 * 1000
    ),
  };
};

export const resolveSoloGameplayAccessDecision = ({
  signedIn = true,
  hasFullAccess = false,
  progression = {},
  campaignStatus = { active: false, state: "inactive", campaign: {} },
  timedCampaignStatus = null,
  timedCampaignAccess = null,
  soloTrial = { state: "available" },
  caseSession = null,
  action = "play",
  buildCampaignGrant = null,
  nowInput = new Date(),
} = {}) => {
  if (!signedIn) {
    return {
      allowed: false,
      reason: "not_signed_in",
      status: 401,
      message: "Not signed in",
    };
  }

  if (hasFullAccess) {
    return {
      allowed: true,
      reason: "full_access",
      hasArenaAccess: true,
      freeGameplayCampaignAccess: null,
      trialState: soloTrial?.state || "available",
    };
  }

  if (action === "read" && caseSession?.status === "verdict") {
    return {
      allowed: true,
      reason: "completed_verdict_read",
      hasArenaAccess: false,
      readOnly: true,
      trialState: soloTrial?.state || "resolved",
    };
  }

  if (action === "list") {
    return {
      allowed: true,
      reason: "dashboard_read",
      hasArenaAccess: false,
      readOnly: soloTrial?.state === "resolved",
      trialState: soloTrial?.state || "available",
      trialCaseId: soloTrial?.caseSessionId || "",
    };
  }

  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  let timedCampaignFailureReason = "";

  if (timedCampaignStatus) {
    const timedCampaign = timedCampaignStatus.campaign || {};

    if (timedCampaignStatus.active && timedCampaign.mode === "fixed_window") {
      return {
        allowed: true,
        reason: "active_timed_fixed_window",
        hasArenaAccess: false,
        freeGameplayCampaignAccess: null,
      };
    }

    if (timedCampaignStatus.active && timedCampaign.mode === "after_login") {
      const accessEndsAt = timedCampaignAccess?.endsAt
        ? new Date(timedCampaignAccess.endsAt)
        : null;
      const matchingCampaign =
        timedCampaignAccess?.campaignId &&
        timedCampaignAccess.campaignId === timedCampaign.campaignId;
      const activeEnrollment =
        matchingCampaign &&
        accessEndsAt &&
        !Number.isNaN(accessEndsAt.getTime()) &&
        !Number.isNaN(now.getTime()) &&
        now < accessEndsAt;

      if (activeEnrollment) {
        return {
          allowed: true,
          reason: "active_timed_after_login",
          hasArenaAccess: false,
          freeGameplayCampaignAccess: null,
          timedSoloAccessEndsAt: accessEndsAt.toISOString(),
        };
      }

      timedCampaignFailureReason = matchingCampaign
        ? "timed_after_login_expired"
        : "timed_after_login_not_enrolled";
    } else if (!timedCampaignStatus.active) {
      timedCampaignFailureReason = `timed_campaign_${
        timedCampaignStatus.state || "inactive"
      }`;
    }
  }

  const hasCompletedFreeVerdict = userHasCompletedFreeSoloVerdict(progression);

  if (
    !hasCompletedFreeVerdict &&
    caseWasCreatedUnderFreeGameplayCampaign(caseSession)
  ) {
    return {
      allowed: true,
      reason: "campaign_case_continuation",
      hasArenaAccess: false,
      freeGameplayCampaignAccess: caseSession.freeGameplayCampaignAccess,
    };
  }

  if (!hasCompletedFreeVerdict && campaignStatus.active) {
    return {
      allowed: true,
      reason: "active_free_campaign",
      hasArenaAccess: false,
      freeGameplayCampaignAccess:
        typeof buildCampaignGrant === "function"
          ? buildCampaignGrant(campaignStatus.campaign || {})
          : null,
    };
  }

  const trialState = soloTrial?.state || "available";
  const trialCaseId = String(soloTrial?.caseSessionId || "");
  const requestedCaseId = String(caseSession?._id || caseSession?.id || "");

  if (
    trialState === "active" &&
    trialCaseId &&
    requestedCaseId &&
    trialCaseId === requestedCaseId
  ) {
    return {
      allowed: true,
      reason: "evergreen_trial_continuation",
      hasArenaAccess: false,
      trialState,
      trialCaseId,
    };
  }

  if (trialState === "available" && action === "create") {
    return {
      allowed: true,
      reason: "evergreen_trial_available",
      hasArenaAccess: false,
      trialState,
      requiresTrialClaim: true,
    };
  }

  return {
    allowed: false,
    reason:
      timedCampaignFailureReason ||
      (hasCompletedFreeVerdict
        ? "free_verdict_completed"
        : `campaign_${campaignStatus.state || "inactive"}`),
    status: 403,
    message: FREE_GAMEPLAY_PAYWALL_MESSAGE,
    hasArenaAccess: false,
    upgradeRequired: true,
    trialState,
    trialCaseId,
  };
};
