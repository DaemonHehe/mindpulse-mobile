import { useCallback, useEffect, useRef, useState } from "react";
import { getEnvironmentalContext } from "../services/environment";

const EMPTY_STATE = {
  data: null,
  loading: true,
  error: "",
};

export function useEnvironmentalContext() {
  const [state, setState] = useState(EMPTY_STATE);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setState((prev) => ({ ...prev, loading: true, error: "" }));

    try {
      const data = await getEnvironmentalContext();
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setState({ data, loading: false, error: "" });
    } catch (error) {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setState({
        data: null,
        loading: false,
        error: error?.message || "Failed to load environmental context.",
      });
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    reload: load,
  };
}
