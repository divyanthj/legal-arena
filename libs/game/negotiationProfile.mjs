export const NEGOTIATION_MODES = Object.freeze({
  CIVIL_SETTLEMENT: "civil_settlement",
  RESTITUTION: "restitution",
  PLEA: "plea",
  DIVERSION: "diversion",
  COOPERATION: "cooperation",
  UNAVAILABLE: "unavailable",
});

const MODE_DETAILS = Object.freeze({
  [NEGOTIATION_MODES.CIVIL_SETTLEMENT]: {
    available: true,
    actionLabel: "Settle",
    stageLabel: "Settlement",
    intentLabel: "Settlement Intent",
  },
  [NEGOTIATION_MODES.RESTITUTION]: {
    available: true,
    actionLabel: "Negotiate Compensation",
    stageLabel: "Compensation Talks",
    intentLabel: "Compensation Proposal",
  },
  [NEGOTIATION_MODES.PLEA]: {
    available: true,
    actionLabel: "Negotiate Plea",
    stageLabel: "Plea Talks",
    intentLabel: "Plea Proposal",
  },
  [NEGOTIATION_MODES.DIVERSION]: {
    available: true,
    actionLabel: "Explore Diversion",
    stageLabel: "Diversion Talks",
    intentLabel: "Diversion Proposal",
  },
  [NEGOTIATION_MODES.COOPERATION]: {
    available: true,
    actionLabel: "Propose Cooperation",
    stageLabel: "Cooperation Talks",
    intentLabel: "Cooperation Proposal",
  },
  [NEGOTIATION_MODES.UNAVAILABLE]: {
    available: false,
    actionLabel: "Negotiation Unavailable",
    stageLabel: "Negotiation Unavailable",
    intentLabel: "Negotiation Unavailable",
  },
});

const SEVERE_OFFENCE_PATTERN =
  /\b(murder|homicide|rape|sexual assault|terrorism|terrorist|genocide|war crime|human trafficking|child sexual abuse)\b/i;
const COOPERATION_PATTERN =
  /\b(cooperat(?:e|ion)|informant|turn state(?:'s)? evidence|testif(?:y|ies|ied)|witness protection|intelligence|undercover|spy for the state|assist the (?:state|prosecution|police))\b/i;
const DIVERSION_PATTERN =
  /\b(first[- ]time offender|juvenile|minor offence|minor offense|diversion|rehabilitation|community service|treatment program|drug possession)\b/i;
const RESTITUTION_PATTERN =
  /\b(assault|battery|hurt|injury|theft|shoplifting|property damage|damage|fraud|cheating|compensation|restitution|repay|payment|bill|fee|repair|refund)\b/i;

const cleanList = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 8);

const caseCorpus = (source = {}) => {
  const template = source.templateSnapshot || {};
  const dynamic = template.dynamicCase || source.dynamicCase || {};
  const premise = source.premise || {};
  const canonicalStory = source.canonicalStory || template.canonicalStory || {};

  return [
    source.title,
    source.practiceArea,
    premise.overview,
    premise.desiredRelief,
    premise.openingStatement,
    template.title,
    template.overview,
    template.desiredRelief,
    template.openingStatement,
    dynamic.coreDispute,
    dynamic.desiredRelief,
    dynamic.defendantObjective,
    dynamic.plaintiffStory,
    dynamic.defendantStory,
    canonicalStory.story,
    ...(Array.isArray(template.legalTags) ? template.legalTags : []),
    ...(Array.isArray(dynamic.legalIssues) ? dynamic.legalIssues : []),
  ]
    .filter(Boolean)
    .join(" ");
};

const explicitProfile = (source = {}) =>
  source.negotiationProfile ||
  source.templateSnapshot?.negotiationProfile ||
  source.templateSnapshot?.dynamicCase?.negotiationProfile ||
  source.dynamicCase?.negotiationProfile ||
  null;

const buildProfile = ({ mode, source = {}, blockedReason = "", derived = false }) => {
  const details = MODE_DETAILS[mode] || MODE_DETAILS[NEGOTIATION_MODES.UNAVAILABLE];
  const explicit = explicitProfile(source) || {};

  return {
    mode,
    ...details,
    blockedReason:
      blockedReason ||
      String(explicit.blockedReason || "").trim() ||
      (details.available ? "" : "This matter does not permit a negotiated resolution."),
    authorityLabel:
      String(explicit.authorityLabel || "").trim() ||
      (mode === NEGOTIATION_MODES.CIVIL_SETTLEMENT || mode === NEGOTIATION_MODES.RESTITUTION
        ? "Client authority"
        : "Client and prosecuting authority"),
    allowedTerms: cleanList(explicit.allowedTerms),
    derived,
  };
};

export const getNegotiationProfile = (source = {}) => {
  const corpus = caseCorpus(source);
  const criminal = source.primaryCategory === "criminal";
  const severe = criminal && SEVERE_OFFENCE_PATTERN.test(corpus);
  const cooperationSupported = COOPERATION_PATTERN.test(corpus);
  const explicit = explicitProfile(source);
  const explicitMode = String(explicit?.mode || "").trim();
  const knownExplicitMode = MODE_DETAILS[explicitMode] ? explicitMode : "";

  if (severe) {
    if (knownExplicitMode === NEGOTIATION_MODES.COOPERATION || cooperationSupported) {
      return buildProfile({ mode: NEGOTIATION_MODES.COOPERATION, source, derived: !knownExplicitMode });
    }

    return buildProfile({
      mode: NEGOTIATION_MODES.UNAVAILABLE,
      source,
      blockedReason:
        "This severe offence cannot be privately settled. A cooperation route appears only when the case record supports one.",
      derived: !knownExplicitMode,
    });
  }

  if (knownExplicitMode) {
    return buildProfile({ mode: knownExplicitMode, source });
  }

  if (!criminal) {
    return buildProfile({ mode: NEGOTIATION_MODES.CIVIL_SETTLEMENT, source, derived: true });
  }

  if (cooperationSupported) {
    return buildProfile({ mode: NEGOTIATION_MODES.COOPERATION, source, derived: true });
  }

  if (DIVERSION_PATTERN.test(corpus)) {
    return buildProfile({ mode: NEGOTIATION_MODES.DIVERSION, source, derived: true });
  }

  if (RESTITUTION_PATTERN.test(corpus)) {
    return buildProfile({ mode: NEGOTIATION_MODES.RESTITUTION, source, derived: true });
  }

  return buildProfile({ mode: NEGOTIATION_MODES.PLEA, source, derived: true });
};

export const canNegotiateResolution = (source = {}) => getNegotiationProfile(source).available;
