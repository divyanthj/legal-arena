import "server-only";

import { requestStructuredCompletion } from "@/libs/gpt";
import { getLawbookRules } from "@/data/legalArenaLawbook";
import {
  buildDesiredReliefForSide,
  buildInterviewAgentContext,
  buildOverviewForSide,
  ensureTemplate,
  getOpposingSide,
  getPartyName,
  getPlayerSide,
  getTemplate,
  mergeFactSheet,
} from "./engine/shared";
import {
  buildInterviewFallback,
  normalizeInterviewResult,
} from "./engine/interview";
import {
  buildCounselContext,
  buildCourtroomAgentContext,
  buildCourtroomFallback,
  normalizeCounselAnalysis,
  normalizeCourtResult,
} from "./engine/courtroom";

export const continueInterview = async ({ caseSession, question, userId }) => {
  const template = ensureTemplate(getTemplate(caseSession));
  const playerSide = getPlayerSide(caseSession);
  const playerPartyName = getPartyName(template, playerSide);
  const opposingPartyName = getPartyName(template, getOpposingSide(playerSide));
  const interviewContext = buildInterviewAgentContext({
    template,
    playerSide,
    factSheet: caseSession.factSheet,
  });
  const fallback = buildInterviewFallback({
    caseSession,
    template,
    question,
    factSheet: caseSession.factSheet,
  });

  const aiResult = await requestStructuredCompletion({
    userId,
    temperature: 0.7,
    maxTokens: 1500,
    retryAttempts: 1,
    systemPrompt:
      "You are simulating a legal-case party speaking to their own lawyer during intake. Treat this as a role actor, not a script expander. You know the full hidden world state, but you speak only as the represented party from memory, bias, confidence, access, and personality. Decide what to reveal, hedge, minimize, or withhold based on the latest question and the party profile. Answer directly when the lawyer asks a yes/no possession question. If the lawyer asks whether you can provide, send, share, or show a record, answer directly about production: say yes, no, or that you would need to check your records first. For ordinary factual questions, answer from memory as concretely as you honestly can before talking about records. If the lawyer asks for names, dates, amounts, or other facts that are already present in the hidden world state or your side-specific memory, give the fact instead of saying you need to check records. Only say you need to check records when the lawyer is asking you to produce or verify a document, not when they are simply asking what happened or how much something was. If you do not remember an exact detail, say that plainly and stop. Do not tell the lawyer how to investigate, what to pin down next, or how to run the case. Do not keep repeating promises to look for or send something on later turns. It is completely acceptable to say you do not know, do not remember, have not seen something yourself, or only heard about it. Speak like a normal person in first person. Never mention internal schemas, canonical truth, or metadata. Keep fact-sheet updates concise, but you may fill summary, theory, and desiredRelief when the case posture is already clear from the intake or the lawyer asks for them. Output valid JSON only.",
    userPrompt: JSON.stringify({
      task: `Answer the lawyer's latest question as ${playerPartyName}. You are the represented ${playerSide} side. Use the hidden canonical world and your side-specific memory to choose what this person would naturally say and what they would keep back for now.`,
      stage: "interview",
      roleArchitecture: {
        representedPartyName: playerPartyName,
        opposingPartyName,
        representedSide: playerSide,
        overview: buildOverviewForSide(template, playerSide),
        desiredRelief: buildDesiredReliefForSide(template, playerSide),
        actorContext: interviewContext,
      },
      currentFactSheet: caseSession.factSheet,
      recentTranscript: caseSession.interviewTranscript.slice(-6),
      latestQuestion: question,
      outputSchema: {
        partyResponse: "string",
        summary: "string",
        theory: "string",
        desiredRelief: "string",
        revealedFactIds: ["string"],
        revealedEvidenceIds: ["string"],
        timeline: ["string"],
        supportingFacts: ["string"],
        risks: ["string"],
        knownClaims: ["string"],
        disputedFacts: ["string"],
        corroboratedFacts: ["string"],
        sourceLinks: ["string"],
        missingEvidence: ["string"],
        openQuestions: ["string"],
        relatedFactIds: ["string"],
      },
    }),
  });

  return normalizeInterviewResult({
    aiResult,
    fallback,
    template,
    caseSession,
    question,
    factSheet: caseSession.factSheet,
    playerSide,
  });
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

  const counselAnalysisResult = await requestStructuredCompletion({
    userId,
    temperature: 0.6,
    maxTokens: 900,
    retryAttempts: 1,
    systemPrompt:
      "You are simulating the player's side counsel in a legal game. Your job is not to invent new facts. Read the player's latest courtroom argument as an attempted advocacy move, then interpret the strongest responsible version of it using only the public case file and lawbook rules already available to the player. Output valid JSON only.",
    userPrompt: JSON.stringify({
      task: "Interpret the player's courtroom move as a counsel-side position statement before the opponent responds.",
      stage: "courtroom",
      counselContext: buildCounselContext({ caseSession, template, rules }),
      latestPlayerArgument: argument,
      outputSchema: {
        playerTheory: "string",
        citedFacts: ["string"],
        citedClaimIds: ["string"],
        citedRules: ["string"],
        strengths: ["string"],
        weaknesses: ["string"],
      },
    }),
  });
  const counselAnalysis = normalizeCounselAnalysis({
    aiResult: counselAnalysisResult,
    caseSession,
    rules,
  });

  const aiResult = await requestStructuredCompletion({
    userId,
    temperature: 0.65,
    maxTokens: 1500,
    retryAttempts: 1,
    systemPrompt:
      "You are simulating a courtroom exchange in a legal strategy game. Use role actors, not deterministic scripts. One hidden role is the player's counsel position, one hidden role is opposing counsel, and one hidden role is the bench. Opposing counsel is adversarial, strategic, and professionally restrained: they should attack the player's legal theory, proof, credibility, requested relief, or handling of disputes from their own side's claim layer, memory, incentives, and evidence posture. Opposing counsel may make narrow concessions only when they are tactically necessary, but must not compliment, praise, coach, validate, or give feedback on the player's advocacy. The bench should score the exchange based on the player's actual argument, the public case file, the lawbook, and the hidden world state. Do not narrate metadata or internal schemas. Output JSON only.",
    userPrompt: JSON.stringify({
      task: shouldReturnVerdict
        ? "Generate the opposing counsel response, the bench scoring, and the final verdict."
        : "Generate the opposing counsel response and the bench scoring for this round.",
      stage: "courtroom",
      opponentResponseRules: [
        "Write the opponentResponse as opposing counsel's courtroom argument only.",
        "Do not start with praise, compliments, validation, or debate-club etiquette.",
        "Do not say the player's argument is good, strong, compelling, persuasive, fair, valid, or well argued.",
        "Do not coach the player or explain how they could improve.",
        "If acknowledging an undisputed fact, immediately pivot to why it does not carry the legal burden or requested relief.",
      ],
      courtroomArchitecture: buildCourtroomAgentContext({
        caseSession,
        template,
        rules,
        counselAnalysis,
        shouldReturnVerdict,
      }),
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
    counselAnalysis,
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

