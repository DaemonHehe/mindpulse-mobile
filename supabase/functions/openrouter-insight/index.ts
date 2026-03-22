import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-auth",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL =
  Deno.env.get("OPENROUTER_MODEL") ?? "stepfun/step-3.5-flash:free";
const OPENROUTER_FALLBACK_MODEL =
  Deno.env.get("OPENROUTER_FALLBACK_MODEL") ?? "openrouter/free";
const OPENROUTER_REFERER =
  Deno.env.get("OPENROUTER_REFERER") ?? "https://mindpulse.app/";
const OPENROUTER_TITLE = Deno.env.get("OPENROUTER_TITLE") ?? "MindPulse";

const parseNumber = (value: string | undefined, fallback: number) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

const REQUEST_TIMEOUT_MS = parseNumber(
  Deno.env.get("OPENROUTER_TIMEOUT_MS"),
  30000
);
const REQUEST_RETRY_COUNT = parseNumber(
  Deno.env.get("OPENROUTER_RETRY_COUNT"),
  1
);
const REQUEST_RETRY_BASE_MS = parseNumber(
  Deno.env.get("OPENROUTER_RETRY_BASE_MS"),
  800
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelay = (attempt: number) => {
  const jitter = Math.random() * 200;
  return REQUEST_RETRY_BASE_MS * Math.pow(2, attempt) + jitter;
};

const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const parseErrorDetails = (data: Record<string, unknown>, status: number) => {
  const error = (data.error ?? {}) as Record<string, unknown>;
  const metadata = (error.metadata ?? {}) as Record<string, unknown>;
  const errorMessage =
    (typeof error.message === "string" && error.message) ||
    (typeof data.message === "string" && data.message) ||
    (typeof data.error_description === "string" && data.error_description) ||
    "Unknown error.";
  const errorCode =
    (typeof error.code === "string" && error.code) ||
    (typeof data.code === "string" && data.code) ||
    null;
  const provider =
    (typeof metadata.provider === "string" && metadata.provider) ||
    (typeof metadata.provider_name === "string" && metadata.provider_name) ||
    (typeof data.provider === "string" && data.provider) ||
    (typeof error.provider === "string" && error.provider) ||
    null;

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

const extractTextFromContent = (content: unknown): string | null => {
  if (typeof content === "string") {
    return content.trim() || null;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (!part || typeof part !== "object") {
          return "";
        }

        const record = part as Record<string, unknown>;

        if (typeof record.text === "string") {
          return record.text;
        }

        if (
          record.type === "text" &&
          typeof record.content === "string"
        ) {
          return record.content;
        }

        return "";
      })
      .join("")
      .trim();

    return text || null;
  }

  return null;
};

const extractAssistantContent = (data: Record<string, unknown>) => {
  const choice = Array.isArray(data.choices)
    ? (data.choices[0] as Record<string, unknown> | undefined)
    : undefined;
  const message =
    choice && typeof choice.message === "object" && choice.message
      ? (choice.message as Record<string, unknown>)
      : null;

  return (
    extractTextFromContent(message?.content) ||
    extractTextFromContent(choice?.text) ||
    (typeof data.output_text === "string" && data.output_text.trim()) ||
    null
  );
};

const getFirstChoice = (data: Record<string, unknown>) =>
  Array.isArray(data.choices)
    ? ((data.choices[0] as Record<string, unknown> | undefined) ?? null)
    : null;

const getAuthenticatedUser = async (req: Request) => {
  const accessToken = req.headers.get("x-supabase-auth")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY");

  if (!accessToken || !supabaseUrl || !supabaseKey) {
    console.error("[openrouter-insight] Missing auth prerequisites", {
      hasAccessToken: Boolean(accessToken),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasSupabaseKey: Boolean(supabaseKey),
    });
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      console.error("[openrouter-insight] Invalid user token", {
        message: error?.message ?? "Unknown auth error",
      });
      return null;
    }

    return user;
  } catch (error) {
    console.error("[openrouter-insight] Auth lookup failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

Deno.serve(async (req) => {
  let stage = "startup";
  try {
    stage = "method-check";
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      return json({ error: "Missing OPENROUTER_API_KEY secret." }, 500);
    }

    stage = "auth";
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return json({ error: "Unauthorized." }, 401);
    }

    let payload: {
      system?: string;
      user?: string;
      temperature?: number;
      maxTokens?: number;
    };

    try {
      stage = "parse-body";
      payload = await req.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }

    stage = "validate-prompt";
    const userPrompt = payload.user?.trim();
    if (!userPrompt) {
      return json({ error: "User prompt is required." }, 400);
    }

    const messages = [];
    if (payload.system?.trim()) {
      messages.push({ role: "system", content: payload.system.trim() });
    }
    messages.push({ role: "user", content: userPrompt });

    const candidateModels = [OPENROUTER_MODEL];
    if (
      OPENROUTER_FALLBACK_MODEL &&
      OPENROUTER_FALLBACK_MODEL !== OPENROUTER_MODEL
    ) {
      candidateModels.push(OPENROUTER_FALLBACK_MODEL);
    }

    let lastError: unknown = null;

    for (const candidateModel of candidateModels) {
      let response: Response | null = null;
      lastError = null;

      for (let attempt = 0; attempt <= REQUEST_RETRY_COUNT; attempt += 1) {
        try {
          stage = `openrouter-fetch:${candidateModel}`;
          response = await fetchWithTimeout(OPENROUTER_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": OPENROUTER_REFERER,
              "X-OpenRouter-Title": OPENROUTER_TITLE,
            },
            body: JSON.stringify({
              model: candidateModel,
              messages,
              temperature: payload.temperature ?? 0.4,
              max_tokens: payload.maxTokens ?? 260,
            }),
          });
          lastError = null;
        } catch (error) {
          lastError = error;
          const shouldRetry =
            error instanceof DOMException &&
            error.name === "AbortError" &&
            attempt < REQUEST_RETRY_COUNT;

          if (!shouldRetry) {
            break;
          }

          await sleep(getRetryDelay(attempt));
          continue;
        }

        stage = `openrouter-parse:${candidateModel}`;
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const details = parseErrorDetails(
            data as Record<string, unknown>,
            response.status
          );

          console.error("[openrouter-insight] Upstream error", {
            model: candidateModel,
            status: response.status,
            provider: details.provider,
            code: details.code,
            message: details.message,
          });

          if (details.retryable && attempt < REQUEST_RETRY_COUNT) {
            await sleep(getRetryDelay(attempt));
            continue;
          }

          const authFailure =
            response.status === 401 || response.status === 403;
          if (
            !authFailure &&
            response.status >= 500 &&
            candidateModel !== candidateModels[candidateModels.length - 1]
          ) {
            break;
          }

          const status = authFailure ? 502 : response.status;
          const prefix = authFailure
            ? "OpenRouter authentication failed"
            : "OpenRouter error";

          return json(
            {
              error: `${prefix} (${response.status}${
                details.provider ? ` / ${details.provider}` : ""
              }${details.code ? ` / ${details.code}` : ""}): ${details.message}`,
              stage,
              model: candidateModel,
            },
            status
          );
        }

        stage = `openrouter-read-content:${candidateModel}`;
        const responseData = data as Record<string, unknown>;
        const choice = getFirstChoice(responseData);
        const content = extractAssistantContent(responseData);

        if (!content) {
          console.error("[openrouter-insight] No assistant content", {
            stage,
            model: candidateModel,
            responseModel:
              typeof responseData.model === "string" ? responseData.model : null,
            finishReason:
              choice && typeof choice.finish_reason === "string"
                ? choice.finish_reason
                : null,
          });

          if (candidateModel !== candidateModels[candidateModels.length - 1]) {
            break;
          }

          return json(
            {
              error: "OpenRouter returned no content.",
              stage,
              model: candidateModel,
            },
            502
          );
        }

        return json({
          content,
          model:
            typeof responseData.model === "string"
              ? responseData.model
              : candidateModel,
        });
      }
    }

    if (
      lastError instanceof DOMException &&
      lastError.name === "AbortError"
    ) {
      return json({ error: "OpenRouter request timed out.", stage }, 504);
    }

    return json({ error: "Failed to reach OpenRouter.", stage }, 502);
  } catch (error) {
    console.error("[openrouter-insight] Unhandled error", {
      stage,
      message: toErrorMessage(error),
    });
    return json(
      {
        error: `Function execution failed at ${stage}: ${toErrorMessage(error)}`,
        stage,
      },
      500
    );
  }
});
