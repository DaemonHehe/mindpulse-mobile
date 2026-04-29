import { useCallback, useState } from "react";
import { askOpenRouter } from "../services/openrouter";

const INSIGHT_TIMEOUT_MS = 12000;

const EMPTY_STATE = {
  loading: false,
  error: "",
  response: "",
};

const withTimeout = (promise, timeoutMs) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Insight request timed out."));
      }, timeoutMs);
    }),
  ]);

const getPromptLine = (prompt, label) => {
  const line = String(prompt || "")
    .split(/\r?\n/)
    .find((entry) => entry.toLowerCase().startsWith(label.toLowerCase()));

  return line?.replace(new RegExp(`^${label}\\s*`, "i"), "").trim() || "";
};

const buildLocalInsight = (prompt) => {
  const stateLine = getPromptLine(prompt, "- State:");
  const hrLine = getPromptLine(prompt, "- Heart rate");
  const airLine = getPromptLine(prompt, "Air quality (US AQI):");
  const weatherLine = getPromptLine(prompt, "Weather:");
  const isStressed = /stressed/i.test(stateLine);
  const stateText = isStressed
    ? "Your current pattern suggests elevated stress."
    : "Your current pattern looks relatively steady.";
  const contextParts = [hrLine, weatherLine, airLine]
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");

  return `${stateText} ${contextParts} Take two minutes for slow breathing, hydrate, and re-check after your next reading.`;
};

export function useLlmInsight({ system }) {
  const [state, setState] = useState(EMPTY_STATE);

  const generate = useCallback(
    async (prompt) => {
      if (!prompt || state.loading) return;
      setState((prev) => ({ ...prev, loading: true, error: "" }));

      try {
        const response = await withTimeout(
          askOpenRouter({
            system,
            user: prompt,
          }),
          INSIGHT_TIMEOUT_MS
        );
        setState({ loading: false, error: "", response });
      } catch (error) {
        setState({
          loading: false,
          error: "",
          response: buildLocalInsight(prompt),
        });
      }
    },
    [state.loading, system]
  );

  const clear = useCallback(() => {
    setState(EMPTY_STATE);
  }, []);

  return {
    loading: state.loading,
    error: state.error,
    response: state.response,
    generate,
    clear,
  };
}
