import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { getAdminEmails } from "@/libs/admin";
import { emailTemplate } from "@/libs/emailTemplate";
import { sendEmail } from "@/libs/resend";
import ContactMessage from "@/models/ContactMessage";
import config from "@/config";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanText = (value = "", maxLength = 1000) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const buildAdminNotification = ({ contactMessage }) => {
  const subject = `New ${config.appName} contact message from ${contactMessage.name}`;
  const text =
    `New contact message\n\n` +
    `Name: ${contactMessage.name}\n` +
    `Email: ${contactMessage.email}\n` +
    `Message ID: ${contactMessage.id}\n\n` +
    `${contactMessage.message}`;

  return {
    subject,
    text,
    html: emailTemplate({
      title: "New contact message",
      subtitle: `${contactMessage.name} sent a message through ${config.appName}.`,
      content: text,
      ctaLabel: "Open admin",
      ctaUrl: `https://${config.domainName}/dashboard/admin`,
      footer: "This notification was sent to admins configured in ADMINS.",
    }),
  };
};

export async function POST(req) {
  try {
    const body = await req.json();
    const name = cleanText(body.name, 120);
    const email = cleanText(body.email, 180).toLowerCase();
    const message = String(body.message || "").trim().slice(0, 4000);

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    if (!email || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: "A valid email is required." },
        { status: 400 }
      );
    }

    if (message.length < 10) {
      return NextResponse.json(
        { error: "Message must be at least 10 characters." },
        { status: 400 }
      );
    }

    await connectMongo();

    const contactMessage = await ContactMessage.create({
      name,
      email,
      message,
      userAgent: cleanText(req.headers.get("user-agent"), 500),
      referrer: cleanText(req.headers.get("referer"), 500),
    });

    const adminEmails = getAdminEmails();
    let notificationSent = false;

    if (adminEmails.length) {
      try {
        const notification = buildAdminNotification({ contactMessage });
        await sendEmail({
          to: adminEmails,
          subject: notification.subject,
          text: notification.text,
          html: notification.html,
          replyTo: email,
        });

        notificationSent = true;
        contactMessage.notificationRecipients = adminEmails;
        contactMessage.notificationSentAt = new Date();
        contactMessage.notificationError = "";
        await contactMessage.save();
      } catch (emailError) {
        console.error("Contact admin notification failed", emailError);
        contactMessage.notificationRecipients = adminEmails;
        contactMessage.notificationError =
          emailError?.message || "Notification failed.";
        await contactMessage.save();
      }
    }

    return NextResponse.json({
      ok: true,
      id: contactMessage.id,
      notificationSent,
    });
  } catch (error) {
    console.error("Contact form submission failed", error);
    return NextResponse.json(
      { error: "Could not send your message. Please try again." },
      { status: 500 }
    );
  }
}
