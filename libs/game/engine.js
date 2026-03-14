import "server-only";

import { requestStructuredCompletion } from "@/libs/gpt";
import { getScenarioById } from "@/data/legalArenaScenarios";
import { getLawbookRules } from "@/data/legalArenaLawbook";

const uniqueList = (items = []) =>
  [...new Set(items.filter(Boolean).map((item) => item.trim()).filter(Boolean))];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const mergeFactSheet = (current, patch, scenario) => {
  const next = {
    ...current,
    summary: patch.summary?.trim() || current.summary || scenario.overview,
    timeline: uniqueList([...(current.timeline || []), ...(patch.timeline || [])]),
    supportingFacts: uniqueList([
      ...(current.supportingFacts || []),
      ...(patch.supportingFacts || []),
    ]),
    risks: uniqueList([...(current.risks || []), ...(patch.risks || [])]),
    theory: patch.theory?.trim() || current.theory || scenario.starterTheory,
    desiredRelief:
      patch.desiredRelief?.trim() ||
      current.desiredRelief ||
      scenario.desiredRelief,
    openQuestions: uniqueList(patch.openQuestions || current.openQuestions || []),
    discoveredFactIds: uniqueList([
      ...(current.discoveredFactIds || []),
      ...(patch.discoveredFactIds || []),
    ]),
  };

  next.ready =
    Boolean(next.summary && next.theory && next.desiredRelief) &&
    next.supportingFacts.length >= 2 &&
    next.timeline.length >= 1;

  return next;
};

const pickRelevantFacts = (scenario, question, discoveredFactIds = []) => {
  const normalizedQuestion = question.toLowerCase();
  const matched = scenario.factInventory.filter(
    (fact) =>
      fact.keywords.some((keyword) => normalizedQuestion.includes(keyword)) &&
      !discoveredFactIds.includes(fact.id)
  );

  if (matched.length) {
    return matched.slice(0, 2);
  }

  return scenario.factInventory
    .filter((fact) => !discoveredFactIds.includes(fact.id))
    .slice(0, 2);
};

const buildInterviewFallback = ({ scenario, question, factSheet }) => {
  const matchedFacts = pickRelevantFacts(
    scenario,
    question,
    factSheet.discoveredFactIds
  );

  const clientResponse =
    matchedFacts.length > 0
      ? matchedFacts
          .map((fact, index) =>
            index === 0
              ? `From what I remember, ${fact.detail.charAt(0).toLowerCase()}${fact.detail.slice(
                  1
                )}`
              : `Also, ${fact.detail.charAt(0).toLowerCase()}${fact.detail.slice(1)}`
          )
          .join(" ")
      : "I need help narrowing that down, but I know the timeline and records should help us.";

  const patch = {
    summary: `${scenario.overview} ${scenario.clientName} believes the opponent acted unfairly.`,
    timeline: matchedFacts
      .filter((fact) => fact.category === "timeline")
      .map((fact) => fact.detail),
    supportingFacts: matchedFacts
      .filter((fact) => fact.category === "supporting")
      .map((fact) => fact.detail),
    risks: matchedFacts
      .filter((fact) => fact.category === "risk")
      .map((fact) => fact.detail),
    theory: scenario.starterTheory,
    desiredRelief: scenario.desiredRelief,
    openQuestions: scenario.factInventory
      .filter((fact) => !matchedFacts.some((matched) => matched.id === fact.id))
      .slice(0, 3)
      .map((fact) => fact.label),
    discoveredFactIds: matchedFacts.map((fact) => fact.id),
  };

  const nextFactSheet = mergeFactSheet(factSheet, patch, scenario);

  return {
    clientResponse,
    patch,
    nextFactSheet,
  };
};

const normalizeInterviewResult = ({ aiResult, fallback, scenario }) => {
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
    theory: aiResult.theory || fallback.patch.theory || scenario.starterTheory,
    desiredRelief:
      aiResult.desiredRelief ||
      fallback.patch.desiredRelief ||
      scenario.desiredRelief,
    openQuestions: Array.isArray(aiResult.openQuestions)
      ? aiResult.openQuestions
      : fallback.patch.openQuestions,
    discoveredFactIds: Array.isArray(aiResult.discoveredFactIds)
      ? aiResult.discoveredFactIds
      : fallback.patch.discoveredFactIds,
  };

  return {
    clientResponse: aiResult.clientResponse || fallback.clientResponse,
    patch,
    nextFactSheet: mergeFactSheet(fallback.nextFactSheet, patch, scenario),
  };
};

const pickFactMentions = (argument, factSheet) => {
  const lowerArgument = argument.toLowerCase();

  return uniqueList(
    [...(factSheet.supportingFacts || []), ...(factSheet.timeline || [])].filter(
      (fact) => {
        const tokens = fact
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((token) => token.length > 4);

        return tokens.some((token) => lowerArgument.includes(token));
      }
    )
  ).slice(0, 3);
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

const buildCourtroomFallback = ({ caseSession, argument, rules, scenario }) => {
  const citedFacts = pickFactMentions(argument, caseSession.factSheet);
  const citedRules = pickRuleMentions(argument, rules);
  const lowerArgument = argument.toLowerCase();
  const addressesRisk = (caseSession.factSheet.risks || []).some((risk) =>
    risk
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 4)
      .some((token) => lowerArgument.includes(token))
  );

  const playerDelta = clamp(
    4 +
      citedFacts.length * 3 +
      citedRules.length * 4 +
      (addressesRisk ? 3 : 0) +
      (argument.length > 240 ? 2 : 0),
    4,
    18
  );

  const unresolvedRisks = clamp(
    (caseSession.factSheet.risks || []).length - (addressesRisk ? 1 : 0),
    0,
    3
  );
  const opponentDelta = clamp(
    5 + unresolvedRisks * 3 + (citedRules.length === 0 ? 2 : 0),
    4,
    16
  );

  const pressurePoint =
    scenario.opponentClaims[
      caseSession.score.roundsCompleted % scenario.opponentClaims.length
    ];
  const opponentResponse = `Counsel for ${scenario.opponentName} argues that ${pressurePoint.charAt(0).toLowerCase()}${pressurePoint.slice(
    1
  )}. They say the player's argument overstates the evidence and ignores that ${
    caseSession.factSheet.risks[0] || "the record is incomplete"
  }.`;

  const strengths = uniqueList([
    citedFacts[0] ? `You grounded the argument in a concrete fact: ${citedFacts[0]}` : "",
    citedRules[0] ? `You tied the argument to ${citedRules[0]}.` : "",
    argument.length > 240 ? "You developed a fuller theory instead of a one-line objection." : "",
  ]).slice(0, 2);

  const weaknesses = uniqueList([
    citedRules.length === 0 ? "The argument did not clearly anchor itself to a lawbook rule." : "",
    !addressesRisk && caseSession.factSheet.risks[0]
      ? `A visible weakness remains unaddressed: ${caseSession.factSheet.risks[0]}`
      : "",
    citedFacts.length === 0
      ? "The bench still needs a more specific fact from the case file."
      : "",
  ]).slice(0, 2);

  const benchSignal =
    playerDelta >= opponentDelta
      ? "The judge appears interested in the factual detail but wants tighter authority."
      : "The judge seems concerned that the defense has more room to frame the record.";

  return {
    opponentResponse,
    playerDelta,
    opponentDelta,
    citedFacts,
    citedRules,
    strengths,
    weaknesses,
    benchSignal,
  };
};

const buildVerdictFallback = ({ updatedScore, rules, factSheet, scenario }) => {
  const winner =
    updatedScore.player === updatedScore.opponent
      ? "draw"
      : updatedScore.player > updatedScore.opponent
      ? "player"
      : "opponent";

  const ruleLabel = rules[0]?.title || "the lawbook";
  const summary =
    winner === "player"
      ? `The court finds for ${scenario.clientName}, concluding that the stronger record and fair-notice concerns outweigh the defense's objections.`
      : winner === "opponent"
      ? `The court finds for ${scenario.opponentName}, concluding that the player's showing left too many gaps for relief.`
      : "The court finds the showing too close to separate decisively and orders each side to bear its own costs.";

  return {
    winner,
    summary,
    highlights: uniqueList([
      factSheet.supportingFacts[0] || "",
      `The court relied heavily on ${ruleLabel}.`,
      updatedScore.highlights?.[0] || "",
    ]).slice(0, 3),
    concerns: uniqueList([
      factSheet.risks[0] || "",
      updatedScore.weaknesses?.[0] || "",
    ]).slice(0, 2),
  };
};

const normalizeCourtResult = ({
  aiResult,
  fallback,
  shouldReturnVerdict,
  caseSession,
  rules,
  scenario,
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
        scenario,
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
  const scenario = getScenarioById(caseSession.scenarioId);
  const fallback = buildInterviewFallback({
    scenario,
    question,
    factSheet: caseSession.factSheet,
  });

  const aiResult = await requestStructuredCompletion({
    userId,
    temperature: 0.4,
    maxTokens: 900,
    systemPrompt:
      "You are roleplaying a civil-law game client speaking to the player's lawyer. Stay grounded in the provided scenario facts, never invent magic evidence, and output only valid JSON.",
    userPrompt: JSON.stringify({
      task: "Answer the lawyer's latest question as the client, then update the structured fact sheet.",
      scenario,
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
        openQuestions: ["string"],
        discoveredFactIds: ["string"],
      },
    }),
  });

  return normalizeInterviewResult({ aiResult, fallback, scenario });
};

export const runCourtroomRound = async ({ caseSession, argument, userId }) => {
  const scenario = getScenarioById(caseSession.scenarioId);
  const rules = getLawbookRules(scenario.legalTags);
  const shouldReturnVerdict =
    caseSession.score.roundsCompleted + 1 >= caseSession.maxCourtRounds;

  const fallback = buildCourtroomFallback({
    caseSession,
    argument,
    rules,
    scenario,
  });

  const aiResult = await requestStructuredCompletion({
    userId,
    temperature: 0.5,
    maxTokens: 1200,
    systemPrompt:
      "You are running a courtroom game turn. Produce JSON only. The player's input is freeform, but your output must stay consistent with the fact sheet and custom lawbook. Generate the opponent's response plus hidden judge scoring.",
    userPrompt: JSON.stringify({
      task: shouldReturnVerdict
        ? "Generate the opponent lawyer response, hidden bench scoring, and a final verdict."
        : "Generate the opponent lawyer response and hidden bench scoring for this round.",
      scenario,
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
    scenario,
  });
};

export const finalizeFactSheetInput = ({ factSheet, scenarioId }) => {
  const scenario = getScenarioById(scenarioId);
  const normalized = mergeFactSheet(
    {
      summary: "",
      timeline: [],
      supportingFacts: [],
      risks: [],
      theory: "",
      desiredRelief: "",
      openQuestions: [],
      discoveredFactIds: [],
      ready: false,
    },
    factSheet,
    scenario
  );

  const missing = [];

  if (!normalized.summary) {
    missing.push("summary");
  }
  if (!normalized.theory) {
    missing.push("case theory");
  }
  if (normalized.supportingFacts.length < 2) {
    missing.push("at least two supporting facts");
  }
  if (!normalized.timeline.length) {
    missing.push("at least one timeline point");
  }
  if (!normalized.desiredRelief) {
    missing.push("requested relief");
  }

  return {
    factSheet: {
      ...normalized,
      ready: missing.length === 0,
    },
    missing,
  };
};
