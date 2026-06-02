export const FREE_GAMEPLAY_PAYWALL_MESSAGE =
  "Legal Arena is still in development. Access is currently limited.";

export const caseWasCreatedUnderFreeGameplayCampaign = (caseSession) =>
  Boolean(caseSession?.freeGameplayCampaignAccess?.grantedAt);

export const userHasCompletedFreeSoloVerdict = (userOrProgression) => {
  const progression = userOrProgression?.progression || userOrProgression || {};
  return (progression.completedCases || 0) >= 1;
};

export const resolveSoloGameplayAccessDecision = ({
  signedIn = true,
  hasFullAccess = false,
  progression = {},
  campaignStatus = { active: false, state: "inactive", campaign: {} },
  caseSession = null,
  action = "play",
  buildCampaignGrant = null,
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
    };
  }

  if (action === "read" && caseSession?.status === "verdict") {
    return {
      allowed: true,
      reason: "completed_verdict_read",
      hasArenaAccess: false,
      readOnly: true,
    };
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

  return {
    allowed: false,
    reason: hasCompletedFreeVerdict
      ? "free_verdict_completed"
      : `campaign_${campaignStatus.state || "inactive"}`,
    status: 403,
    message: FREE_GAMEPLAY_PAYWALL_MESSAGE,
    hasArenaAccess: false,
  };
};
