import "server-only";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-5.4";
const usesResponsesApi = (model = "") => /^gpt-5/i.test(model);
const usesMaxCompletionTokens = (model = "") =>
  /^gpt-5/i.test(model) || /^o[134]/i.test(model);
const buildTokenPayload = (model, maxTokens) =>
  usesMaxCompletionTokens(model)
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };
const buildResponsesStructuredFormat = () => ({
  type: "json_object",
});

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

  const trimmed = value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const tryParse = (candidate) => {
    if (!candidate || typeof candidate !== "string") {
      return null;
    }

    try {
      return JSON.parse(candidate);
    } catch (error) {
      return null;
    }
  };

  const direct = tryParse(trimmed);
  if (direct) {
    return direct;
  }

  const matchedObject = trimmed.match(/\{[\s\S]*\}/);
  const matchedParsed = tryParse(matchedObject?.[0]);
  if (matchedParsed) {
    return matchedParsed;
  }

  const objectStart = trimmed.indexOf("{");
  if (objectStart === -1) {
    return null;
  }

  const candidate = trimmed.slice(objectStart);
  let inString = false;
  let escaping = false;
  let curlyDepth = 0;
  let squareDepth = 0;

  for (const char of candidate) {
    if (escaping) {
      escaping = false;
      continue;
    }

    if (char === "\\" && inString) {
      escaping = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      curlyDepth += 1;
    } else if (char === "}") {
      curlyDepth = Math.max(0, curlyDepth - 1);
    } else if (char === "[") {
      squareDepth += 1;
    } else if (char === "]") {
      squareDepth = Math.max(0, squareDepth - 1);
    }
  }

  const repairedCandidate =
    candidate +
    (inString ? '"' : "") +
    "]".repeat(squareDepth) +
    "}".repeat(curlyDepth);

  return tryParse(repairedCandidate);
};

const extractResponsesText = (response = {}) => {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  return (Array.isArray(response?.output) ? response.output : [])
    .flatMap((item) =>
      item?.type === "message" && Array.isArray(item.content) ? item.content : []
    )
    .map((part) => {
      if (typeof part?.text === "string") {
        return part.text;
      }

      if (typeof part?.text?.value === "string") {
        return part.text.value;
      }

      if (typeof part?.refusal === "string") {
        return part.refusal;
      }

      return "";
    })
    .filter(Boolean)
    .join("\n");
};

const ensureJsonInstruction = (value = "") => {
  const text = String(value || "").trim();

  if (!text) {
    return "Return a valid JSON object only.";
  }

  if (/\bjson\b/i.test(text)) {
    return text;
  }

  return `Return a valid JSON object only.\n\n${text}`;
};

const isLikelyTruncatedJson = (value, finishReason = "") => {
  const trimmed = typeof value === "string" ? value.trim() : "";

  if (!trimmed) {
    return false;
  }

  return finishReason === "length" || (trimmed.startsWith("{") && !trimmed.endsWith("}"));
};

const shouldRetryStructuredParse = ({ content, finishReason = "", parsed }) => {
  if (parsed) {
    return false;
  }

  const text = String(content || "").trim();

  if (!text) {
    return true;
  }

  return (
    isLikelyTruncatedJson(text, finishReason) ||
    text.startsWith("{") ||
    text.startsWith("```json") ||
    finishReason === "incomplete"
  );
};

const isRetryableApiErrorStatus = (status) =>
  [408, 409, 429, 500, 502, 503, 504].includes(Number(status));

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
      attempt === 0 ? maxTokens : Math.ceil(maxTokens * (1 + attempt));
    const useResponsesApi = usesResponsesApi(model);
    const endpoint = useResponsesApi ? OPENAI_RESPONSES_URL : OPENAI_URL;
    const requestBody = useResponsesApi
      ? {
          model,
          temperature,
          max_output_tokens: attemptMaxTokens,
          instructions: ensureJsonInstruction(systemPrompt),
          input: ensureJsonInstruction(userPrompt),
          text: {
            format: buildResponsesStructuredFormat(),
          },
          user: userId,
        }
      : {
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
        };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        const apiError = new Error(`OpenAI API error ${res.status}: ${errorBody}`);

        console.error("OpenAI error:", res.status, errorBody);
        lastError = apiError;

        if (attempt < retryAttempts && isRetryableApiErrorStatus(res.status)) {
          console.warn("Retrying structured completion after retryable API error.", {
            nextAttempt: attempt + 2,
            status: res.status,
            model,
          });
          continue;
        }

        if (throwOnError) {
          throw apiError;
        }

        return null;
      }

      const data = await res.json();
      const finishReason = useResponsesApi
        ? data?.status === "incomplete"
          ? String(data?.incomplete_details?.reason || "incomplete")
          : String(data?.status || "")
        : data?.choices?.[0]?.finish_reason || "";
      const content = useResponsesApi
        ? extractResponsesText(data)
        : extractMessageText(data?.choices?.[0]?.message?.content);
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
        model,
        api: useResponsesApi ? "responses" : "chat_completions",
      });
      lastError = parseError;

      if (
        attempt < retryAttempts &&
        shouldRetryStructuredParse({
          content,
          finishReason,
          parsed,
        })
      ) {
        console.warn("Retrying structured completion after empty or incomplete structured output.", {
          nextAttempt: attempt + 2,
          attemptMaxTokens,
          finishReason,
          model,
          api: useResponsesApi ? "responses" : "chat_completions",
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
