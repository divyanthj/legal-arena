"use client";

const GOAL_NAME_PATTERN = /^[a-z0-9_:-]{1,64}$/;
const PARAM_NAME_PATTERN = /^[a-z0-9_-]{1,64}$/;
const MAX_PARAMS = 10;
const MAX_VALUE_LENGTH = 255;
const DATAFAST_COOKIE_NAMES = ["datafast_visitor_id", "datafast_session_id"];
const ATTRIBUTION_STORAGE_KEY = "legalarena_attribution_v1";
const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "gbraid",
  "wbraid",
];

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

const readAttribution = (searchParams) =>
  ATTRIBUTION_KEYS.reduce((attribution, key) => {
    const value = String(searchParams.get(key) || "").trim().slice(0, MAX_VALUE_LENGTH);
    if (value) attribution[key] = value;
    return attribution;
  }, {});

// Keep the original acquisition parameters through sign-in and multi-page gameplay
// so that checkout metadata represents the first touch, not just the final page.
export const getAcquisitionAttribution = () => {
  if (typeof window === "undefined") return {};

  let stored = {};
  try {
    stored = JSON.parse(window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY) || "{}") || {};
  } catch {
    stored = {};
  }

  const current = readAttribution(new URLSearchParams(window.location.search));
  const attribution = { ...stored, ...current };

  if (Object.keys(current).length > 0) {
    try {
      window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
    } catch {
      // Attribution is optional; blocked storage must not affect checkout.
    }
  }

  return attribution;
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

const getValidProfileImage = (value = "") => {
  if (typeof window === "undefined" || !value) return "";

  try {
    const image = new URL(String(value), window.location.origin).href;
    return /^https?:\/\//i.test(image) && image.length <= 250 ? image : "";
  } catch {
    return "";
  }
};

export const identifyDatafastUser = ({ userId, name = "", image = "", ...params } = {}) => {
  if (typeof window === "undefined" || !String(userId || "").trim()) {
    return;
  }

  const identity = {
    user_id: String(userId).trim().slice(0, MAX_VALUE_LENGTH),
  };
  if (name) identity.name = String(name).slice(0, MAX_VALUE_LENGTH);

  const validImage = getValidProfileImage(image);
  if (validImage) identity.image = validImage;

  Object.entries(params || {}).some(([key, value], index) => {
    if (index >= MAX_PARAMS) return true;
    const cleanKey = cleanParamName(key);
    const cleanValue = cleanParamValue(value);
    if (cleanKey && PARAM_NAME_PATTERN.test(cleanKey) && cleanValue) {
      identity[cleanKey] = cleanValue;
    }
    return false;
  });

  try {
    window.datafast?.("identify", identity);
  } catch (error) {
    console.error("DataFast user identification failed", error);
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
