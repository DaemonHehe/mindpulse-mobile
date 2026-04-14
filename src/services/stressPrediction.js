import { invokeSupabaseFunction } from "./functionClient";

const FUNCTION_NAME = "hf-stress-predict";
const REQUEST_TIMEOUT_MS =
  Number(process.env.EXPO_PUBLIC_STRESS_REQUEST_TIMEOUT_MS) || 120000;
const MAX_RETRIES = 1;

export async function predictStress(payload) {
  const data = await invokeSupabaseFunction({
    functionName: FUNCTION_NAME,
    payload,
    timeoutMs: REQUEST_TIMEOUT_MS,
    retries: MAX_RETRIES,
    timeoutErrorMessage: "Stress prediction request timed out.",
    unauthenticatedMessage: "You must be signed in to run stress prediction.",
  });

  if (!data?.final_state) {
    throw new Error("Stress prediction function returned no state.");
  }

  return data;
}
