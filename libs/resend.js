import { Resend } from "resend";
import config from "@/config";
import {
  trackLegalArenaLinksInHtml,
  trackLegalArenaLinksInText,
} from "@/libs/emailTracking.mjs";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

if (!process.env.RESEND_API_KEY && process.env.NODE_ENV === "development") {
  console.group("RESEND_API_KEY missing from .env");
  console.error("It's required to send emails with Resend.");
  console.groupEnd();
}

export const sendEmail = async ({
  to,
  subject,
  html,
  text,
  from = config.email.fromSupport,
  replyTo,
  trackingCampaign = "email",
}) => {
  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!to || !subject || (!html && !text)) {
    throw new Error("Missing required email fields.");
  }

  return resend.emails.send({
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html: html
      ? trackLegalArenaLinksInHtml(html, {
          domainName: config.domainName,
          campaign: trackingCampaign,
        })
      : html,
    text: text
      ? trackLegalArenaLinksInText(text, {
          domainName: config.domainName,
          campaign: trackingCampaign,
        })
      : text,
    ...(replyTo ? { replyTo } : {}),
  });
};

export const sendBatchEmails = async (batchEmails) => {
  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!batchEmails.length) {
    return 0;
  }

  const emailsWithFrom = batchEmails.map(({ trackingCampaign = "email", ...email }) => ({
    from: email.from || config.email.fromSupport,
    ...email,
    html: email.html
      ? trackLegalArenaLinksInHtml(email.html, {
          domainName: config.domainName,
          campaign: trackingCampaign,
        })
      : email.html,
    text: email.text
      ? trackLegalArenaLinksInText(email.text, {
          domainName: config.domainName,
          campaign: trackingCampaign,
        })
      : email.text,
  }));

  await resend.batch.send(emailsWithFrom);

  return emailsWithFrom.length;
};
