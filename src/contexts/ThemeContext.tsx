import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';

// Theme Types
export type ThemeType = 'light' | 'dark' | 'tech';

// Color definitions for each theme
export interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceSecondary: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  primary: string;
  primaryText: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  cardBackground: string;
  cardBorder: string;
  headerBackground: string;
  sidebarBackground: string;
  inputBackground: string;
  inputBorder: string;
  glowColor: string;
  glowIntensity: number;
}

// Light Theme
export const lightTheme: ThemeColors = {
  background: '#f8fafc',
  backgroundSecondary: '#ffffff',
  surface: '#ffffff',
  surfaceSecondary: '#f1f5f9',
  text: '#1a1a1a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  primary: '#1a1a1a',
  primaryText: '#ffffff',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  cardBackground: '#ffffff',
  cardBorder: '#e2e8f0',
  headerBackground: '#ffffff',
  sidebarBackground: '#1a1a1a',
  inputBackground: '#ffffff',
  inputBorder: '#e2e8f0',
  glowColor: 'transparent',
  glowIntensity: 0,
};

// Dark Theme (Black)
export const darkTheme: ThemeColors = {
  background: '#000000',
  backgroundSecondary: '#121212',
  surface: '#1a1a1a',
  surfaceSecondary: '#2a2a2a',
  text: '#ffffff',
  textSecondary: '#b3b3b3',
  textMuted: '#808080',
  border: '#333333',
  borderLight: '#444444',
  primary: '#ffffff',
  primaryText: '#000000',
  success: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
  info: '#60a5fa',
  cardBackground: '#1a1a1a',
  cardBorder: '#333333',
  headerBackground: '#000000',
  sidebarBackground: '#000000',
  inputBackground: '#2a2a2a',
  inputBorder: '#444444',
  glowColor: 'transparent',
  glowIntensity: 0,
};

// Tech Theme (Futuristic Blue)
export const techTheme: ThemeColors = {
  background: '#0a0e1a',
  backgroundSecondary: '#111827',
  surface: '#131c2e',
  surfaceSecondary: '#1a2744',
  text: '#e0f2fe',
  textSecondary: '#7dd3fc',
  textMuted: '#38bdf8',
  border: '#1e40af',
  borderLight: '#1d4ed8',
  primary: '#0ea5e9',
  primaryText: '#ffffff',
  success: '#22d3ee',
  warning: '#fbbf24',
  error: '#f87171',
  info: '#38bdf8',
  cardBackground: '#0f1729',
  cardBorder: '#1e3a5f',
  headerBackground: '#0a0e1a',
  sidebarBackground: '#050810',
  inputBackground: '#1a2744',
  inputBorder: '#1e40af',
  glowColor: '#0ea5e9',
  glowIntensity: 0.3,
};

// Get theme by type
export const getTheme = (type: ThemeType): ThemeColors => {
  switch (type) {
    case 'dark':
      return darkTheme;
    case 'tech':
      return techTheme;
    default:
      return lightTheme;
  }
};

// Theme labels
export const themeLabels: Record<ThemeType, string> = {
  light: 'Hell',
  dark: 'Dunkel',
  tech: 'Tech',
};

// Context
interface ThemeContextType {
  theme: ThemeType;
  colors: ThemeColors;
  setTheme: (theme: ThemeType) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@app_theme';

// Provider
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>('light');

  // Load saved theme on mount
  useEffect(() => {
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme && ['light', 'dark', 'tech'].includes(savedTheme)) {
          setThemeState(savedTheme as ThemeType);
        }
      }
    } catch (error) {
      console.log('Error loading theme:', error);
    }
  }, []);

  // Save and set theme
  const setTheme = (newTheme: ThemeType) => {
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      }
    } catch (error) {
      console.log('Error saving theme:', error);
    }
    setThemeState(newTheme);
  };

  const colors = getTheme(theme);
  const isDark = theme === 'dark' || theme === 'tech';

  return (
    <ThemeContext.Provider value={{ theme, colors, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return default values if context is not available
    return {
      theme: 'light' as ThemeType,
      colors: lightTheme,
      setTheme: () => {},
      isDark: false,
    };
  }
  return context;
}
