import "server-only";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.4";
const usesMaxCompletionTokens = (model = "") =>
  /^gpt-5/i.test(model) || /^o[134]/i.test(model);
const buildTokenPayload = (model, maxTokens) =>
  usesMaxCompletionTokens(model)
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };

const extractMessageText = (value) => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (typeof item?.text === "string") {
          return item.text;
        }

        if (typeof item?.text?.value === "string") {
          return item.text.value;
        }

        if (typeof item?.content === "string") {
          return item.content;
        }

        if (typeof item?.value === "string") {
          return item.value;
        }

        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  if (typeof value?.text === "string") {
    return value.text;
  }

  if (typeof value?.text?.value === "string") {
    return value.text.value;
  }

  return "";
};

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

const isLikelyTruncatedJson = (value, finishReason = "") => {
  const trimmed = typeof value === "string" ? value.trim() : "";

  if (!trimmed) {
    return false;
  }

  return finishReason === "length" || (trimmed.startsWith("{") && !trimmed.endsWith("}"));
};

export const requestStructuredCompletion = async ({
  systemPrompt,
  userPrompt,
  userId,
  model = DEFAULT_MODEL,
  temperature = 0.3,
  maxTokens = 900,
  throwOnError = false,
  retryAttempts = 0,
}) => {
  if (!process.env.OPENAI_API_KEY) {
    if (throwOnError) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }
    return null;
  }

  let lastError = null;

  for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
    const attemptMaxTokens =
      attempt === 0 ? maxTokens : Math.ceil(maxTokens * (1 + 0.5 * attempt));

    try {
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature,
          ...buildTokenPayload(model, attemptMaxTokens),
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
        const apiError = new Error(`OpenAI API error ${res.status}: ${errorBody}`);

        console.error("OpenAI error:", res.status, errorBody);
        lastError = apiError;

        if (throwOnError) {
          throw apiError;
        }

        return null;
      }

      const data = await res.json();
      const finishReason = data?.choices?.[0]?.finish_reason || "";
      const content = extractMessageText(data?.choices?.[0]?.message?.content);
      const parsed = extractJsonObject(content);

      if (parsed) {
        return parsed;
      }

      const preview = content?.trim()
        ? content.trim().slice(0, 500)
        : "[empty response]";
      const parseError = new Error(
        `OpenAI returned a non-JSON structured response: ${preview}`
      );

      console.error("OpenAI structured parse failed:", {
        attempt: attempt + 1,
        finishReason,
        preview,
      });
      lastError = parseError;

      if (attempt < retryAttempts && isLikelyTruncatedJson(content, finishReason)) {
        console.warn("Retrying structured completion after likely truncation.", {
          nextAttempt: attempt + 2,
          attemptMaxTokens,
          finishReason,
        });
        continue;
      }

      if (throwOnError) {
        throw parseError;
      }

      return null;
    } catch (error) {
      lastError = error;
      console.error("OpenAI request failed:", error);

      if (throwOnError) {
        throw error;
      }

      return null;
    }
  }

  if (throwOnError && lastError) {
    throw lastError;
  }

  return null;
};
