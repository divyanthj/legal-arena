import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const contactMessageSchema = mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
      maxlength: 120,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      maxlength: 180,
    },
    message: {
      type: String,
      trim: true,
      required: true,
      maxlength: 4000,
    },
    status: {
      type: String,
      enum: ["new", "read", "archived"],
      default: "new",
    },
    source: {
      type: String,
      trim: true,
      default: "contact_page",
      maxlength: 80,
    },
    userAgent: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    referrer: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    notificationRecipients: {
      type: [String],
      default: [],
    },
    notificationSentAt: {
      type: Date,
      default: null,
    },
    notificationError: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

contactMessageSchema.index({ createdAt: -1 });
contactMessageSchema.index({ email: 1, createdAt: -1 });
contactMessageSchema.plugin(toJSON);

export default mongoose.models.ContactMessage ||
  mongoose.model("ContactMessage", contactMessageSchema);
