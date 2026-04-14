import { invokeSupabaseFunction } from "./functionClient";

const FUNCTION_NAME = "openrouter-insight";
const REQUEST_TIMEOUT_MS = 30000;

export async function askOpenRouter({
  system,
  user,
  temperature = 0.4,
  maxTokens = 260,
}) {
  if (!user?.trim()) {
    throw new Error("Prompt is required.");
  }

  const data = await invokeSupabaseFunction({
    functionName: FUNCTION_NAME,
    payload: {
      system,
      user,
      temperature,
      maxTokens,
    },
    timeoutMs: REQUEST_TIMEOUT_MS,
    retries: 0,
    timeoutErrorMessage: "Insight request timed out.",
    unauthenticatedMessage: "You must be signed in to generate an insight.",
  });

  if (!data?.content) {
    throw new Error("OpenRouter function returned no content.");
  }

  return data.content;
}
