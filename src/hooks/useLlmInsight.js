import { useCallback, useState } from "react";
import { askOpenRouter } from "../services/openrouter";

const EMPTY_STATE = {
  loading: false,
  error: "",
  response: "",
};

export function useLlmInsight({ system }) {
  const [state, setState] = useState(EMPTY_STATE);

  const generate = useCallback(
    async (prompt) => {
      if (!prompt || state.loading) return;
      setState((prev) => ({ ...prev, loading: true, error: "" }));

      try {
        const response = await askOpenRouter({
          system,
          user: prompt,
        });
        setState({ loading: false, error: "", response });
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error?.message || "Failed to generate insight.",
        }));
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
