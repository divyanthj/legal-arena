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
      enum: ["player", "opponent"],
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    citedFacts: {
      type: [String],
      default: [],
    },
    citedClaimIds: {
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
    finalTerms: {
      type: [String],
      default: [],
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
      required: true,
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
    complexity: {
      type: Number,
      default: 1,
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

export default mongoose.models.CaseSession ||
  mongoose.model("CaseSession", caseSessionSchema);
