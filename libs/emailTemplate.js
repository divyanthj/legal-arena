import config from "@/config";

const escapeHtml = (value = "") =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatContent = (content = "") =>
  escapeHtml(content).replace(/\n/g, "<br />");

export const emailTemplate = ({
  title = config.appName,
  subtitle = config.appDescription,
  content,
  ctaLabel = `Open ${config.appName}`,
  ctaUrl = `https://${config.domainName}`,
  footer = `You're receiving this email because you have an account or requested updates from ${config.appName}.`,
}) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f5f1e8;font-family:Georgia, 'Times New Roman', serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:640px;background:#fffdf8;border:1px solid #d6c7ab;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:32px;background:linear-gradient(135deg,#1f2937,#7c5c31);color:#f9f5ec;text-align:center;">
                <div style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.8;">${escapeHtml(
                  config.appName
                )}</div>
                <h1 style="margin:12px 0 8px;font-size:30px;line-height:1.2;">${escapeHtml(
                  title
                )}</h1>
                <p style="margin:0;font-size:15px;line-height:1.6;opacity:0.9;">${escapeHtml(
                  subtitle
                )}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 20px;">
                <div style="font-size:16px;line-height:1.8;color:#374151;">${formatContent(
                  content
                )}</div>
                <div style="margin-top:28px;">
                  <a href="${ctaUrl}" style="display:inline-block;padding:12px 20px;background:#7c5c31;color:#fffdf8;text-decoration:none;border-radius:999px;font-weight:600;">${escapeHtml(
                    ctaLabel
                  )}</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;font-size:12px;line-height:1.7;color:#6b7280;">
                <p style="margin:0 0 8px;">${escapeHtml(footer)}</p>
                <p style="margin:0;">Need help? Contact ${escapeHtml(
                  config.email.supportEmail
                )}.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
