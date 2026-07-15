const countWords = (value = "") => String(value || "").trim().split(/\s+/).filter(Boolean).length;
const sum = (items = []) => items.reduce((total, value) => total + (Number(value) || 0), 0);

export const buildObjectiveAwardMatches = ({ context = {}, career = {}, definitions = [] } = {}) => {
  const matches = [];
  const byCode = new Map(definitions.map((definition) => [definition.code, definition]));
  const add = (code, evidence, progress = 1, metadata = {}) => {
    if (byCode.get(code)?.enabled) matches.push({ code, evidence, progress, metadata });
  };
  const won = context.outcome === "win";
  const settled = context.outcome === "settled";
  const categoryWins = career.winsByLegalCategory || {};
  const jurisdictionWins = career.winsByJurisdiction || {};
  const sideWins = career.winsBySide || {};
  const evidenceTypes = new Set(context.evidenceTypes || []);
  const submittedEvidence = context.submittedEvidenceIds || [];
  const argumentWords = Number(context.argumentWordCount) || sum(
    (context.playerArguments || []).map((item) => countWords(item.text || item))
  );

  if (won && career.totalWins >= 1) add("first_victory", "Recorded the first career victory.", 1);
  if (career.currentWinStreak >= 3) add("winning_streak", `${career.currentWinStreak} consecutive wins.`, career.currentWinStreak);
  if (career.totalWins >= 10) add("career_wins", `${career.totalWins} career victories.`, career.totalWins);
  if (won && Number(context.difficulty) >= 5) add("giant_killer", "Won a complexity-five matter.");
  if (career.totalWins >= 25 && Number(context.overallRating) >= 1800) add("elite_advocate", "Reached 1,800 rating with at least 25 wins.");

  if (won && context.intakeQuestionCount != null && context.intakeQuestionCount <= 5) add("minimal_intake", `Won after ${context.intakeQuestionCount} intake questions.`);
  if (context.allMaterialFactsDiscovered === true) add("complete_picture", "Discovered every high-priority material fact.");
  if (context.intakeDurationSeconds != null && context.intakeDurationSeconds <= 480) add("rapid_intake", "Completed intake within eight minutes of recorded play.");
  if (context.allMaterialRisksDiscovered === true) add("no_surprises", "Identified every high-priority risk in the case file.");
  if (evidenceTypes.has("photo")) add("picture_perfect", "Discovered photographic evidence.");
  if (["document", "invoice", "record", "message"].filter((type) => evidenceTypes.has(type)).length >= 2) add("paper_trail", "Assembled multiple forms of documentary evidence.");
  if (won && Number(context.legalRulesCorrectlyApplied) >= 2) add("rule_of_law", `Applied ${context.legalRulesCorrectlyApplied} relevant rules in a victory.`);
  if (won && Number(context.argumentCount) > 0 && Number(context.legalRulesCorrectlyApplied) > 0 && submittedEvidence.length > 0) add("complete_advocacy", "Combined facts, evidence, and law in a victory.");

  if (won && Number(context.argumentCount) <= 2) add("light_touch", `Won with ${context.argumentCount} courtroom submissions.`);
  if (won && context.durationSeconds != null && context.durationSeconds <= 900) add("swift_justice", "Completed a winning matter within fifteen minutes of recorded play.");
  if (won && context.evidenceSubmittedCount != null && context.evidenceSubmittedCount <= 1) add("travel_light", `Won with ${context.evidenceSubmittedCount} submitted exhibit${context.evidenceSubmittedCount === 1 ? "" : "s"}.`);
  if (won && argumentWords <= 350) add("concise_counsel", `Won with ${argumentWords} words of courtroom argument.`);
  if (won && Number(context.argumentCount) === 1) add("one_shot", "Won after one courtroom submission.");

  if (settled) add("peace_broker", "Concluded a successful settlement.");
  if (settled && Number(context.settlement?.qualityScore) >= 55) add("fair_compromise", `Settlement quality scored ${context.settlement.qualityScore}/100.`);
  if (settled && Number(context.settlement?.rejectedOffers) >= 1) add("impasse_to_agreement", "Reached agreement after a rejected offer.");
  if (settled && context.amountClaimed != null && context.settlement?.monetaryOutcome != null && context.settlement.monetaryOutcome >= context.amountClaimed) add("full_value_settlement", "Settlement met the full validated monetary claim.");

  if (won && context.side === "defendant" && context.disposition === "dismissed") add("case_dismissed", "Obtained dismissal of the claim.");
  if (won && context.side === "defendant" && context.legalCategory === "criminal") add("reasonable_doubt", "Won a criminal matter for the defence.");
  if (won && context.side === "claimant") add("claimants_champion", `${Number(sideWins.claimant) || 1} claimant-side wins.`, Number(sideWins.claimant) || 1);

  const practiceRules = [
    ["property_practitioner", ["property", "rental-dispute"]],
    ["employment_advocate", ["employment"]],
    ["consumer_champion", ["consumer"]],
    ["commercial_counsel", ["business-dispute", "contract-violation"]],
    ["family_law_hand", ["marital-dispute"]],
  ];
  for (const [code, categories] of practiceRules) {
    const progress = sum(categories.map((category) => categoryWins[category]));
    if (progress >= 3) add(code, `${progress} qualifying practice-area wins.`, progress);
  }
  const jurisdictionCount = Object.values(jurisdictionWins).filter((count) => Number(count) > 0).length;
  if (jurisdictionCount >= 3) add("global_counsel", `Victories in ${jurisdictionCount} jurisdictions.`, jurisdictionCount);
  const categoryCount = Object.values(categoryWins).filter((count) => Number(count) > 0).length;
  if (categoryCount >= 5) add("general_practitioner", `Victories in ${categoryCount} legal categories.`, categoryCount);
  const specialistWins = Math.max(0, ...Object.values(categoryWins).map(Number));
  if (specialistWins >= 10) add("specialist", `${specialistWins} wins in the strongest practice area.`, specialistWins);
  if ((career.legalRulesApplied || []).length >= 10) add("walking_encyclopedia", `Applied ${(career.legalRulesApplied || []).length} distinct legal rules.`, (career.legalRulesApplied || []).length);

  if (won && context.jurisdiction) {
    const countryCode = String(context.jurisdiction).toUpperCase();
    const countryAwardCode = `country_${countryCode.toLowerCase()}`;
    const countryDefinition = byCode.get(countryAwardCode);
    if (countryDefinition?.metadata?.countryCode === countryCode) {
      const progress = Number(jurisdictionWins[countryCode]) || 1;
      add(countryAwardCode, `Recorded ${progress} ${progress === 1 ? "victory" : "victories"} in ${countryDefinition.metadata.countryName}.`, progress, { countryCode });
    }
  }

  return matches;
};

export const objectivePrerequisiteSatisfied = (code, context = {}) => {
  const won = context.outcome === "win";
  switch (code) {
    case "against_the_odds": return won && context.initialSuccessChance != null && context.initialSuccessChance <= 35;
    case "comeback_counsel": return won && context.initialSuccessChance != null && context.initialSuccessChance < 50;
    case "clean_sweep": return won;
    case "chain_of_proof": return (context.evidenceSubmittedCount || 0) >= 2;
    case "evidence_purist": return won;
    case "nothing_wasted": return won && (context.argumentCount || 0) <= 3;
    case "maximum_leverage": return won || context.outcome === "settled";
    case "walk_away_wisely": return (context.settlement?.rejectedOffers || 0) > 0;
    case "hard_bargainer": return context.outcome === "settled";
    case "complete_defence": return won && context.side === "defendant";
    case "damage_control": return context.side === "defendant" && context.expectedLiabilityBefore != null && context.actualLiability != null && context.actualLiability < context.expectedLiabilityBefore;
    case "reduced_exposure": return context.side === "defendant" && context.expectedLiabilityBefore != null && context.actualLiability != null && context.actualLiability <= context.expectedLiabilityBefore * 0.7;
    case "full_recovery": return won && context.side === "claimant" && context.amountClaimed != null && context.amountAwarded != null && context.amountAwarded >= context.amountClaimed;
    case "beyond_expectations": return won && context.initialSuccessChance != null && context.initialSuccessChance < 50;
    case "legal_alchemy": return won && context.initialSuccessChance != null && context.initialSuccessChance <= 25;
    case "how_did_that_work": return won && context.initialSuccessChance != null && context.initialSuccessChance <= 35;
    default: return true;
  }
};
