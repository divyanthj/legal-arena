import "server-only";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.4";
const usesMaxCompletionTokens = (model = "") =>
  /^gpt-5/i.test(model) || /^o[134]/i.test(model);

const extractJsonObject = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const match = trimmed.match(/\{[\s\S]*\}/);

    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch (nestedError) {
      return null;
    }
  }
};

export const requestStructuredCompletion = async ({
  systemPrompt,
  userPrompt,
  userId,
  model = DEFAULT_MODEL,
  temperature = 0.3,
  maxTokens = 900,
  throwOnError = false,
}) => {
  if (!process.env.OPENAI_API_KEY) {
    if (throwOnError) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }
    return null;
  }

  try {
    const tokenPayload = usesMaxCompletionTokens(model)
      ? { max_completion_tokens: maxTokens }
      : { max_tokens: maxTokens };

    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature,
        ...tokenPayload,
        response_format: { type: "json_object" },
        user: userId,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error("OpenAI error:", res.status, errorBody);
      if (throwOnError) {
        throw new Error(`OpenAI API error ${res.status}: ${errorBody}`);
      }
      return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;

    return extractJsonObject(content);
  } catch (error) {
    console.error("OpenAI request failed:", error);
    if (throwOnError) {
      throw error;
    }
    return null;
  }
};
