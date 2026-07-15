import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const schema = mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  totalCompletedCases: { type: Number, default: 0 },
  totalWins: { type: Number, default: 0 },
  totalLosses: { type: Number, default: 0 },
  totalDraws: { type: Number, default: 0 },
  totalSettlements: { type: Number, default: 0 },
  currentWinStreak: { type: Number, default: 0 },
  longestWinStreak: { type: Number, default: 0 },
  winsBySide: { type: Map, of: Number, default: () => ({}) },
  winsByDifficulty: { type: Map, of: Number, default: () => ({}) },
  winsByLegalCategory: { type: Map, of: Number, default: () => ({}) },
  winsByJurisdiction: { type: Map, of: Number, default: () => ({}) },
  totalDecisiveFactsDiscovered: { type: Number, default: 0 },
  totalSuccessfulSettlements: { type: Number, default: 0 },
  totalFullRecoveries: { type: Number, default: 0 },
  totalCompleteDefences: { type: Number, default: 0 },
  wonIntakeQuestionTotal: { type: Number, default: 0 },
  wonIntakeCaseCount: { type: Number, default: 0 },
  wonArgumentTotal: { type: Number, default: 0 },
  wonArgumentCaseCount: { type: Number, default: 0 },
  legalRulesApplied: { type: [String], default: [] },
  lastCompletedAt: { type: Date, default: null },
}, { timestamps: true, toJSON: { virtuals: true } });

schema.plugin(toJSON);
export default mongoose.models.PlayerCareerStats || mongoose.model("PlayerCareerStats", schema);

