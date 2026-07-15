import nextEnv from "@next/env";
import { MongoClient, ObjectId } from "mongodb";
import { determineTier, evaluateTitleRequirements } from "../libs/game/awards/core.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const apply = process.argv.includes("--apply");
const batchArg = process.argv.find((item) => item.startsWith("--batch-size="));
const cursorArg = process.argv.find((item) => item.startsWith("--cursor="));
const batchSize = Math.max(1, Math.min(500, Number(batchArg?.split("=")[1]) || 100));
const cursor = cursorArg?.split("=")[1] || "";
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const summary = { players: 0, occurrencesCreated: 0, awardsUpdated: 0, titlesUnlocked: 0, statsUpdated: 0, failures: 0, nextCursor: null };

const increment = (object, key) => { if (key) object[key] = (object[key] || 0) + 1; };
const sideName = (side) => side === "opponent" ? "defendant" : "claimant";

try {
  const db = client.db();
  const definitions = await db.collection("awarddefinitions").find({ enabled: true }).toArray();
  if (!definitions.length) throw new Error("Award catalogue is empty. Run awards:migrate -- --apply first.");
  const definitionByCode = new Map(definitions.map((item) => [item.code, item]));
  const definitionById = new Map(definitions.map((item) => [String(item._id), item]));
  const titles = await db.collection("lawyertitles").find({ enabled: true }).toArray();
  const users = await db.collection("users").find(cursor && ObjectId.isValid(cursor) ? { _id: { $gt: new ObjectId(cursor) } } : {}).sort({ _id: 1 }).limit(batchSize).toArray();

  for (const user of users) {
    summary.players += 1;
    summary.nextCursor = String(user._id);
    try {
      const [cases, challenges] = await Promise.all([
        db.collection("casesessions").find({ userId: user._id, status: { $in: ["verdict", "settled"] } }).toArray(),
        db.collection("challenges").find({ "participants.userId": user._id, status: { $in: ["verdict", "settled"] } }).toArray(),
      ]);
      const events = [
        ...cases.map((item) => ({ sourceType: "case", sourceId: item._id, completedAt: item.completedAt || item.updatedAt, outcome: item.status === "settled" ? "settled" : item.verdict?.winner === "player" ? "win" : item.verdict?.winner === "opponent" ? "loss" : "draw", side: sideName(item.playerSide), category: item.primaryCategory, jurisdiction: item.caseCountry?.code || "", difficulty: Number(item.complexity) || 1 })),
        ...challenges.map((item) => {
          const participant = (item.participants || []).find((entry) => String(entry.userId) === String(user._id));
          return { sourceType: "challenge", sourceId: item._id, completedAt: item.completedAt || item.updatedAt, outcome: item.status === "settled" ? "settled" : participant?.verdict || "draw", side: sideName(participant?.side), category: item.primaryCategory, jurisdiction: item.caseCountry?.code || "", difficulty: Number(item.complexity) || 1 };
        }),
      ].sort((left, right) => new Date(left.completedAt || 0) - new Date(right.completedAt || 0));

      const career = { totalCompletedCases: 0, totalWins: 0, totalLosses: 0, totalDraws: 0, totalSettlements: 0, currentWinStreak: 0, longestWinStreak: 0, winsBySide: {}, winsByDifficulty: {}, winsByLegalCategory: {}, winsByJurisdiction: {}, totalDecisiveFactsDiscovered: 0, totalSuccessfulSettlements: 0, totalFullRecoveries: 0, totalCompleteDefences: 0, wonIntakeQuestionTotal: 0, wonIntakeCaseCount: 0, wonArgumentTotal: 0, wonArgumentCaseCount: 0, legalRulesApplied: [], lastCompletedAt: events.at(-1)?.completedAt || null };

      const grant = async (code, event, progress, evidence) => {
        const definition = definitionByCode.get(code);
        if (!definition) return;
        const occurrenceKey = `${user._id}:${event.sourceType}:${event.sourceId}:${code}:backfill-v1`;
        if (!apply) { summary.occurrencesCreated += 1; return; }
        const tier = definition.tierThresholds ? determineTier(progress, definition.tierThresholds) : null;
        const occurrence = await db.collection("awardoccurrences").updateOne({ occurrenceKey }, { $setOnInsert: { occurrenceKey, playerId: user._id, awardDefinitionId: definition._id, caseId: String(event.sourceId), sourceType: event.sourceType, tierAtTime: tier, evaluationSource: "backfill", evaluationVersion: "backfill-v1", confidence: null, evidenceText: evidence, metadata: null, earnedAt: event.completedAt || new Date(), createdAt: new Date(), updatedAt: new Date() } }, { upsert: true });
        if (!occurrence.upsertedCount) return;
        summary.occurrencesCreated += 1;
        const existing = await db.collection("playerawards").findOne({ playerId: user._id, awardDefinitionId: definition._id });
        if (!definition.repeatable && existing?.firstUnlockedAt) return;
        const highestTier = existing?.highestTier && tier && ["bronze", "silver", "gold", "diamond"].indexOf(existing.highestTier) > ["bronze", "silver", "gold", "diamond"].indexOf(tier) ? existing.highestTier : tier || existing?.highestTier || null;
        await db.collection("playerawards").updateOne({ playerId: user._id, awardDefinitionId: definition._id }, { $setOnInsert: { playerId: user._id, awardDefinitionId: definition._id, firstUnlockedAt: event.completedAt || new Date(), createdAt: new Date() }, $set: { progress, highestTier, lastEarnedAt: event.completedAt || new Date(), lastCaseId: String(event.sourceId), updatedAt: new Date() }, $inc: { occurrenceCount: 1 } }, { upsert: true });
        summary.awardsUpdated += 1;
      };

      let firstWinGranted = false;
      for (const event of events) {
        const won = event.outcome === "win";
        career.totalCompletedCases += 1;
        career.totalWins += won ? 1 : 0;
        career.totalLosses += event.outcome === "loss" ? 1 : 0;
        career.totalDraws += event.outcome === "draw" ? 1 : 0;
        career.totalSettlements += event.outcome === "settled" ? 1 : 0;
        career.totalSuccessfulSettlements += event.outcome === "settled" ? 1 : 0;
        career.currentWinStreak = won ? career.currentWinStreak + 1 : 0;
        career.longestWinStreak = Math.max(career.longestWinStreak, career.currentWinStreak);
        if (won) {
          increment(career.winsBySide, event.side); increment(career.winsByDifficulty, String(event.difficulty)); increment(career.winsByLegalCategory, event.category); increment(career.winsByJurisdiction, event.jurisdiction);
          if (!firstWinGranted) { await grant("first_victory", event, 1, "First historical victory."); firstWinGranted = true; }
          if (career.currentWinStreak >= 3) await grant("winning_streak", event, career.currentWinStreak, `${career.currentWinStreak} consecutive historical wins.`);
          if (career.totalWins >= 10) await grant("career_wins", event, career.totalWins, `${career.totalWins} historical career wins.`);
          if (event.difficulty >= 5) await grant("giant_killer", event, 1, "Historical complexity-five victory.");
          if (event.side === "claimant") await grant("claimants_champion", event, career.winsBySide.claimant, `${career.winsBySide.claimant} claimant-side wins.`);
          if (event.side === "defendant" && event.category === "criminal") await grant("reasonable_doubt", event, 1, "Historical criminal defence victory.");
          const practices = [["property_practitioner", ["property", "rental-dispute"]], ["employment_advocate", ["employment"]], ["consumer_champion", ["consumer"]], ["commercial_counsel", ["business-dispute", "contract-violation"]], ["family_law_hand", ["marital-dispute"]]];
          for (const [code, categories] of practices) { const count = categories.reduce((total, category) => total + (career.winsByLegalCategory[category] || 0), 0); if (count >= 3 && categories.includes(event.category)) await grant(code, event, count, `${count} historical practice-area wins.`); }
          const jurisdictionCount = Object.keys(career.winsByJurisdiction).length; if (jurisdictionCount >= 3) await grant("global_counsel", event, jurisdictionCount, `Historical wins in ${jurisdictionCount} jurisdictions.`);
          const categoryCount = Object.keys(career.winsByLegalCategory).length; if (categoryCount >= 5) await grant("general_practitioner", event, categoryCount, `Historical wins in ${categoryCount} categories.`);
          const specialtyWins = Math.max(...Object.values(career.winsByLegalCategory)); if (specialtyWins >= 10) await grant("specialist", event, specialtyWins, `${specialtyWins} historical wins in one category.`);
        }
        if (event.outcome === "settled") await grant("peace_broker", event, career.totalSettlements, "Historical successful settlement.");
      }
      if (apply) {
        await db.collection("playercareerstats").updateOne({ playerId: user._id }, { $set: { ...career, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
        const playerAwards = await db.collection("playerawards").find({ playerId: user._id, firstUnlockedAt: { $ne: null } }).toArray();
        const titleInput = playerAwards.map((award) => { const definition = definitionById.get(String(award.awardDefinitionId)); return { ...award, code: definition?.code, category: definition?.category, unlocked: true }; });
        for (const title of titles) {
          if (!evaluateTitleRequirements({ requirements: title.requirements, awards: titleInput })) continue;
          const unlocked = await db.collection("playerlawyertitles").updateOne({ playerId: user._id, lawyerTitleId: title._id }, { $setOnInsert: { playerId: user._id, lawyerTitleId: title._id, unlockedAt: new Date(), createdAt: new Date(), updatedAt: new Date() } }, { upsert: true });
          summary.titlesUnlocked += unlocked.upsertedCount || 0;
        }
        summary.statsUpdated += 1;
      }
      else summary.statsUpdated += 1;
    } catch (error) { summary.failures += 1; console.error(JSON.stringify({ playerId: String(user._id), error: error.message })); }
  }
  console.log(JSON.stringify({ ...summary, dryRun: !apply }, null, 2));
  if (!apply) console.log("Dry run only. Re-run with --apply to write reliable historical aggregates and awards.");
} finally { await client.close(); }
