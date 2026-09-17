'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { THEME_STORAGE_KEY, type ThemePreference } from '@/lib/theme';

function getSystemDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyDarkClass(isDark: boolean) {
  const el = document.documentElement;
  if (isDark) el.classList.add('dark');
  else el.classList.remove('dark');
}

type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  setTheme: (t: ThemePreference) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>('system');
  const [systemDark, setSystemDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeState(stored);
      }
    } catch {
      /* ignore */
    }
    setSystemDark(getSystemDark());
    setMounted(true);
  }, []);

  const resolvedTheme: 'light' | 'dark' =
    theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : systemDark ? 'dark' : 'light';

  useEffect(() => {
    if (!mounted) return;
    const isDark =
      theme === 'dark' || (theme === 'system' && systemDark);
    applyDarkClass(isDark);
  }, [theme, systemDark, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY || e.newValue == null) return;
      const v = e.newValue as ThemePreference;
      if (v === 'light' || v === 'dark' || v === 'system') {
        setThemeState(v);
        const dark = v === 'dark' || (v === 'system' && getSystemDark());
        applyDarkClass(dark);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [mounted]);

  const setTheme = useCallback((t: ThemePreference) => {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    const dark = t === 'dark' || (t === 'system' && getSystemDark());
    applyDarkClass(dark);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
