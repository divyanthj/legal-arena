import {
  hasThirdPersonSelfReference,
  normalizePartySpeechToFirstPerson,
} from "./engine/voice.js";

export const normalizeClientMemoryText = (clientMemory) => {
  if (typeof clientMemory === "string") {
    return clientMemory.trim();
  }

  if (!clientMemory || typeof clientMemory !== "object" || Array.isArray(clientMemory)) {
    return "";
  }

  return [
    clientMemory.clientNarrative,
    clientMemory.voice,
    clientMemory.posture,
    ...(Array.isArray(clientMemory.personalMemory) ? clientMemory.personalMemory : []),
    ...(Array.isArray(clientMemory.evidenceAccess) ? clientMemory.evidenceAccess : []),
    ...(Array.isArray(clientMemory.uncertainty) ? clientMemory.uncertainty : []),
    ...(Array.isArray(clientMemory.blindSpots) ? clientMemory.blindSpots : []),
    ...(Array.isArray(clientMemory.motivations) ? clientMemory.motivations : []),
    ...(Array.isArray(clientMemory.boundaries) ? clientMemory.boundaries : []),
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" ");
};

const splitSentences = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

const clipText = (value = "", maxLength = 420, maxSentences = 4) => {
  const sentences = splitSentences(value);
  const sentenceLimited = sentences.length
    ? sentences.slice(0, maxSentences).join(" ")
    : String(value || "").replace(/\s+/g, " ").trim();

  if (sentenceLimited.length <= maxLength) {
    return sentenceLimited;
  }

  const clipped = sentenceLimited.slice(0, maxLength).trim();
  const sentenceEnd = Math.max(
    clipped.lastIndexOf("."),
    clipped.lastIndexOf("!"),
    clipped.lastIndexOf("?")
  );

  if (sentenceEnd >= 120) {
    return clipped.slice(0, sentenceEnd + 1).trim();
  }

  return `${clipped.replace(/[,;:\s]+$/g, "")}...`;
};

const normalizeSentenceStartSelfPronouns = (value = "") =>
  String(value || "")
    .replace(/(^|[.!?]\s+)(?:he|she|they|it)\s+/gi, (match, before) => `${before}I `)
    .replace(/\bI does\b/gi, "I do")
    .replace(/\bI has\b/gi, "I have")
    .replace(/\bI is\b/gi, "I am")
    .replace(/\bI are\b/gi, "I am")
    .replace(/\bI was\b/gi, "I was")
    .replace(/\bI were\b/gi, "I was")
    .replace(/\bI thinks\b/gi, "I think")
    .replace(/\bI believes\b/gi, "I believe")
    .replace(/\bI remembers\b/gi, "I remember")
    .replace(/\bI wants\b/gi, "I want")
    .replace(/\bI knows\b/gi, "I know");

export const buildSafeClientMemoryExcerpt = ({
  clientMemory,
  partyName = "",
  playerSide = "client",
  fallback = "",
  maxLength = 420,
  maxSentences = 4,
} = {}) => {
  const rawText = normalizeClientMemoryText(clientMemory);
  const source = rawText || String(fallback || "");
  const normalized = normalizePartySpeechToFirstPerson({
    text: source,
    partyName,
    playerSide,
  });
  const clipped = clipText(
    normalizeSentenceStartSelfPronouns(normalized),
    maxLength,
    maxSentences
  );

  if (
    !clipped ||
    hasThirdPersonSelfReference({
      text: clipped,
      partyName,
      playerSide,
    })
  ) {
    return "";
  }

  return clipped;
};
