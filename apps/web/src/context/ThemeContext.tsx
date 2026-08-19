import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  isDark: false,
  setTheme: () => {},
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('web_theme') as Theme;
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'light';
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (theme === 'dark') return true;
    if (theme === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches;
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    let effectiveDark = false;

    if (theme === 'dark') {
      effectiveDark = true;
    } else if (theme === 'system') {
      effectiveDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    setIsDark(effectiveDark);
    if (effectiveDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('web_theme', newTheme);
  };

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

/**
 * Modern 1-click Dark/Light Toggle Pill for Header
 */
export const ThemeTogglePill = ({ className }: { className?: string }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs ${
        isDark
          ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
      } ${className || ''}`}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <span className={`material-symbols-outlined text-[16px] ${isDark ? 'text-amber-300' : 'text-amber-500'}`}>
        {isDark ? 'dark_mode' : 'light_mode'}
      </span>
      <span>{isDark ? 'Dark' : 'Light'}</span>
    </button>
  );
};
