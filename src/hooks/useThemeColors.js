import { useMemo } from "react";
import { useColorScheme } from "../../hooks/useColorScheme";
import { themes } from "../constants/theme";

export function useThemeColors() {
  const scheme = useColorScheme() ?? "light";
  return useMemo(() => themes[scheme] ?? themes.light, [scheme]);
}

export function useThemeScheme() {
  return useColorScheme() ?? "light";
}
