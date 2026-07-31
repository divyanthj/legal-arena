const cleanText = (value = "") => String(value || "").trim();

const listCount = (value) => (Array.isArray(value) ? value.filter(Boolean).length : 0);

const titleCase = (value = "") =>
  cleanText(value || "matter")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const representedPartyName = (caseSession = {}) => {
  if (cleanText(caseSession.playerPartyName)) return cleanText(caseSession.playerPartyName);

  const isOpponentSide = caseSession.playerSide === "opponent";
  const template = caseSession.template || caseSession.templateSnapshot || {};
  const plaintiff =
    cleanText(template.plaintiffName) ||
    cleanText(template.clientName) ||
    cleanText(caseSession.premise?.clientName);
  const defendant =
    cleanText(template.defendantName) ||
    cleanText(template.opponentName) ||
    cleanText(caseSession.premise?.opponentName);

  return (isOpponentSide ? defendant : plaintiff) || "your client";
};

const REPUTATION_FOCUS = {
  contracts: "commercial judgment",
  criminal: "courtroom advocacy",
  employment: "workplace advocacy",
  family: "client trust",
  housing: "housing advocacy",
  immigration: "high-stakes advocacy",
  injury: "evidence-led advocacy",
  property: "property advocacy",
  "public-law": "public-law advocacy",
  consumer: "consumer advocacy",
};

const STAKES_BY_CATEGORY = {
  contracts: "The result will test whether you can turn a disputed bargain into a precise commercial case.",
  criminal: "The result will test your control of evidence, credibility, and pressure in court.",
  employment: "The result will test whether you can make a contested workplace record feel coherent and fair.",
  family: "The client needs both sound judgment and an advocate who can keep a personal dispute focused.",
  housing: "The result will test whether you can separate everyday friction from legally significant facts.",
  immigration: "The client is relying on you to organize a high-stakes record without losing the human story.",
  injury: "The result will turn on whether you can connect harm, proof, and responsibility into one persuasive record.",
  property: "The result will test how well you can make documents, conduct, and competing claims fit together.",
  "public-law": "The result will test whether you can challenge official action with a disciplined record.",
  consumer: "The result will test whether you can translate an everyday dispute into a focused legal claim.",
};

export const getCareerChapter = (progression = {}) => {
  const completedCases = Math.max(0, Number(progression?.completedCases) || 0);
  const overallXp = Math.max(0, Number(progression?.overallXp) || 0);

  if (completedCases >= 30 || overallXp >= 7500) {
    return {
      number: 6,
      title: "A Practice of Your Own",
      roleTitle: "Leading Counsel",
      description: "Your docket now reflects a practice you have shaped through repeated choices and results.",
    };
  }
  if (completedCases >= 15 || overallXp >= 3750) {
    return {
      number: 5,
      title: "Counsel of Record",
      roleTitle: "Senior Advocate",
      description: "Clients bring you consequential matters because your record now carries weight.",
    };
  }
  if (completedCases >= 7 || overallXp >= 1750) {
    return {
      number: 4,
      title: "A Growing Reputation",
      roleTitle: "Established Counsel",
      description: "Your results are beginning to define what kind of advocate you are becoming.",
    };
  }
  if (completedCases >= 3 || overallXp >= 750) {
    return {
      number: 3,
      title: "Building a Practice",
      roleTitle: "Rising Advocate",
      description: "Each new file can deepen a specialty or broaden the practice carrying your name.",
    };
  }
  if (completedCases >= 1 || overallXp >= 250) {
    return {
      number: 2,
      title: "Finding Your Footing",
      roleTitle: "Junior Counsel",
      description: "Your early results are starting to shape the matters and clients that find you.",
    };
  }

  return {
    number: 1,
    title: "First Briefs",
    roleTitle: "Rookie Advocate",
    description: "Your first matters will establish the instincts and reputation of your new practice.",
  };
};

export const buildCaseCareerNarrative = ({
  caseSession = {},
  progression = {},
  continuationOfCaseId = null,
  continuationTeaserKey = "",
} = {}) => {
  const chapter = getCareerChapter(progression);
  const categorySlug = cleanText(caseSession.primaryCategory) || "general";
  const categoryTitle = titleCase(categorySlug);
  const clientName = representedPartyName(caseSession);
  const country =
    cleanText(caseSession.caseCountry?.name) ||
    cleanText(caseSession.legalJurisdiction?.countryName) ||
    "this jurisdiction";
  const isContinuation = Boolean(
    continuationOfCaseId ||
      continuationTeaserKey ||
      caseSession.continuationOfCaseId ||
      caseSession.continuationTeaserKey
  );
  const reputationFocus = REPUTATION_FOCUS[categorySlug] || "legal judgment";
  const origin = isContinuation
    ? `Your last result has brought another ${categoryTitle.toLowerCase()} referral to your desk. ${clientName} now needs you in ${country}.`
    : chapter.number === 1
      ? `${clientName} has placed one of the first matters carrying your name in your hands.`
      : `Your growing record has brought ${clientName}'s ${categoryTitle.toLowerCase()} matter to your desk in ${country}.`;
  const stakes =
    STAKES_BY_CATEGORY[categorySlug] ||
    "The result will test whether you can turn an uncertain record into a focused and persuasive case.";

  return {
    version: 1,
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
    roleTitle: chapter.roleTitle,
    categoryTitle,
    clientName,
    origin,
    stakes,
    reputationFocus,
    careerQuestion: `Can you turn this difficult record into a result that strengthens your reputation for ${reputationFocus}?`,
    continuation: isContinuation,
  };
};

export const normalizeCareerNarrative = (
  storedNarrative = null,
  caseSession = {},
  progression = {}
) => ({
  ...buildCaseCareerNarrative({ caseSession, progression }),
  ...(storedNarrative && typeof storedNarrative === "object" ? storedNarrative : {}),
});

export const buildCareerDevelopments = ({
  caseSession = {},
  factSheet = null,
  careerNarrative = null,
} = {}) => {
  const narrative = normalizeCareerNarrative(careerNarrative, caseSession);
  const visibleFactSheet = factSheet || caseSession.factSheet || {};
  const developments = [
    {
      key: "matter-opened",
      stage: "opening",
      title: "A new matter reaches your desk",
      body: narrative.origin,
    },
  ];

  if (listCount(visibleFactSheet.theory)) {
    developments.push({
      key: "theory-formed",
      stage: "intake",
      title: "A theory is taking shape",
      body: "Your questions have begun turning the client's account into a case you can explain and defend.",
    });
  }

  const supportingCount =
    listCount(visibleFactSheet.supportingFacts) +
    listCount(visibleFactSheet.corroboratedFacts) +
    listCount(visibleFactSheet.sourceLinks);
  if (supportingCount) {
    developments.push({
      key: "record-strengthened",
      stage: "intake",
      title: "The record has strengthened",
      body: `${supportingCount} supporting point${supportingCount === 1 ? " is" : "s are"} now available to carry into negotiation or court.`,
    });
  }

  const lawCount = listCount(
    caseSession.lockedApplicableLaws?.length
      ? caseSession.lockedApplicableLaws
      : caseSession.applicableLaws
  );
  if (lawCount) {
    developments.push({
      key: "law-path-clearer",
      stage: "intake",
      title: "The legal path is clearer",
      body: `${lawCount} ${caseSession.lawSource === "real" ? "actual-law provision" : "game rule"}${
        lawCount === 1 ? "" : "s"
      } now connect to points in the visible case file.`,
    });
  }

  const pressureCount =
    listCount(visibleFactSheet.risks) +
    listCount(visibleFactSheet.disputedFacts) +
    listCount(visibleFactSheet.missingEvidence);
  if (pressureCount) {
    developments.push({
      key: "pressure-point",
      stage: "intake",
      title: "A pressure point has emerged",
      body: `${pressureCount} contested or vulnerable point${pressureCount === 1 ? " needs" : "s need"} an answer before the record is tested.`,
    });
  }

  const settlementActive = Boolean(
    caseSession.status === "settlement" ||
      caseSession.settlement?.status === "active" ||
      caseSession.settlement?.status === "proposed"
  );
  if (settlementActive) {
    developments.push({
      key: "negotiation-opened",
      stage: "settlement",
      title: "The case has moved to negotiation",
      body: "The story you built during intake now has to support a deal your client can live with.",
    });
  }

  if (caseSession.status === "courtroom") {
    const roundsCompleted = Math.max(0, Number(caseSession.score?.roundsCompleted) || 0);
    developments.push({
      key: roundsCompleted ? "bench-focus" : "record-locked",
      stage: "courtroom",
      title: roundsCompleted ? "The bench has shifted focus" : "The record is locked for court",
      body:
        (roundsCompleted && cleanText(caseSession.score?.lastBenchSignal)) ||
        "Your intake choices now define the facts and law available for the hearing.",
    });
  }

  return developments;
};

export const buildResolutionAftermath = ({ caseSession = {} } = {}) => {
  const isSettled = Boolean(
    caseSession.status === "settled" ||
      caseSession.settlement?.accepted === true ||
      caseSession.settlement?.status === "settled" ||
      caseSession.settlement?.resolution === "settled"
  );
  const winner = cleanText(caseSession.verdict?.winner);
  if (!isSettled && caseSession.status !== "verdict" && !winner) return null;

  const clientName = representedPartyName(caseSession);
  const narrative = normalizeCareerNarrative(caseSession.careerNarrative, caseSession);

  if (isSettled) {
    return {
      outcome: "settlement",
      eyebrow: "Career aftermath",
      title: "A negotiated result becomes part of your record",
      clientResponse: `${clientName} leaves with a definite outcome instead of an uncertain ruling.`,
      careerImpact: `The matter strengthens your reputation for practical judgment and gives your ${narrative.reputationFocus} practice another completed file.`,
      nextLead: "A new client may now arrive because you found a workable ending under pressure.",
      tone: "emerald",
    };
  }

  if (winner === "player") {
    return {
      outcome: "win",
      eyebrow: "Career aftermath",
      title: "The result carries beyond this courtroom",
      clientResponse: `${clientName} leaves with the result you were retained to pursue.`,
      careerImpact: `The win strengthens your reputation for ${narrative.reputationFocus} and makes a harder referral feel earned.`,
      nextLead: "Your result has put another prospective client in reach.",
      tone: "emerald",
    };
  }

  if (winner === "opponent") {
    return {
      outcome: "loss",
      eyebrow: "Career aftermath",
      title: "The ruling leaves a lesson on your record",
      clientResponse: `${clientName} did not get the result hoped for, and the weak point identified by the court now matters.`,
      careerImpact: `The loss adds hard-earned experience to your ${narrative.reputationFocus} practice and shows what the next case must improve.`,
      nextLead: "The next file is a chance to answer the weakness this ruling exposed.",
      tone: "rose",
    };
  }

  return {
    outcome: "draw",
    eyebrow: "Career aftermath",
    title: "A close result leaves your reputation unsettled",
    clientResponse: `${clientName}'s matter ends without either side fully controlling the outcome.`,
    careerImpact: `The result adds experience but leaves your reputation for ${narrative.reputationFocus} open to definition by the next case.`,
    nextLead: "Another contested matter can turn this narrow result into momentum.",
    tone: "amber",
  };
};

export const buildNextCaseCareerBridge = ({
  caseSession = {},
  aftermath = null,
  teaser = null,
  recommendation = null,
} = {}) => {
  const resolvedAftermath = aftermath || buildResolutionAftermath({ caseSession });
  const nextMatter = cleanText(teaser?.headline);
  const lead =
    resolvedAftermath?.nextLead ||
    "Your completed matter has opened the door to another client and another test.";
  const destination = nextMatter ? ` The new file: ${nextMatter}.` : "";
  const direction =
    recommendation?.kind === "broaden"
      ? " It gives your growing practice a new area to prove itself in."
      : recommendation?.kind === "level_up"
        ? " It raises the stakes in an area where your record is already growing."
        : "";

  return `${lead}${destination}${direction}`.trim();
};
