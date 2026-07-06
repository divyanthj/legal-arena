import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const factSheetSchema = mongoose.Schema(
  {
    summary: { type: [String], default: [] },
    timeline: { type: [String], default: [] },
    supportingFacts: { type: [String], default: [] },
    risks: { type: [String], default: [] },
    theory: { type: [String], default: [] },
    desiredRelief: { type: [String], default: [] },
    openQuestions: { type: [String], default: [] },
    knownFacts: { type: [String], default: [] },
    knownClaims: { type: [String], default: [] },
    disputedFacts: { type: [String], default: [] },
    corroboratedFacts: { type: [String], default: [] },
    sourceLinks: { type: [String], default: [] },
    missingEvidence: { type: [String], default: [] },
    discoveredFactIds: { type: [String], default: [] },
    discoveredClaimIds: { type: [String], default: [] },
    discoveredEvidenceIds: { type: [String], default: [] },
    ready: { type: Boolean, default: false },
  },
  { _id: false }
);

const interviewEntrySchema = mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["player", "client", "party"],
      required: true,
    },
    speaker: { type: String, required: true },
    text: { type: String, required: true },
    sourceType: {
      type: String,
      enum: ["question", "claim", "evidence", "system"],
      default: "question",
    },
    relatedFactIds: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const caseAssessmentSchema = mongoose.Schema(
  {
    currentSuccessChance: { type: Number, default: null },
    currentReasons: { type: [String], default: [] },
    lockedCourtEntryChance: { type: Number, default: null },
    lockedReasons: { type: [String], default: [] },
    assessedAt: { type: Date, default: null },
    lockedAt: { type: Date, default: null },
  },
  { _id: false }
);

const portraitSchema = mongoose.Schema(
  {
    image: {
      type: String,
      default: "",
      trim: true,
    },
    generatedAt: {
      type: Date,
      default: null,
    },
    prompt: {
      type: String,
      default: "",
      trim: true,
      private: true,
    },
    promptVersion: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const participantSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    side: {
      type: String,
      enum: ["client", "opponent"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "ready", "verdict", "declined"],
      default: "pending",
    },
    readyAt: { type: Date, default: null },
    score: { type: Number, default: 0 },
    verdict: {
      type: String,
      enum: ["win", "loss", "draw", ""],
      default: "",
    },
    factSheet: {
      type: factSheetSchema,
      default: () => ({}),
    },
    caseAssessment: {
      type: caseAssessmentSchema,
      default: () => ({}),
    },
    interviewTranscript: {
      type: [interviewEntrySchema],
      default: [],
    },
    clientMemory: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      private: true,
    },
    clientMemoryExcerpt: {
      type: String,
      default: "",
      trim: true,
    },
    clientPortrait: {
      type: portraitSchema,
      default: () => ({}),
    },
  },
  { _id: false }
);

const courtroomSubmissionSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    side: {
      type: String,
      enum: ["client", "opponent"],
      required: true,
    },
    text: { type: String, required: true },
    citedFacts: { type: [String], default: [] },
    citedClaimIds: { type: [String], default: [] },
    citedRules: { type: [String], default: [] },
    judgeNotes: {
      playerDelta: { type: Number, default: 0 },
      opponentDelta: { type: Number, default: 0 },
      strengths: { type: [String], default: [] },
      weaknesses: { type: [String], default: [] },
      benchSignal: { type: String, default: "" },
    },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const courtroomRoundSchema = mongoose.Schema(
  {
    round: { type: Number, required: true },
    status: {
      type: String,
      enum: ["open", "judged"],
      default: "open",
    },
    submissions: {
      type: [courtroomSubmissionSchema],
      default: [],
    },
    benchSummary: { type: String, default: "" },
    judgedAt: { type: Date, default: null },
  },
  { _id: false }
);

const settlementEntrySchema = mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["player", "client", "opponent", "system"],
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    side: {
      type: String,
      enum: ["client", "opponent", ""],
      default: "",
    },
    speaker: { type: String, required: true },
    text: { type: String, required: true },
    moodSnapshot: {
      player: { type: Number, default: 0 },
      opponent: { type: Number, default: 0 },
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const settlementSchema = mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["none", "proposed", "active", "rejected", "failed", "settled"],
      default: "none",
    },
    moods: {
      player: { type: Number, default: 0 },
      opponent: { type: Number, default: 0 },
    },
    transcript: {
      type: [settlementEntrySchema],
      default: [],
    },
    currentTerms: { type: [String], default: [] },
    finalTerms: { type: [String], default: [] },
    proposedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    proposedBySide: {
      type: String,
      enum: ["client", "opponent", ""],
      default: "",
    },
    proposalMessage: { type: String, default: "" },
    proposedAt: { type: Date, default: null },
    outcomeSummary: { type: String, default: "" },
    failureReason: { type: String, default: "" },
    rejectionCount: { type: Number, default: 0 },
    cooldownUntil: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const challengeSchema = mongoose.Schema(
  {
    initiatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    challengedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sponsorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "settlement", "settled", "courtroom", "verdict", "declined", "expired"],
      default: "pending",
      index: true,
    },
    title: { type: String, required: true, trim: true },
    slug: { type: String, trim: true, default: "", index: true },
    caseTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CaseTemplate",
      default: null,
    },
    templateSlug: { type: String, required: true, trim: true },
    practiceArea: { type: String, required: true, trim: true },
    primaryCategory: { type: String, required: true, trim: true },
    complexity: { type: Number, default: 1 },
    lawbookVersion: { type: String, required: true, trim: true },
    maxCourtRounds: { type: Number, default: 3 },
    templateSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    canonicalStory: { type: mongoose.Schema.Types.Mixed, default: null },
    judgeProfile: { type: mongoose.Schema.Types.Mixed, default: null },
    premise: {
      clientName: String,
      opponentName: String,
      courtName: String,
      overview: String,
      desiredRelief: String,
    },
    participants: {
      type: [participantSchema],
      default: [],
      validate: [(value) => value.length === 2, "A challenge needs two participants."],
    },
    courtroomRounds: {
      type: [courtroomRoundSchema],
      default: [],
    },
    settlement: {
      type: settlementSchema,
      default: () => ({}),
    },
    verdict: {
      winnerUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      winner: {
        type: String,
        enum: ["initiator", "challenged", "draw", ""],
        default: "",
      },
      summary: { type: String, default: "" },
      finalScore: {
        initiator: { type: Number, default: 0 },
        challenged: { type: Number, default: 0 },
      },
      quitByUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      quitAt: { type: Date, default: null },
      stayBonus: { type: Number, default: 0 },
    },
    acceptedAt: { type: Date, default: null },
    declinedAt: { type: Date, default: null },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      index: true,
    },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

challengeSchema.index({ initiatorId: 1, challengedId: 1, status: 1 });
challengeSchema.index({ "participants.userId": 1, updatedAt: -1 });

challengeSchema.plugin(toJSON);

export default mongoose.models.Challenge ||
  mongoose.model("Challenge", challengeSchema);
