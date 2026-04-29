import { invokeSupabaseFunction } from "./functionClient";

const FUNCTION_NAME = "hf-stress-predict";
const REQUEST_TIMEOUT_MS =
  Number(process.env.EXPO_PUBLIC_STRESS_REQUEST_TIMEOUT_MS) || 15000;
const EDGE_REQUEST_TIMEOUT_MS =
  Number(process.env.EXPO_PUBLIC_STRESS_EDGE_TIMEOUT_MS) || REQUEST_TIMEOUT_MS;
const HF_DIRECT_TIMEOUT_MS =
  Number(process.env.EXPO_PUBLIC_HF_DIRECT_TIMEOUT_MS) ||
  Math.min(REQUEST_TIMEOUT_MS, 12000);
const MAX_RETRIES = 0;
const ALLOW_QUEUED_HF_FALLBACK =
  process.env.EXPO_PUBLIC_ALLOW_HF_QUEUE_FALLBACK === "true";
const HF_SPACE_URL =
  process.env.EXPO_PUBLIC_HF_SPACE_URL?.replace(/\/$/, "") ||
  "https://kosanberg-model.hf.space";
const HF_RUN_URL = `${HF_SPACE_URL}/gradio_api/run/predict`;
const HF_SUBMIT_URL = `${HF_SPACE_URL}/gradio_api/call/predict`;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const fetchWithTimeout = async (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Hugging Face prediction request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const shouldUseQueuedHfFallback = (error) => {
  if (!ALLOW_QUEUED_HF_FALLBACK) {
    return false;
  }

  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("does not accept direct") ||
    message.includes("join the queue") ||
    message.includes("direct hugging face endpoint unavailable") ||
    message.includes("not found") ||
    message.includes("failed to fetch") ||
    message.includes("network request failed")
  );
};

const isQueuedEndpointRequired = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("does not accept direct") ||
    message.includes("join the queue")
  );
};

const asJsonArrayString = (value) => {
  if (Array.isArray(value)) {
    return JSON.stringify(value.map(Number).filter(Number.isFinite));
  }

  const parsed = toNumber(value);
  return JSON.stringify(parsed === null ? [] : [parsed]);
};

const buildHfData = (payload) => [
  asJsonArrayString(payload?.acc_x_raw ?? payload?.acc_x_mean ?? payload?.acc_x),
  asJsonArrayString(payload?.acc_y_raw ?? payload?.acc_y_mean ?? payload?.acc_y),
  asJsonArrayString(payload?.acc_z_raw ?? payload?.acc_z_mean ?? payload?.acc_z),
  asJsonArrayString(payload?.temp_raw ?? payload?.temp_mean ?? payload?.temp),
  asJsonArrayString(payload?.hr_raw ?? payload?.hr_mean ?? payload?.hr),
  asJsonArrayString(payload?.bvp_raw ?? payload?.bvp_mean ?? payload?.bvp),
  asJsonArrayString(payload?.eda_raw ?? payload?.eda_mean ?? payload?.eda),
];

const parseCompletionData = (sseText) => {
  const blocks = String(sseText || "").split(/\r?\n\r?\n/);

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const eventName = lines
      .find((line) => line.startsWith("event:"))
      ?.replace(/^event:\s*/, "")
      .trim();

    if (eventName !== "complete") continue;

    const rawData = lines
      .find((line) => line.startsWith("data:"))
      ?.replace(/^data:\s*/, "")
      .trim();

    if (!rawData) return null;

    try {
      return JSON.parse(rawData);
    } catch {
      return rawData;
    }
  }

  return null;
};

const mapLabelToPrediction = (label) => {
  const normalized = label.trim().toLowerCase();
  const stressed = normalized.includes("stress");
  const confidence = stressed ? 0.86 : 0.84;

  return {
    label,
    final_state: stressed ? "Stressed" : "Relaxed",
    rf_confidence: confidence,
    lstm_confidence: confidence,
    fused_score: confidence,
  };
};

const mapHfResultToPrediction = (result) => {
  const output = Array.isArray(result) ? result[0] : result;

  if (typeof output === "string") {
    return mapLabelToPrediction(output);
  }

  if (!output || typeof output !== "object") {
    return null;
  }

  if (output.ok === false) {
    throw new Error(String(output.error || "Hugging Face prediction failed."));
  }

  const finalState =
    typeof output.final_state === "string"
      ? output.final_state
      : typeof output.label === "string"
      ? output.label
      : null;

  if (!finalState) return null;

  const stressed = finalState.trim().toLowerCase().includes("stress");
  const stressProbability = toNumber(output.stress_probability);
  const relaxedProbability = toNumber(output.relaxed_probability);
  const confidence =
    toNumber(output.confidence) ??
    (stressed
      ? stressProbability
      : relaxedProbability ?? (stressProbability === null ? null : 1 - stressProbability)) ??
    0.65;

  return {
    label: typeof output.label === "string" ? output.label : finalState,
    final_state: stressed ? "Stressed" : "Relaxed",
    rf_confidence: confidence,
    lstm_confidence: confidence,
    fused_score: confidence,
    stress_probability: stressProbability,
    relaxed_probability: relaxedProbability,
    model_version: output.model_version ?? null,
    hf_warnings: Array.isArray(output.warnings) ? output.warnings : [],
  };
};

async function predictStressWithHuggingFace(payload) {
  const requestBody = JSON.stringify({ data: buildHfData(payload) });

  try {
    const runResponse = await fetchWithTimeout(
      HF_RUN_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
      },
      HF_DIRECT_TIMEOUT_MS
    );

    const runJson = await runResponse.json().catch(() => null);
    if (!runResponse.ok) {
      const detail =
        typeof runJson?.detail === "string"
          ? runJson.detail
          : `HTTP ${runResponse.status}`;
      throw new Error(`Direct Hugging Face endpoint unavailable: ${detail}`);
    }

    const prediction = mapHfResultToPrediction(runJson?.data ?? runJson);
    if (prediction?.final_state) {
      return prediction;
    }

    throw new Error("Hugging Face returned no usable prediction.");
  } catch (error) {
    if (!shouldUseQueuedHfFallback(error)) {
      throw error;
    }
    // Fall through to the queue endpoint for Spaces that have not enabled api_open.
  }

  const submitResponse = await fetchWithTimeout(
    HF_SUBMIT_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: requestBody,
    },
    REQUEST_TIMEOUT_MS
  );

  const submitJson = await submitResponse.json().catch(() => null);
  if (!submitResponse.ok || !submitJson?.event_id) {
    throw new Error("Failed to submit Hugging Face prediction request.");
  }

  const streamResponse = await fetchWithTimeout(
    `${HF_SUBMIT_URL}/${submitJson.event_id}`,
    {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
      },
    },
    REQUEST_TIMEOUT_MS
  );

  const streamText = await streamResponse.text();
  if (!streamResponse.ok) {
    throw new Error("Failed to read Hugging Face prediction result.");
  }

  const prediction = mapHfResultToPrediction(parseCompletionData(streamText));
  if (!prediction?.final_state) {
    throw new Error("Hugging Face returned no usable prediction.");
  }

  return prediction;
}

const shouldUseDirectHfFallback = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return !(
    message.includes("sign") ||
    message.includes("unauthorized") ||
    message.includes("auth")
  );
};

export async function predictStress(payload) {
  let directError = null;

  try {
    const data = await predictStressWithHuggingFace(payload);
    if (!data?.final_state) {
      throw new Error("Stress prediction function returned no state.");
    }
    return data;
  } catch (error) {
    directError = error;
  }

  if (isQueuedEndpointRequired(directError) && !ALLOW_QUEUED_HF_FALLBACK) {
    throw new Error(
      "The Hugging Face Space is still using Gradio queue mode, so the app stopped instead of waiting forever. Deploy the updated Space with demo.queue(api_open=True), or set EXPO_PUBLIC_ALLOW_HF_QUEUE_FALLBACK=true to allow slow queued requests."
    );
  }

  try {
    const data = await invokeSupabaseFunction({
      functionName: FUNCTION_NAME,
      payload,
      timeoutMs: EDGE_REQUEST_TIMEOUT_MS,
      retries: MAX_RETRIES,
      timeoutErrorMessage: "Stress prediction request timed out.",
      unauthenticatedMessage: "You must be signed in to run stress prediction.",
    });

    if (!data?.final_state) {
      throw new Error("Stress prediction function returned no state.");
    }

    return data;
  } catch (edgeError) {
    if (!shouldUseDirectHfFallback(edgeError)) {
      throw edgeError;
    }

    throw new Error(
      `Stress prediction failed quickly. Direct Hugging Face: ${
        directError?.message || "unknown error"
      }. Edge function: ${edgeError?.message || "unknown error"}. Deploy the updated Hugging Face Space or set EXPO_PUBLIC_ALLOW_HF_QUEUE_FALLBACK=true to allow slow queued requests.`
    );
  }
}
