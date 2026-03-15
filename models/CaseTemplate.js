import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";
import {
  DEFAULT_CATEGORY_SLUG,
  LEGAL_CASE_CATEGORIES,
} from "@/libs/game/categories";

const claimSchema = mongoose.Schema(
  {
    party: {
      type: String,
      enum: ["client", "opponent"],
      required: true,
    },
    claimedDetail: {
      type: String,
      required: true,
      trim: true,
    },
    stance: {
      type: String,
      enum: ["admits", "denies", "distorts", "omits"],
      default: "admits",
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.8,
    },
    accessLevel: {
      type: String,
      enum: ["direct", "partial", "hearsay"],
      default: "direct",
    },
    deceptionProfile: {
      type: String,
      trim: true,
      default: "",
    },
    keywords: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const evidenceSchema = mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    detail: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["document", "photo", "message", "invoice", "witness", "record", "other"],
      default: "document",
    },
    linkedFactIds: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const canonicalFactSchema = mongoose.Schema(
  {
    factId: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    kind: {
      type: String,
      enum: ["timeline", "supporting", "risk", "dispute", "evidence"],
      default: "supporting",
    },
    truthStatus: {
      type: String,
      enum: ["verified", "probable", "uncertain"],
      default: "verified",
    },
    canonicalDetail: {
      type: String,
      required: true,
      trim: true,
    },
    discoverability: {
      keywords: {
        type: [String],
        default: [],
      },
      phase: {
        type: String,
        enum: ["interview", "courtroom"],
        default: "interview",
      },
      priority: {
        type: Number,
        min: 1,
        max: 5,
        default: 3,
      },
    },
    evidenceRefs: {
      type: [String],
      default: [],
    },
    claims: {
      type: [claimSchema],
      default: [],
      validate(value) {
        const parties = value.map((item) => item.party);
        return parties.includes("client") && parties.includes("opponent");
      },
    },
  },
  { _id: false }
);

const caseTemplateSchema = mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    sourceType: {
      type: String,
      enum: ["manual", "generated", "imported"],
      default: "manual",
    },
    status: {
      type: String,
      enum: ["active", "draft", "archived"],
      default: "active",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      default: "",
      trim: true,
    },
    overview: {
      type: String,
      required: true,
      trim: true,
    },
    desiredRelief: {
      type: String,
      required: true,
      trim: true,
    },
    openingStatement: {
      type: String,
      required: true,
      trim: true,
    },
    starterTheory: {
      type: String,
      required: true,
      trim: true,
    },
    practiceArea: {
      type: String,
      required: true,
      trim: true,
    },
    primaryCategory: {
      type: String,
      enum: LEGAL_CASE_CATEGORIES.map((category) => category.slug),
      default: DEFAULT_CATEGORY_SLUG,
    },
    secondaryCategories: {
      type: [String],
      default: [],
    },
    complexity: {
      type: Number,
      min: 1,
      max: 5,
      default: 1,
    },
    courtName: {
      type: String,
      required: true,
      trim: true,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    opponentName: {
      type: String,
      required: true,
      trim: true,
    },
    legalTags: {
      type: [String],
      default: [],
    },
    authoringNotes: {
      type: String,
      default: "",
      trim: true,
    },
    canonicalFacts: {
      type: [canonicalFactSchema],
      default: [],
      validate(value) {
        return Array.isArray(value) && value.length > 0;
      },
    },
    evidenceItems: {
      type: [evidenceSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

caseTemplateSchema.plugin(toJSON);

export default mongoose.models.CaseTemplate ||
  mongoose.model("CaseTemplate", caseTemplateSchema);

