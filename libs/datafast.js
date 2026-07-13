"use client";

const GOAL_NAME_PATTERN = /^[a-z0-9_:-]{1,64}$/;
const PARAM_NAME_PATTERN = /^[a-z0-9_-]{1,64}$/;
const MAX_PARAMS = 10;
const MAX_VALUE_LENGTH = 255;
const DATAFAST_COOKIE_NAMES = ["datafast_visitor_id", "datafast_session_id"];

const cleanParamName = (name = "") =>
  String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);

const cleanParamValue = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value).slice(0, MAX_VALUE_LENGTH);
};

export const trackGoal = (goalName, params = {}) => {
  if (typeof window === "undefined" || !GOAL_NAME_PATTERN.test(goalName)) {
    return;
  }

  const cleanParams = Object.entries(params || {}).reduce((nextParams, [key, value]) => {
    if (Object.keys(nextParams).length >= MAX_PARAMS) {
      return nextParams;
    }

    const cleanKey = cleanParamName(key);
    if (!cleanKey || !PARAM_NAME_PATTERN.test(cleanKey)) {
      return nextParams;
    }

    const cleanValue = cleanParamValue(value);
    if (!cleanValue) {
      return nextParams;
    }

    return {
      ...nextParams,
      [cleanKey]: cleanValue,
    };
  }, {});

  try {
    window.datafast?.(goalName, cleanParams);
  } catch (error) {
    console.error("DataFast goal tracking failed", error);
  }
};

const hasDatafastAttributionCookies = () => {
  if (typeof document === "undefined") {
    return false;
  }

  const cookieNames = new Set(
    document.cookie
      .split(";")
      .map((cookie) => cookie.trim().split("=")[0])
      .filter(Boolean)
  );

  return DATAFAST_COOKIE_NAMES.every((cookieName) => cookieNames.has(cookieName));
};

// The tracker loads asynchronously. A fast click on the checkout CTA can otherwise
// reach the server before DataFast has created the visitor/session cookies that are
// required for Lemon Squeezy revenue attribution.
export const waitForDatafastAttribution = async ({ timeoutMs = 2000, intervalMs = 50 } = {}) => {
  if (typeof window === "undefined" || hasDatafastAttributionCookies()) {
    return hasDatafastAttributionCookies();
  }

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    if (hasDatafastAttributionCookies()) {
      return true;
    }
  }

  return false;
};
