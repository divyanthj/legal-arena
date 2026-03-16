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
    <style>
      body {
        margin: 0;
        padding: 0;
        background: #f5f7fb;
        font-family: Inter, Arial, sans-serif;
        color: #334155;
      }
      .shell {
        width: 100%;
        padding: 24px 12px;
      }
      .card {
        max-width: 640px;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #d8e1ee;
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0 12px 36px rgba(15, 23, 42, 0.08);
      }
      .header {
        padding: 28px 32px;
        text-align: center;
        background: linear-gradient(135deg, #1f2937 0%, #273449 60%, #334155 100%);
        color: #f8fafc;
      }
      .logo {
        display: block;
        width: 64px;
        height: 64px;
        margin: 0 auto 14px;
        border-radius: 16px;
      }
      .eyebrow {
        margin: 0 0 10px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        color: rgba(248, 250, 252, 0.8);
      }
      .title {
        margin: 0 0 12px;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 42px;
        line-height: 1.05;
        color: #f8fafc;
      }
      .subtitle {
        max-width: 520px;
        margin: 0 auto;
        font-size: 16px;
        line-height: 1.7;
        color: rgba(248, 250, 252, 0.84);
      }
      .content {
        padding: 34px 32px 18px;
        font-size: 16px;
        line-height: 1.85;
        color: #334155;
      }
      .cta-wrap {
        padding: 0 32px 8px;
      }
      .btn {
        display: inline-block;
        padding: 14px 22px;
        border-radius: 999px;
        background: ${config.colors.main};
        color: #ffffff !important;
        text-decoration: none;
        font-size: 16px;
        font-weight: 700;
      }
      .footer {
        padding: 14px 32px 32px;
        font-size: 13px;
        line-height: 1.75;
        color: #64748b;
      }
      .footer p {
        margin: 0 0 10px;
      }
    </style>
  </head>
  <body>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="shell">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" class="card">
            <tr>
              <td class="header">
                <img
                  src="https://${config.domainName}/icon.png"
                  alt="${escapeHtml(config.appName)} logo"
                  width="64"
                  height="64"
                  class="logo"
                />
                <p class="eyebrow">${escapeHtml(
                  config.appName
                )}</p>
                <h1 class="title">${escapeHtml(
                  title
                )}</h1>
                <p class="subtitle">${escapeHtml(
                  subtitle
                )}</p>
              </td>
            </tr>
            <tr>
              <td class="content">${formatContent(content)}</td>
            </tr>
            <tr>
              <td class="cta-wrap">
                <a href="${ctaUrl}" class="btn">${escapeHtml(ctaLabel)}</a>
              </td>
            </tr>
            <tr>
              <td class="footer">
                <p>${escapeHtml(footer)}</p>
                <p>Need help? Contact ${escapeHtml(config.email.supportEmail)}.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
