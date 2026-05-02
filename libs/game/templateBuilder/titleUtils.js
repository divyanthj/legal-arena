export const MONEY_PATTERN =
  /\$\s?\d[\d,]*(?:\.\d{2})?|\b\d[\d,]*(?:\.\d{2})?\s?dollars?\b/gi;

export const extractMoneyValues = (value = "") =>
  [...String(value || "").matchAll(MONEY_PATTERN)].map((match) =>
    String(match[0]).replace(/[^0-9.]/g, "")
  );

export const buildDepositCaseTitle = (corpus = "") => {
  const moneyValues = extractMoneyValues(corpus);
  const likelyWithheldAmount =
    moneyValues.find((value) => value && value !== "1200") || moneyValues[0] || "";

  if (likelyWithheldAmount) {
    return `The $${likelyWithheldAmount} Deposit Fight`;
  }

  return "The Deposit Fight";
};
