const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
const OPENROUTER_MODEL =
  process.env.EXPO_PUBLIC_OPENROUTER_MODEL || "openrouter/free";
const OPENROUTER_REFERER =
  process.env.EXPO_PUBLIC_OPENROUTER_REFERER || "https://mindpulse.app";
const OPENROUTER_TITLE =
  process.env.EXPO_PUBLIC_OPENROUTER_TITLE || "MindPulse";
const REQUEST_TIMEOUT_MS = 15000;

const fetchWithTimeout = async (url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
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
  try {
    response = await fetchWithTimeout(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": OPENROUTER_REFERER,
        "X-Title": OPENROUTER_TITLE,
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });
  } catch (error) {
    const message =
      error?.name === "AbortError"
        ? "OpenRouter request timed out."
        : "Failed to reach OpenRouter.";
    throw new Error(message);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `OpenRouter error (${response.status}).`;
    throw new Error(message);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned no content.");
  }

  return content.trim();
}
