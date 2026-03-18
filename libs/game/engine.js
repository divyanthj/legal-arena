import "server-only";

import { requestStructuredCompletion } from "@/libs/gpt";
import { getLawbookRules } from "@/data/legalArenaLawbook";
import {
  buildMissingEvidenceNotesForSide,
  buildSuggestedQuestionsForSide,
  cleanPartyClaimText,
  enrichTemplateForGameplay,
  getEvidenceItemsForFact,
  isFactCorroborated,
} from "./templateInterview";

const uniqueList = (items = []) =>
  [...new Set(items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const DEFAULT_PLAYER_SIDE = "client";
const OPPOSING_SIDE = {
  client: "opponent",
  opponent: "client",
};
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
    .replace(/\bmodelled claims\b/gi, "what I remember")
    .replace(/\bclient account pending refinement\b/gi, "I need to explain that more clearly")
    .replace(
      /\bthe opponent would use this point to challenge the client's credibility:\s*/gi,
      ""
    )
    .replace(
      /\bthe opponent is likely to minimize the importance of this event or frame it differently:\s*/gi,
      ""
    )
    .replace(/\bopponent disputes the client's framing\b/gi, "they're going to dispute my side of it")
    .replace(/\bI don't have (a|any) (modeled|modelled) claim here\b/gi, "I do not remember the exact detail")
    .replace(/\bthe client\b/gi, "I")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
};

const stripClaimScaffolding = (value = "") =>
  cleanPartyClaimText(
    String(value || "")
      .trim()
      .replace(/\bfrom the modeled claims\b/gi, "")
      .replace(/\bmodeled claims\b/gi, "what I remember")
      .replace(/\bmodelled claims\b/gi, "what I remember")
      .replace(/\bclient account pending refinement\b/gi, "I need to explain that more clearly")
      .replace(/\bI don't have (a|any) (modeled|modelled) claim here\b/gi, "I do not remember the exact detail")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+\./g, ".")
  );

const isMetaResponse = (value = "") => {
  const text = String(value || "").trim().toLowerCase();

  if (!text) {
    return true;
  }

  return [
    "modeled claim",
    "modelled claim",
    "pending refinement",
    "schema",
    "exact words",
    "i don't have a modeled claim",
    "i dont have a modeled claim",
    "i don't have any modeled claim",
    "i dont have any modeled claim",
  ].some((pattern) => text.includes(pattern));
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
  interviewBlueprint: {},
  legalTags: [],
  overview: "",
  starterTheory: "",
  desiredRelief: "",
  clientName: "Client",
  opponentName: "Opponent",
  title: "Case",
  ...enrichTemplateForGameplay(template || {}),
});

const getClaimId = (factId, party) => `${party}:${factId}`;

const getClaimForParty = (fact, party) =>
  (fact.claims || []).find((claim) => claim.party === party) || null;

const getPlayerSide = (caseSession) =>
  caseSession?.playerSide === "opponent" ? "opponent" : DEFAULT_PLAYER_SIDE;

const getOpposingSide = (side) => OPPOSING_SIDE[side] || DEFAULT_PLAYER_SIDE;

const getPartyName = (template, side) =>
  side === "opponent" ? template.opponentName : template.clientName;

const buildDesiredReliefForSide = (template, side) =>
  side === "client"
    ? template.desiredRelief
    : `Deny or materially reduce ${template.clientName}'s requested relief.`;

const buildTheoryForSide = (template, side) =>
  side === "client"
    ? template.starterTheory
    : `${template.opponentName} should prevail because the record leaves enough dispute, credibility pressure, or proof gaps to defeat ${template.clientName}'s request for relief.`;

const buildOverviewForSide = (template, side) => {
  if (side === "client") {
    return template.overview;
  }

  const requestedRelief = String(template.desiredRelief || "").trim();

  return requestedRelief
    ? `${template.opponentName} is defending against ${template.clientName}'s request for ${requestedRelief.charAt(0).toLowerCase()}${requestedRelief.slice(
        1
      )}`
    : `${template.opponentName} is defending against ${template.clientName}'s claims in ${template.courtName}.`;
};

const buildSummaryForSide = (template, side) => {
  const playerPartyName = getPartyName(template, side);
  const sideLabel = side === "client" ? "claimant-side" : "defense-side";

  return `${buildOverviewForSide(template, side)} ${playerPartyName} is building the strongest ${sideLabel} record available.`;
};

const formatOpponentPosition = (value = "") => {
  const cleaned = stripClaimScaffolding(value);

  if (!cleaned) {
    return "";
  }

  if (
    /^(the other side|the opposing side|opposing counsel|opposing party|the opposition)\b/i.test(
      cleaned
    )
  ) {
    return cleaned;
  }

  return `The other side is likely to argue that ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(
    1
  )}`;
};

const normalizeFactSheetPatch = (patch = {}) => ({
  ...patch,
  timeline: (patch.timeline || []).map((item) => humanizeClaimText(item)),
  supportingFacts: (patch.supportingFacts || []).map((item) =>
    humanizeClaimText(item)
  ),
  risks: (patch.risks || []).map((item) => humanizeClaimText(item)),
  knownFacts: (patch.knownFacts || []).map((item) => humanizeClaimText(item)),
  knownClaims: (patch.knownClaims || []).map((item) => humanizeClaimText(item)),
  disputedFacts: (patch.disputedFacts || []).map((item) =>
    formatOpponentPosition(item)
  ),
  corroboratedFacts: (patch.corroboratedFacts || []).map((item) =>
    humanizeClaimText(item)
  ),
  sourceLinks: patch.sourceLinks || [],
  missingEvidence: (patch.missingEvidence || []).map((item) => humanizeClaimText(item)),
  openQuestions: patch.openQuestions || [],
  discoveredFactIds: patch.discoveredFactIds || [],
  discoveredClaimIds: patch.discoveredClaimIds || [],
  discoveredEvidenceIds: patch.discoveredEvidenceIds || [],
});

const buildOpenQuestions = (
  template,
  side,
  excludedFactIds = [],
  excludedEvidenceIds = []
) =>
  buildSuggestedQuestionsForSide(ensureTemplate(template), side, {
    excludedFactIds,
    excludedEvidenceIds,
  });

const mergeFactSheet = (current, patch, template) => {
  const safeTemplate = ensureTemplate(template);
  const normalizedCurrent = normalizeFactSheetPatch(current);
  const normalizedPatch = normalizeFactSheetPatch(patch);
  const next = {
    ...current,
    summary:
      normalizedPatch.summary?.trim() ||
      normalizedCurrent.summary ||
      safeTemplate.overview,
    timeline: uniqueList([
      ...(normalizedCurrent.timeline || []),
      ...(normalizedPatch.timeline || []),
    ]),
    supportingFacts: uniqueList([
      ...(normalizedCurrent.supportingFacts || []),
      ...(normalizedPatch.supportingFacts || []),
    ]),
    risks: uniqueList([
      ...(normalizedCurrent.risks || []),
      ...(normalizedPatch.risks || []),
    ]),
    theory:
      normalizedPatch.theory?.trim() ||
      normalizedCurrent.theory ||
      safeTemplate.starterTheory,
    desiredRelief:
      normalizedPatch.desiredRelief?.trim() ||
      normalizedCurrent.desiredRelief ||
      safeTemplate.desiredRelief,
    openQuestions: uniqueList(
      normalizedPatch.openQuestions ||
        normalizedCurrent.openQuestions ||
        buildOpenQuestions(safeTemplate, DEFAULT_PLAYER_SIDE)
    ),
    knownFacts: uniqueList([
      ...(normalizedCurrent.knownFacts || []),
      ...(normalizedPatch.knownFacts || []),
    ]),
    knownClaims: uniqueList([
      ...(normalizedCurrent.knownClaims || []),
      ...(normalizedPatch.knownClaims || []),
    ]),
    disputedFacts: uniqueList([
      ...(normalizedCurrent.disputedFacts || []),
      ...(normalizedPatch.disputedFacts || []),
    ]),
    corroboratedFacts: uniqueList([
      ...(normalizedCurrent.corroboratedFacts || []),
      ...(normalizedPatch.corroboratedFacts || []),
    ]),
    sourceLinks: uniqueList([
      ...(normalizedCurrent.sourceLinks || []),
      ...(normalizedPatch.sourceLinks || []),
    ]),
    missingEvidence: uniqueList([
      ...(normalizedCurrent.missingEvidence || []),
      ...(normalizedPatch.missingEvidence || []),
    ]),
    discoveredFactIds: uniqueList([
      ...(normalizedCurrent.discoveredFactIds || []),
      ...(normalizedPatch.discoveredFactIds || []),
    ]),
    discoveredClaimIds: uniqueList([
      ...(normalizedCurrent.discoveredClaimIds || []),
      ...(normalizedPatch.discoveredClaimIds || []),
    ]),
    discoveredEvidenceIds: uniqueList([
      ...(normalizedCurrent.discoveredEvidenceIds || []),
      ...(normalizedPatch.discoveredEvidenceIds || []),
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
  const interviewFacts = (safeTemplate.canonicalFacts || []).filter(
    (fact) => fact.discoverability?.phase !== "courtroom"
  );

  const ranked = interviewFacts
    .map((fact) => ({
      fact,
      score: scoreFactForQuestion(fact, question),
    }))
    .sort((left, right) => right.score - left.score);

  const matched = ranked.filter((entry) => entry.score > 0).map((entry) => entry.fact);

  if (matched.length > 0) {
    const freshMatches = matched.filter(
      (fact) => !discoveredFactIds.includes(fact.factId)
    );

    return (freshMatches.length > 0 ? freshMatches : matched).slice(0, 2);
  }

  return interviewFacts
    .filter((fact) => !discoveredFactIds.includes(fact.factId))
    .slice()
    .sort(
      (left, right) =>
        (right.discoverability?.priority || 0) - (left.discoverability?.priority || 0)
    )
    .slice(0, 2);
};

const scoreEvidenceForQuestion = (item, question, template) => {
  const safeTemplate = ensureTemplate(template);
  const linkedFacts = (safeTemplate.canonicalFacts || []).filter((fact) =>
    (item.linkedFactIds || []).includes(fact.factId)
  );
  const questionTokens = tokenize(question);
  const searchableTokens = uniqueList([
    ...tokenize(item.label),
    ...tokenize(item.detail),
    ...((item.followUpQuestions || []).flatMap((value) => tokenize(value))),
    ...linkedFacts.flatMap((fact) => tokenize(fact.label)),
    ...linkedFacts.flatMap((fact) => tokenize(fact.canonicalDetail)),
  ]);

  const exactMatchCount = searchableTokens.filter((token) =>
    questionTokens.includes(token)
  ).length;
  const partialMatchCount = searchableTokens.filter((token) =>
    question.toLowerCase().includes(token)
  ).length;

  return exactMatchCount * 2 + partialMatchCount * 0.5;
};

const pickRelevantEvidence = (template, question, discoveredEvidenceIds = []) => {
  const safeTemplate = ensureTemplate(template);
  const evidenceItems = safeTemplate.evidenceItems || [];
  const ranked = evidenceItems
    .map((item) => ({
      item,
      score: scoreEvidenceForQuestion(item, question, safeTemplate),
    }))
    .sort((left, right) => right.score - left.score);

  const matched = ranked.filter((entry) => entry.score > 0).map((entry) => entry.item);

  if (matched.length > 0) {
    const freshMatches = matched.filter(
      (item) => !discoveredEvidenceIds.includes(item.id)
    );

    return (freshMatches.length > 0 ? freshMatches : matched).slice(0, 2);
  }

  return evidenceItems
    .filter((item) => !discoveredEvidenceIds.includes(item.id))
    .slice()
    .sort((left, right) => {
      const leftWeight = left.availabilityStatus === "confirmed" ? 0 : 1;
      const rightWeight = right.availabilityStatus === "confirmed" ? 0 : 1;

      return rightWeight - leftWeight;
    })
    .slice(0, 2);
};

const buildEvidenceResponseSegment = (item, side) => {
  const label = String(item.label || item.detail || "that record").trim();
  const lowerLabel = label.charAt(0).toLowerCase() + label.slice(1);
  const holderIsSelf = item.holderSide === side || item.holderSide === "shared";
  const holderIsOtherParty =
    (side === "client" && item.holderSide === "opponent") ||
    (side === "opponent" && item.holderSide === "client");

  switch (item.availabilityStatus) {
    case "confirmed":
      if (holderIsOtherParty) {
        return `They should have ${lowerLabel}, and that is something we can press on.`;
      }
      if (item.holderSide === "third-party") {
        return `A third party should have ${lowerLabel} on that point.`;
      }
      return `I can point to ${lowerLabel} on that point.`;
    case "mentioned":
      if (holderIsOtherParty) {
        return `I think they may have ${lowerLabel}, but I have not confirmed it yet.`;
      }
      if (item.holderSide === "third-party") {
        return `I think a third party may have ${lowerLabel}, but I have not confirmed it yet.`;
      }
      return `I think there should be ${lowerLabel}, but I cannot say that for certain yet.`;
    case "missing":
      if (holderIsOtherParty) {
        return `I do not have ${lowerLabel}, and the other side may be the one holding it.`;
      }
      return `I do not have ${lowerLabel} in hand yet.`;
    case "contested":
      return `There is ${lowerLabel}, but the other side is likely to fight over what it really shows.`;
    default:
      return `I am not sure yet whether ${lowerLabel} exists or who has it.`;
  }
};

const buildEvidenceHolderResponseSegment = (item) => {
  const label = String(item.label || item.detail || "that record").trim();
  const lowerLabel = label.charAt(0).toLowerCase() + label.slice(1);

  switch (item.holderSide) {
    case "third-party":
      return item.availabilityStatus === "confirmed"
        ? `A third party has ${lowerLabel}, but I do not know which one yet.`
        : `I do not know which third party has ${lowerLabel} yet. I only know a third party may have it, but I have not confirmed who.`;
    case "shared":
      return `Both sides should be able to access ${lowerLabel}.`;
    case "client":
      return `From my side, I should be the one with ${lowerLabel}.`;
    case "opponent":
      return `The other side should be the one holding ${lowerLabel}.`;
    default:
      return `I do not know who has ${lowerLabel} yet.`;
  }
};

const buildInterviewFallback = ({ caseSession, template, question, factSheet }) => {
  const safeTemplate = ensureTemplate(template);
  const playerSide = getPlayerSide(caseSession);
  const opponentSide = getOpposingSide(playerSide);
  const lowerQuestion = String(question || "").trim().toLowerCase();
  const recentPartyResponses = caseSession.interviewTranscript
    .filter((entry) => entry.role === "party")
    .slice(-3)
    .map((entry) => entry.text?.trim())
    .filter(Boolean);
  const matchedFacts = pickRelevantFacts(
    safeTemplate,
    question,
    factSheet.discoveredFactIds
  );

  const partyClaims = matchedFacts
    .map((fact) => ({
      fact,
      playerClaim: getClaimForParty(fact, playerSide),
      opposingClaim: getClaimForParty(fact, opponentSide),
    }))
    .filter((item) => item.playerClaim && !isMetaResponse(item.playerClaim.claimedDetail));

  const factLinkedEvidence = uniqueList(
    partyClaims.flatMap((item) =>
      getEvidenceItemsForFact(safeTemplate, item.fact).map((evidenceItem) => evidenceItem.id)
    )
  )
    .map((id) => (safeTemplate.evidenceItems || []).find((item) => item.id === id))
    .filter(Boolean);
  const matchedEvidence = uniqueList([
    ...factLinkedEvidence.map((item) => item.id),
    ...pickRelevantEvidence(safeTemplate, question, factSheet.discoveredEvidenceIds).map(
      (item) => item.id
    ),
  ])
    .map((id) => (safeTemplate.evidenceItems || []).find((item) => item.id === id))
    .filter(Boolean);
  const remainingFacts = (safeTemplate.canonicalFacts || []).filter(
    (fact) => !factSheet.discoveredFactIds.includes(fact.factId)
  );
  const leadQuestion = buildOpenQuestions(
    safeTemplate,
    playerSide,
    factSheet.discoveredFactIds,
    factSheet.discoveredEvidenceIds
  )[0];
  const lastKnownClaim = (factSheet.knownClaims || []).slice(-1)[0];
  const evidenceResponse = matchedEvidence
    .slice(0, partyClaims.length > 0 ? 1 : 2)
    .map((item) => buildEvidenceResponseSegment(item, playerSide))
    .join(" ");

  let partyResponse =
    partyClaims.length > 0
      ? [
          partyClaims
            .map((item, index) =>
              index === 0
                ? `From my side, ${toSpokenSentence(item.playerClaim.claimedDetail)}`
                : `Also, ${toSpokenSentence(item.playerClaim.claimedDetail)}`
            )
            .join(" "),
          evidenceResponse,
        ]
          .filter(Boolean)
          .join(" ")
      : evidenceResponse
      ? evidenceResponse
      : remainingFacts.length === 0
      ? lastKnownClaim
        ? `That's still my position. The clearest point I can give you is that ${toSpokenSentence(lastKnownClaim)}`
        : "I think we've covered the main facts from my side. We may need to lean on the documents and weak spots now."
      : leadQuestion
      ? `I'm not sure I can answer that directly yet. Try asking me: ${leadQuestion}`
      : "I may be mixing up the details. Ask me about the timeline, the records, or what the other side might challenge.";

  const repeatedFallbackReply = recentPartyResponses.includes(partyResponse.trim());
  const holderQuestion =
    /\b(who|which)\b/.test(lowerQuestion) &&
    (lowerQuestion.includes("third party") ||
      lowerQuestion.includes("has it") ||
      lowerQuestion.includes("holds it") ||
      lowerQuestion.includes("who has"));
  const proofQuestion =
    lowerQuestion.includes("concrete") ||
    lowerQuestion.includes("specific") ||
    lowerQuestion.includes("proof") ||
    lowerQuestion.includes("evidence") ||
    lowerQuestion.includes("record");
  const thirdPartyEvidence = matchedEvidence.find(
    (item) => item.holderSide === "third-party"
  );

  if (repeatedFallbackReply && holderQuestion && thirdPartyEvidence) {
    partyResponse = buildEvidenceHolderResponseSegment(thirdPartyEvidence);
  } else if (repeatedFallbackReply && proofQuestion && matchedEvidence[0]) {
    partyResponse = `The most concrete thing I can tell you right now is this: ${buildEvidenceResponseSegment(
      matchedEvidence[0],
      playerSide
    )}`;
  } else if (repeatedFallbackReply && leadQuestion) {
    partyResponse = `I do not have a different detail on that point yet. The next thing we should pin down is: ${leadQuestion}`;
  }

  const corroboratedClaims = partyClaims.filter(
    (item) =>
      item.fact.truthStatus === "verified" &&
      item.playerClaim.stance === "admits" &&
      isFactCorroborated(safeTemplate, item.fact)
  );

  const patch = {
    summary: buildSummaryForSide(safeTemplate, playerSide),
    timeline: partyClaims
      .filter((item) => item.fact.kind === "timeline")
      .map((item) => humanizeClaimText(item.playerClaim.claimedDetail)),
    supportingFacts: partyClaims
      .filter((item) => item.fact.kind === "supporting")
      .map((item) => humanizeClaimText(item.playerClaim.claimedDetail)),
    risks: partyClaims
      .filter((item) => item.fact.kind === "risk")
      .map((item) => humanizeClaimText(item.playerClaim.claimedDetail)),
    theory: buildTheoryForSide(safeTemplate, playerSide),
    desiredRelief: buildDesiredReliefForSide(safeTemplate, playerSide),
    knownFacts: partyClaims
      .filter(
        (item) =>
          item.fact.truthStatus === "verified" && isFactCorroborated(safeTemplate, item.fact)
      )
      .map((item) => item.fact.canonicalDetail),
    knownClaims: partyClaims.map((item) =>
      humanizeClaimText(item.playerClaim.claimedDetail)
    ),
    disputedFacts: partyClaims
      .filter(
        (item) =>
          item.opposingClaim &&
          item.opposingClaim.claimedDetail !== item.playerClaim.claimedDetail
      )
      .map((item) => item.opposingClaim.claimedDetail),
    corroboratedFacts: corroboratedClaims.map((item) => item.fact.canonicalDetail),
    sourceLinks: corroboratedClaims.flatMap((item) =>
      getEvidenceItemsForFact(safeTemplate, item.fact)
        .filter((evidenceItem) => evidenceItem.availabilityStatus === "confirmed")
        .map((evidenceItem) => `${item.fact.label}: ${evidenceItem.label}`)
    ),
    missingEvidence: buildMissingEvidenceNotesForSide(safeTemplate, playerSide),
    openQuestions: buildOpenQuestions(
      safeTemplate,
      playerSide,
      uniqueList([
        ...factSheet.discoveredFactIds,
        ...partyClaims.map((item) => item.fact.factId),
      ]),
      uniqueList([
        ...factSheet.discoveredEvidenceIds,
        ...matchedEvidence.map((item) => item.id),
      ])
    ),
    discoveredFactIds: partyClaims.map((item) => item.fact.factId),
    discoveredClaimIds: partyClaims.map((item) =>
      getClaimId(item.fact.factId, playerSide)
    ),
    discoveredEvidenceIds: matchedEvidence.map((item) => item.id),
  };

  const normalizedPatch = normalizeFactSheetPatch(patch);
  const nextFactSheet = mergeFactSheet(factSheet, normalizedPatch, safeTemplate);

  return {
    partyResponse,
    patch: normalizedPatch,
    nextFactSheet,
    relatedFactIds: uniqueList([
      ...partyClaims.map((item) => item.fact.factId),
      ...matchedEvidence.flatMap((item) => item.linkedFactIds || []),
    ]),
    discoveredClaimIds: normalizedPatch.discoveredClaimIds,
  };
};

const normalizeInterviewResult = ({ aiResult, fallback, template }) => {
  const safeTemplate = ensureTemplate(template);
  if (!aiResult || typeof aiResult !== "object") {
    return fallback;
  }

  const patch = normalizeFactSheetPatch({
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
    missingEvidence: Array.isArray(aiResult.missingEvidence)
      ? aiResult.missingEvidence
      : fallback.patch.missingEvidence,
    openQuestions: Array.isArray(aiResult.openQuestions)
      ? aiResult.openQuestions
      : fallback.patch.openQuestions,
    discoveredFactIds: Array.isArray(aiResult.discoveredFactIds)
      ? aiResult.discoveredFactIds
      : fallback.patch.discoveredFactIds,
    discoveredClaimIds: Array.isArray(aiResult.discoveredClaimIds)
      ? aiResult.discoveredClaimIds
      : fallback.patch.discoveredClaimIds,
    discoveredEvidenceIds: Array.isArray(aiResult.discoveredEvidenceIds)
      ? aiResult.discoveredEvidenceIds
      : fallback.patch.discoveredEvidenceIds,
  });

  return {
    partyResponse:
      aiResult.partyResponse && !isMetaResponse(aiResult.partyResponse)
        ? humanizeClaimText(aiResult.partyResponse)
        : fallback.partyResponse,
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
  const playerSide = getPlayerSide(caseSession);
  const opponentSide = getOpposingSide(playerSide);
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
  const opponentClaim = pressureFact ? getClaimForParty(pressureFact, opponentSide) : null;
  const opponentPartyName = getPartyName(safeTemplate, opponentSide);

  const opponentResponse = opponentClaim
    ? `Counsel for ${opponentPartyName} argues that ${opponentClaim.claimedDetail.charAt(0).toLowerCase()}${opponentClaim.claimedDetail.slice(
        1
      )}. They say the player's presentation leans too heavily on its own version instead of settled proof.`
    : `Counsel for ${opponentPartyName} argues that the player's record is too thin and the disputed facts cut against relief.`;

  const strengths = uniqueList([
    corroboratedHits > 0
      ? `You leaned on corroborated proof, not only unsupported narrative.`
      : "",
    citedFacts[0] ? `You grounded the argument in a concrete fact: ${citedFacts[0]}` : "",
    citedRules[0] ? `You tied the argument to ${citedRules[0]}.` : "",
    addressesDispute ? "You directly confronted the opposing side's framing." : "",
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
      ? "The judge seems to trust arguments more when they rest on corroborated facts rather than raw party statements."
      : "The judge appears concerned that the opposing side still has room to reframe the disputed record.";

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

const buildVerdictFallback = ({ updatedScore, rules, factSheet, template, playerSide }) => {
  const safeTemplate = ensureTemplate(template);
  const opponentSide = getOpposingSide(playerSide);
  const playerPartyName = getPartyName(safeTemplate, playerSide);
  const opponentPartyName = getPartyName(safeTemplate, opponentSide);
  const winner =
    updatedScore.player === updatedScore.opponent
      ? "draw"
      : updatedScore.player > updatedScore.opponent
      ? "player"
      : "opponent";

  const ruleLabel = rules[0]?.title || "the lawbook";
  const summary =
    winner === "player"
      ? `The court finds for ${playerPartyName}, concluding that the stronger corroborated record and better handling of disputed facts carried the day.`
      : winner === "opponent"
      ? `The court finds for ${opponentPartyName}, concluding that the player's showing relied too heavily on unresolved side-specific claims.`
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
        playerSide: getPlayerSide(caseSession),
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
  const playerSide = getPlayerSide(caseSession);
  const playerPartyName = getPartyName(template, playerSide);
  const opposingPartyName = getPartyName(template, getOpposingSide(playerSide));
  const fallback = buildInterviewFallback({
    caseSession,
    template,
    question,
    factSheet: caseSession.factSheet,
  });

  const aiResult = await requestStructuredCompletion({
    userId,
    temperature: 0.4,
    maxTokens: 1100,
    retryAttempts: 1,
    systemPrompt:
      "You are roleplaying a legal-game party speaking to the player's lawyer during intake. Speak like a normal person in first person, not like a lawyer in court. Do not say 'Your Honor', 'Your Honour', 'may it please the court', 'counsel', or use courtroom advocacy language. Stay grounded in the provided claim layer, canonical fact layer, and evidence availability layer. Never invent unsupported facts or pretend uncertain evidence is confirmed. If a record is only mentioned, missing, or unknown, say so plainly. Output only valid JSON. Keep the fact sheet aligned to the represented side's perspective: supporting facts, risks, summary, theory, and relief should be framed for that side, while disputed facts should be phrased as what the other side is likely to argue.",
    userPrompt: JSON.stringify({
      task: `Answer the lawyer's latest question as ${playerPartyName}, the represented ${playerSide} side, using only the ${playerSide}-side claims that are modeled for the case, then update the structured knowledge sheet.`,
      caseTemplate: {
        title: template.title,
        clientName: template.clientName,
        opponentName: template.opponentName,
        representedPartyName: playerPartyName,
        opposingPartyName,
        representedSide: playerSide,
        overview: buildOverviewForSide(template, playerSide),
        desiredRelief: buildDesiredReliefForSide(template, playerSide),
        interviewBlueprint: template.interviewBlueprint,
        canonicalFacts: template.canonicalFacts,
        evidenceItems: template.evidenceItems,
      },
      currentFactSheet: caseSession.factSheet,
      recentTranscript: caseSession.interviewTranscript.slice(-6),
      latestQuestion: question,
      outputSchema: {
        partyResponse: "string",
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
        missingEvidence: ["string"],
        openQuestions: ["string"],
        discoveredFactIds: ["string"],
        discoveredClaimIds: ["string"],
        discoveredEvidenceIds: ["string"],
        relatedFactIds: ["string"],
      },
    }),
  });

  return normalizeInterviewResult({ aiResult, fallback, template });
};

export const runCourtroomRound = async ({ caseSession, argument, userId }) => {
  const template = ensureTemplate(getTemplate(caseSession));
  const rules = getLawbookRules(template.legalTags);
  const playerSide = getPlayerSide(caseSession);
  const opponentSide = getOpposingSide(playerSide);
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
    retryAttempts: 1,
    systemPrompt:
      "You are running a courtroom game turn. Produce JSON only. Keep the opposing lawyer grounded in the modeled claim layer for the side opposite the player, while scoring the player's use of corroborated facts, dispute handling, and lawbook support.",
    userPrompt: JSON.stringify({
      task: shouldReturnVerdict
        ? "Generate the opponent lawyer response, hidden bench scoring, and a final verdict."
        : "Generate the opponent lawyer response and hidden bench scoring for this round.",
      caseTemplate: {
        ...template,
        representedSide: playerSide,
        representedPartyName: getPartyName(template, playerSide),
        opposingSide: opponentSide,
        opposingPartyName: getPartyName(template, opponentSide),
        desiredRelief: buildDesiredReliefForSide(template, playerSide),
      },
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
      missingEvidence: [],
      discoveredFactIds: [],
      discoveredClaimIds: [],
      discoveredEvidenceIds: [],
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
