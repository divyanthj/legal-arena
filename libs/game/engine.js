import "server-only";

import { requestStructuredCompletion } from "@/libs/gpt";
import { getLawbookRules } from "@/data/legalArenaLawbook";
import {
  lockCaseAssessment,
  normalizeCaseAssessment,
} from "./caseAssessment";
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
  normalizeFactSheetPatch,
  coerceStringList,
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
import {
  getCourtroomDifficultyProfile,
  getOpponentResponsePromptRules,
} from "./courtroomDifficulty";

const INTERVIEW_RESPONSE_MAX_TOKENS = 1500;

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
    maxTokens: INTERVIEW_RESPONSE_MAX_TOKENS,
    retryAttempts: 1,
    systemPrompt:
      "You are simulating a legal-case party speaking to their own lawyer during intake. Treat this as a role actor, not a script expander. The canonical story is the real event history; structured facts and evidence are helper maps, not the only memory you have. Answer first from the represented party's lived perspective, thought process, and accessible story memory. Decide what to reveal, hedge, minimize, or withhold based on the latest question and the party profile. Answer directly when the lawyer asks a yes/no possession question. If the lawyer asks whether you can provide, send, share, or show a record, answer directly about production. If the record is confirmed and held by your side or shared, say yes and identify the record and what it shows. If it is held by the other side or a third party, say who likely has it. If it is missing, say no. If it is only mentioned or unknown, say it has not been confirmed in the file; do not repeatedly promise to check later. For ordinary factual questions, answer from memory as concretely as you honestly can before talking about records. If the lawyer asks a broad question, connect it to the nearest relevant events, mental states, evidence, or ambiguity in the canonical story instead of stonewalling. If the lawyer asks for names, dates, amounts, or other facts already present in the hidden world state or side-specific memory, give the fact instead of saying you need to check records. Use uncertainty only for genuine proof gaps, hearsay, missing records, low-access facts, or exact details the represented party would not know. If you do not remember an exact detail, say that plainly and stop. Do not tell the lawyer how to investigate, what to pin down next, or how to run the case. Speak like a normal person in first person. Never mention internal schemas, canonical truth, or metadata. Keep fact-sheet updates concise, but you may fill summary, theory, and desiredRelief when the case posture is already clear from the intake or the lawyer asks for them. When records are produced or confirmed, add them to corroboratedFacts/sourceLinks; when records cannot be produced, add the specific missing item to missingEvidence. Output valid JSON only.",
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

  const interviewResult = normalizeInterviewResult({
    aiResult,
    fallback,
    template,
    caseSession,
    question,
    factSheet: caseSession.factSheet,
    playerSide,
  });

  const conversationPatch = await buildConversationFactSheetPatch({
    userId,
    currentFactSheet: caseSession.factSheet,
    recentTranscript: caseSession.interviewTranscript.slice(-8),
    latestQuestion: question,
    latestAnswer: interviewResult.partyResponse,
  });
  const nextFactSheet = mergeFactSheet(caseSession.factSheet, conversationPatch, template, {
    playerSide,
  });
  const nextAssessment = await assessCaseSuccessChance({
    userId,
    caseSession,
    factSheet: nextFactSheet,
    latestQuestion: question,
    latestAnswer: interviewResult.partyResponse,
    previousAssessment: caseSession.caseAssessment,
  });

  return {
    ...interviewResult,
    patch: conversationPatch,
    nextFactSheet,
    caseAssessment: nextAssessment,
  };
};

export const assessCaseSuccessChance = async ({
  userId,
  caseSession,
  factSheet,
  latestQuestion = "",
  latestAnswer = "",
  previousAssessment = null,
}) => {
  const template = ensureTemplate(getTemplate(caseSession));
  const playerSide = getPlayerSide(caseSession);
  const rules = getLawbookRules(template.legalTags).map((rule) => ({
    id: rule.id,
    title: rule.title,
    principle: rule.principle,
  }));
  const visibleTranscript = [
    ...(caseSession.interviewTranscript || []).slice(-8),
    latestQuestion
      ? {
          role: "player",
          speaker: "You",
          text: latestQuestion,
        }
      : null,
    latestAnswer
      ? {
          role: "party",
          speaker: getPartyName(template, playerSide),
          text: latestAnswer,
        }
      : null,
  ].filter(Boolean);

  try {
    const aiResult = await requestStructuredCompletion({
      userId,
      temperature: 0.25,
      maxTokens: 600,
      retryAttempts: 1,
      systemPrompt:
        "You estimate the player's chance of winning a legal simulation if they go to court with only the visible case file. Use only the supplied transcript, fact sheet, side, and public lawbook labels. Do not infer from hidden truth, canonical story, template facts, or evidence that is not visible. Output valid JSON only.",
      userPrompt: JSON.stringify({
        task: "Estimate the player's success chance from the visible intake record.",
        representedSide: playerSide,
        representedPartyName: getPartyName(template, playerSide),
        opposingPartyName: getPartyName(template, getOpposingSide(playerSide)),
        factSheet,
        recentTranscript: visibleTranscript,
        lawbookRules: rules,
        scoringGuidance: [
          "Higher chance for corroborated facts, specific timeline, clear requested relief, and addressed disputes.",
          "Lower chance for missing evidence, vague memory, unresolved risks, unsupported key points, and thin legal fit.",
          "Return 0-100 as the player's chance to win in court with this record.",
          "Give 2-3 short tooltip reasons.",
        ],
        outputSchema: {
          successChance: "number",
          reasons: ["string"],
        },
      }),
    });

    return normalizeCaseAssessment(aiResult, previousAssessment);
  } catch (error) {
    console.error("case success assessment failed", error);
    return normalizeCaseAssessment(previousAssessment);
  }
};

export const lockAssessmentForCourt = (assessment = null) => lockCaseAssessment(assessment);

const buildConversationFactSheetPatch = async ({
  userId,
  currentFactSheet,
  recentTranscript,
  latestQuestion,
  latestAnswer,
}) => {
  const fallbackPatch = buildConversationFactSheetFallback({
    latestQuestion,
    latestAnswer,
  });

  try {
    const aiResult = await requestStructuredCompletion({
      userId,
      temperature: 0.35,
      maxTokens: 900,
      retryAttempts: 1,
      systemPrompt:
        "You update a lawyer's private working fact sheet from the conversation only. You do not know the hidden case truth, canonical story, template facts, evidence graph, or any source outside the transcript you are given. Write concise bullet notes as the player's own internal thoughts after speaking with the client. If something was not said or clearly implied in the conversation, leave it out. Output valid JSON only.",
      userPrompt: JSON.stringify({
        task: "Create a fact-sheet patch from only the visible intake conversation.",
        currentFactSheet,
        recentTranscript,
        latestExchange: {
          playerQuestion: latestQuestion,
          clientAnswer: latestAnswer,
        },
        styleRules: [
          "Use bullets, not paragraphs.",
          "Prefer concise internal notes such as 'Client says...' or 'I still need...'.",
          "Do not state anything as proven unless the client actually said it or produced it.",
          "If the client confirms a photo, record, invoice, receipt, document, witness, or other proof exists, was shown, was produced, or is in hand, put that note in corroboratedFacts.",
          "If the client says proof does not exist, was not shown, cannot be provided, or still needs to be found, put that note in missingEvidence.",
          "Do not mention canonical truth, hidden facts, templates, schemas, or source of truth.",
          "Return only new or revised notes supported by the visible conversation.",
        ],
        outputSchema: {
          summary: ["string"],
          theory: ["string"],
          desiredRelief: ["string"],
          timeline: ["string"],
          supportingFacts: ["string"],
          risks: ["string"],
          knownClaims: ["string"],
          disputedFacts: ["string"],
          corroboratedFacts: ["string"],
          sourceLinks: ["string"],
          missingEvidence: ["string"],
          openQuestions: ["string"],
        },
      }),
    });

    const patch = normalizeFactSheetPatch({
      summary: coerceStringList(aiResult?.summary, 3),
      theory: coerceStringList(aiResult?.theory, 3),
      desiredRelief: coerceStringList(aiResult?.desiredRelief, 2),
      timeline: coerceStringList(aiResult?.timeline, 4),
      supportingFacts: coerceStringList(aiResult?.supportingFacts, 5),
      risks: coerceStringList(aiResult?.risks, 4),
      knownFacts: [],
      knownClaims: coerceStringList(aiResult?.knownClaims, 5),
      disputedFacts: coerceStringList(aiResult?.disputedFacts, 4),
      corroboratedFacts: coerceStringList(aiResult?.corroboratedFacts, 4),
      sourceLinks: coerceStringList(aiResult?.sourceLinks, 4),
      missingEvidence: coerceStringList(aiResult?.missingEvidence, 4),
      openQuestions: coerceStringList(aiResult?.openQuestions, 3),
      discoveredFactIds: [],
      discoveredClaimIds: [],
      discoveredEvidenceIds: [],
    });
    const proofPatch = buildConversationProofClassificationFallback({
      latestQuestion,
      latestAnswer,
    });
    const proofAlreadyClassified =
      patch.corroboratedFacts.length || patch.missingEvidence.length;
    const mergedPatch = normalizeFactSheetPatch({
      ...patch,
      corroboratedFacts: proofAlreadyClassified
        ? patch.corroboratedFacts
        : proofPatch.corroboratedFacts,
      missingEvidence: proofAlreadyClassified
        ? patch.missingEvidence
        : proofPatch.missingEvidence,
      sourceLinks:
        patch.sourceLinks.length > 0 ? patch.sourceLinks : proofPatch.sourceLinks,
    });

    if (
      mergedPatch.summary.length ||
      mergedPatch.theory.length ||
      mergedPatch.desiredRelief.length ||
      mergedPatch.timeline.length ||
      mergedPatch.supportingFacts.length ||
      mergedPatch.risks.length ||
      mergedPatch.disputedFacts.length ||
      mergedPatch.corroboratedFacts.length ||
      mergedPatch.missingEvidence.length
    ) {
      return mergedPatch;
    }
  } catch (error) {
    console.error("conversation fact sheet update failed", error);
  }

  return fallbackPatch;
};

const proofTermPattern =
  /\b(proof|record|records|document|documents|photo|photos|picture|pictures|invoice|invoices|receipt|receipts|witness|witnesses|evidence|inspection|statement|statements|breakdown|itemized|itemised|ledger|email|emails|text|texts|message|messages)\b/i;
const missingProofPattern =
  /(^|\b)(no|nope|not really|never|none|without|do not|don't|does not|doesn't|did not|didn't|cannot|can't|could not|couldn't|missing|need to find|need to confirm|wasn't shown|were not shown|not shown|not provided|not produced|not in hand|do not remember|don't remember|not sure)\b/i;
const confirmedProofPattern =
  /(^|\b)(yes|yeah|yep|showed|shown|provided|produced|sent|shared|gave|received|kept|saved|attached|uploaded|photographed|documented|itemized|itemised|confirmed|in hand)\b/i;

const buildConversationProofClassificationFallback = ({
  latestQuestion,
  latestAnswer,
}) => {
  const answer = String(latestAnswer || "").trim();
  const question = String(latestQuestion || "").trim();
  const lowerQuestion = question.toLowerCase();
  const lowerAnswer = answer.toLowerCase();
  const patch = {
    corroboratedFacts: [],
    sourceLinks: [],
    missingEvidence: [],
  };

  if (!answer || !proofTermPattern.test(`${lowerQuestion} ${lowerAnswer}`)) {
    return patch;
  }

  const answerShowsProofPossession =
    /\b(have|has|had|hold|holds|held)\b/i.test(lowerAnswer) &&
    proofTermPattern.test(lowerAnswer);

  if (missingProofPattern.test(lowerAnswer)) {
    patch.missingEvidence.push(`Proof gap: ${answer}`);
  } else if (
    confirmedProofPattern.test(lowerAnswer) ||
    answerShowsProofPossession ||
    proofTermPattern.test(lowerAnswer)
  ) {
    patch.corroboratedFacts.push(`Client points me to this proof: ${answer}`);
    patch.sourceLinks.push("Client intake answer");
  }

  return patch;
};

const buildConversationFactSheetFallback = ({ latestQuestion, latestAnswer }) => {
  const answer = String(latestAnswer || "").trim();
  const question = String(latestQuestion || "").trim();

  if (!answer) {
    return normalizeFactSheetPatch({});
  }

  const lower = `${question} ${answer}`.toLowerCase();
  const patch = {
    summary: [],
    theory: [],
    desiredRelief: [],
    timeline: [],
    supportingFacts: [],
    risks: [],
    knownFacts: [],
    knownClaims: [],
    disputedFacts: [],
    corroboratedFacts: [],
    sourceLinks: [],
    missingEvidence: [],
    openQuestions: [],
    discoveredFactIds: [],
    discoveredClaimIds: [],
    discoveredEvidenceIds: [],
  };

  if (/\b(need|want|asking|request|relief|deposit|damages|refund|return)\b/i.test(lower)) {
    patch.desiredRelief.push(`Client says: ${answer}`);
  } else if (/\b(when|date|before|after|during|then|timeline|moved|signed|paid|sent)\b/i.test(lower)) {
    patch.timeline.push(`Client says: ${answer}`);
  } else if (proofTermPattern.test(lower)) {
    const proofPatch = buildConversationProofClassificationFallback({
      latestQuestion,
      latestAnswer,
    });

    if (proofPatch.missingEvidence.length) {
      patch.missingEvidence.push(`I still need to pin down: ${answer}`);
    } else if (proofPatch.corroboratedFacts.length) {
      patch.corroboratedFacts.push(`Client points me to this proof: ${answer}`);
      patch.sourceLinks.push(...proofPatch.sourceLinks);
    }
  } else if (/\b(risk|worry|problem|weak|unsure|not sure|don't remember|do not remember)\b/i.test(lower)) {
    patch.risks.push(`Risk I heard from the client: ${answer}`);
  } else {
    patch.supportingFacts.push(`Client says: ${answer}`);
  }

  return normalizeFactSheetPatch(patch);
};

export const runCourtroomRound = async ({ caseSession, argument, userId }) => {
  const template = ensureTemplate(getTemplate(caseSession));
  const rules = getLawbookRules(template.legalTags);
  const playerSide = getPlayerSide(caseSession);
  const opponentSide = getOpposingSide(playerSide);
  const shouldReturnVerdict =
    caseSession.score.roundsCompleted + 1 >= caseSession.maxCourtRounds;
  const difficultyProfile = getCourtroomDifficultyProfile(caseSession.complexity);

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
      "You are simulating a courtroom exchange in a legal strategy game. Use role actors, not deterministic scripts. One hidden role is the player's counsel position, one hidden role is opposing counsel, and one hidden role is the bench. Opposing counsel is always talented, adversarial, strategic, and professionally restrained: they should attack the player's legal theory, proof, credibility, requested relief, or handling of disputes from their own side's story memory, claim layer, incentives, and evidence posture. Opposing counsel may make narrow concessions only when they are tactically necessary, but must not compliment, praise, coach, validate, or give feedback on the player's advocacy. The bench should score the exchange based on facts gathered, facts actually presented, argument quality, proof gaps, the lawbook, judge profile, hidden courtroom calibration, and the hidden canonical story. Outcomes may vary in close cases based on judicial weighting, but they must remain explainable and sensitive to the record. Never reveal or refer to calibration, difficulty, complexity scaling, junior counsel, senior counsel, scoring bounds, or hidden tuning in player-facing text. Do not narrate metadata or internal schemas. Output JSON only.",
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
        ...difficultyProfile.promptGuidance,
        ...getOpponentResponsePromptRules(difficultyProfile),
        "Never mention the hidden courtroom calibration or why the response is more focused or more layered.",
      ],
      verdictPerspectiveRules: [
        "If returning a verdict, highlights must list only points that helped the represented player's side.",
        "If returning a verdict, concerns must list only points that weakened the represented player's side.",
        "Do not put adverse findings against the represented player in highlights, even if they were important to the court's ruling.",
        "Do not prefix highlights or concerns with bullets, hyphens, numbering, or markdown.",
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
      summary: [],
      timeline: [],
      supportingFacts: [],
      risks: [],
      theory: [],
      desiredRelief: [],
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

  if (!normalized.summary.length) {
    missing.push("summary");
  }
  if (!normalized.theory.length) {
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
  if (!normalized.desiredRelief.length) {
    missing.push("requested relief");
  }
  if (normalized.risks.length === 0 && normalized.disputedFacts.length === 0) {
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
