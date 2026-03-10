import { useColorScheme as useNativeColorScheme } from "react-native";
import { useThemeMode } from "../theme/ThemeProvider";

export function useColorScheme() {
  const systemScheme = useNativeColorScheme() ?? "light";
  const { mode } = useThemeMode();
  return mode === "system" ? systemScheme : mode;
}
