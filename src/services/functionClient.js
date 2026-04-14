import { supabase } from "./supabase";

const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientError = (error) => {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("timed out") ||
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("temporar")
  );
};

const fetchWithTimeout = async (
  url,
  options,
  timeoutMs,
  timeoutErrorMessage
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(timeoutErrorMessage);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const getAuthenticatedSession = async (unauthenticatedMessage) => {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message || "Failed to read auth session.");
  }

  if (!session?.access_token) {
    throw new Error(unauthenticatedMessage || "You must be signed in to continue.");
  }

  return session;
};

const getFunctionUrl = (functionName) => {
  if (!SUPABASE_URL) {
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL.");
  }

  return `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${functionName}`;
};

const buildFunctionHeaders = (accessToken) => {
  if (!SUPABASE_ANON_KEY) {
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return {
    Authorization: `Bearer ${accessToken}`,
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    "x-supabase-auth": accessToken,
  };
};

export async function invokeSupabaseFunction({
  functionName,
  payload,
  timeoutMs = 30000,
  retries = 0,
  timeoutErrorMessage = "Request timed out.",
  unauthenticatedMessage,
}) {
  const session = await getAuthenticatedSession(unauthenticatedMessage);
  const functionUrl = getFunctionUrl(functionName);
  const headers = buildFunctionHeaders(session.access_token);

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        functionUrl,
        {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        },
        timeoutMs + attempt * 15000,
        timeoutErrorMessage
      );

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data?.error || `Request failed (${response.status}).`
        );
      }

      return data;
    } catch (error) {
      lastError = error;
      const shouldRetry = attempt < retries && isTransientError(error);
      if (!shouldRetry) {
        throw error;
      }

      await sleep(1200);
    }
  }

  throw lastError || new Error("Request failed.");
}
