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
      enum: ["interview", "courtroom", "verdict", "exited"],
      default: "interview",
    },
    exitedAt: {
      type: Date,
      default: null,
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
        type: String,
        default: "",
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
        type: String,
        default: "",
      },
      desiredRelief: {
        type: String,
        default: "",
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
      discoveredFactIds: {
        type: [String],
        default: [],
      },
      discoveredClaimIds: {
        type: [String],
        default: [],
      },
      ready: {
        type: Boolean,
        default: false,
      },
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
