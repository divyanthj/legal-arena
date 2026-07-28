import "server-only";
import crypto from "crypto";
import mongoose from "mongoose";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import CaseSession from "@/models/CaseSession";
import ApiCredential from "@/models/ApiCredential";
import AIUsageEvent from "@/models/AIUsageEvent";
import AwardEvaluation from "@/models/AwardEvaluation";
import AwardOccurrence from "@/models/AwardOccurrence";
import PlayerAward from "@/models/PlayerAward";
import PlayerCareerStats from "@/models/PlayerCareerStats";
import PlayerLawyerTitle from "@/models/PlayerLawyerTitle";
import EmailNudgeLog from "@/models/EmailNudgeLog";
import ProfileView from "@/models/ProfileView";
import BlogPost from "@/models/BlogPost";
import PlayerBlock from "@/models/PlayerBlock";
import ContentReport from "@/models/ContentReport";
import ContactMessage from "@/models/ContactMessage";
import EmailSuppression from "@/models/EmailSuppression";
import Lead from "@/models/Lead";

export const deleteAccountForUser = async (userId) => {
  await connectMongo();

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid account.");
  }

  const objectId = new mongoose.Types.ObjectId(userId);
  const user = await User.findById(objectId).select("+email +deletedAt");

  if (!user) return { deleted: true, alreadyDeleted: true };
  if (user.deletedAt) return { deleted: true, alreadyDeleted: true };

  const email = String(user.email || "").trim().toLowerCase();
  const deletionReference = crypto.randomUUID();
  const deletedAt = new Date();

  const results = await Promise.all([
    CaseSession.deleteMany({ userId: objectId }),
    ApiCredential.deleteMany({ userId: objectId }),
    AIUsageEvent.deleteMany({ userId: objectId }),
    AwardEvaluation.deleteMany({ playerId: objectId }),
    AwardOccurrence.deleteMany({ playerId: objectId }),
    PlayerAward.deleteMany({ playerId: objectId }),
    PlayerCareerStats.deleteMany({ playerId: objectId }),
    PlayerLawyerTitle.deleteMany({ playerId: objectId }),
    EmailNudgeLog.deleteMany({ userId: objectId }),
    ProfileView.deleteMany({
      $or: [{ profileUserId: objectId }, { viewerUserId: objectId }],
    }),
    PlayerBlock.deleteMany({
      $or: [{ blockerId: objectId }, { blockedId: objectId }],
    }),
    ContentReport.updateMany(
      { reporterUserId: objectId },
      { $set: { reporterUserId: null } }
    ),
    ContentReport.updateMany(
      { reportedUserId: objectId },
      { $set: { reportedUserId: null } }
    ),
    BlogPost.updateMany(
      { participantUserIds: objectId },
      {
        $set: {
          status: "unpublished",
          unpublishedAt: deletedAt,
          "author.name": "Deleted player",
          "author.playerImage": "",
        },
        $pull: { consentedUserIds: objectId },
      }
    ),
    ...(email
      ? [
          ContactMessage.deleteMany({ email }),
          EmailSuppression.deleteMany({ email }),
          Lead.deleteMany({ email }),
        ]
      : []),
    mongoose.connection.collection("accounts").deleteMany({ userId: objectId }),
    mongoose.connection.collection("sessions").deleteMany({ userId: objectId }),
  ]);

  await User.updateOne(
    { _id: objectId, deletedAt: null },
    {
      $set: {
        name: "Deleted player",
        deletedAt,
        deletionReference,
        hasAccess: false,
        freeAccessGranted: false,
        autoPublishCaseReports: false,
        allowPortraitInCaseReports: false,
        accountType: "human",
        progression: {},
        lawyerProfileSummary: "",
        dashboardEncouragementNote: "",
        communityTermsVersion: "",
        communityTermsAcceptedAt: null,
      },
      $unset: {
        email: "",
        emailVerified: "",
        image: "",
        customerId: "",
        priceId: "",
        variantId: "",
        billingProvider: "",
        preferredCaseCountryCode: "",
        aiUsageTotals: "",
        aiManagedBy: "",
      },
    }
  );

  return {
    deleted: true,
    alreadyDeleted: false,
    deletedAt: deletedAt.toISOString(),
    deletionReference,
    deletedPrivateRecords: results.reduce(
      (total, result) => total + Number(result?.deletedCount || 0),
      0
    ),
  };
};

