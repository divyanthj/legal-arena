import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const sectionSchema = mongoose.Schema(
  {
    heading: { type: String, required: true, trim: true },
    paragraphs: { type: [String], default: [] },
    bullets: { type: [String], default: [] },
    quote: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const blogPostSchema = mongoose.Schema(
  {
    sourceType: {
      type: String,
      enum: ["caseSession", "challenge"],
      required: true,
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    participantUserIds: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
      private: true,
    },
    consentedUserIds: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
      private: true,
    },
    status: {
      type: String,
      enum: ["awaiting_consent", "generating", "published", "failed", "unpublished"],
      default: "generating",
      index: true,
    },
    slug: { type: String, required: true, trim: true, unique: true, index: true },
    title: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    categories: { type: [String], default: ["courtroom-strategy"] },
    tags: { type: [String], default: [], index: true },
    author: {
      name: { type: String, default: "Legal Arena Reports" },
      playerId: { type: mongoose.Schema.Types.ObjectId, default: null },
      playerImage: { type: String, default: "" },
    },
    advocates: {
      type: [{
        name: { type: String, required: true, trim: true },
        playerId: { type: mongoose.Schema.Types.ObjectId, required: true },
      }],
      default: [],
    },
    sections: { type: [sectionSchema], default: [] },
    caseDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    image: {
      url: { type: String, default: "" },
      alt: { type: String, default: "" },
      prompt: { type: String, default: "", private: true },
      width: { type: Number, default: 1536 },
      height: { type: Number, default: 1024 },
    },
    generationError: { type: String, default: "", private: true },
    generationStage: {
      type: String,
      enum: ["", "preparing", "writing", "generating_image", "storing_image", "published", "failed"],
      default: "",
    },
    generationStartedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null, index: true },
    unpublishedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

blogPostSchema.index({ sourceType: 1, sourceId: 1 }, { unique: true });
blogPostSchema.index({ status: 1, categories: 1, publishedAt: -1 });
blogPostSchema.index({
  title: "text",
  description: "text",
  tags: "text",
  "sections.heading": "text",
  "sections.paragraphs": "text",
});
blogPostSchema.plugin(toJSON);

export default mongoose.models.BlogPost || mongoose.model("BlogPost", blogPostSchema);
