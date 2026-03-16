import "server-only";

import { requestStructuredCompletion } from "@/libs/gpt";
import { getLawbookRules } from "@/data/legalArenaLawbook";

const uniqueList = (items = []) =>
  [...new Set(items.filter(Boolean).map((item) => item.trim()).filter(Boolean))];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const tokenize = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);

const humanizeClaimText = (value = "") => {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  return text
    .replace(/\bfrom the modeled claims\b/gi, "")
    .replace(/\bmodeled claims\b/gi, "what I remember")
    .replace(/\bclient account pending refinement\b/gi, "I need to explain that more clearly")
    .replace(/\bopponent disputes the client's framing\b/gi, "they're going to dispute my side of it")
    .replace(/\bthe client\b/gi, "I")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
};

const toSpokenSentence = (value = "") => {
  const text = humanizeClaimText(value);
  if (!text) {
    return "";
  }

  return text.charAt(0).toLowerCase() + text.slice(1);
};

const getTemplate = (caseSession) =>
  caseSession.caseTemplateId?.toJSON
    ? caseSession.caseTemplateId.toJSON()
    : caseSession.caseTemplateId;

const ensureTemplate = (template) => ({
  canonicalFacts: [],
  evidenceItems: [],
  legalTags: [],
  overview: "",
  starterTheory: "",
  desiredRelief: "",
  clientName: "Client",
  opponentName: "Opponent",
  title: "Case",
  ...(template || {}),
});

const getClaimId = (factId, party) => `${party}:${factId}`;

const getClaimForParty = (fact, party) =>
  (fact.claims || []).find((claim) => claim.party === party) || null;

const buildOpenQuestions = (template, excludedFactIds = []) =>
  (ensureTemplate(template).canonicalFacts || [])
    .filter((fact) => !excludedFactIds.includes(fact.factId))
    .slice()
    .sort(
      (left, right) =>
        (right.discoverability?.priority || 0) - (left.discoverability?.priority || 0)
    )
    .slice(0, 3)
    .map((fact) => fact.label);

const mergeFactSheet = (current, patch, template) => {
  const safeTemplate = ensureTemplate(template);
  const next = {
    ...current,
    summary: patch.summary?.trim() || current.summary || safeTemplate.overview,
    timeline: uniqueList([...(current.timeline || []), ...(patch.timeline || [])]),
    supportingFacts: uniqueList([
      ...(current.supportingFacts || []),
      ...(patch.supportingFacts || []),
    ]),
    risks: uniqueList([...(current.risks || []), ...(patch.risks || [])]),
    theory: patch.theory?.trim() || current.theory || safeTemplate.starterTheory,
    desiredRelief:
      patch.desiredRelief?.trim() ||
      current.desiredRelief ||
      safeTemplate.desiredRelief,
    openQuestions: uniqueList(
      patch.openQuestions || current.openQuestions || buildOpenQuestions(safeTemplate)
    ),
    knownFacts: uniqueList([...(current.knownFacts || []), ...(patch.knownFacts || [])]),
    knownClaims: uniqueList([
      ...(current.knownClaims || []),
      ...(patch.knownClaims || []),
    ]),
    disputedFacts: uniqueList([
      ...(current.disputedFacts || []),
      ...(patch.disputedFacts || []),
    ]),
    corroboratedFacts: uniqueList([
      ...(current.corroboratedFacts || []),
      ...(patch.corroboratedFacts || []),
    ]),
    sourceLinks: uniqueList([
      ...(current.sourceLinks || []),
      ...(patch.sourceLinks || []),
    ]),
    discoveredFactIds: uniqueList([
      ...(current.discoveredFactIds || []),
      ...(patch.discoveredFactIds || []),
    ]),
    discoveredClaimIds: uniqueList([
      ...(current.discoveredClaimIds || []),
      ...(patch.discoveredClaimIds || []),
    ]),
  };

  next.ready =
    Boolean(next.summary && next.theory && next.desiredRelief) &&
    next.timeline.length >= 1 &&
    (next.supportingFacts.length >= 2 || next.corroboratedFacts.length >= 1);

  return next;
};

const scoreFactForQuestion = (fact, question) => {
  const questionTokens = tokenize(question);
  const keywords = uniqueList([
    ...(fact.discoverability?.keywords || []),
    ...((fact.claims || []).flatMap((claim) => claim.keywords || [])),
  ]);
  const searchableTokens = uniqueList([
    ...keywords.flatMap((keyword) => tokenize(keyword)),
    ...tokenize(fact.label),
    ...tokenize(fact.canonicalDetail),
    ...((fact.claims || []).flatMap((claim) => tokenize(claim.claimedDetail))),
  ]);

  const exactMatchCount = searchableTokens.filter((token) =>
    questionTokens.includes(token)
  ).length;
  const partialMatchCount = searchableTokens.filter((token) =>
    question.toLowerCase().includes(token)
  ).length;

  return exactMatchCount * 2 + partialMatchCount * 0.5 + (fact.discoverability?.priority || 0) / 10;
};

const pickRelevantFacts = (template, question, discoveredFactIds = []) => {
  const safeTemplate = ensureTemplate(template);
  const availableFacts = (safeTemplate.canonicalFacts || []).filter(
    (fact) =>
      fact.discoverability?.phase !== "courtroom" &&
      !discoveredFactIds.includes(fact.factId)
  );

  const ranked = availableFacts
    .map((fact) => ({
      fact,
      score: scoreFactForQuestion(fact, question),
    }))
    .sort((left, right) => right.score - left.score);

  const matched = ranked.filter((entry) => entry.score > 0).map((entry) => entry.fact);

  if (matched.length > 0) {
    return matched.slice(0, 2);
  }

  return availableFacts
    .slice()
    .sort(
      (left, right) =>
        (right.discoverability?.priority || 0) - (left.discoverability?.priority || 0)
    )
    .slice(0, 2);
};

const buildInterviewFallback = ({ template, question, factSheet }) => {
  const safeTemplate = ensureTemplate(template);
  const matchedFacts = pickRelevantFacts(
    safeTemplate,
    question,
    factSheet.discoveredFactIds
  );

  const clientClaims = matchedFacts
    .map((fact) => ({
      fact,
      clientClaim: getClaimForParty(fact, "client"),
      opponentClaim: getClaimForParty(fact, "opponent"),
    }))
    .filter((item) => item.clientClaim);

  const remainingFacts = (safeTemplate.canonicalFacts || []).filter(
    (fact) => !factSheet.discoveredFactIds.includes(fact.factId)
  );
  const leadQuestion = buildOpenQuestions(safeTemplate, factSheet.discoveredFactIds)[0];
  const lastKnownClaim = (factSheet.knownClaims || []).slice(-1)[0];

  const clientResponse =
    clientClaims.length > 0
      ? clientClaims
          .map((item, index) =>
            index === 0
              ? `From my side, ${toSpokenSentence(item.clientClaim.claimedDetail)}`
              : `Also, ${toSpokenSentence(item.clientClaim.claimedDetail)}`
          )
          .join(" ")
      : remainingFacts.length === 0
      ? lastKnownClaim
        ? `That's still my position. The clearest point I can give you is that ${toSpokenSentence(lastKnownClaim)}`
        : "I think we've covered the main facts from my side. We may need to lean on the documents and weak spots now."
      : leadQuestion
      ? `I'm not sure I can answer that directly yet. It may help if you ask me about ${leadQuestion.charAt(0).toLowerCase()}${leadQuestion.slice(1)}`
      : "I may be mixing up the details. Ask me about the timeline, the records, or what the other side might challenge.";

  const patch = {
    summary: `${safeTemplate.overview} ${safeTemplate.clientName} wants relief and is building the strongest client-side record available.`,
    timeline: clientClaims
      .filter((item) => item.fact.kind === "timeline")
      .map((item) => humanizeClaimText(item.clientClaim.claimedDetail)),
    supportingFacts: clientClaims
      .filter((item) => item.fact.kind === "supporting")
      .map((item) => humanizeClaimText(item.clientClaim.claimedDetail)),
    risks: clientClaims
      .filter((item) => item.fact.kind === "risk")
      .map((item) => humanizeClaimText(item.clientClaim.claimedDetail)),
    theory: safeTemplate.starterTheory,
    desiredRelief: safeTemplate.desiredRelief,
    knownFacts: clientClaims
      .filter((item) => item.fact.truthStatus === "verified" && item.fact.evidenceRefs?.length)
      .map((item) => item.fact.canonicalDetail),
    knownClaims: clientClaims.map((item) =>
      humanizeClaimText(item.clientClaim.claimedDetail)
    ),
    disputedFacts: clientClaims
      .filter(
        (item) =>
          item.opponentClaim &&
          item.opponentClaim.claimedDetail !== item.clientClaim.claimedDetail
      )
      .map((item) => item.opponentClaim.claimedDetail),
    corroboratedFacts: clientClaims
      .filter(
        (item) =>
          item.fact.truthStatus === "verified" &&
          item.clientClaim.stance === "admits" &&
          item.fact.evidenceRefs?.length
      )
      .map((item) => item.fact.canonicalDetail),
    sourceLinks: clientClaims.flatMap((item) =>
      (item.fact.evidenceRefs || []).map((ref) => `${item.fact.label}: ${ref}`)
    ),
    openQuestions: buildOpenQuestions(
      safeTemplate,
      uniqueList([
        ...factSheet.discoveredFactIds,
        ...clientClaims.map((item) => item.fact.factId),
      ])
    ),
    discoveredFactIds: clientClaims.map((item) => item.fact.factId),
    discoveredClaimIds: clientClaims.map((item) =>
      getClaimId(item.fact.factId, "client")
    ),
  };

  const nextFactSheet = mergeFactSheet(factSheet, patch, safeTemplate);

  return {
    clientResponse,
    patch,
    nextFactSheet,
    relatedFactIds: clientClaims.map((item) => item.fact.factId),
    discoveredClaimIds: patch.discoveredClaimIds,
  };
};

const normalizeInterviewResult = ({ aiResult, fallback, template }) => {
  const safeTemplate = ensureTemplate(template);
  if (!aiResult || typeof aiResult !== "object") {
    return fallback;
  }

  const patch = {
    summary: aiResult.summary || fallback.patch.summary,
    timeline: Array.isArray(aiResult.timeline)
      ? aiResult.timeline
      : fallback.patch.timeline,
    supportingFacts: Array.isArray(aiResult.supportingFacts)
      ? aiResult.supportingFacts
      : fallback.patch.supportingFacts,
    risks: Array.isArray(aiResult.risks) ? aiResult.risks : fallback.patch.risks,
    theory: aiResult.theory || fallback.patch.theory || safeTemplate.starterTheory,
    desiredRelief:
      aiResult.desiredRelief ||
      fallback.patch.desiredRelief ||
      safeTemplate.desiredRelief,
    knownFacts: Array.isArray(aiResult.knownFacts)
      ? aiResult.knownFacts
      : fallback.patch.knownFacts,
    knownClaims: Array.isArray(aiResult.knownClaims)
      ? aiResult.knownClaims
      : fallback.patch.knownClaims,
    disputedFacts: Array.isArray(aiResult.disputedFacts)
      ? aiResult.disputedFacts
      : fallback.patch.disputedFacts,
    corroboratedFacts: Array.isArray(aiResult.corroboratedFacts)
      ? aiResult.corroboratedFacts
      : fallback.patch.corroboratedFacts,
    sourceLinks: Array.isArray(aiResult.sourceLinks)
      ? aiResult.sourceLinks
      : fallback.patch.sourceLinks,
    openQuestions: Array.isArray(aiResult.openQuestions)
      ? aiResult.openQuestions
      : fallback.patch.openQuestions,
    discoveredFactIds: Array.isArray(aiResult.discoveredFactIds)
      ? aiResult.discoveredFactIds
      : fallback.patch.discoveredFactIds,
    discoveredClaimIds: Array.isArray(aiResult.discoveredClaimIds)
      ? aiResult.discoveredClaimIds
      : fallback.patch.discoveredClaimIds,
  };

  return {
    clientResponse: aiResult.clientResponse || fallback.clientResponse,
    patch,
    nextFactSheet: mergeFactSheet(fallback.nextFactSheet, patch, safeTemplate),
    relatedFactIds:
      Array.isArray(aiResult.relatedFactIds) && aiResult.relatedFactIds.length > 0
        ? aiResult.relatedFactIds
        : fallback.relatedFactIds,
    discoveredClaimIds:
      Array.isArray(aiResult.discoveredClaimIds) &&
      aiResult.discoveredClaimIds.length > 0
        ? aiResult.discoveredClaimIds
        : fallback.discoveredClaimIds,
  };
};

const pickFactMentions = (argument, factSheet) => {
  const lowerArgument = argument.toLowerCase();

  return uniqueList(
    [
      ...(factSheet.supportingFacts || []),
      ...(factSheet.timeline || []),
      ...(factSheet.corroboratedFacts || []),
      ...(factSheet.knownFacts || []),
    ].filter((fact) => {
      const tokens = fact
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 4);

      return tokens.some((token) => lowerArgument.includes(token));
    })
  ).slice(0, 4);
};

const pickRuleMentions = (argument, rules) => {
  const lowerArgument = argument.toLowerCase();

  return rules
    .filter((rule) => {
      const titleTokens = rule.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 4);

      return (
        titleTokens.some((token) => lowerArgument.includes(token)) ||
        lowerArgument.includes(rule.id.replace(/-/g, " "))
      );
    })
    .map((rule) => rule.id)
    .slice(0, 3);
};

const pickClaimMentions = (argument, factSheet) => {
  const lowerArgument = argument.toLowerCase();

  return uniqueList(
    (factSheet.knownClaims || []).filter((claim) => {
      const tokens = claim
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 4);

      return tokens.some((token) => lowerArgument.includes(token));
    })
  ).slice(0, 3);
};

const buildCourtroomFallback = ({ caseSession, argument, rules, template }) => {
  const safeTemplate = ensureTemplate(template);
  const citedFacts = pickFactMentions(argument, caseSession.factSheet);
  const citedRules = pickRuleMentions(argument, rules);
  const citedClaims = pickClaimMentions(argument, caseSession.factSheet);
  const lowerArgument = argument.toLowerCase();

  const addressesRisk = (caseSession.factSheet.risks || []).some((risk) =>
    risk
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 4)
      .some((token) => lowerArgument.includes(token))
  );

  const addressesDispute = (caseSession.factSheet.disputedFacts || []).some((dispute) =>
    dispute
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 4)
      .some((token) => lowerArgument.includes(token))
  );

  const corroboratedHits = (caseSession.factSheet.corroboratedFacts || []).filter(
    (fact) => citedFacts.includes(fact)
  ).length;

  const playerDelta = clamp(
    4 +
      corroboratedHits * 4 +
      (citedFacts.length - corroboratedHits) * 2 +
      citedRules.length * 4 +
      citedClaims.length * 1 +
      (addressesRisk ? 2 : 0) +
      (addressesDispute ? 3 : 0) +
      (argument.length > 240 ? 2 : 0),
    4,
    20
  );

  const unresolvedDisputes = clamp(
    (caseSession.factSheet.disputedFacts || []).length - (addressesDispute ? 1 : 0),
    0,
    3
  );
  const unresolvedRisks = clamp(
    (caseSession.factSheet.risks || []).length - (addressesRisk ? 1 : 0),
    0,
    3
  );
  const opponentDelta = clamp(
    5 +
      unresolvedDisputes * 3 +
      unresolvedRisks * 2 +
      (citedRules.length === 0 ? 2 : 0),
    4,
    18
  );

  const templateFacts = safeTemplate.canonicalFacts || [];
  const pressureFact =
    templateFacts[caseSession.score.roundsCompleted % templateFacts.length] || null;
  const opponentClaim = pressureFact ? getClaimForParty(pressureFact, "opponent") : null;

  const opponentResponse = opponentClaim
    ? `Counsel for ${safeTemplate.opponentName} argues that ${opponentClaim.claimedDetail.charAt(0).toLowerCase()}${opponentClaim.claimedDetail.slice(
        1
      )}. They say the player's presentation leans too heavily on the client's version instead of settled proof.`
    : `Counsel for ${safeTemplate.opponentName} argues that the player's record is too thin and the disputed facts cut against relief.`;

  const strengths = uniqueList([
    corroboratedHits > 0
      ? `You leaned on corroborated proof, not only client narrative.`
      : "",
    citedFacts[0] ? `You grounded the argument in a concrete fact: ${citedFacts[0]}` : "",
    citedRules[0] ? `You tied the argument to ${citedRules[0]}.` : "",
    addressesDispute ? "You directly confronted a disputed defense framing." : "",
  ]).slice(0, 3);

  const weaknesses = uniqueList([
    citedRules.length === 0 ? "The argument did not clearly anchor itself to a lawbook rule." : "",
    !addressesRisk && caseSession.factSheet.risks[0]
      ? `A visible weakness remains unaddressed: ${caseSession.factSheet.risks[0]}`
      : "",
    !addressesDispute && caseSession.factSheet.disputedFacts[0]
      ? `You did not directly answer a live dispute: ${caseSession.factSheet.disputedFacts[0]}`
      : "",
    citedFacts.length === 0 ? "The bench still needs a more specific fact from the case file." : "",
  ]).slice(0, 3);

  const benchSignal =
    playerDelta >= opponentDelta
      ? "The judge seems to trust arguments more when they rest on corroborated facts rather than raw client statements."
      : "The judge appears concerned that the defense still has room to reframe the disputed record.";

  return {
    opponentResponse,
    playerDelta,
    opponentDelta,
    citedFacts,
    citedRules,
    citedClaimIds: citedClaims.slice(0, 3),
    strengths,
    weaknesses,
    benchSignal,
  };
};

const buildVerdictFallback = ({ updatedScore, rules, factSheet, template }) => {
  const safeTemplate = ensureTemplate(template);
  const winner =
    updatedScore.player === updatedScore.opponent
      ? "draw"
      : updatedScore.player > updatedScore.opponent
      ? "player"
      : "opponent";

  const ruleLabel = rules[0]?.title || "the lawbook";
  const summary =
    winner === "player"
      ? `The court finds for ${safeTemplate.clientName}, concluding that the stronger corroborated record and better handling of disputed facts support relief.`
      : winner === "opponent"
      ? `The court finds for ${safeTemplate.opponentName}, concluding that the player's showing relied too heavily on unresolved client-side claims.`
      : "The court finds the record too closely balanced and declines to separate the parties decisively.";

  return {
    winner,
    summary,
    highlights: uniqueList([
      factSheet.corroboratedFacts[0] || factSheet.supportingFacts[0] || "",
      `The court relied heavily on ${ruleLabel}.`,
      updatedScore.highlights?.[0] || "",
    ]).slice(0, 3),
    concerns: uniqueList([
      factSheet.risks[0] || "",
      factSheet.disputedFacts[0] || "",
      updatedScore.weaknesses?.[0] || "",
    ]).slice(0, 3),
  };
};

const normalizeCourtResult = ({
  aiResult,
  fallback,
  shouldReturnVerdict,
  caseSession,
  rules,
  template,
}) => {
  const fallbackVerdict = shouldReturnVerdict
    ? buildVerdictFallback({
        updatedScore: {
          player: caseSession.score.player + fallback.playerDelta,
          opponent: caseSession.score.opponent + fallback.opponentDelta,
          highlights: fallback.strengths,
          weaknesses: fallback.weaknesses,
        },
        rules,
        factSheet: caseSession.factSheet,
        template,
      })
    : null;

  if (!aiResult || typeof aiResult !== "object") {
    return {
      ...fallback,
      verdict: fallbackVerdict,
    };
  }

  const normalized = {
    opponentResponse: aiResult.opponentResponse || fallback.opponentResponse,
    playerDelta:
      typeof aiResult.playerDelta === "number"
        ? clamp(aiResult.playerDelta, 1, 20)
        : fallback.playerDelta,
    opponentDelta:
      typeof aiResult.opponentDelta === "number"
        ? clamp(aiResult.opponentDelta, 1, 20)
        : fallback.opponentDelta,
    citedFacts: Array.isArray(aiResult.citedFacts)
      ? aiResult.citedFacts
      : fallback.citedFacts,
    citedRules: Array.isArray(aiResult.citedRules)
      ? aiResult.citedRules
      : fallback.citedRules,
    citedClaimIds: Array.isArray(aiResult.citedClaimIds)
      ? aiResult.citedClaimIds
      : fallback.citedClaimIds,
    strengths: Array.isArray(aiResult.strengths)
      ? aiResult.strengths
      : fallback.strengths,
    weaknesses: Array.isArray(aiResult.weaknesses)
      ? aiResult.weaknesses
      : fallback.weaknesses,
    benchSignal: aiResult.benchSignal || fallback.benchSignal,
  };

  if (!shouldReturnVerdict) {
    return {
      ...normalized,
      verdict: null,
    };
  }

  return {
    ...normalized,
    verdict:
      aiResult.verdict && typeof aiResult.verdict === "object"
        ? {
            winner: aiResult.verdict.winner || fallbackVerdict?.winner || "draw",
            summary: aiResult.verdict.summary || fallbackVerdict?.summary || "",
            highlights: Array.isArray(aiResult.verdict.highlights)
              ? aiResult.verdict.highlights
              : fallbackVerdict?.highlights || [],
            concerns: Array.isArray(aiResult.verdict.concerns)
              ? aiResult.verdict.concerns
              : fallbackVerdict?.concerns || [],
          }
        : fallbackVerdict,
  };
};

export const continueInterview = async ({ caseSession, question, userId }) => {
  const template = ensureTemplate(getTemplate(caseSession));
  const fallback = buildInterviewFallback({
    template,
    question,
    factSheet: caseSession.factSheet,
  });

  const aiResult = await requestStructuredCompletion({
    userId,
    temperature: 0.4,
    maxTokens: 1100,
    systemPrompt:
      "You are roleplaying a legal-game client speaking to the player's lawyer. Stay grounded in the provided claim layer and canonical fact layer, never invent unsupported facts or evidence, and output only valid JSON.",
    userPrompt: JSON.stringify({
      task: "Answer the lawyer's latest question as the client using only the client-side claims that are modeled for the case, then update the structured knowledge sheet.",
      caseTemplate: {
        title: template.title,
        clientName: template.clientName,
        opponentName: template.opponentName,
        overview: template.overview,
        desiredRelief: template.desiredRelief,
        canonicalFacts: template.canonicalFacts,
        evidenceItems: template.evidenceItems,
      },
      currentFactSheet: caseSession.factSheet,
      recentTranscript: caseSession.interviewTranscript.slice(-6),
      latestQuestion: question,
      outputSchema: {
        clientResponse: "string",
        summary: "string",
        timeline: ["string"],
        supportingFacts: ["string"],
        risks: ["string"],
        theory: "string",
        desiredRelief: "string",
        knownFacts: ["string"],
        knownClaims: ["string"],
        disputedFacts: ["string"],
        corroboratedFacts: ["string"],
        sourceLinks: ["string"],
        openQuestions: ["string"],
        discoveredFactIds: ["string"],
        discoveredClaimIds: ["string"],
        relatedFactIds: ["string"],
      },
    }),
  });

  return normalizeInterviewResult({ aiResult, fallback, template });
};

export const runCourtroomRound = async ({ caseSession, argument, userId }) => {
  const template = ensureTemplate(getTemplate(caseSession));
  const rules = getLawbookRules(template.legalTags);
  const shouldReturnVerdict =
    caseSession.score.roundsCompleted + 1 >= caseSession.maxCourtRounds;

  const fallback = buildCourtroomFallback({
    caseSession,
    argument,
    rules,
    template,
  });

  const aiResult = await requestStructuredCompletion({
    userId,
    temperature: 0.5,
    maxTokens: 1200,
    systemPrompt:
      "You are running a courtroom game turn. Produce JSON only. Keep the opponent grounded in the opponent claim layer and hidden case truth, while scoring the player's use of corroborated facts, dispute handling, and lawbook support.",
    userPrompt: JSON.stringify({
      task: shouldReturnVerdict
        ? "Generate the opponent lawyer response, hidden bench scoring, and a final verdict."
        : "Generate the opponent lawyer response and hidden bench scoring for this round.",
      caseTemplate: template,
      lawbookRules: rules,
      factSheet: caseSession.factSheet,
      score: caseSession.score,
      courtroomTranscript: caseSession.courtroomTranscript.slice(-6),
      latestPlayerArgument: argument,
      outputSchema: {
        opponentResponse: "string",
        playerDelta: "number",
        opponentDelta: "number",
        citedFacts: ["string"],
        citedRules: ["string"],
        citedClaimIds: ["string"],
        strengths: ["string"],
        weaknesses: ["string"],
        benchSignal: "string",
        verdict: shouldReturnVerdict
          ? {
              winner: "player|opponent|draw",
              summary: "string",
              highlights: ["string"],
              concerns: ["string"],
            }
          : null,
      },
    }),
  });

  return normalizeCourtResult({
    aiResult,
    fallback,
    shouldReturnVerdict,
    caseSession,
    rules,
    template,
  });
};

export const finalizeFactSheetInput = ({ factSheet, caseTemplate }) => {
  const template = ensureTemplate(
    caseTemplate?.toJSON ? caseTemplate.toJSON() : caseTemplate
  );
  const normalized = mergeFactSheet(
    {
      summary: "",
      timeline: [],
      supportingFacts: [],
      risks: [],
      theory: "",
      desiredRelief: "",
      openQuestions: [],
      knownFacts: [],
      knownClaims: [],
      disputedFacts: [],
      corroboratedFacts: [],
      sourceLinks: [],
      discoveredFactIds: [],
      discoveredClaimIds: [],
      ready: false,
    },
    factSheet,
    template
  );

  const missing = [];

  if (!normalized.summary) {
    missing.push("summary");
  }
  if (!normalized.theory) {
    missing.push("case theory");
  }
  if (!normalized.timeline.length) {
    missing.push("at least one timeline point");
  }
  if (
    normalized.supportingFacts.length < 2 &&
    normalized.corroboratedFacts.length < 1
  ) {
    missing.push("at least two supporting facts or one corroborated fact");
  }
  if (!normalized.desiredRelief) {
    missing.push("requested relief");
  }
  if (
    (normalized.risks.length === 0 && normalized.disputedFacts.length === 0) &&
    (template?.canonicalFacts || []).some((fact) => fact.kind === "risk" || fact.kind === "dispute")
  ) {
    missing.push("at least one identified dispute or risk");
  }

  return {
    factSheet: {
      ...normalized,
      ready: missing.length === 0,
    },
    missing,
  };
};
