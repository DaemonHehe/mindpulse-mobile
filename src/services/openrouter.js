const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
const OPENROUTER_MODEL =
  process.env.EXPO_PUBLIC_OPENROUTER_MODEL || "z-ai/glm-4.5-air:free";
const OPENROUTER_REFERER =
  process.env.EXPO_PUBLIC_OPENROUTER_REFERER || "https://mindpulse.app";
const OPENROUTER_TITLE =
  process.env.EXPO_PUBLIC_OPENROUTER_TITLE || "MindPulse";
const parseNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

const REQUEST_TIMEOUT_MS = parseNumber(
  process.env.EXPO_PUBLIC_OPENROUTER_TIMEOUT_MS,
  30000
);
const REQUEST_RETRY_COUNT = parseNumber(
  process.env.EXPO_PUBLIC_OPENROUTER_RETRY_COUNT,
  1
);
const REQUEST_RETRY_BASE_MS = parseNumber(
  process.env.EXPO_PUBLIC_OPENROUTER_RETRY_BASE_MS,
  800
);

const fetchWithTimeout = async (url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelay = (attempt) => {
  const jitter = Math.random() * 200;
  return REQUEST_RETRY_BASE_MS * Math.pow(2, attempt) + jitter;
};

const parseErrorDetails = (data = {}, status) => {
  const errorMessage =
    data?.error?.message ||
    data?.message ||
    data?.error_description ||
    "Unknown error.";
  const errorCode = data?.error?.code || data?.code;
  const provider =
    data?.error?.metadata?.provider ||
    data?.error?.metadata?.provider_name ||
    data?.provider ||
    data?.error?.provider;

  const retryableStatus = [408, 425, 429, 500, 502, 503, 504];
  const retryable =
    retryableStatus.includes(status) ||
    /rate limit|overloaded|timeout|temporar|unavailable/i.test(errorMessage);

  return {
    message: errorMessage,
    code: errorCode,
    provider,
    retryable,
  };
};

export async function askOpenRouter({
  system,
  user,
  temperature = 0.4,
  maxTokens = 260,
}) {
  if (!OPENROUTER_API_KEY) {
    throw new Error(
      "Missing OpenRouter API key. Set EXPO_PUBLIC_OPENROUTER_API_KEY."
    );
  }

  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  if (user) messages.push({ role: "user", content: user });

  let response;
  let lastError;
  for (let attempt = 0; attempt <= REQUEST_RETRY_COUNT; attempt += 1) {
    try {
      response = await fetchWithTimeout(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": OPENROUTER_REFERER,
          "X-OpenRouter-Title": OPENROUTER_TITLE,
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      });
      lastError = null;
    } catch (error) {
      lastError = error;
      const shouldRetry =
        error?.name === "AbortError" && attempt < REQUEST_RETRY_COUNT;
      if (!shouldRetry) break;
      await sleep(getRetryDelay(attempt));
      continue;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const details = parseErrorDetails(data, response.status);
      console.warn("[OpenRouter] Provider error", {
        status: response.status,
        attempt: attempt + 1,
        model: OPENROUTER_MODEL,
        provider: details.provider,
        code: details.code,
        message: details.message,
      });

      if (details.retryable && attempt < REQUEST_RETRY_COUNT) {
        await sleep(getRetryDelay(attempt));
        continue;
      }

      throw new Error(
        `OpenRouter error (${response.status}${
          details.provider ? ` / ${details.provider}` : ""
        }${details.code ? ` / ${details.code}` : ""}): ${details.message}`
      );
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenRouter returned no content.");
    }

    return content.trim();
  }

  if (lastError) {
    const message =
      lastError?.name === "AbortError"
        ? "OpenRouter request timed out."
        : "Failed to reach OpenRouter.";
    throw new Error(message);
  }
  throw new Error("OpenRouter request failed.");
}
