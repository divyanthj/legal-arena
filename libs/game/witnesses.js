import "server-only";

import { requestStructuredCompletion } from "@/libs/gpt";
import { createUsageCollector } from "./sessionUsage";

const WITNESS_MODEL =
  process.env.OPENAI_GAMEPLAY_MODEL?.trim() ||
  process.env.OPENAI_MODEL?.trim() ||
  "gpt-5.4-mini";
const WITNESS_ROSTER_VERSION = 2;

const cleanText = (value = "", limit = 2400) =>
  String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);

const cleanList = (items = [], limit = 8, itemLimit = 900) =>
  (Array.isArray(items) ? items : [])
    .map((item) => cleanText(item, itemLimit))
    .filter(Boolean)
    .slice(0, limit);

const clamp = (value, min = 0, max = 1, fallback = 0.5) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
};

const slugify = (value = "") =>
  cleanText(value, 100)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

const getPlayerTemplateSide = (caseSession = {}) =>
  caseSession.playerSide === "opponent" ? "defendant" : "plaintiff";

const getWitnessSideOwner = (caseSession = {}, witness = {}) =>
  witness.side === getPlayerTemplateSide(caseSession) ? "player" : "opponent";

const getCaseSource = (caseSession = {}) => {
  const template = caseSession.templateSnapshot || caseSession.caseTemplateId || {};
  const dynamicCase = template.dynamicCase || {};
  return {
    caseCountry: caseSession.caseCountry || template.caseCountry || null,
    title: caseSession.title,
    practiceArea: caseSession.practiceArea,
    representedSide: getPlayerTemplateSide(caseSession),
    plaintiffName:
      caseSession.premise?.clientName || template.plaintiffName || dynamicCase.plaintiffName,
    defendantName:
      caseSession.premise?.opponentName || template.defendantName || dynamicCase.defendantName,
    publicFactSheet: caseSession.factSheet || {},
    plaintiffStory:
      dynamicCase.plaintiffStory || template.interviewBlueprint?.plaintiff?.posture || "",
    defendantStory:
      dynamicCase.defendantStory || template.interviewBlueprint?.defendant?.posture || "",
    evidence:
      dynamicCase.evidencePool || template.evidenceItems || [],
    canonicalStory: caseSession.canonicalStory || template.canonicalStory || null,
  };
};

const hashFraction = (value = "") => {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
};

const NON_PARTY_WITNESS_CUE_PATTERN =
  /\b(?:eye\s*witness|bystander|roommate|neighbou?r|coworker|co-worker|supervisor|human resources|\bhr\b|property manager|building manager|site manager|contractor|subcontractor|inspector|technician|delivery driver|courier|receptionist|accountant|bookkeeper|broker|agent|first responder|paramedic|nurse|doctor|physician|teacher|school administrator|security guard|police officer|investigating officer|records custodian)\b/i;

export const buildWitnessRosterPlan = (caseSession = {}) => {
  const source = getCaseSource(caseSession);
  const complexity = Math.max(1, Math.min(5, Number(caseSession.complexity) || 1));
  const evidence = Array.isArray(source.evidence) ? source.evidence : [];
  const explicitWitnessItems = evidence.filter(
    (item) => String(item?.type || "").trim().toLowerCase() === "witness"
  );
  const sourceText = [
    source.plaintiffStory,
    source.defendantStory,
    source.canonicalStory ? JSON.stringify(source.canonicalStory) : "",
    ...evidence.flatMap((item) => [item?.label, item?.detail, item?.description]),
    ...(caseSession.factSheet?.corroboratedFacts || []),
    ...(caseSession.factSheet?.knownClaims || []),
  ]
    .filter(Boolean)
    .join(" ");
  const hasNaturalNonPartyCue = NON_PARTY_WITNESS_CUE_PATTERN.test(sourceText);
  const seed = [caseSession._id, caseSession.id, caseSession.slug, caseSession.title]
    .filter(Boolean)
    .join(":");
  const roll = hashFraction(seed || sourceText);

  if (explicitWitnessItems.length) {
    const explicitSides = explicitWitnessItems
      .map((item) => {
        const side = String(item.owner || item.holderSide || item.supportsSide || "").toLowerCase();
        return ["plaintiff", "defendant"].includes(side) ? side : "";
      })
      .filter(Boolean);
    return {
      enabled: true,
      reason: "explicit-witness-evidence",
      maxWitnesses: Math.min(complexity <= 2 ? 1 : 2, explicitWitnessItems.length),
      preferredSides: [...new Set(explicitSides)],
    };
  }

  if (!hasNaturalNonPartyCue || complexity === 1) {
    return {
      enabled: false,
      reason: complexity === 1 ? "simple-record-or-party-testimony-case" : "no-natural-non-party-witness",
      maxWitnesses: 0,
      preferredSides: [],
    };
  }

  const inclusionThreshold = { 2: 0.4, 3: 0.7, 4: 0.88, 5: 1 }[complexity] || 0;
  const enabled = roll < inclusionThreshold;
  return {
    enabled,
    reason: enabled ? "natural-non-party-observer" : "witness-omitted-for-case-variety",
    maxWitnesses: enabled ? (complexity >= 4 ? 2 : 1) : 0,
    preferredSides: [],
  };
};

const fallbackWitness = ({ side, caseSession }) => {
  const countryCode = String(caseSession?.caseCountry?.code || "").toUpperCase();
  const names =
    countryCode === "IN"
      ? side === "plaintiff"
        ? ["Meera Kapoor", "Neighbour and firsthand observer"]
        : ["Arjun Menon", "Records custodian and site representative"]
      : side === "plaintiff"
      ? ["Jordan Ellis", "Firsthand observer familiar with the events"]
      : ["Morgan Reed", "Records custodian familiar with the response"];

  return {
    id: `${side}-witness-1`,
    name: names[0],
    role: names[1],
    side,
    relationshipToParty: side === "plaintiff" ? "Knows the plaintiff through the events" : "Connected to the defendant's response",
    publicSummary: "A fact witness with personal knowledge of part of the dispute.",
    appearance: "An adult fact witness dressed appropriately for an ordinary court appearance.",
    personality: {
      communicationStyle: side === "plaintiff" ? "earnest and conversational" : "careful and formal",
      dominantTraits: side === "plaintiff" ? ["observant", "protective"] : ["methodical", "guarded"],
      answerRhythm: side === "plaintiff" ? "answers quickly, then corrects small details" : "pauses before precise answers",
      pressureResponse: side === "plaintiff" ? "becomes defensive when motives are challenged" : "narrows answers under pressure",
      privateMotive: "Wants to be seen as helpful without appearing partisan.",
    },
    credibility: {
      reliability: side === "plaintiff" ? 0.68 : 0.62,
      honesty: 0.72,
      memoryDiscipline: side === "plaintiff" ? 0.58 : 0.7,
      emotionalControl: side === "plaintiff" ? 0.52 : 0.7,
      bias: side === "plaintiff" ? "Feels protective of the plaintiff" : "Has a professional connection to the defendant",
      vulnerabilities: ["Did not personally observe every disputed event"],
      liveAdjustment: 0,
    },
    knowledge: {
      knownFacts: cleanList([
        ...(caseSession?.factSheet?.supportingFacts || []),
        ...(caseSession?.factSheet?.timeline || []),
      ], 4),
      uncertainFacts: cleanList(caseSession?.factSheet?.disputedFacts || [], 3),
      boundaries: ["Must not claim personal knowledge of events not included in knownFacts."],
      linkedEvidenceIds: cleanList(caseSession?.factSheet?.discoveredEvidenceIds || [], 4, 120),
    },
    portraitDirection: {
      expressionCue:
        side === "plaintiff"
          ? "open gaze with a trace of nervous tension around the mouth"
          : "controlled expression with slightly guarded eyes",
      bodyLanguage: side === "plaintiff" ? "upright but a little tense" : "composed with restrained shoulders",
    },
    examinationStatus: "available",
    portrait: { image: "", generatedAt: null, prompt: "", promptVersion: 0 },
  };
};

const normalizeWitness = (source = {}, side = "plaintiff", index = 0, caseSession = {}) => {
  const fallback = fallbackWitness({ side, caseSession });
  const name = cleanText(source.name, 100) || fallback.name;
  return {
    id: slugify(source.id || `${side}-${name}`) || `${side}-witness-${index + 1}`,
    name,
    role: cleanText(source.role, 160) || fallback.role,
    side,
    relationshipToParty:
      cleanText(source.relationshipToParty, 240) || fallback.relationshipToParty,
    publicSummary: cleanText(source.publicSummary, 280) || fallback.publicSummary,
    appearance: cleanText(source.appearance, 600) || fallback.appearance,
    personality: {
      communicationStyle:
        cleanText(source.personality?.communicationStyle, 180) ||
        fallback.personality.communicationStyle,
      dominantTraits:
        cleanList(source.personality?.dominantTraits, 4, 80).length
          ? cleanList(source.personality.dominantTraits, 4, 80)
          : fallback.personality.dominantTraits,
      answerRhythm:
        cleanText(source.personality?.answerRhythm, 220) || fallback.personality.answerRhythm,
      pressureResponse:
        cleanText(source.personality?.pressureResponse, 260) || fallback.personality.pressureResponse,
      privateMotive:
        cleanText(source.personality?.privateMotive, 260) || fallback.personality.privateMotive,
    },
    credibility: {
      reliability: clamp(source.credibility?.reliability, 0.15, 0.95, fallback.credibility.reliability),
      honesty: clamp(source.credibility?.honesty, 0.15, 0.95, fallback.credibility.honesty),
      memoryDiscipline: clamp(
        source.credibility?.memoryDiscipline,
        0.15,
        0.95,
        fallback.credibility.memoryDiscipline
      ),
      emotionalControl: clamp(
        source.credibility?.emotionalControl,
        0.15,
        0.95,
        fallback.credibility.emotionalControl
      ),
      bias: cleanText(source.credibility?.bias, 260) || fallback.credibility.bias,
      vulnerabilities:
        cleanList(source.credibility?.vulnerabilities, 5, 260).length
          ? cleanList(source.credibility.vulnerabilities, 5, 260)
          : fallback.credibility.vulnerabilities,
      liveAdjustment: 0,
    },
    knowledge: {
      knownFacts:
        cleanList(source.knowledge?.knownFacts, 8).length
          ? cleanList(source.knowledge.knownFacts, 8)
          : fallback.knowledge.knownFacts,
      uncertainFacts:
        cleanList(source.knowledge?.uncertainFacts, 5).length
          ? cleanList(source.knowledge.uncertainFacts, 5)
          : fallback.knowledge.uncertainFacts,
      boundaries:
        cleanList(source.knowledge?.boundaries, 5).length
          ? cleanList(source.knowledge.boundaries, 5)
          : fallback.knowledge.boundaries,
      linkedEvidenceIds: cleanList(source.knowledge?.linkedEvidenceIds, 6, 120),
    },
    portraitDirection: {
      expressionCue:
        cleanText(source.portraitDirection?.expressionCue, 220) ||
        fallback.portraitDirection.expressionCue,
      bodyLanguage:
        cleanText(source.portraitDirection?.bodyLanguage, 220) ||
        fallback.portraitDirection.bodyLanguage,
    },
    examinationStatus: "available",
    portrait: { image: "", generatedAt: null, prompt: "", promptVersion: 0 },
  };
};

export const ensureCaseWitnesses = async ({ caseSession, userId } = {}) => {
  if (Number(caseSession?.witnessRosterVersion) >= WITNESS_ROSTER_VERSION) {
    return { created: false, usageEntries: [] };
  }

  const rosterPlan = buildWitnessRosterPlan(caseSession);
  if (!rosterPlan.enabled) {
    caseSession.witnesses = [];
    caseSession.witnessRosterVersion = WITNESS_ROSTER_VERSION;
    caseSession.markModified?.("witnesses");
    return { created: true, usageEntries: [] };
  }

  const usageCollector = createUsageCollector("courtroom");
  let aiResult = null;
  try {
    aiResult = await requestStructuredCompletion({
      userId,
      model: WITNESS_MODEL,
      temperature: 0.82,
      maxTokens: 2200,
      retryAttempts: 1,
      usageLabel: "courtroom.witnessRoster",
      onUsage: usageCollector.record,
      systemPrompt:
        "You create private role-actor profiles for fact witnesses in a legal strategy game. Each witness must feel like a distinct person with stable speech habits, motives, memory limits, bias, and a pressure response. Witnesses are not omniscient: knownFacts are the only facts they may affirm from personal knowledge, uncertainFacts must be hedged, and boundaries are hard prohibitions. Credibility characteristics and portrait expression cues are hidden game calibration and must never be stated to the player. Avoid stereotypes based on nationality, gender, ethnicity, occupation, class, or appearance. Output valid JSON only.",
      userPrompt: JSON.stringify({
        task:
          `Create ${rosterPlan.maxWitnesses} useful but imperfect non-party fact witness${rosterPlan.maxWitnesses === 1 ? "" : "es"}. Give each a distinct personality and testimony vulnerability. Their presence and knowledge must be traceable to the supplied case source; do not turn either litigating party into an extra witness and do not invent new documents, admissions, outcomes, or decisive events.`,
        caseSource: getCaseSource(caseSession),
        rosterPlan,
        designRules: [
          "Use plausible fresh names appropriate to the country setting without stereotyping.",
          "Do not use either party's name, role, or identity as a substitute witness. These are additional non-party witnesses only.",
          "Respect rosterPlan.maxWitnesses exactly. If preferredSides is non-empty, use those sides first; otherwise choose the side naturally supported by the source.",
          "Make publicSummary neutral and non-evaluative; never reveal whether the witness is strong or weak.",
          "appearance describes only stable visible identity and ordinary courtroom clothing.",
          "portraitDirection.expressionCue may subtly reflect composure, candor, guardedness, or nervousness, but must remain natural and ambiguous.",
          "Do not encode credibility with sinister lighting, villain styling, beauty, disability, age, race, or other protected characteristics.",
        ],
        outputSchema: {
          witnesses: [
            {
              name: "string",
              role: "string",
              side: "plaintiff|defendant",
              relationshipToParty: "string",
              publicSummary: "neutral string",
              appearance: "string",
              personality: {
                communicationStyle: "string",
                dominantTraits: ["string"],
                answerRhythm: "string",
                pressureResponse: "string",
                privateMotive: "string",
              },
              credibility: {
                reliability: "number 0-1",
                honesty: "number 0-1",
                memoryDiscipline: "number 0-1",
                emotionalControl: "number 0-1",
                bias: "string",
                vulnerabilities: ["string"],
              },
              knowledge: {
                knownFacts: ["string"],
                uncertainFacts: ["string"],
                boundaries: ["string"],
                linkedEvidenceIds: ["string"],
              },
              portraitDirection: {
                expressionCue: "subtle natural expression direction",
                bodyLanguage: "subtle natural posture direction",
              },
            },
          ],
        },
      }),
    });
  } catch (error) {
    console.error("Witness roster generation failed", error);
  }

  const sourceWitnesses = (Array.isArray(aiResult?.witnesses) ? aiResult.witnesses : [])
    .filter((item) => ["plaintiff", "defendant"].includes(item?.side))
    .slice(0, rosterPlan.maxWitnesses);
  const playerTemplateSide = getPlayerTemplateSide(caseSession);
  const fallbackSides = rosterPlan.preferredSides.length
    ? [...rosterPlan.preferredSides]
    : [playerTemplateSide];
  const oppositeSide = playerTemplateSide === "plaintiff" ? "defendant" : "plaintiff";
  for (const side of [playerTemplateSide, oppositeSide]) {
    if (fallbackSides.length >= rosterPlan.maxWitnesses) break;
    if (!fallbackSides.includes(side)) fallbackSides.push(side);
  }
  const witnesses = sourceWitnesses.length
    ? sourceWitnesses.map((item, index) =>
        normalizeWitness(item, item.side, index, caseSession)
      )
    : fallbackSides
        .slice(0, rosterPlan.maxWitnesses)
        .map((side, index) => normalizeWitness({}, side, index, caseSession));
  caseSession.witnesses = witnesses;
  caseSession.witnessRosterVersion = WITNESS_ROSTER_VERSION;
  caseSession.markModified?.("witnesses");
  return { created: true, usageEntries: usageCollector.entries };
};

export const buildPublicWitnessPayload = (caseSession = {}) => {
  const playerSide = getPlayerTemplateSide(caseSession);
  const state = caseSession.witnessExamination || {};
  return (Array.isArray(caseSession.witnesses) ? caseSession.witnesses : []).map((witness) => ({
    id: cleanText(witness.id, 100),
    name: cleanText(witness.name, 100),
    role: cleanText(witness.role, 160),
    relationshipToParty: cleanText(witness.relationshipToParty, 240),
    publicSummary: cleanText(witness.publicSummary, 280),
    side: witness.side === playerSide ? "yours" : "opposing",
    examinationStatus: cleanText(witness.examinationStatus, 40) || "available",
    portrait: witness.portrait?.image ? { image: witness.portrait.image } : { image: "" },
    active: cleanText(state.activeWitnessId, 100) === cleanText(witness.id, 100),
  }));
};

export const startWitnessExamination = async ({ caseSession, witnessId, userId } = {}) => {
  const usageCollector = createUsageCollector("courtroom");
  const witness = (caseSession.witnesses || []).find(
    (item) => cleanText(item.id, 100) === cleanText(witnessId, 100)
  );
  if (!witness) throw new Error("Witness not found.");
  if (witness.examinationStatus === "completed") {
    throw new Error("This witness has already completed testimony.");
  }
  if (caseSession.witnessExamination?.activeWitnessId) {
    throw new Error("Finish the current examination before calling another witness.");
  }

  const owner = getWitnessSideOwner(caseSession, witness);
  const examinationType = owner === "player" ? "direct" : "cross";
  const entries = [];

  if (owner === "opponent") {
    const result = await requestStructuredCompletion({
      userId,
      model: WITNESS_MODEL,
      temperature: 0.62,
      maxTokens: 850,
      retryAttempts: 1,
      usageLabel: "courtroom.witnessOpponentDirect",
      onUsage: usageCollector.record,
      systemPrompt:
        "You simulate a short direct examination by opposing counsel and a fact witness. Stay strictly within the witness's private knowledge. The witness must speak with their supplied personality but must not reveal profile labels, credibility scores, hidden facts, or game mechanics. Output valid JSON only.",
      userPrompt: JSON.stringify({
        task:
          "Write one focused non-leading direct question and the witness's answer establishing their core admissible testimony before the player's cross-examination.",
        witness,
        recentCourtroomTranscript: (caseSession.courtroomTranscript || []).slice(-8),
        outputSchema: {
          question: "string",
          answer: "string",
          admittedFacts: ["verbatim or close paraphrase of knownFacts only"],
          benchSignal: "short neutral string",
        },
      }),
    });
    const question = cleanText(result?.question, 800) || "What did you personally observe about the events in dispute?";
    const answer = cleanText(result?.answer, 1400) || "I can only speak to the part I personally observed.";
    entries.push(
      buildWitnessTranscriptEntry({
        caseSession,
        speaker: "opponent",
        text: question,
        entryType: "question",
        witness,
        examinationType: "direct",
      }),
      buildWitnessTranscriptEntry({
        caseSession,
        speaker: "witness",
        text: answer,
        entryType: "answer",
        witness,
        examinationType: "direct",
        admitted: true,
        citedFacts: cleanList(result?.admittedFacts, 4),
      })
    );
    caseSession.score.lastBenchSignal = cleanText(result?.benchSignal, 400) ||
      `${witness.name}'s direct testimony is now part of the record.`;
  }

  witness.examinationStatus = "active";
  caseSession.witnessExamination = {
    phase: examinationType,
    activeWitnessId: witness.id,
    examinationType,
    calledBy: owner,
    questionsUsed: 0,
    maxQuestions: 3,
    completedWitnessIds: caseSession.witnessExamination?.completedWitnessIds || [],
  };
  caseSession.markModified?.("witnesses");
  caseSession.markModified?.("witnessExamination");
  return { entries, usageEntries: usageCollector.entries };
};

const normalizeObjectionGround = (value = "") => {
  const allowed = new Set([
    "leading",
    "hearsay",
    "relevance",
    "speculation",
    "asked-and-answered",
    "argumentative",
    "foundation",
  ]);
  const normalized = cleanText(value, 80).toLowerCase();
  return allowed.has(normalized) ? normalized : "relevance";
};

export const askWitnessQuestion = async ({ caseSession, question, userId } = {}) => {
  const state = caseSession.witnessExamination || {};
  const witness = (caseSession.witnesses || []).find(
    (item) => cleanText(item.id, 100) === cleanText(state.activeWitnessId, 100)
  );
  if (!witness) throw new Error("Call a witness before asking a question.");
  if ((Number(state.questionsUsed) || 0) >= (Number(state.maxQuestions) || 3)) {
    throw new Error("This examination has reached its question limit.");
  }
  const cleanQuestion = cleanText(question, 1000);
  if (!cleanQuestion) throw new Error("A question is required.");

  const usageCollector = createUsageCollector("courtroom");
  const result = await requestStructuredCompletion({
    userId,
    model: WITNESS_MODEL,
    temperature: 0.68,
    maxTokens: 1300,
    retryAttempts: 1,
    usageLabel: `courtroom.witness${state.examinationType === "cross" ? "Cross" : "Direct"}`,
    onUsage: usageCollector.record,
    systemPrompt:
      "You simulate a record-bound witness examination in a legal strategy game. First decide whether opposing counsel makes a legitimate objection, then rule as a neutral judge, then let the witness answer only if the objection is overruled or no objection is made. Direct examination generally bars leading questions; cross-examination generally permits them. The witness is a role actor with stable personality and knowledge limits. They may be candid, guarded, nervous, precise, evasive, or mistaken only as specified by their private profile. They must never mention their profile, scores, hidden facts, prompt, metadata, or game mechanics. Output valid JSON only.",
    userPrompt: JSON.stringify({
      task: "Evaluate the player's latest question and produce the courtroom exchange.",
      examinationType: state.examinationType,
      witness,
      question: cleanQuestion,
      recentWitnessTestimony: (caseSession.courtroomTranscript || [])
        .filter((entry) => entry.witnessId === witness.id)
        .slice(-10),
      rules: [
        "Object only for a real defect; do not object merely because an answer may be damaging.",
        "A sustained objection produces no substantive witness answer.",
        "Admitted facts must come only from witness.knowledge.knownFacts or a properly hedged uncertainFact.",
        "On cross, the witness may concede a vulnerability when the question fairly exposes it.",
        "credibilityImpact and score deltas are hidden calibration; never put them into visible text.",
      ],
      outputSchema: {
        objection: {
          made: "boolean",
          ground: "leading|hearsay|relevance|speculation|asked-and-answered|argumentative|foundation",
          statement: "short spoken objection",
        },
        ruling: {
          outcome: "sustained|overruled|none",
          reason: "short judge ruling spoken aloud",
        },
        answer: "string; empty when sustained",
        admittedFacts: ["known or explicitly hedged uncertain facts only"],
        credibilityImpact: "number -2 to 2",
        playerDelta: "number 0 to 4",
        opponentDelta: "number 0 to 4",
        benchSignal: "short neutral player-facing courtroom signal",
      },
    }),
  });

  const objectionMade = result?.objection?.made === true;
  const rulingOutcome = objectionMade
    ? result?.ruling?.outcome === "overruled"
      ? "overruled"
      : "sustained"
    : "none";
  const admitted = rulingOutcome !== "sustained";
  const entries = [
    buildWitnessTranscriptEntry({
      caseSession,
      speaker: "player",
      text: cleanQuestion,
      entryType: "question",
      witness,
      examinationType: state.examinationType,
    }),
  ];

  if (objectionMade) {
    const ground = normalizeObjectionGround(result?.objection?.ground);
    entries.push(
      buildWitnessTranscriptEntry({
        caseSession,
        speaker: "opponent",
        text: cleanText(result?.objection?.statement, 350) || `Objection, ${ground}.`,
        entryType: "objection",
        witness,
        examinationType: state.examinationType,
        objectionGround: ground,
      }),
      buildWitnessTranscriptEntry({
        caseSession,
        speaker: "judge",
        text:
          cleanText(result?.ruling?.reason, 450) ||
          (rulingOutcome === "sustained" ? "Sustained. Rephrase the question." : "Overruled. The witness may answer."),
        entryType: "ruling",
        witness,
        examinationType: state.examinationType,
        ruling: rulingOutcome,
      })
    );
  }

  if (admitted) {
    entries.push(
      buildWitnessTranscriptEntry({
        caseSession,
        speaker: "witness",
        text: cleanText(result?.answer, 1600) || "I do not know that from my own experience.",
        entryType: "answer",
        witness,
        examinationType: state.examinationType,
        admitted: true,
        citedFacts: cleanList(result?.admittedFacts, 4),
      })
    );
  }

  state.questionsUsed = (Number(state.questionsUsed) || 0) + 1;
  witness.credibility.liveAdjustment = clamp(
    (Number(witness.credibility?.liveAdjustment) || 0) + clamp(result?.credibilityImpact, -2, 2, 0),
    -5,
    5,
    0
  );
  const playerDelta = clamp(result?.playerDelta, 0, 4, admitted ? 1 : 0);
  const opponentDelta = clamp(result?.opponentDelta, 0, 4, objectionMade && rulingOutcome === "sustained" ? 1 : 0);
  caseSession.score.player += playerDelta;
  caseSession.score.opponent += opponentDelta;
  caseSession.score.lastBenchSignal =
    cleanText(result?.benchSignal, 500) ||
    (admitted ? "The court will weigh that answer with the rest of the testimony." : "The question did not reach the evidentiary record.");
  caseSession.markModified?.("witnesses");
  caseSession.markModified?.("witnessExamination");
  return { entries, usageEntries: usageCollector.entries };
};

export const endWitnessExamination = async ({ caseSession, userId } = {}) => {
  const state = caseSession.witnessExamination || {};
  const witness = (caseSession.witnesses || []).find(
    (item) => cleanText(item.id, 100) === cleanText(state.activeWitnessId, 100)
  );
  if (!witness) throw new Error("There is no active witness examination.");
  const usageCollector = createUsageCollector("courtroom");
  const entries = [];

  if (state.examinationType === "direct") {
    const result = await requestStructuredCompletion({
      userId,
      model: WITNESS_MODEL,
      temperature: 0.66,
      maxTokens: 950,
      retryAttempts: 1,
      usageLabel: "courtroom.witnessAutomaticCross",
      onUsage: usageCollector.record,
      systemPrompt:
        "You simulate a concise cross-examination by opposing counsel. Ask one sharp but fair leading question grounded in the existing testimony and the witness's private vulnerability, then answer in the witness's stable voice. Do not reveal profile labels, hidden calibration, scores, or game mechanics. Do not invent facts. Output valid JSON only.",
      userPrompt: JSON.stringify({
        task: "Close the witness's appearance with one opposing cross-examination exchange.",
        witness,
        existingTestimony: (caseSession.courtroomTranscript || [])
          .filter((entry) => entry.witnessId === witness.id)
          .slice(-12),
        outputSchema: {
          question: "string",
          answer: "string",
          admittedFacts: ["string"],
          benchSignal: "short neutral string",
        },
      }),
    });
    entries.push(
      buildWitnessTranscriptEntry({
        caseSession,
        speaker: "opponent",
        text: cleanText(result?.question, 850) || "You did not personally observe every event in dispute, correct?",
        entryType: "question",
        witness,
        examinationType: "cross",
      }),
      buildWitnessTranscriptEntry({
        caseSession,
        speaker: "witness",
        text: cleanText(result?.answer, 1400) || "Correct. I can only speak to what I personally observed.",
        entryType: "answer",
        witness,
        examinationType: "cross",
        admitted: true,
        citedFacts: cleanList(result?.admittedFacts, 4),
      })
    );
    caseSession.score.lastBenchSignal =
      cleanText(result?.benchSignal, 500) || `${witness.name}'s testimony is complete.`;
  } else {
    caseSession.score.lastBenchSignal = `${witness.name}'s cross-examination is complete. The testimony remains part of the record.`;
  }

  witness.examinationStatus = "completed";
  const completedWitnessIds = Array.from(
    new Set([...(state.completedWitnessIds || []), cleanText(witness.id, 100)])
  );
  caseSession.witnessExamination = {
    phase: "idle",
    activeWitnessId: "",
    examinationType: "",
    calledBy: "",
    questionsUsed: 0,
    maxQuestions: 3,
    completedWitnessIds,
  };
  caseSession.markModified?.("witnesses");
  caseSession.markModified?.("witnessExamination");
  return { entries, usageEntries: usageCollector.entries };
};

export const buildWitnessTranscriptEntry = ({
  caseSession,
  speaker,
  text,
  entryType,
  witness,
  examinationType = "",
  admitted = false,
  citedFacts = [],
  objectionGround = "",
  ruling = "",
} = {}) => ({
  round: Math.max(1, (Number(caseSession?.score?.roundsCompleted) || 0) + 1),
  speaker,
  speakerName:
    speaker === "witness"
      ? witness?.name
      : speaker === "judge"
      ? "The Court"
      : speaker === "player"
      ? "You"
      : "Opposing counsel",
  text: cleanText(text, 2200),
  entryType,
  witnessId: witness?.id || "",
  witnessName: witness?.name || "",
  examinationType,
  admitted,
  objectionGround,
  ruling,
  citedFacts: cleanList(citedFacts, 4),
  citedClaimIds: [],
  citedEvidenceIds: [],
  citedRules: [],
  judgeNotes: {
    playerDelta: 0,
    opponentDelta: 0,
    strengths: [],
    weaknesses: [],
    benchSignal: "",
  },
});
