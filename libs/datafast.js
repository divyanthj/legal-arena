"use client";

const GOAL_NAME_PATTERN = /^[a-z0-9_:-]{1,64}$/;
const PARAM_NAME_PATTERN = /^[a-z0-9_-]{1,64}$/;
const MAX_PARAMS = 10;
const MAX_VALUE_LENGTH = 255;

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

