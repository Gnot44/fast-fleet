import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSubtle: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryLight: string;
  primaryBorder: string;
  success: string;
  successLight: string;
  successText: string;
  warning: string;
  warningLight: string;
  warningText: string;
  danger: string;
  dangerLight: string;
  dangerText: string;
  card: string;
  divider: string;
  inputBg: string;
}

const lightColors: ThemeColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1F5F9',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  primary: '#1D4ED8',
  primaryLight: '#EFF6FF',
  primaryBorder: '#BFDBFE',
  success: '#10B981',
  successLight: '#ECFDF5',
  successText: '#065F46',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  warningText: '#92400E',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  dangerText: '#991B1B',
  card: '#FFFFFF',
  divider: '#F1F5F9',
  inputBg: '#F8FAFC',
};

const darkColors: ThemeColors = {
  background: '#0B1120',
  surface: '#1E293B',
  surfaceSubtle: '#0F172A',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  border: '#334155',
  primary: '#3B82F6',
  primaryLight: '#1E3A8A',
  primaryBorder: '#2563EB',
  success: '#10B981',
  successLight: '#064E3B',
  successText: '#6EE7B7',
  warning: '#F59E0B',
  warningLight: '#78350F',
  warningText: '#FDE68A',
  danger: '#EF4444',
  dangerLight: '#7F1D1D',
  dangerText: '#FCA5A5',
  card: '#1E293B',
  divider: '#334155',
  inputBg: '#0F172A',
};

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  isDark: false,
  colors: lightColors,
  setTheme: () => {},
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem('mobile_theme').then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemeState(saved as ThemeMode);
      }
    });
  }, []);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    AsyncStorage.setItem('mobile_theme', mode);
  };

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
  };

  const isDark =
    theme === 'dark' || (theme === 'system' && systemColorScheme === 'dark');

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
