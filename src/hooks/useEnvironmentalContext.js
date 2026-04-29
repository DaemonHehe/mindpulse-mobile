import { useCallback, useEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";
import { getEnvironmentalContext } from "../services/environment";

const EMPTY_STATE = {
  data: null,
  loading: true,
  error: "",
  code: "",
};

export function useEnvironmentalContext() {
  const [state, setState] = useState(EMPTY_STATE);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setState((prev) => ({ ...prev, loading: true, error: "", code: "" }));

    try {
      const data = await getEnvironmentalContext();
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setState({ data, loading: false, error: "", code: "" });
    } catch (error) {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setState({
        data: null,
        loading: false,
        error: error?.message || "Failed to load environmental context.",
        code: error?.code || "",
      });
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const task = InteractionManager.runAfterInteractions(() => {
      load();
    });
    return () => {
      mountedRef.current = false;
      task?.cancel?.();
    };
  }, [load]);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    code: state.code,
    reload: load,
  };
}
