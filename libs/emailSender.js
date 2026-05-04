import mongoose from "mongoose";
import connectMongo from "@/libs/mongoose";
import { sendEmail, sendBatchEmails } from "@/libs/resend";
import { emailTemplate } from "@/libs/emailTemplate";
import User from "@/models/User";
import Lead from "@/models/Lead";
import config from "@/config";

const MAX_BATCH_SIZE = 100;

const greeting = (name) => (name ? `Hello ${name},\n\n` : "Hello,\n\n");

const getDigestSignature = (type) =>
  type === "marketing" ? `${config.appName} team` : config.appName;

async function getRecipientsForAudience({ audience = "all_users", userId = "" } = {}) {
  if (audience === "single_user") {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID format.");
    }

    const user = await User.findById(userId).select("email name");

    if (!user?.email) {
      throw new Error("User not found or email is missing.");
    }

    return [{ email: user.email, name: user.name || "" }];
  }

  if (audience === "all_leads") {
    const leads = await Lead.find({ email: { $exists: true, $ne: null } }).select("email");
    return leads.map((lead) => ({ email: lead.email, name: "" }));
  }

  if (audience === "all_contacts") {
    const [users, leads] = await Promise.all([
      User.find({ email: { $exists: true, $ne: null } }).select("email name"),
      Lead.find({ email: { $exists: true, $ne: null } }).select("email"),
    ]);

    const recipientsByEmail = new Map();

    users.forEach((user) => {
      recipientsByEmail.set(String(user.email).trim().toLowerCase(), {
        email: user.email,
        name: user.name || "",
      });
    });
    leads.forEach((lead) => {
      const normalizedEmail = String(lead.email).trim().toLowerCase();

      if (!recipientsByEmail.has(normalizedEmail)) {
        recipientsByEmail.set(normalizedEmail, {
          email: lead.email,
          name: "",
        });
      }
    });

    return [...recipientsByEmail.values()];
  }

  const users = await User.find({ email: { $exists: true, $ne: null } }).select(
    "email name"
  );
  return users.map((user) => ({ email: user.email, name: user.name || "" }));
}

export async function sendBroadcastEmail({
  audience = "all_users",
  userId = "",
  subject,
  content,
  type = "announcement",
  footerNote = "",
}) {
  await connectMongo();

  const recipients = await getRecipientsForAudience({ audience, userId });
  const signature = getDigestSignature(type);

  const emailsToSend = recipients.map((recipient) => {
    const text = `${greeting(recipient.name)}${content}\n\n${
      footerNote ? `${footerNote}\n\n` : ""
    }Regards,\n${signature}`;

    return {
      to: recipient.email,
      subject,
      text,
      html: emailTemplate({
        title: subject,
        content: text,
      }),
    };
  });

  if (!emailsToSend.length) {
    return { success: true, totalEmailsSent: 0 };
  }

  let totalSent = 0;

  for (let i = 0; i < emailsToSend.length; i += MAX_BATCH_SIZE) {
    totalSent += await sendBatchEmails(
      emailsToSend.slice(i, i + MAX_BATCH_SIZE)
    );
  }

  return { success: true, totalEmailsSent: totalSent };
}

export async function sendCustomEmail({
  userId,
  subject,
  content,
  type = "announcement",
}) {
  return sendBroadcastEmail({
    audience: userId ? "single_user" : "all_users",
    userId,
    subject,
    content,
    type,
  });
}

export async function sendMagicLinkEmail({ email, url }) {
  const subject = `Sign in to ${config.appName}`;
  const text =
    `Use the secure link below to sign in to your ${config.appName} account.\n\n` +
    `If you did not request this email, you can ignore it.\n\n${url}`;

  return sendEmail({
    to: email,
    subject,
    text,
    html: emailTemplate({
      title: subject,
      content:
        `Use the secure link below to sign in to your ${config.appName} account.\n\n` +
        "If you did not request this email, you can ignore it.",
      ctaLabel: "Sign in securely",
      ctaUrl: url,
      footer: "This sign-in link expires shortly for your security.",
    }),
    from: process.env.RESEND_AUTH_FROM || config.email.fromNoReply,
  });
}

export async function sendLeadWelcomeEmail(email) {
  const subject = `Welcome to ${config.appName}`;
  const text =
    `Thanks for joining ${config.appName}.\n\n` +
    "We'll send launch updates, early access news, and major product changes here.";

  return sendEmail({
    to: email,
    subject,
    text,
    html: emailTemplate({
      title: subject,
      content: text,
      ctaLabel: `Visit ${config.appName}`,
    }),
  });
}

export async function createLeadAndSendWelcome(email) {
  await connectMongo();

  const existingLead = await Lead.findOne({ email });

  if (existingLead) {
    return { created: false };
  }

  await Lead.create({ email });
  await sendLeadWelcomeEmail(email);

  return { created: true };
}
