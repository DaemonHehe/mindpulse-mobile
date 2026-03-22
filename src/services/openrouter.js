import { supabase } from "./supabase";

const FUNCTION_NAME = "openrouter-insight";
const REQUEST_TIMEOUT_MS = 30000;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

const invokeWithTimeout = async (fn, timeoutMs = REQUEST_TIMEOUT_MS) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Insight request timed out."));
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const FUNCTION_URL = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${FUNCTION_NAME}`
  : null;

export async function askOpenRouter({
  system,
  user,
  temperature = 0.4,
  maxTokens = 260,
}) {
  if (!user?.trim()) {
    throw new Error("Prompt is required.");
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message || "Failed to read auth session.");
  }

  if (!session?.access_token) {
    throw new Error("You must be signed in to generate an insight.");
  }

  if (!FUNCTION_URL) {
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL.");
  }

  if (!SUPABASE_ANON_KEY) {
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const headers = {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    "x-supabase-auth": session.access_token,
  };

  const response = await invokeWithTimeout(() =>
    fetch(FUNCTION_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        system,
        user,
        temperature,
        maxTokens,
      }),
    })
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error ||
        `Failed to generate insight (${response.status}).`
    );
  }

  if (!data?.content) {
    throw new Error("OpenRouter function returned no content.");
  }

  return data.content;
}
