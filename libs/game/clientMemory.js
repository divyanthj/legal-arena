import { requestStructuredCompletion } from "@/libs/gpt";

const CLIENT_MEMORY_EXCERPT_MODEL =
  process.env.OPENAI_CLIENT_MEMORY_MODEL?.trim() ||
  process.env.OPENAI_GAMEPLAY_MODEL?.trim() ||
  process.env.OPENAI_MODEL?.trim() ||
  "gpt-5.4-mini";

export const normalizeClientMemoryText = (clientMemory) => {
  if (typeof clientMemory === "string") {
    return clientMemory.trim();
  }

  if (!clientMemory || typeof clientMemory !== "object" || Array.isArray(clientMemory)) {
    return "";
  }

  return [
    clientMemory.clientStory,
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
    .join("\n");
};

const cleanGeneratedExcerpt = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^(your\s+honou?r|judge|court)\s*[:,.-]?\s*/i, "")
    .trim();

export const generateClientMemoryExcerpt = async ({
  clientMemory,
  partyName = "",
  playerSide = "client",
  userId,
  promptCacheKey = "",
  onUsage,
} = {}) => {
  const clientStory = normalizeClientMemoryText(clientMemory);

  if (!clientStory) {
    return "";
  }

  try {
    const aiResult = await requestStructuredCompletion({
      userId,
      model: CLIENT_MEMORY_EXCERPT_MODEL,
      temperature: 0.35,
      maxTokens: 360,
      retryAttempts: 1,
      usageLabel: "intake.clientMemoryExcerpt",
      promptCacheKey,
      onUsage,
      systemPrompt:
        "You write active-intake hero excerpts from a private client memory story. Write only a concise first-person excerpt in the interview subject's voice. The excerpt is spoken privately to the party's own lawyer, not to a judge or courtroom. Never address the listener as Your Honor, Judge, Court, counsel, sir, or ma'am. Use the client's subjective truth, not a neutral case summary. Do not add objective facts, documents, witnesses, outcomes, legal advice, headings, labels, or JSON-looking prose. Avoid generic setup lines like 'I need to walk through this' and choose concrete story content instead. Output valid JSON only.",
      userPrompt: JSON.stringify({
        task: "Generate the hero excerpt shown to the player before intake questioning.",
        representedPartyName: partyName,
        representedSide: playerSide,
        clientStory,
        styleRules: [
          "First person only.",
          "Two to four sentences.",
          "No courtroom address; do not say Your Honor.",
          "No third-person reporting voice.",
          "No legal-summary scaffolding.",
          "Keep it under 520 characters.",
          "Make it sound like a vivid excerpt from the client story, not a button label or placeholder.",
        ],
        outputSchema: {
          excerpt: "string",
        },
      }),
    });

    return cleanGeneratedExcerpt(aiResult?.excerpt || aiResult?.clientMemoryExcerpt || "");
  } catch (error) {
    console.error("client memory excerpt generation failed", error);
    return "";
  }
};
