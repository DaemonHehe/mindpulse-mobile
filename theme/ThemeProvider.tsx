import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme as useNativeColorScheme } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ThemeScheme = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedScheme: ThemeScheme;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  setMode: () => {},
  resolvedScheme: 'light',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useNativeColorScheme() ?? 'light';
  const [mode, setMode] = useState<ThemeMode>('system');
  const resolvedScheme: ThemeScheme =
    mode === 'system' ? systemScheme : mode;

  const value = useMemo(
    () => ({ mode, setMode, resolvedScheme }),
    [mode, resolvedScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  return useContext(ThemeContext);
}
