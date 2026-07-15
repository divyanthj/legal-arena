import nextEnv from "@next/env";
import { MongoClient } from "mongodb";
import { AWARD_CATALOGUE_VERSION, AWARD_DEFINITIONS } from "../libs/game/awards/catalogue.mjs";
import { LAWYER_TITLE_CATALOGUE_VERSION, LAWYER_TITLES } from "../libs/game/awards/titles.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const apply = process.argv.includes("--apply");
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
try {
  const db = client.db();
  const awardCollection = db.collection("awarddefinitions");
  const titleCollection = db.collection("lawyertitles");
  const existingAwards = await awardCollection.countDocuments({ code: { $in: AWARD_DEFINITIONS.map((item) => item.code) } });
  const existingTitles = await titleCollection.countDocuments({ code: { $in: LAWYER_TITLES.map((item) => item.code) } });
  console.table([{ collection: "awarddefinitions", catalogue: AWARD_DEFINITIONS.length, existing: existingAwards, pending: AWARD_DEFINITIONS.length - existingAwards }, { collection: "lawyertitles", catalogue: LAWYER_TITLES.length, existing: existingTitles, pending: LAWYER_TITLES.length - existingTitles }]);
  if (!apply) { console.log("Dry run only. Re-run with --apply to upsert catalogue records and indexes."); process.exitCode = 0; }
  else {
    const now = new Date();
    await awardCollection.bulkWrite(AWARD_DEFINITIONS.map((item) => ({ updateOne: { filter: { code: item.code }, update: { $set: { ...item, catalogueVersion: AWARD_CATALOGUE_VERSION, updatedAt: now }, $setOnInsert: { createdAt: now } }, upsert: true } })), { ordered: false });
    await titleCollection.bulkWrite(LAWYER_TITLES.map((item) => ({ updateOne: { filter: { code: item.code }, update: { $set: { ...item, catalogueVersion: LAWYER_TITLE_CATALOGUE_VERSION, updatedAt: now }, $setOnInsert: { createdAt: now } }, upsert: true } })), { ordered: false });
    const indexes = [
      ["awarddefinitions", { code: 1 }, { unique: true, name: "award_code_unique" }],
      ["playerawards", { playerId: 1, awardDefinitionId: 1 }, { unique: true, name: "player_award_unique" }],
      ["awardoccurrences", { occurrenceKey: 1 }, { unique: true, name: "award_occurrence_key_unique" }],
      ["awardevaluations", { evaluationKey: 1 }, { unique: true, name: "award_evaluation_key_unique" }],
      ["playercareerstats", { playerId: 1 }, { unique: true, name: "player_career_unique" }],
      ["lawyertitles", { code: 1 }, { unique: true, name: "lawyer_title_code_unique" }],
      ["playerlawyertitles", { playerId: 1, lawyerTitleId: 1 }, { unique: true, name: "player_lawyer_title_unique" }],
      ["awardraritysnapshots", { awardDefinitionId: 1 }, { unique: true, name: "award_rarity_unique" }],
    ];
    for (const [collection, keys, options] of indexes) await db.collection(collection).createIndex(keys, options);
    console.log(`Applied ${AWARD_DEFINITIONS.length} awards, ${LAWYER_TITLES.length} titles, and ${indexes.length} unique indexes.`);
  }
} finally { await client.close(); }
