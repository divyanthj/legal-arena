import "server-only";

import { recordAIUsageEvent } from "@/libs/aiUsage";

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

export const getPromptCacheHitRate = ({
  inputTokens = 0,
  cachedInputTokens = 0,
} = {}) => {
  const input = Number(inputTokens || 0);
  const cached = Number(cachedInputTokens || 0);

  if (input <= 0 || cached <= 0) {
    return 0;
  }

  return Number(Math.min(1, cached / input).toFixed(4));
};

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

  const closeJsonDelimiters = (candidate = "") => {
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

    return (
      candidate +
      (inString ? '"' : "") +
      "]".repeat(squareDepth) +
      "}".repeat(curlyDepth)
    );
  };

  const sanitizeTrailingJsonFragment = (candidate = "") =>
    String(candidate || "")
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/,?\s*"[^"]*"\s*:\s*$/s, "")
      .replace(/,?\s*"[^"]*"\s*:\s*(?:\{|\[)?\s*$/s, "")
      .replace(/,\s*$/s, "")
      .trim();

  const tryParseRepaired = (candidate = "") => {
    const repaired = closeJsonDelimiters(candidate);
    const repairedParsed = tryParse(repaired);
    if (repairedParsed) {
      return repairedParsed;
    }

    const sanitizedRepaired = closeJsonDelimiters(sanitizeTrailingJsonFragment(candidate));
    return tryParse(sanitizedRepaired);
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

  let candidate = trimmed.slice(objectStart);
  const repairedParsed = tryParseRepaired(candidate);
  if (repairedParsed) {
    return repairedParsed;
  }

  for (let index = 0; index < 8; index += 1) {
    const trimmedCandidate = sanitizeTrailingJsonFragment(candidate);
    if (!trimmedCandidate || trimmedCandidate === candidate) {
      break;
    }

    candidate = trimmedCandidate;
    const parsed = tryParseRepaired(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
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

const extractUsage = (response = {}, useResponsesApi = false) => {
  if (useResponsesApi) {
    const usage = response?.usage || {};
    return {
      inputTokens: Number(usage?.input_tokens || 0),
      outputTokens: Number(usage?.output_tokens || 0),
      totalTokens: Number(usage?.total_tokens || 0),
      cachedInputTokens: Number(
        usage?.input_tokens_details?.cached_tokens ||
          usage?.input_cached_tokens ||
          0
      ),
      reasoningTokens: Number(usage?.output_tokens_details?.reasoning_tokens || 0),
    };
  }

  const usage = response?.usage || {};
  return {
    inputTokens: Number(usage?.prompt_tokens || 0),
    outputTokens: Number(usage?.completion_tokens || 0),
    totalTokens: Number(usage?.total_tokens || 0),
    cachedInputTokens: 0,
    reasoningTokens: 0,
  };
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

const isRetryableTransportError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  const causeCode = String(error?.cause?.code || "").toUpperCase();

  return (
    message.includes("fetch failed") ||
    [
      "ECONNRESET",
      "ETIMEDOUT",
      "ECONNREFUSED",
      "EPIPE",
      "UND_ERR_CONNECT_TIMEOUT",
      "UND_ERR_HEADERS_TIMEOUT",
      "UND_ERR_SOCKET",
    ].includes(causeCode)
  );
};

const getRetryTokenGrowthStep = (maxTokens = 0) =>
  Math.max(500, Math.min(2000, Math.ceil((Number(maxTokens) || 0) * 0.25)));

const getAttemptMaxTokens = (maxTokens = 0, attempt = 0) => {
  const normalized = Math.max(1, Number(maxTokens) || 1);

  if (attempt <= 0) {
    return normalized;
  }

  return normalized + getRetryTokenGrowthStep(normalized) * attempt;
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
  usageLabel = "",
  onUsage,
  promptCacheKey = "",
  serviceTier = "",
}) => {
  if (!process.env.OPENAI_API_KEY) {
    if (throwOnError) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }
    return null;
  }

  let lastError = null;

  for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
    const attemptMaxTokens = getAttemptMaxTokens(maxTokens, attempt);
    const useResponsesApi = usesResponsesApi(model);
    const endpoint = useResponsesApi ? OPENAI_RESPONSES_URL : OPENAI_URL;
    const requestedServiceTier = String(serviceTier || "").trim().toLowerCase() || "auto";
    const serviceTierPayload = serviceTier
      ? { service_tier: requestedServiceTier }
      : {};
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
          ...serviceTierPayload,
          ...(promptCacheKey
            ? { prompt_cache_key: String(promptCacheKey).trim().slice(0, 64) }
            : {}),
        }
      : {
          model,
          temperature,
          ...buildTokenPayload(model, attemptMaxTokens),
          response_format: { type: "json_object" },
          user: userId,
          ...serviceTierPayload,
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
      const requestStartedAt = Date.now();
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
      const usage = extractUsage(data, useResponsesApi);
      const actualServiceTier = String(
        data?.service_tier || requestedServiceTier || "unknown"
      ).toLowerCase();
      const finishReason = useResponsesApi
        ? data?.status === "incomplete"
          ? String(data?.incomplete_details?.reason || "incomplete")
          : String(data?.status || "")
        : data?.choices?.[0]?.finish_reason || "";
      const content = useResponsesApi
        ? extractResponsesText(data)
        : extractMessageText(data?.choices?.[0]?.message?.content);
      const parsed = extractJsonObject(content);

      const cacheHitRate = getPromptCacheHitRate(usage);
      const usagePayload = {
        label: usageLabel || "unlabeled",
        attempt: attempt + 1,
        maxTokens: attemptMaxTokens,
        finishReason,
        model,
        api: useResponsesApi ? "responses" : "chat_completions",
        parsed: Boolean(parsed),
        promptCacheKey: promptCacheKey ? String(promptCacheKey).trim().slice(0, 64) : "",
        cacheHitRate,
        requestedServiceTier,
        serviceTier: actualServiceTier,
        isPriority: actualServiceTier === "priority",
        responseId: String(data?.id || ""),
        durationMs: Date.now() - requestStartedAt,
        ...usage,
      };

      if (usageLabel) {
        console.log("[openai-usage]", usagePayload);
      }

      if (typeof onUsage === "function") {
        try {
          onUsage(usagePayload);
        } catch (usageError) {
          console.error("OpenAI usage callback failed:", usageError);
        }
      }

      try {
        await recordAIUsageEvent({ userId, ...usagePayload });
      } catch (usageError) {
        console.error("Persistent OpenAI usage tracking failed:", usageError);
      }

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

      if (attempt < retryAttempts && isRetryableTransportError(error)) {
        console.warn("Retrying structured completion after transport failure.", {
          nextAttempt: attempt + 2,
          maxTokens: attemptMaxTokens,
          model,
          api: useResponsesApi ? "responses" : "chat_completions",
          causeCode: error?.cause?.code || "",
          message: error?.message || String(error),
        });
        continue;
      }

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

const collectWebSources = (response = {}) => {
  const sources = [];
  const addSource = (source = {}) => {
    const url = String(source?.url || source?.uri || "").trim();
    if (!/^https?:\/\//i.test(url)) return;
    sources.push({
      url,
      title: String(source?.title || source?.name || "").trim(),
      publisher: String(source?.publisher || source?.site_name || "").trim(),
      publishedAt: String(
        source?.published_at || source?.publishedAt || source?.date || ""
      ).trim(),
    });
  };

  for (const item of Array.isArray(response?.output) ? response.output : []) {
    for (const source of Array.isArray(item?.action?.sources)
      ? item.action.sources
      : []) {
      addSource(source);
    }
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      for (const annotation of Array.isArray(part?.annotations)
        ? part.annotations
        : []) {
        addSource(annotation?.url_citation || annotation);
      }
    }
  }

  return [
    ...new Map(sources.map((source) => [source.url, source])).values(),
  ].slice(0, 12);
};

export const requestWebGroundedStructuredCompletion = async ({
  systemPrompt,
  userPrompt,
  userId,
  model = DEFAULT_MODEL,
  maxTokens = 1800,
  usageLabel = "web-grounded",
  onUsage,
  serviceTier = "",
  retryAttempts = 1,
}) => {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY is not configured.");
    error.status = 503;
    error.code = "current_event_search_unavailable";
    throw error;
  }

  const requestedServiceTier =
    String(serviceTier || "").trim().toLowerCase() || "auto";
  const maxAttempts = Math.max(1, Math.min(3, Number(retryAttempts) + 1 || 1));
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const attemptMaxTokens = Math.max(
      1,
      Math.round((Number(maxTokens) || 1800) * (attempt === 0 ? 1 : 1.5))
    );
    const requestStartedAt = Date.now();
    const requestBody = {
      model,
      max_output_tokens: attemptMaxTokens,
      instructions: ensureJsonInstruction(systemPrompt),
      input: ensureJsonInstruction(
        attempt === 0
          ? userPrompt
          : `${userPrompt}\n\nRetry requirement: keep descriptions concise and ensure the complete JSON object closes within the output budget.`
      ),
      tools: [{ type: "web_search" }],
      include: ["web_search_call.action.sources"],
      user: userId,
      ...(serviceTier ? { service_tier: requestedServiceTier } : {}),
    };

    let response;
    try {
      response = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (cause) {
      const error = new Error("Live current-event search could not be reached.");
      error.status = 503;
      error.code = "current_event_search_unavailable";
      error.cause = cause;
      lastError = error;
      if (attempt + 1 < maxAttempts) continue;
      throw error;
    }

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(
        `Live current-event search failed (${response.status}).`
      );
      error.status = 503;
      error.code = "current_event_search_unavailable";
      error.providerStatus = response.status;
      lastError = error;
      console.error("OpenAI web search error:", response.status, body.slice(0, 1000));
      if (
        attempt + 1 < maxAttempts &&
        (response.status === 408 ||
          response.status === 409 ||
          response.status === 429 ||
          response.status >= 500)
      ) {
        continue;
      }
      throw error;
    }

    const data = await response.json();
    const content = extractResponsesText(data);
    const parsed = extractJsonObject(content);
    const usage = extractUsage(data, true);
    const usagePayload = {
      label: usageLabel,
      attempt: attempt + 1,
      maxTokens: attemptMaxTokens,
      finishReason:
        data?.status === "incomplete"
          ? String(data?.incomplete_details?.reason || "incomplete")
          : String(data?.status || ""),
      model,
      api: "responses",
      parsed: Boolean(parsed),
      promptCacheKey: "",
      cacheHitRate: getPromptCacheHitRate(usage),
      requestedServiceTier,
      serviceTier: String(data?.service_tier || requestedServiceTier || "unknown"),
      isPriority:
        String(data?.service_tier || requestedServiceTier).toLowerCase() ===
        "priority",
      responseId: String(data?.id || ""),
      durationMs: Date.now() - requestStartedAt,
      ...usage,
    };

    if (typeof onUsage === "function") onUsage(usagePayload);
    try {
      await recordAIUsageEvent({ userId, ...usagePayload });
    } catch (usageError) {
      console.error("Persistent web-search usage tracking failed:", usageError);
    }

    if (parsed) {
      return {
        payload: parsed,
        sources: collectWebSources(data),
        usage: usagePayload,
      };
    }

    const error = new Error(
      "Live current-event search returned an unusable result."
    );
    error.status = 503;
    error.code = "current_event_search_unavailable";
    lastError = error;
    console.warn("OpenAI web search returned malformed or incomplete JSON.", {
      attempt: attempt + 1,
      maxAttempts,
      finishReason: usagePayload.finishReason,
      maxTokens: attemptMaxTokens,
      preview: String(content || "").trim().slice(0, 500),
    });
    if (attempt + 1 >= maxAttempts) throw error;
  }

  throw lastError;
};
