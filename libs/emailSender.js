import connectMongo from "@/libs/mongoose";
import { sendEmail, sendBatchEmails } from "@/libs/resend";
import { emailTemplate } from "@/libs/emailTemplate";
import { createMagicLoginLink } from "@/libs/authMagicLink";
import User from "@/models/User";
import Lead from "@/models/Lead";
import EmailSuppression from "@/models/EmailSuppression";
import config from "@/config";
import { createUnsubscribeToken } from "@/libs/emailUnsubscribe";

const MAX_BATCH_SIZE = 100;

const greeting = (name) =>
  name ? `Hey Advocate ${name},\n\n` : "Hey advocate,\n\n";

const getDigestSignature = (type) =>
  type === "marketing" ? `${config.appName} team` : config.appName;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

async function getRecipientsForAudience({ audience = "all_users", email = "" } = {}) {
  if (audience === "single_user") {
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      throw new Error("Email address is required for single-user sends.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error("Enter a valid email address.");
    }

    const user = await User.findOne({ email: normalizedEmail }).select("email name");

    if (!user?.email) {
      throw new Error("No stored user account was found for that email.");
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
  email = "",
  subject,
  content,
  type = "announcement",
  footerNote = "",
}) {
  await connectMongo();

  const recipients = await getRecipientsForAudience({ audience, email });
  const suppressedEmails = new Set(
    (await EmailSuppression.find({ email: { $in: recipients.map((recipient) => String(recipient.email || "").trim().toLowerCase()) } }).select("email").lean())
      .map((entry) => String(entry.email || "").trim().toLowerCase())
  );
  const deliverableRecipients = recipients.filter(
    (recipient) => !suppressedEmails.has(String(recipient.email || "").trim().toLowerCase())
  );
  const signature = getDigestSignature(type);

  const emailsToSend = deliverableRecipients.map((recipient) => {
    const unsubscribeUrl = `https://${config.domainName}/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(recipient.email))}`;
    const bodyText = `${greeting(recipient.name)}${content}\n\n${
      footerNote ? `${footerNote}\n\n` : ""
    }Regards,\n${signature}`;
    const text = `${bodyText}\n\nUnsubscribe from mailing list: ${unsubscribeUrl}`;

    return {
      to: recipient.email,
      subject,
      text,
      html: emailTemplate({
        title: subject,
        content: bodyText,
        unsubscribeUrl,
      }),
    };
  });

  if (!emailsToSend.length) {
    return { success: true, totalEmailsSent: 0, suppressedCount: recipients.length - deliverableRecipients.length };
  }

  let totalSent = 0;

  for (let i = 0; i < emailsToSend.length; i += MAX_BATCH_SIZE) {
    totalSent += await sendBatchEmails(
      emailsToSend.slice(i, i + MAX_BATCH_SIZE)
    );
  }

  return { success: true, totalEmailsSent: totalSent, suppressedCount: recipients.length - deliverableRecipients.length };
}

export async function sendCustomEmail({
  audience = "",
  email,
  subject,
  content,
  type = "announcement",
}) {
  return sendBroadcastEmail({
    audience: audience || (email ? "single_user" : "all_users"),
    email,
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

export async function sendFreeAccessGrantedEmail({
  email,
  name = "",
  grantedBy = "",
} = {}) {
  if (!email) {
    throw new Error("Email is required.");
  }

  const subject = `You're in: free ${config.appName} access is unlocked`;
  const recipientName = name?.trim?.() || email.split("@")[0] || "Counsel";
  const adminLine = grantedBy
    ? `Access was granted by ${grantedBy}.`
    : "Access was granted by the Legal Arena team.";
  const content =
    `Hi ${recipientName},\n\n` +
    `Good news: your ${config.appName} access has been unlocked.\n\n` +
    "Your account can now enter the arena, run client intake, build case files, argue in court, and chase leaderboard glory without needing to purchase access.\n\n" +
    "A few things waiting for you:\n" +
    "- AI-powered client interviews\n" +
    "- Conversation-built fact sheets\n" +
    "- Courtroom rounds with scoring\n" +
    "- Progression, ratings, and specialty leaderboards\n\n" +
    `${adminLine}\n\n` +
    "Bring sharp questions. The court is open.";
  const magicLoginUrl = await createMagicLoginLink({
    email,
    callbackUrl: "/dashboard",
  });

  return sendEmail({
    to: email,
    subject,
    text:
      `${content}\n\nUse this secure magic link to enter Legal Arena: ${magicLoginUrl}\n\n` +
      "This link expires in 24 hours. If you were not expecting this, you can ignore this email.",
    html: emailTemplate({
      title: "You're in",
      subtitle: `Free ${config.appName} access has been unlocked for your account.`,
      content,
      contentHtml: `
        <p style="margin:0 0 18px;">Hi ${escapeHtml(recipientName)},</p>
        <p style="margin:0 0 18px;">Good news: your <strong>${escapeHtml(
          config.appName
        )}</strong> access has been unlocked.</p>
        <p style="margin:0 0 18px;">Your account can now enter the arena without needing to purchase access.</p>
        <p style="margin:0 0 10px;"><strong>A few things waiting for you:</strong></p>
        <ul style="margin:0 0 20px 22px; padding:0;">
          <li style="margin:0 0 8px;">AI-powered client interviews</li>
          <li style="margin:0 0 8px;">Conversation-built fact sheets</li>
          <li style="margin:0 0 8px;">Courtroom rounds with scoring</li>
          <li style="margin:0;">Progression, ratings, and specialty leaderboards</li>
        </ul>
        <p style="margin:0 0 18px;">${escapeHtml(adminLine)}</p>
        <p style="margin:0;">Bring sharp questions. The court is open.</p>
      `,
      ctaLabel: "Enter with magic link",
      ctaUrl: magicLoginUrl,
      footer:
        `You're receiving this because an admin granted free access to ${config.appName}. ` +
        "This secure sign-in link expires in 24 hours. If this was unexpected, you can ignore this email.",
    }),
    from: config.email.fromSupport,
  });
}

export async function sendFreeAccessRevokedEmail({
  email,
  name = "",
  revokedBy = "",
} = {}) {
  if (!email) {
    throw new Error("Email is required.");
  }

  const subject = `${config.appName} free access has been updated`;
  const recipientName = name?.trim?.() || email.split("@")[0] || "Counsel";
  const adminLine = revokedBy
    ? `This change was made by ${revokedBy}.`
    : "This change was made by the Legal Arena team.";
  const content =
    `Hi ${recipientName},\n\n` +
    `A quick heads-up: your manually granted free access to ${config.appName} has been revoked.\n\n` +
    "That means the free-access override on your account is no longer active. If you still have access through another route, such as a purchase or admin status, that separate access is unchanged.\n\n" +
    `${adminLine}\n\n` +
    "If this was unexpected, reply to support and we will help sort it out.";
  const magicLoginUrl = await createMagicLoginLink({
    email,
    callbackUrl: "/dashboard",
  });

  return sendEmail({
    to: email,
    subject,
    text:
      `${content}\n\nUse this secure magic link to view your account: ${magicLoginUrl}\n\n` +
      "This link expires in 24 hours.\n\n" +
      `Support: https://${config.domainName}/contact`,
    html: emailTemplate({
      title: "Access updated",
      subtitle: `Your manually granted free ${config.appName} access has changed.`,
      content,
      contentHtml: `
        <p style="margin:0 0 18px;">Hi ${escapeHtml(recipientName)},</p>
        <p style="margin:0 0 18px;">A quick heads-up: your manually granted free access to <strong>${escapeHtml(
          config.appName
        )}</strong> has been revoked.</p>
        <p style="margin:0 0 18px;">The free-access override on your account is no longer active.</p>
        <ul style="margin:0 0 20px 22px; padding:0;">
          <li style="margin:0 0 8px;">Paid access, if you have it, is unchanged.</li>
          <li style="margin:0 0 8px;">Admin access, if applicable, is unchanged.</li>
          <li style="margin:0;">If this was unexpected, support can help sort it out.</li>
        </ul>
        <p style="margin:0 0 18px;">${escapeHtml(adminLine)}</p>
        <p style="margin:0;">Thanks for being part of ${escapeHtml(config.appName)}.</p>
      `,
      ctaLabel: "View your account",
      ctaUrl: magicLoginUrl,
      footer:
        `You're receiving this because an admin changed your free-access status for ${config.appName}. ` +
        "This secure sign-in link expires in 24 hours.",
    }),
    from: config.email.fromSupport,
  });
}

export async function sendChallengeInviteEmail({
  toUser,
  fromUser,
  challenge,
} = {}) {
  if (!toUser?.email) {
    throw new Error("Challenged player email is required.");
  }

  const recipientName =
    toUser.name?.trim?.() || toUser.email.split("@")[0] || "Counsel";
  const challengerName =
    fromUser?.name?.trim?.() || fromUser?.email?.split("@")[0] || "Another player";
  const challengeRef = challenge.slug || challenge.id;
  const challengePath = `/dashboard/challenges/${challengeRef}`;
  const magicLoginUrl = await createMagicLoginLink({
    email: toUser.email,
    callbackUrl: challengePath,
  });
  const subject = `${challengerName} challenged you in ${config.appName}`;
  const content =
    `Hi ${recipientName},\n\n` +
    `${challengerName} challenged you to a Legal Arena PVP match: ${challenge.title}.\n\n` +
    "You do not need to purchase access for this challenge. The match is sponsored by the player who challenged you.\n\n" +
    "Accept the challenge, complete your private intake, and the courtroom will open once both sides are ready.";

  return sendEmail({
    to: toUser.email,
    subject,
    text:
      `${content}\n\nOpen the challenge: ${magicLoginUrl}\n\n` +
      "This sign-in link expires in 24 hours. The challenge invite expires in 7 days.",
    html: emailTemplate({
      title: "Challenge received",
      subtitle: `${challengerName} wants to face you in ${config.appName}.`,
      content,
      contentHtml: `
        <p style="margin:0 0 18px;">Hi ${escapeHtml(recipientName)},</p>
        <p style="margin:0 0 18px;"><strong>${escapeHtml(
          challengerName
        )}</strong> challenged you to a Legal Arena PVP match.</p>
        <p style="margin:0 0 10px;"><strong>${escapeHtml(challenge.title)}</strong></p>
        <p style="margin:0 0 18px;">You do not need to purchase access for this challenge. The match is sponsored by the player who challenged you.</p>
        <p style="margin:0;">Accept the challenge, complete your private intake, and the courtroom will open once both sides are ready.</p>
      `,
      ctaLabel: "Open challenge",
      ctaUrl: magicLoginUrl,
      footer:
        "This secure sign-in link expires in 24 hours. The challenge invite expires in 7 days.",
    }),
    from: config.email.fromSupport,
  });
}

export async function sendChallengeAcceptedEmail({
  toUser,
  acceptedByUser,
  challenge,
} = {}) {
  if (!toUser?.email) {
    throw new Error("Challenge sender email is required.");
  }

  const recipientName =
    toUser.name?.trim?.() || toUser.email.split("@")[0] || "Counsel";
  const acceptedByName =
    acceptedByUser?.name?.trim?.() ||
    acceptedByUser?.email?.split("@")[0] ||
    "Your opponent";
  const challengeRef = challenge.slug || challenge.id;
  const challengePath = `/dashboard/challenges/${challengeRef}`;
  const magicLoginUrl = await createMagicLoginLink({
    email: toUser.email,
    callbackUrl: challengePath,
  });
  const subject = `${acceptedByName} accepted your ${config.appName} challenge`;
  const content =
    `Hi ${recipientName},\n\n` +
    `${acceptedByName} accepted your Legal Arena PVP challenge: ${challenge.title}.\n\n` +
    "The match is now active. You can open the challenge, continue private intake, and prepare for court.";

  return sendEmail({
    to: toUser.email,
    subject,
    text:
      `${content}\n\nOpen the challenge: ${magicLoginUrl}\n\n` +
      "This sign-in link expires in 24 hours.",
    html: emailTemplate({
      title: "Challenge accepted",
      subtitle: `${acceptedByName} is ready to face you in ${config.appName}.`,
      content,
      contentHtml: `
        <p style="margin:0 0 18px;">Hi ${escapeHtml(recipientName)},</p>
        <p style="margin:0 0 18px;"><strong>${escapeHtml(
          acceptedByName
        )}</strong> accepted your Legal Arena PVP challenge.</p>
        <p style="margin:0 0 18px;"><strong>${escapeHtml(challenge.title)}</strong></p>
        <p style="margin:0;">The match is now active. Open the challenge, continue private intake, and prepare for court.</p>
      `,
      ctaLabel: "Open challenge",
      ctaUrl: magicLoginUrl,
      footer: "This secure sign-in link expires in 24 hours.",
    }),
    from: config.email.fromSupport,
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
