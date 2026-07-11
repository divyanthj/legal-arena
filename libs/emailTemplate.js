import config from "@/config";
import { markdownToSafeHtml, styleEmailMarkdown } from "@/libs/markdown";

const escapeHtml = (value = "") =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatInlineContent = (value = "") =>
  escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" style="color:#f7d56a;text-decoration:underline;text-underline-offset:3px;">$1</a>'
    );

const formatContent = (content = "") => {
  const sections = String(content || "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (!sections.length) {
    return "";
  }

  return sections
    .map((section) => {
      const lines = section.split("\n").map((line) => line.trim()).filter(Boolean);
      const listItems = lines.filter((line) => /^[-*]\s+/.test(line));

      if (listItems.length === lines.length && listItems.length > 0) {
        return `
          <ul style="margin:0 0 22px 0;padding:0;list-style:none;">
            ${listItems
              .map(
                (line) => `
                  <li style="margin:0 0 10px 0;padding:0 0 0 28px;position:relative;color:#e7e1d4;font-size:15px;line-height:1.75;">
                    <span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:#f7d56a;margin-left:-22px;margin-right:15px;vertical-align:2px;"></span>${formatInlineContent(
                      line.replace(/^[-*]\s+/, "")
                    )}
                  </li>`
              )
              .join("")}
          </ul>`;
      }

      if (lines.length === 1 && /^\*\*.+\*\*$/.test(lines[0])) {
        return `<h2 style="margin:26px 0 10px;color:#ffffff;font-size:19px;line-height:1.3;font-weight:800;">${formatInlineContent(
          lines[0].replace(/^\*\*|\*\*$/g, "")
        )}</h2>`;
      }

      return `<p style="margin:0 0 18px;color:#e7e1d4;font-size:15px;line-height:1.8;">${lines
        .map((line) => formatInlineContent(line))
        .join("<br />")}</p>`;
    })
    .join("");
};

const renderMarkdownEmail = (content = "") =>
  styleEmailMarkdown(markdownToSafeHtml(content));

export const emailTemplate = ({
  title = config.appName,
  subtitle = config.appDescription,
  content,
  contentHtml = "",
  ctaLabel = `Open ${config.appName}`,
  ctaUrl = `https://${config.domainName}`,
  footer = `You're receiving this email because you have an account or requested updates from ${config.appName}.`,
}) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background: #070707;
        font-family: Inter, Arial, sans-serif;
        color: #e7e1d4;
      }
      a {
        color: #f7d56a;
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#070707;color:#e7e1d4;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#070707;background-image:radial-gradient(circle at top left,rgba(247,213,106,0.16),transparent 34%),radial-gradient(circle at top right,rgba(42,111,88,0.22),transparent 30%);padding:34px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:680px;margin:0 auto;border-collapse:separate;border-spacing:0;background:#0d0d0d;border:1px solid #2a2a2a;border-radius:28px;overflow:hidden;box-shadow:0 26px 90px rgba(0,0,0,0.48);">
            <tr>
              <td style="padding:34px 34px 24px;background:#0b0b0b;background-image:linear-gradient(145deg,rgba(255,255,255,0.045),rgba(255,255,255,0)),radial-gradient(circle at 85% 0%,rgba(247,213,106,0.18),transparent 32%);border-bottom:1px solid #242424;">
                <img
                  src="https://${config.domainName}/icon.png"
                  alt="${escapeHtml(config.appName)} logo"
                  width="56"
                  height="56"
                  style="display:block;width:56px;height:56px;border-radius:16px;margin:0 0 22px;background:#000000;border:1px solid rgba(255,255,255,0.16);"
                />
                <p style="margin:0 0 12px;color:#f7d56a;font-size:11px;font-weight:800;letter-spacing:0.28em;text-transform:uppercase;">${escapeHtml(
                  config.appName
                )}</p>
                <h1 style="margin:0 0 14px;color:#ffffff;font-size:34px;line-height:1.08;font-weight:900;letter-spacing:-0.02em;">${escapeHtml(
                  title
                )}</h1>
                <p style="margin:0;max-width:560px;color:#cfc7b8;font-size:15px;line-height:1.75;">${escapeHtml(
                  subtitle
                )}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 34px 12px;background:#101010;">
                ${contentHtml || renderMarkdownEmail(content) || formatContent(content)}
              </td>
            </tr>
            <tr>
              <td style="padding:12px 34px 30px;background:#101010;">
                <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:separate;border-spacing:0;">
                  <tr>
                    <td align="center" style="border-radius:16px;background:#fee88a;box-shadow:0 18px 42px rgba(245,158,11,0.18);">
                      <a href="${ctaUrl}" style="display:block;padding:17px 22px;border-radius:16px;background:#fee88a;color:#090909 !important;text-decoration:none;font-size:16px;line-height:1.2;font-weight:900;">${escapeHtml(
                        ctaLabel
                      )}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 34px 32px;background:#0b0b0b;border-top:1px solid #242424;">
                <p style="margin:0 0 10px;color:#8f8a80;font-size:12px;line-height:1.7;">${escapeHtml(
                  footer
                )}</p>
                <p style="margin:0;color:#8f8a80;font-size:12px;line-height:1.7;">Need help? Visit the <a href="https://${escapeHtml(
                  config.domainName
                )}/contact" style="color:#d8c275;text-decoration:underline;">contact page</a>.</p>
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;color:#5f5a52;font-size:11px;line-height:1.6;">${escapeHtml(
            config.appName
          )} - AI courtroom strategy, client intake, settlements, and PVP challenges.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
