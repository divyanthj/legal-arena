import { CASE_COUNTRIES, countryFlagEmoji } from "../countryCatalogue.mjs";

export const AWARD_CATALOGUE_VERSION = "2026.07.2";
export const DEFAULT_DISTINCTION_THRESHOLDS = Object.freeze({
  bronze: 1,
  silver: 3,
  gold: 10,
  diamond: 25,
});

const categoryKinds = {
  career: "honour",
  expertise: "badge",
};

const objectiveCodes = new Set([
  "first_victory", "winning_streak", "career_wins", "giant_killer", "elite_advocate",
  "minimal_intake", "complete_picture", "rapid_intake", "no_surprises",
  "picture_perfect", "paper_trail", "rule_of_law", "complete_advocacy",
  "light_touch", "swift_justice", "travel_light", "concise_counsel", "one_shot",
  "peace_broker", "full_value_settlement", "fair_compromise", "impasse_to_agreement", "case_dismissed",
  "reasonable_doubt", "claimants_champion", "property_practitioner", "employment_advocate",
  "consumer_champion", "commercial_counsel", "family_law_hand", "global_counsel",
  "general_practitioner", "specialist", "walking_encyclopedia",
]);

const hybridCodes = new Set([
  "against_the_odds", "comeback_counsel", "clean_sweep", "chain_of_proof",
  "evidence_purist", "nothing_wasted", "maximum_leverage", "walk_away_wisely",
  "hard_bargainer", "complete_defence", "damage_control", "reduced_exposure",
  "full_recovery", "beyond_expectations", "legal_alchemy", "how_did_that_work",
]);

const rows = [
  ["first_victory", "First Victory", "🏁", "Win your first decided matter in the arena.", "career", false],
  ["winning_streak", "Hot Streak", "🔥", "Build an unbroken run of courtroom victories.", "career", true, { bronze: 3, silver: 5, gold: 10, diamond: 25 }],
  ["career_wins", "Career Victor", "💯", "Accumulate victories across your legal career.", "career", true, { bronze: 10, silver: 25, gold: 50, diamond: 100 }],
  ["giant_killer", "Giant Killer", "👑", "Win a complexity-five matter.", "career", true],
  ["against_the_odds", "Against the Odds", "🧗", "Win after entering court with a success estimate below 35%.", "career", true],
  ["comeback_counsel", "Comeback Counsel", "🌙", "Turn a materially adverse position into victory through advocacy.", "career", true],
  ["clean_sweep", "Clean Sweep", "🧹", "Win every material issue and obtain the complete requested disposition.", "career", true],
  ["elite_advocate", "Elite Advocate", "🏆", "Reach a 1,800 overall rating with at least 25 career wins.", "career", false],

  ["right_question", "The Right Question", "❓", "Ask the question that unlocks a decisive fact.", "intake", true],
  ["minimal_intake", "Five Questions or Fewer", "🎯", "Win after asking no more than five intake questions.", "intake", true],
  ["complete_picture", "Complete Picture", "🧩", "Discover every high-priority material fact before court.", "intake", true],
  ["red_flag_spotter", "Red Flag Spotter", "🚨", "Identify a serious weakness before it can surprise your client.", "intake", true],
  ["client_whisperer", "Client Whisperer", "🕵️", "Draw out guarded information with precise, empathetic questioning.", "intake", true],
  ["rapid_intake", "Rapid Intake", "⏱️", "Complete a thorough intake within eight minutes of active play.", "intake", true],
  ["no_surprises", "No Surprises", "🪤", "Identify every high-priority risk recorded in the case file.", "intake", true],
  ["open_ended_advocate", "Let Them Speak", "🤫", "Use open questions to reveal material information without leading the witness.", "intake", true],

  ["needle_in_haystack", "Needle in the Haystack", "🔍", "Find a deeply hidden fact that materially changes the case.", "investigation", true],
  ["picture_perfect", "Picture Perfect", "📸", "Discover and use photographic evidence in a completed matter.", "evidence", true],
  ["paper_trail", "Paper Trail", "🧾", "Assemble and use multiple documentary records.", "evidence", true],
  ["chain_of_proof", "Chain of Proof", "🔗", "Connect evidence into a complete, persuasive chain of proof.", "evidence", true],
  ["smoking_gun", "Smoking Gun", "🧨", "Uncover evidence that directly resolves a decisive issue.", "evidence", true],
  ["evidence_purist", "Evidence Purist", "🧹", "Win while relying only on evidence the record supports as reliable.", "evidence", true],
  ["turned_their_evidence", "Turn Their Evidence", "🔄", "Use the opposing side's evidence to advance your own case.", "evidence", true],
  ["contradiction_exposed", "Contradiction Exposed", "🪞", "Expose a material contradiction in the opposing account.", "evidence", true],

  ["point_by_point", "Point-by-Point", "⚔️", "Answer every major opposing submission directly.", "courtroom", true],
  ["reasonable_inference", "Reasonable Inference", "🧠", "Build a persuasive inference without overstating the record.", "courtroom", true],
  ["rule_of_law", "Rule of Law", "📚", "Win after correctly applying at least two relevant legal rules.", "courtroom", true],
  ["burden_not_met", "Burden Not Met", "🧱", "Win by showing that the opposing party failed its burden.", "courtroom", true],
  ["case_dispositive", "Case-Dispositive", "🎯", "Make an argument that resolves the central legal issue.", "courtroom", true],
  ["narrative_control", "Narrative Control", "🌀", "Keep the court focused on a coherent and legally relevant theory.", "courtroom", true],
  ["cool_under_pressure", "Cool Under Pressure", "🧊", "Recover from adverse bench feedback with a strong response.", "courtroom", true],
  ["final_word", "Final Word", "🔨", "Deliver the decisive submission in the final courtroom round.", "courtroom", true],
  ["complete_advocacy", "Complete Advocate", "🎤", "Win after presenting facts, evidence, and governing rules.", "courtroom", true],
  ["evidence_challenged", "Evidence Challenged", "🚫", "Successfully attack the reliability or relevance of opposing evidence.", "courtroom", true],

  ["light_touch", "Light Touch", "🪶", "Win with no more than two courtroom submissions.", "efficiency", true],
  ["swift_justice", "Swift Justice", "⚡", "Complete a winning matter within fifteen minutes of active play.", "efficiency", true],
  ["travel_light", "Travel Light", "🎒", "Win while relying on no more than one submitted exhibit.", "efficiency", true],
  ["nothing_wasted", "Nothing Wasted", "🧠", "Win with three or fewer arguments and no material irrelevance.", "efficiency", true],
  ["concise_counsel", "Concise Counsel", "✂️", "Win with no more than 350 words of courtroom argument.", "efficiency", true],
  ["one_shot", "One Shot", "🏹", "Win after making a single courtroom submission.", "efficiency", true],
  ["maximum_leverage", "Maximum Leverage", "♻️", "Achieve an excellent result from very few moves or concessions.", "efficiency", true],
  ["straight_to_point", "Straight to the Point", "🧭", "Reach the decisive issue without diversion or repetition.", "efficiency", true],

  ["peace_broker", "Peace Broker", "🤝", "Conclude a successful settlement.", "settlement", true],
  ["full_value_settlement", "Full Value", "💰", "Settle for the full validated value sought by your client.", "settlement", true],
  ["fair_compromise", "Fair Compromise", "⚖️", "Reach a settlement rated fair or better for both sides.", "settlement", true],
  ["deescalator", "De-escalator", "🕊️", "Restore a strained negotiation and guide it to agreement.", "settlement", true],
  ["impasse_to_agreement", "From Impasse to Agreement", "🔄", "Settle after at least one offer was rejected.", "settlement", true],
  ["creative_terms", "Creative Terms", "🎁", "Use meaningful non-monetary terms to unlock agreement.", "settlement", true],
  ["walk_away_wisely", "Walk Away Wisely", "🚪", "Reject a poor settlement and later secure a better final outcome.", "settlement", true],
  ["calm_negotiator", "Calm Negotiator", "🧊", "Remain measured and constructive throughout negotiation.", "settlement", true],
  ["hard_bargainer", "Hard Bargainer", "🦈", "Secure a strong settlement with few concessions and purposeful pressure.", "settlement", true],

  ["complete_defence", "Complete Defence", "🛡️", "Defeat every material claim while representing the defence.", "defence", true],
  ["case_dismissed", "Case Dismissed", "🚫", "Obtain a validated dismissal while representing the defence.", "defence", true],
  ["damage_control", "Damage Control", "🧯", "Materially reduce your client's validated exposure.", "defence", true],
  ["reasonable_doubt", "Reasonable Doubt", "🔓", "Win a criminal matter for the defence.", "defence", true],
  ["reduced_exposure", "Reduced Exposure", "📉", "Hold actual liability materially below the validated pre-case estimate.", "defence", true],
  ["claimants_champion", "Claimant's Champion", "⚔️", "Accumulate victories while representing claimants.", "claimant", true, { bronze: 3, silver: 10, gold: 25, diamond: 50 }],
  ["full_recovery", "Full Recovery", "💸", "Recover the full validated amount claimed for your client.", "claimant", true],
  ["beyond_expectations", "Beyond Expectations", "📈", "Obtain a validated result materially above the initial expectation.", "claimant", true],
  ["damages_proven", "Every Rupee Accounted For", "🧾", "Prove each material component of the claimed loss.", "claimant", true],
  ["accountability", "Accountability", "🔔", "Secure a result that meaningfully acknowledges and remedies wrongdoing.", "claimant", true],

  ["master_strategist", "Master Strategist", "♟️", "Execute a coherent strategy that anticipates the whole case.", "strategy", true],
  ["successful_pivot", "Pivot", "🔄", "Abandon a failing approach and succeed with a stronger theory.", "strategy", true],
  ["strongest_legal_theory", "Know Your Case", "🧭", "Identify and consistently advance the strongest available legal theory.", "strategy", true],
  ["anticipated_rebuttal", "Bait and Rebuttal", "🪤", "Anticipate a major response and answer it decisively.", "strategy", true],
  ["three_moves_ahead", "Three Moves Ahead", "👁️", "Show unusually strong anticipation across intake and court.", "strategy", true],
  ["alternative_theory", "Alternative Theory", "🧬", "Present a coherent alternative theory supported by the record.", "strategy", true],
  ["crisis_management", "Crisis Management", "🧯", "Stabilize the case after a serious adverse development.", "strategy", true],

  ["property_practitioner", "Property Practitioner", "🏠", "Win property or rental matters.", "expertise", true, { bronze: 3, silver: 10, gold: 25, diamond: 50 }],
  ["employment_advocate", "Employment Advocate", "👷", "Win employment matters.", "expertise", true, { bronze: 3, silver: 10, gold: 25, diamond: 50 }],
  ["consumer_champion", "Consumer Champion", "🛒", "Win consumer matters.", "expertise", true, { bronze: 3, silver: 10, gold: 25, diamond: 50 }],
  ["commercial_counsel", "Commercial Counsel", "💼", "Win business or contract matters.", "expertise", true, { bronze: 3, silver: 10, gold: 25, diamond: 50 }],
  ["family_law_hand", "Family Law Hand", "👨‍👩‍👧", "Win marital and family disputes.", "expertise", true, { bronze: 3, silver: 10, gold: 25, diamond: 50 }],
  ["global_counsel", "Global Counsel", "🌐", "Win matters in at least three jurisdictions.", "expertise", true, { bronze: 3, silver: 5, gold: 10, diamond: 20 }],
  ["general_practitioner", "General Practitioner", "🧳", "Win in at least five legal categories.", "expertise", true, { bronze: 5, silver: 7, gold: 9, diamond: 10 }],
  ["specialist", "Specialist", "🦉", "Win ten matters within one legal category.", "expertise", true, { bronze: 10, silver: 25, gold: 50, diamond: 100 }],
  ["walking_encyclopedia", "Walking Encyclopedia", "🧠", "Correctly apply a broad range of legal rules across categories.", "expertise", true],

  ["courtroom_theatricality", "Courtroom Theatricality", "🎩", "Use memorable courtroom flair without losing legal substance.", "style", true],
  ["stone_cold_counsel", "Stone-Cold Counsel", "🧊", "Maintain an exceptionally controlled and clinical advocacy style.", "style", true],
  ["spicy_submission", "Spicy Submission", "🌶️", "Deliver a sharp, memorable submission that remains professionally effective.", "style", true],
  ["technicality", "Technicality", "🐍", "Win through a narrow but valid procedural or technical point.", "style", true],
  ["compassionate_counsel", "Compassionate Counsel", "🫶", "Combine empathy with effective representation.", "style", true],
  ["scorched_earth", "Scorched Earth", "🧨", "Apply relentless, comprehensive pressure across the entire record.", "style", true],
  ["zen_advocate", "Zen Advocate", "🧘", "Win through calm, economical, and consistently measured advocacy.", "style", true],
  ["nice_try", "Nice Try", "😏", "Expose an implausible opposing tactic with a decisive response.", "rare", true],
  ["legal_alchemy", "Legal Alchemy", "🪄", "Transform an extremely weak case with an unconventional but coherent strategy.", "rare", true],
  ["how_did_that_work", "How Did That Work?", "🎲", "Win after a highly unusual, low-probability advocacy choice succeeds.", "rare", true],
];

const metadataByCode = {
  giant_killer: { minimumComplexity: 5, requiresWin: true },
  against_the_odds: { maximumInitialSuccessChance: 35, requiresWin: true },
  elite_advocate: { minimumRating: 1800, minimumWins: 25 },
  minimal_intake: { maximumQuestions: 5, requiresWin: true },
  rapid_intake: { maximumDurationSeconds: 480 },
  rule_of_law: { minimumRulesApplied: 2, requiresWin: true },
  light_touch: { maximumArguments: 2, requiresWin: true },
  swift_justice: { maximumDurationSeconds: 900, requiresWin: true },
  travel_light: { maximumEvidenceSubmitted: 1, requiresWin: true },
  concise_counsel: { maximumArgumentWords: 350, requiresWin: true },
  one_shot: { maximumArguments: 1, requiresWin: true },
  fair_compromise: { minimumSettlementQuality: 55 },
  impasse_to_agreement: { minimumRejectedOffers: 1 },
  reasonable_doubt: { categories: ["criminal"], sides: ["defendant"], requiresWin: true },
  property_practitioner: { categories: ["property", "rental-dispute"] },
  employment_advocate: { categories: ["employment"] },
  consumer_champion: { categories: ["consumer"] },
  commercial_counsel: { categories: ["business-dispute", "contract-violation"] },
  family_law_hand: { categories: ["marital-dispute"] },
  global_counsel: { distinctJurisdictions: true },
  general_practitioner: { distinctCategories: true },
  specialist: { maximumCategoryWins: true },
};

const coreAwardDefinitions = rows.map((row, index) => {
  const [code, name, emoji, description, category, repeatable, tierThresholds] = row;
  const evaluationType = objectiveCodes.has(code)
    ? "objective"
    : hybridCodes.has(code)
      ? "hybrid"
      : "ai";
  return Object.freeze({
    code,
    name,
    emoji,
    description,
    category,
    kind: categoryKinds[category] || "distinction",
    evaluationType,
    repeatable: Boolean(repeatable),
    hiddenUntilUnlocked: category === "rare",
    enabled: true,
    sortOrder: index + 1,
    tierThresholds: repeatable
      ? (tierThresholds || DEFAULT_DISTINCTION_THRESHOLDS)
      : undefined,
    metadata: Object.freeze(metadataByCode[code] || {}),
  });
});

export const COUNTRY_AWARD_DEFINITIONS = Object.freeze(CASE_COUNTRIES.map((country, index) => Object.freeze({
  code: `country_${country.code.toLowerCase()}`,
  name: `${country.name} Counsel`,
  emoji: countryFlagEmoji(country.code),
  description: `Win completed matters set in ${country.name}.`,
  category: "country",
  kind: "distinction",
  evaluationType: "objective",
  repeatable: true,
  hiddenUntilUnlocked: true,
  enabled: true,
  sortOrder: rows.length + index + 1,
  tierThresholds: DEFAULT_DISTINCTION_THRESHOLDS,
  metadata: Object.freeze({ countryCode: country.code, countryName: country.name }),
})));

export const AWARD_DEFINITIONS = Object.freeze([
  ...coreAwardDefinitions,
  ...COUNTRY_AWARD_DEFINITIONS,
]);

export const AWARD_DEFINITION_BY_CODE = new Map(
  AWARD_DEFINITIONS.map((definition) => [definition.code, definition])
);

export const AI_ELIGIBLE_AWARD_CODES = new Set(
  AWARD_DEFINITIONS
    .filter((definition) => definition.evaluationType !== "objective")
    .map((definition) => definition.code)
);

export const CONTRADICTORY_AWARD_GROUPS = Object.freeze([
  Object.freeze(["zen_advocate", "scorched_earth"]),
  Object.freeze(["stone_cold_counsel", "compassionate_counsel"]),
]);
