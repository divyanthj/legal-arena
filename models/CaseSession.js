import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const interviewEntrySchema = mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["player", "client", "party"],
      required: true,
    },
    speaker: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    sourceType: {
      type: String,
      enum: ["question", "claim", "evidence", "system"],
      default: "question",
    },
    relatedFactIds: {
      type: [String],
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const courtroomEntrySchema = mongoose.Schema(
  {
    round: {
      type: Number,
      required: true,
    },
    speaker: {
      type: String,
      enum: ["player", "opponent", "witness", "judge"],
      required: true,
    },
    speakerName: {
      type: String,
      default: "",
      trim: true,
    },
    text: {
      type: String,
      required: true,
    },
    entryType: {
      type: String,
      enum: ["argument", "question", "answer", "objection", "ruling", "system", ""],
      default: "argument",
    },
    witnessId: { type: String, default: "", trim: true },
    witnessName: { type: String, default: "", trim: true },
    examinationType: {
      type: String,
      enum: ["direct", "cross", ""],
      default: "",
    },
    admitted: { type: Boolean, default: false },
    objectionGround: { type: String, default: "", trim: true },
    ruling: {
      type: String,
      enum: ["sustained", "overruled", "none", ""],
      default: "",
    },
    citedFacts: {
      type: [String],
      default: [],
    },
    citedClaimIds: {
      type: [String],
      default: [],
    },
    citedEvidenceIds: {
      type: [String],
      default: [],
    },
    citedRules: {
      type: [String],
      default: [],
    },
    judgeNotes: {
      playerDelta: {
        type: Number,
        default: 0,
      },
      opponentDelta: {
        type: Number,
        default: 0,
      },
      strengths: {
        type: [String],
        default: [],
      },
      weaknesses: {
        type: [String],
        default: [],
      },
      benchSignal: {
        type: String,
        default: "",
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
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
    speaker: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    terms: {
      type: [
        {
          label: { type: String, default: "" },
          value: { type: String, default: "" },
        },
      ],
      default: [],
    },
    moodSnapshot: {
      player: {
        type: Number,
        default: 0,
      },
      opponent: {
        type: Number,
        default: 0,
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
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
      player: {
        type: Number,
        default: 0,
      },
      opponent: {
        type: Number,
        default: 0,
      },
    },
    transcript: {
      type: [settlementEntrySchema],
      default: [],
    },
    currentTerms: {
      type: [String],
      default: [],
    },
    openIssues: { type: [String], default: [] },
    agreedTerms: { type: [String], default: [] },
    clientPreview: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    clientPreviewUpdatedAt: {
      type: Date,
      default: null,
    },
    clientHuddle: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    finalTerms: {
      type: [String],
      default: [],
    },
    resolved: {
      type: Boolean,
      default: false,
    },
    resolution: {
      type: String,
      enum: ["", "settled", "failed", "rejected"],
      default: "",
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    accepted: {
      type: Boolean,
      default: false,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    acceptedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    acceptedBySide: {
      type: String,
      enum: ["client", "opponent", ""],
      default: "",
    },
    intentPending: {
      type: Boolean,
      default: false,
    },
    intentStatus: {
      type: String,
      enum: ["none", "pending", "accepted", "rejected"],
      default: "none",
    },
    intentSenderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    intentSenderSide: {
      type: String,
      enum: ["client", "opponent", ""],
      default: "",
    },
    intentReceiverUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    intentReceiverSide: {
      type: String,
      enum: ["client", "opponent", ""],
      default: "",
    },
    intentMessage: {
      type: String,
      default: "",
    },
    intentSentAt: {
      type: Date,
      default: null,
    },
    intentResponse: {
      type: String,
      enum: ["", "accepted", "rejected"],
      default: "",
    },
    intentRespondedAt: {
      type: Date,
      default: null,
    },
    latestNegotiationMessageUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    latestNegotiationMessageSide: {
      type: String,
      enum: ["client", "opponent", ""],
      default: "",
    },
    awaitingNegotiationResponseUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    negotiationTurnUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    negotiationTurnSide: {
      type: String,
      enum: ["client", "opponent", ""],
      default: "",
    },
    latestNegotiationMessageAt: {
      type: Date,
      default: null,
    },
    outcomeSummary: {
      type: String,
      default: "",
    },
    failureReason: {
      type: String,
      default: "",
    },
    rejectionCount: {
      type: Number,
      default: 0,
    },
    noProgressCount: { type: Number, default: 0 },
    tacticShiftUsed: { type: Boolean, default: false },
    tacticShiftRequired: { type: Boolean, default: false },
    publicExchangeCount: { type: Number, default: 0 },
    cooldownUntil: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    continuationOfCaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CaseSession",
      default: null,
    },
  },
  { _id: false }
);

const usageEntrySchema = mongoose.Schema(
  {
    label: {
      type: String,
      default: "",
    },
    phase: {
      type: String,
      enum: ["intake", "courtroom", "settlement"],
      default: "intake",
    },
    model: {
      type: String,
      default: "",
    },
    api: {
      type: String,
      default: "",
    },
    requestedServiceTier: {
      type: String,
      default: "auto",
    },
    serviceTier: {
      type: String,
      default: "unknown",
    },
    isPriority: {
      type: Boolean,
      default: false,
    },
    attempt: {
      type: Number,
      default: 0,
    },
    maxTokens: {
      type: Number,
      default: 0,
    },
    finishReason: {
      type: String,
      default: "",
    },
    parsed: {
      type: Boolean,
      default: false,
    },
    inputTokens: {
      type: Number,
      default: 0,
    },
    outputTokens: {
      type: Number,
      default: 0,
    },
    totalTokens: {
      type: Number,
      default: 0,
    },
    cachedInputTokens: {
      type: Number,
      default: 0,
    },
    reasoningTokens: {
      type: Number,
      default: 0,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const usageBucketSchema = mongoose.Schema(
  {
    inputTokens: {
      type: Number,
      default: 0,
    },
    outputTokens: {
      type: Number,
      default: 0,
    },
    totalTokens: {
      type: Number,
      default: 0,
    },
    cachedInputTokens: {
      type: Number,
      default: 0,
    },
    reasoningTokens: {
      type: Number,
      default: 0,
    },
    entries: {
      type: [usageEntrySchema],
      default: [],
      private: true,
    },
  },
  { _id: false }
);

const adjournmentHistoryEntrySchema = mongoose.Schema(
  {
    trigger: {
      type: String,
      enum: ["judge", "player_request"],
      required: true,
    },
    requestedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    courtroomRound: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    ruling: { type: String, required: true, trim: true },
    outcome: {
      type: String,
      enum: ["granted", "denied"],
      required: true,
    },
    createdAt: { type: Date, default: Date.now },
    resumedAt: { type: Date, default: null },
  },
  { _id: false }
);

const adjournmentSchema = mongoose.Schema(
  {
    active: { type: Boolean, default: false },
    grantsUsed: { type: Number, default: 0 },
    grantsAllowed: { type: Number, default: 0 },
    history: { type: [adjournmentHistoryEntrySchema], default: [] },
  },
  { _id: false }
);

const caseSessionSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      private: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    caseTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CaseTemplate",
      default: null,
    },
    templateSlug: {
      type: String,
      required: true,
      trim: true,
    },
    scenarioId: {
      type: String,
      trim: true,
      default: "",
    },
    practiceArea: {
      type: String,
      required: true,
      trim: true,
    },
    primaryCategory: {
      type: String,
      required: true,
      trim: true,
    },
    negotiationProfile: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    complexity: {
      type: Number,
      default: 1,
    },
    newcomerAssist: {
      type: Boolean,
      default: false,
      private: true,
    },
    caseCountry: {
      code: { type: String, trim: true, uppercase: true, default: "" },
      name: { type: String, trim: true, default: "" },
    },
    currentEventProvenance: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      private: true,
    },
    playerSide: {
      type: String,
      enum: ["client", "opponent"],
      default: "client",
    },
    status: {
      type: String,
      enum: ["interview", "courtroom", "settlement", "verdict", "settled", "exited"],
      default: "interview",
    },
    exitedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    awardMetrics: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      private: true,
    },
    freeGameplayCampaignAccess: {
      grantedAt: {
        type: Date,
        default: null,
      },
      campaignStartsAt: {
        type: Date,
        default: null,
      },
      campaignEndsAt: {
        type: Date,
        default: null,
      },
    },
    lawbookVersion: {
      type: String,
      required: true,
      trim: true,
    },
    maxCourtRounds: {
      type: Number,
      default: 3,
    },
    templateSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    canonicalStory: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
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
    opponentPortrait: {
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
    playerImage: {
      type: String,
      default: "",
      trim: true,
    },
    judgeProfile: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    premise: {
      clientName: String,
      opponentName: String,
      courtName: String,
      overview: String,
      desiredRelief: String,
      openingStatement: String,
    },
    interviewTranscript: {
      type: [interviewEntrySchema],
      default: [],
    },
    factSheet: {
      summary: {
        type: [String],
        default: [],
      },
      timeline: {
        type: [String],
        default: [],
      },
      supportingFacts: {
        type: [String],
        default: [],
      },
      risks: {
        type: [String],
        default: [],
      },
      theory: {
        type: [String],
        default: [],
      },
      desiredRelief: {
        type: [String],
        default: [],
      },
      openQuestions: {
        type: [String],
        default: [],
      },
      knownFacts: {
        type: [String],
        default: [],
      },
      knownClaims: {
        type: [String],
        default: [],
      },
      disputedFacts: {
        type: [String],
        default: [],
      },
      corroboratedFacts: {
        type: [String],
        default: [],
      },
      sourceLinks: {
        type: [String],
        default: [],
      },
      missingEvidence: {
        type: [String],
        default: [],
      },
      discoveredFactIds: {
        type: [String],
        default: [],
      },
      discoveredClaimIds: {
        type: [String],
        default: [],
      },
      discoveredEvidenceIds: {
        type: [String],
        default: [],
      },
      ready: {
        type: Boolean,
        default: false,
      },
    },
    caseAssessment: {
      currentSuccessChance: {
        type: Number,
        default: null,
      },
      currentReasons: {
        type: [String],
        default: [],
      },
      lockedCourtEntryChance: {
        type: Number,
        default: null,
      },
      lockedReasons: {
        type: [String],
        default: [],
      },
      assessedAt: {
        type: Date,
        default: null,
      },
      lockedAt: {
        type: Date,
        default: null,
      },
    },
    usage: {
      intake: {
        type: usageBucketSchema,
        default: () => ({}),
      },
      courtroom: {
        type: usageBucketSchema,
        default: () => ({}),
      },
      settlement: {
        type: usageBucketSchema,
        default: () => ({}),
      },
      total: {
        type: usageBucketSchema,
        default: () => ({}),
      },
    },
    settlement: {
      type: settlementSchema,
      default: () => ({}),
    },
    adjournment: {
      type: adjournmentSchema,
      default: () => ({}),
    },
    witnesses: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
      private: true,
    },
    witnessRosterVersion: {
      type: Number,
      default: 0,
      private: true,
    },
    witnessExamination: {
      phase: {
        type: String,
        enum: ["idle", "direct", "cross"],
        default: "idle",
      },
      activeWitnessId: { type: String, default: "", trim: true },
      examinationType: {
        type: String,
        enum: ["direct", "cross", ""],
        default: "",
      },
      calledBy: {
        type: String,
        enum: ["player", "opponent", ""],
        default: "",
      },
      questionsUsed: { type: Number, default: 0, min: 0 },
      maxQuestions: { type: Number, default: 3, min: 1, max: 6 },
      completedWitnessIds: { type: [String], default: [] },
    },
    courtroomTranscript: {
      type: [courtroomEntrySchema],
      default: [],
    },
    score: {
      player: {
        type: Number,
        default: 0,
      },
      opponent: {
        type: Number,
        default: 0,
      },
      roundsCompleted: {
        type: Number,
        default: 0,
      },
      lastBenchSignal: {
        type: String,
        default: "",
      },
      highlights: {
        type: [String],
        default: [],
      },
      weaknesses: {
        type: [String],
        default: [],
      },
    },
    verdict: {
      winner: {
        type: String,
        enum: ["player", "opponent", "draw", ""],
        default: "",
      },
      summary: {
        type: String,
        default: "",
      },
      highlights: {
        type: [String],
        default: [],
      },
      concerns: {
        type: [String],
        default: [],
      },
      outcomeMetrics: {
        disposition: { type: String, enum: ["", "dismissed", "all_claims_denied", "partial_relief", "full_relief", "other"], default: "" },
        amountClaimed: { type: Number, default: null },
        amountAwarded: { type: Number, default: null },
        expectedLiabilityBefore: { type: Number, default: null },
        actualLiability: { type: Number, default: null },
        currency: { type: String, default: "" },
      },
      finalScore: {
        player: {
          type: Number,
          default: 0,
        },
        opponent: {
          type: Number,
          default: 0,
        },
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

caseSessionSchema.plugin(toJSON);
caseSessionSchema.index({ userId: 1, completedAt: -1 });
caseSessionSchema.index(
  { userId: 1, continuationOfCaseId: 1 },
  {
    unique: true,
    partialFilterExpression: { continuationOfCaseId: { $type: "objectId" } },
  }
);

export default mongoose.models.CaseSession ||
  mongoose.model("CaseSession", caseSessionSchema);
