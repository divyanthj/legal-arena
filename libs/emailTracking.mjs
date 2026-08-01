const normalizeCampaign = (value = "email") =>
  String(value || "email")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "email";

const isLegalArenaUrl = (url, domainName) => {
  const expectedHost = String(domainName || "").trim().toLowerCase();
  return expectedHost && url.hostname.toLowerCase() === expectedHost;
};

export const addEmailUtmParams = (rawUrl, { domainName, campaign = "email" } = {}) => {
  try {
    const url = new URL(String(rawUrl || "").replace(/&amp;/g, "&"));
    if (!isLegalArenaUrl(url, domainName) || url.pathname === "/unsubscribe") {
      return rawUrl;
    }

    const attribution = {
      utm_source: "legal_arena",
      utm_medium: "email",
      utm_campaign: normalizeCampaign(campaign),
    };

    // Auth links redirect immediately, so put attribution on the eventual landing URL.
    if (url.pathname.startsWith("/api/auth/callback/")) {
      const callbackUrl = url.searchParams.get("callbackUrl");
      if (callbackUrl) {
        const trackedCallback = addEmailUtmParams(callbackUrl, { domainName, campaign });
        url.searchParams.set("callbackUrl", trackedCallback);
      }
      return url.toString();
    }

    Object.entries(attribution).forEach(([key, value]) => url.searchParams.set(key, value));
    return url.toString();
  } catch {
    return rawUrl;
  }
};

export const trackLegalArenaLinksInText = (
  text = "",
  { domainName, campaign = "email" } = {}
) =>
  String(text || "").replace(/https?:\/\/[^\s<>"']+/g, (match) => {
    const trailing = match.match(/[),.;!?]+$/)?.[0] || "";
    const url = trailing ? match.slice(0, -trailing.length) : match;
    return `${addEmailUtmParams(url, { domainName, campaign })}${trailing}`;
  });

export const trackLegalArenaLinksInHtml = (
  html = "",
  { domainName, campaign = "email" } = {}
) =>
  String(html || "").replace(/href=(['"])(.*?)\1/gi, (match, quote, href) => {
    const tracked = addEmailUtmParams(href, { domainName, campaign });
    return `href=${quote}${String(tracked).replace(/&/g, "&amp;")}${quote}`;
  });
