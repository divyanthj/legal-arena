export const LAWYER_TITLE_CATALOGUE_VERSION = "2026.07.1";

export const LAWYER_TITLES = Object.freeze([
  { code: "forensic_advocate", name: "Forensic Advocate", emoji: "🔍", description: "A master of evidence, proof, and contradiction.", requirements: { all: ["chain_of_proof"], any: ["contradiction_exposed", "smoking_gun"] } },
  { code: "settlement_architect", name: "Settlement Architect", emoji: "🤝", description: "Builds durable agreements from difficult disputes.", requirements: { all: ["peace_broker"], category: "settlement", categoryCount: 3 } },
  { code: "efficient_counsel", name: "Efficient Counsel", emoji: "⚡", description: "Achieves more through disciplined, economical advocacy.", requirements: { all: ["minimal_intake", "concise_counsel"], category: "efficiency", categoryCount: 2 } },
  { code: "defender_of_accused", name: "Defender of the Accused", emoji: "🛡️", description: "A proven specialist in protecting defendants.", requirements: { all: ["complete_defence"], category: "defence", categoryCount: 2 } },
  { code: "claimants_champion_title", name: "Claimant's Champion", emoji: "⚔️", description: "A formidable advocate for claimants and recovery.", requirements: { tiers: { claimants_champion: "silver" }, any: ["full_recovery", "damages_proven"] } },
  { code: "master_strategist_title", name: "Master Strategist", emoji: "♟️", description: "Sees the whole case and several moves beyond it.", requirements: { all: ["master_strategist"], category: "strategy", categoryCount: 3 } },
  { code: "global_counsel_title", name: "Global Counsel", emoji: "🌐", description: "A lawyer with a proven record across jurisdictions.", requirements: { all: ["global_counsel"] } },
  { code: "general_practitioner_title", name: "General Practitioner", emoji: "🧳", description: "A versatile lawyer across many fields of law.", requirements: { all: ["general_practitioner"] } },
  { code: "miracle_worker", name: "Miracle Worker", emoji: "🪄", description: "Turns improbable positions into extraordinary results.", requirements: { anyCount: 2, any: ["against_the_odds", "comeback_counsel", "legal_alchemy"] } },
  { code: "elite_advocate_title", name: "Elite Advocate", emoji: "👑", description: "A career record belonging to the arena's highest tier.", requirements: { all: ["elite_advocate"], tiers: { career_wins: "gold", winning_streak: "silver" } } },
].map((title, index) => Object.freeze({ ...title, enabled: true, sortOrder: index + 1 })));

