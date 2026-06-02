import "server-only";

import { toSpokenSentence } from "../shared";
import {
  buildEvidencePossessionResponse,
  buildEvidenceProductionResponse,
  buildEvidenceResponseSegment,
} from "./evidence";

export const MONTH_NAME_PATTERN =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i;
export const EXACT_DATE_PATTERN =
  /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}(st|nd|rd|th)\b/i;
export const CONTACT_METHOD_PATTERN =
  /\b(phone|email|e-mail|text|sms|call|called|voicemail|letter|mail|mailed|portal|chat|in person|in-person)\b/i;
export const AMOUNT_PATTERN =
  /\$\s?\d[\d,]*(?:\.\d{2})?|\b\d[\d,]*(?:\.\d{2})?\s?(dollars?|usd|bucks)\b/i;

export const questionAsksForExactDate = (lowerQuestion = "") =>
  lowerQuestion.includes("exact date") ||
  lowerQuestion.includes("exact dates") ||
  lowerQuestion.includes("what date") ||
  lowerQuestion.includes("what dates") ||
  lowerQuestion.includes("which date") ||
  lowerQuestion.includes("which dates") ||
  lowerQuestion.includes("end date") ||
  lowerQuestion.includes("start date") ||
  lowerQuestion.includes("lease end") ||
  lowerQuestion.includes("lease start") ||
  lowerQuestion.includes("when exactly") ||
  (lowerQuestion.includes("date") &&
    (lowerQuestion.includes("pay") ||
      lowerQuestion.includes("paid") ||
      lowerQuestion.includes("due") ||
      lowerQuestion.includes("notice") ||
      lowerQuestion.includes("contact"))) ||
  (/\bwhen\b/.test(lowerQuestion) &&
    (lowerQuestion.includes("pay") ||
      lowerQuestion.includes("paid") ||
      lowerQuestion.includes("due") ||
      lowerQuestion.includes("served") ||
      lowerQuestion.includes("contacted")));

export const questionAsksForContactMethod = (lowerQuestion = "") =>
  lowerQuestion.includes("contact method") ||
  lowerQuestion.includes("how did") ||
  lowerQuestion.includes("what method") ||
  lowerQuestion.includes("which method") ||
  lowerQuestion.includes("phone or email") ||
  (lowerQuestion.includes("contact") &&
    (lowerQuestion.includes("phone") ||
      lowerQuestion.includes("email") ||
      lowerQuestion.includes("text") ||
      lowerQuestion.includes("call") ||
      lowerQuestion.includes("method")));

export const questionAsksForAmount = (lowerQuestion = "") =>
  lowerQuestion.includes("how much") ||
  lowerQuestion.includes("what amount") ||
  lowerQuestion.includes("what was the amount") ||
  lowerQuestion.includes("exact amount") ||
  lowerQuestion.includes("how many dollars");

export const questionAsksForNamesOrList = (lowerQuestion = "") =>
  lowerQuestion.includes("specific names") ||
  lowerQuestion.includes("the names") ||
  lowerQuestion.includes("those names") ||
  lowerQuestion.includes("their names") ||
  lowerQuestion.includes("provide the names") ||
  lowerQuestion.includes("tell me the names") ||
  lowerQuestion.includes("make that proper list") ||
  ((lowerQuestion.includes("name") || lowerQuestion.includes("names")) &&
    (lowerQuestion.includes("what") ||
      lowerQuestion.includes("which") ||
      lowerQuestion.includes("who") ||
      lowerQuestion.includes("provide") ||
      lowerQuestion.includes("tell"))) ||
  (lowerQuestion.includes("list") &&
    (lowerQuestion.includes("provide") ||
      lowerQuestion.includes("send") ||
      lowerQuestion.includes("share") ||
      lowerQuestion.includes("show") ||
      lowerQuestion.includes("find") ||
      lowerQuestion.includes("make")));

export const questionRequestsProductionOrLookup = (lowerQuestion = "") =>
  lowerQuestion.includes("provide") ||
  lowerQuestion.includes("send") ||
  lowerQuestion.includes("share") ||
  lowerQuestion.includes("show") ||
  lowerQuestion.includes("look for") ||
  lowerQuestion.includes("find") ||
  lowerQuestion.includes("check your") ||
  lowerQuestion.includes("pull") ||
  lowerQuestion.includes("make that") ||
  lowerQuestion.includes("give me");

export const questionAsksForProofLikeEvidence = (lowerQuestion = "") =>
  (lowerQuestion.includes("proof") ||
    lowerQuestion.includes("evidence") ||
    lowerQuestion.includes("record") ||
    lowerQuestion.includes("records") ||
    lowerQuestion.includes("invoice") ||
    lowerQuestion.includes("receipt") ||
    lowerQuestion.includes("statement") ||
    lowerQuestion.includes("statements") ||
    lowerQuestion.includes("photo") ||
    lowerQuestion.includes("photos") ||
    lowerQuestion.includes("video") ||
    lowerQuestion.includes("videos") ||
    lowerQuestion.includes("document") ||
    lowerQuestion.includes("documents")) &&
  !lowerQuestion.includes("what happened") &&
  !lowerQuestion.includes("what did") &&
  !lowerQuestion.includes("how did") &&
  !lowerQuestion.includes("where did");

export const hasRecordSearchPromise = (value = "") =>
  /\b(need to look|need to check|i'?ll look|i will look|i'?ll check|i will check|before i can send|before sending|once i'?ve pulled|once i have pulled|pull(?:ed)? my|check my messages|check my notes|look for it)\b/i.test(
    value
  );

export const buildStalledProductionReply = (lowerQuestion = "") => {
  if (questionAsksForNamesOrList(lowerQuestion)) {
    return "I still do not have the specific names in front of me right now.";
  }

  if (questionAsksForExactDate(lowerQuestion)) {
    return "I still do not have the exact date in front of me right now.";
  }

  if (questionAsksForAmount(lowerQuestion)) {
    return "I still do not have the exact amount in front of me right now.";
  }

  return "I still do not have that detail in front of me right now.";
};

export const hasExactDateDetail = (value = "") =>
  MONTH_NAME_PATTERN.test(value) || EXACT_DATE_PATTERN.test(value);

export const hasContactMethodDetail = (value = "") => CONTACT_METHOD_PATTERN.test(value);

export const hasAmountDetail = (value = "") => AMOUNT_PATTERN.test(value);

export const hasUncertaintyLanguage = (value = "") =>
  /\b(i do not|i don't|cannot|can't|not sure|do not have|don't have|do not know|don't know)\b/i.test(
    value
  );

export const shouldUseKnownSpecificFallback = (question = "", answer = "", fallbackAnswer = "") => {
  const lowerQuestion = String(question || "").trim().toLowerCase();
  const normalizedAnswer = String(answer || "").trim();
  const normalizedFallback = String(fallbackAnswer || "").trim();

  if (!normalizedAnswer || !normalizedFallback) {
    return false;
  }

  if (
    questionAsksForAmount(lowerQuestion) &&
    hasAmountDetail(normalizedFallback) &&
    !hasAmountDetail(normalizedAnswer)
  ) {
    return true;
  }

  if (
    questionAsksForExactDate(lowerQuestion) &&
    hasExactDateDetail(normalizedFallback) &&
    !hasExactDateDetail(normalizedAnswer)
  ) {
    return true;
  }

  if (
    questionAsksForContactMethod(lowerQuestion) &&
    hasContactMethodDetail(normalizedFallback) &&
    !hasContactMethodDetail(normalizedAnswer)
  ) {
    return true;
  }

  return false;
};

export const isResponsiveInterviewAnswer = (question = "", answer = "") => {
  const lowerQuestion = String(question || "").trim().toLowerCase();
  const normalizedAnswer = String(answer || "").trim();

  if (!normalizedAnswer) {
    return false;
  }

  if (questionAsksForExactDate(lowerQuestion)) {
    return hasExactDateDetail(normalizedAnswer) || hasUncertaintyLanguage(normalizedAnswer);
  }

  if (questionAsksForContactMethod(lowerQuestion)) {
    return (
      hasContactMethodDetail(normalizedAnswer) || hasUncertaintyLanguage(normalizedAnswer)
    );
  }

  if (questionAsksForAmount(lowerQuestion)) {
    return hasAmountDetail(normalizedAnswer) || hasUncertaintyLanguage(normalizedAnswer);
  }

  return true;
};

export const buildSpecificDetailFallback = ({
  lowerQuestion,
  corpus,
  bestKnownDetail,
  matchedEvidence,
  supportingEvidence,
  leadQuestion,
  playerSide,
}) => {
  const proofQuestion = questionAsksForProofLikeEvidence(lowerQuestion);
  const possessionQuestion =
    (lowerQuestion.includes("do you have") ||
      lowerQuestion.includes("did you have") ||
      lowerQuestion.includes("do you got") ||
      lowerQuestion.includes("have the") ||
      lowerQuestion.includes("have any") ||
      lowerQuestion.includes("have a") ||
      lowerQuestion.includes("got the") ||
      lowerQuestion.includes("got any") ||
      lowerQuestion.includes("did you take") ||
      lowerQuestion.includes("did you get") ||
      lowerQuestion.includes("is there a")) &&
    (lowerQuestion.includes("photo") ||
      lowerQuestion.includes("photos") ||
      lowerQuestion.includes("picture") ||
      lowerQuestion.includes("pictures") ||
      lowerQuestion.includes("video") ||
      lowerQuestion.includes("videos") ||
      lowerQuestion.includes("document") ||
      lowerQuestion.includes("documents") ||
      lowerQuestion.includes("record") ||
      lowerQuestion.includes("records") ||
      lowerQuestion.includes("email") ||
      lowerQuestion.includes("emails") ||
      lowerQuestion.includes("text") ||
      lowerQuestion.includes("texts") ||
      lowerQuestion.includes("message") ||
      lowerQuestion.includes("messages"));
  const productionQuestion =
    (lowerQuestion.includes("can you provide") ||
      lowerQuestion.includes("can you send") ||
      lowerQuestion.includes("can you share") ||
      lowerQuestion.includes("can you show") ||
      lowerQuestion.includes("send it over") ||
      lowerQuestion.includes("send over") ||
      lowerQuestion.includes("provide the") ||
      lowerQuestion.includes("provide that") ||
      lowerQuestion.includes("show me") ||
      lowerQuestion.includes("let me see")) &&
    (lowerQuestion.includes("breakdown") ||
      lowerQuestion.includes("itemized") ||
      lowerQuestion.includes("invoice") ||
      lowerQuestion.includes("receipt") ||
      lowerQuestion.includes("photo") ||
      lowerQuestion.includes("photos") ||
      lowerQuestion.includes("document") ||
      lowerQuestion.includes("documents") ||
      lowerQuestion.includes("record") ||
      lowerQuestion.includes("records") ||
      lowerQuestion.includes("email") ||
      lowerQuestion.includes("emails") ||
      lowerQuestion.includes("text") ||
      lowerQuestion.includes("texts") ||
      lowerQuestion.includes("message") ||
      lowerQuestion.includes("messages"));
  const asksForExactDate = questionAsksForExactDate(lowerQuestion);
  const asksForContactMethod = questionAsksForContactMethod(lowerQuestion);
  const asksForAmount = questionAsksForAmount(lowerQuestion);
  const bestEvidence = matchedEvidence[0] || null;

  if (asksForExactDate && !hasExactDateDetail(corpus)) {
    return `I do not have the exact date${lowerQuestion.includes("dates") ? "s" : ""} in front of me right now. The best I can say from what I have is that ${toSpokenSentence(
      bestKnownDetail
    ) || "I only remember the general sequence, not the exact day"}.`;
  }

  if (asksForContactMethod && !hasContactMethodDetail(corpus)) {
    return `I cannot confirm whether that was by phone, email, text, or something else from what I have right now.${
      supportingEvidence[0]
        ? ` ${buildEvidenceResponseSegment(supportingEvidence[0], playerSide)}`
        : ""
    }`;
  }

  if (asksForAmount && !hasAmountDetail(corpus)) {
    return "I do not have the exact amount in front of me right now.";
  }

  if (proofQuestion && supportingEvidence.length === 0 && matchedEvidence.length === 0) {
    return possessionQuestion || productionQuestion
      ? "No, not that I know of."
      : "I do not have that.";
  }

  if (possessionQuestion && bestEvidence) {
    return buildEvidencePossessionResponse(bestEvidence, playerSide);
  }

  if (productionQuestion && bestEvidence) {
    return buildEvidenceProductionResponse(bestEvidence, playerSide);
  }

  return "";
};
