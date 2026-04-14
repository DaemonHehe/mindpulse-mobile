import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-auth",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const HF_SPACE_URL =
  Deno.env.get("HF_RF_SPACE_URL")?.replace(/\/$/, "") ??
  "https://kosanberg-model.hf.space";
const HF_SUBMIT_URL = `${HF_SPACE_URL}/gradio_api/call/predict`;
const REQUEST_TIMEOUT_MS =
  Number(Deno.env.get("HF_REQUEST_TIMEOUT_MS")) || 120000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Hugging Face request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const getAuthenticatedUser = async (req: Request) => {
  const accessToken = req.headers.get("x-supabase-auth")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY");

  if (!accessToken || !supabaseUrl || !supabaseKey) {
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseNumberSeries = (value: unknown) => {
  let source = value;

  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      const parsed = toNumber(source);
      return parsed === null ? null : [parsed];
    }
  }

  if (Array.isArray(source)) {
    const values = source.map(toNumber);
    return values.some((entry) => entry === null) ? null : values;
  }

  const parsed = toNumber(source);
  return parsed === null ? null : [parsed];
};

const pickSeries = (
  payload: Record<string, unknown>,
  rawKey: string,
  meanKey: string,
  legacyKey: string
) => {
  for (const key of [rawKey, meanKey, legacyKey]) {
    const value = payload[key];
    if (value === undefined || value === null) continue;

    const series = parseNumberSeries(value);
    if (series && series.length) {
      return series;
    }
  }

  return null;
};

const parseCompletionData = (sseText: string) => {
  const blocks = sseText.split(/\r?\n\r?\n/);

  for (const block of blocks) {
    const eventLine = block
      .split(/\r?\n/)
      .find((line) => line.startsWith("event:"));
    const dataLine = block
      .split(/\r?\n/)
      .find((line) => line.startsWith("data:"));

    if (!eventLine || !dataLine) continue;

    const eventName = eventLine.replace(/^event:\s*/, "").trim();
    if (eventName !== "complete") continue;

    const rawData = dataLine.replace(/^data:\s*/, "").trim();
    try {
      return JSON.parse(rawData);
    } catch {
      return rawData;
    }
  }

  return null;
};

const mapLabelToPrediction = (label: string) => {
  const normalized = label.trim().toLowerCase();
  const stressed = normalized.includes("stress");

  const confidence = stressed
    ? 0.86
    : normalized.includes("relax") || normalized.includes("baseline")
    ? 0.84
    : 0.65;

  return {
    label,
    final_state: stressed ? "Stressed" : "Relaxed",
    rf_confidence: confidence,
    lstm_confidence: confidence,
    fused_score: confidence,
  };
};

const mapHfResultToPrediction = (result: unknown) => {
  const output = Array.isArray(result) ? result[0] : result;

  if (typeof output === "string") {
    return mapLabelToPrediction(output);
  }

  if (!output || typeof output !== "object") {
    return null;
  }

  const body = output as Record<string, unknown>;
  if (body.ok === false) {
    throw new Error(String(body.error ?? "Hugging Face prediction failed."));
  }

  const finalState =
    typeof body.final_state === "string"
      ? body.final_state
      : typeof body.label === "string"
      ? body.label
      : null;

  if (!finalState) {
    return null;
  }

  const normalized = finalState.trim().toLowerCase();
  const stressed = normalized.includes("stress");
  const stressProbability = toNumber(body.stress_probability);
  const relaxedProbability = toNumber(body.relaxed_probability);
  const confidence =
    toNumber(body.confidence) ??
    (stressed
      ? stressProbability
      : relaxedProbability ?? (stressProbability === null ? null : 1 - stressProbability)) ??
    0.65;

  return {
    label: typeof body.label === "string" ? body.label : finalState,
    final_state: stressed ? "Stressed" : "Relaxed",
    rf_confidence: confidence,
    lstm_confidence: confidence,
    fused_score: confidence,
    stress_probability: stressProbability,
    relaxed_probability: relaxedProbability,
    model_version: body.model_version ?? null,
    hf_warnings: Array.isArray(body.warnings) ? body.warnings : [],
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return json({ error: "Unauthorized." }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const accX = pickSeries(payload, "acc_x_raw", "acc_x_mean", "acc_x");
  const accY = pickSeries(payload, "acc_y_raw", "acc_y_mean", "acc_y");
  const accZ = pickSeries(payload, "acc_z_raw", "acc_z_mean", "acc_z");
  const temp = pickSeries(payload, "temp_raw", "temp_mean", "temp");
  const hr = pickSeries(payload, "hr_raw", "hr_mean", "hr");
  const bvp = pickSeries(payload, "bvp_raw", "bvp_mean", "bvp");
  const eda = pickSeries(payload, "eda_raw", "eda_mean", "eda");

  const inputSeries = [accX, accY, accZ, temp, hr, bvp, eda];

  if (inputSeries.some((value) => value === null)) {
    return json(
      {
        error:
          "acc_x_raw, acc_y_raw, acc_z_raw, temp_raw, hr_raw, bvp_raw, and eda_raw are required numeric arrays. Mean or legacy scalar fields are accepted as fallback.",
      },
      400
    );
  }

  const values = inputSeries.map((series) => JSON.stringify(series ?? []));

  try {
    const submitResponse = await fetchWithTimeout(HF_SUBMIT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: values }),
    });

    const submitJson = await submitResponse.json().catch(() => null);
    if (!submitResponse.ok || !submitJson?.event_id) {
      return json(
        {
          error: "Failed to submit Hugging Face prediction request.",
          details: submitJson,
        },
        502
      );
    }

    const streamResponse = await fetchWithTimeout(
      `${HF_SUBMIT_URL}/${submitJson.event_id}`,
      {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
        },
      }
    );

    const streamText = await streamResponse.text();
    if (!streamResponse.ok) {
      return json(
        {
          error: "Failed to read Hugging Face prediction result.",
          details: streamText,
        },
        502
      );
    }

    const completion = parseCompletionData(streamText);
    const prediction = mapHfResultToPrediction(completion);

    if (!prediction) {
      return json(
        {
          error: "Hugging Face returned no usable prediction.",
          details: completion,
        },
        502
      );
    }

    return json(prediction);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json(
      {
        error: `Prediction request failed: ${message}`,
      },
      502
    );
  }
});
