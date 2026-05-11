import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const categoryProgressSchema = mongoose.Schema(
  {
    categorySlug: {
      type: String,
      required: true,
      trim: true,
    },
    xp: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: 1000,
    },
    completedCases: {
      type: Number,
      default: 0,
    },
    wins: {
      type: Number,
      default: 0,
    },
    losses: {
      type: Number,
      default: 0,
    },
    draws: {
      type: Number,
      default: 0,
    },
    unlockedComplexity: {
      type: Number,
      default: 1,
    },
    recentPerformance: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const pvpCategoryProgressSchema = mongoose.Schema(
  {
    categorySlug: {
      type: String,
      required: true,
      trim: true,
    },
    completedChallenges: {
      type: Number,
      default: 0,
    },
    wins: {
      type: Number,
      default: 0,
    },
    losses: {
      type: Number,
      default: 0,
    },
    draws: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const pvpProgressSchema = mongoose.Schema(
  {
    completedChallenges: {
      type: Number,
      default: 0,
    },
    wins: {
      type: Number,
      default: 0,
    },
    losses: {
      type: Number,
      default: 0,
    },
    draws: {
      type: Number,
      default: 0,
    },
    categoryStats: {
      type: [pvpCategoryProgressSchema],
      default: [],
    },
  },
  { _id: false }
);

const onboardingSchema = mongoose.Schema(
  {
    dashboardTutorialCompleted: {
      type: Boolean,
      default: false,
    },
    dashboardTutorialCompletedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

// USER SCHEMA
const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      private: true,
    },
    emailVerified: {
      type: Date,
      default: null,
    },
    image: {
      type: String,
    },
    lawyerProfileSummary: {
      type: String,
      trim: true,
      default: "",
    },
    lawyerProfileSummarySource: {
      type: String,
      enum: ["default", "generated"],
      default: "default",
    },
    lastGameplayResetAt: {
      type: Date,
      default: null,
      private: true,
    },
    // Used in the Stripe webhook to identify the user in Stripe and later create Customer Portal or prefill user credit card details
    customerId: {
      type: String,
    },
    // Used in the Stripe webhook. should match a plan in config.js file.
    priceId: {
      type: String,
    },
    variantId: {
      type: String,
    },
    billingProvider: {
      type: String,
      enum: ["stripe", "lemonsqueezy"],
    },
    // Used to determine if the user has access to the product—it's turn on/off by the Stripe webhook
    hasAccess: {
      type: Boolean,
      default: false,
    },
    freeAccessGranted: {
      type: Boolean,
      default: false,
    },
    freeAccessGrantedAt: {
      type: Date,
      default: null,
    },
    freeAccessGrantedBy: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    onboarding: {
      type: onboardingSchema,
      default: () => ({}),
    },
    progression: {
      overallXp: {
        type: Number,
        default: 0,
      },
      overallRating: {
        type: Number,
        default: 1000,
      },
      completedCases: {
        type: Number,
        default: 0,
      },
      wins: {
        type: Number,
        default: 0,
      },
      losses: {
        type: Number,
        default: 0,
      },
      draws: {
        type: Number,
        default: 0,
      },
      categoryStats: {
        type: [categoryProgressSchema],
        default: [],
      },
      pvp: {
        type: pvpProgressSchema,
        default: () => ({}),
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

userSchema.index({ email: 1 }, { unique: true, sparse: true });

// add plugin that converts mongoose to json
userSchema.plugin(toJSON);

export default mongoose.models.User || mongoose.model("User", userSchema);
