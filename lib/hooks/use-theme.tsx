'use client';
import * as React from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
const KEY = 'prism:theme';

interface ThemeCtx { theme: ThemeMode; resolved: 'light' | 'dark'; setTheme: (t: ThemeMode) => void; toggle: () => void }
const Ctx = React.createContext<ThemeCtx | null>(null);

function apply(theme: ThemeMode) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  return dark ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeMode>('dark');
  const [resolved, setResolved] = React.useState<'light' | 'dark'>('dark');

  React.useEffect(() => {
    const stored = (localStorage.getItem(KEY) as ThemeMode | null) ?? 'dark';
    setThemeState(stored);
    setResolved(apply(stored));
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if ((localStorage.getItem(KEY) as ThemeMode | null) === 'system') setResolved(apply('system')); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setTheme = React.useCallback((t: ThemeMode) => {
    localStorage.setItem(KEY, t);
    setThemeState(t);
    setResolved(apply(t));
  }, []);

  const toggle = React.useCallback(() => {
    setTheme(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setTheme]);

  return <Ctx.Provider value={{ theme, resolved, setTheme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(Ctx);
  if (!ctx) return { theme: 'dark' as ThemeMode, resolved: 'dark' as const, setTheme: () => {}, toggle: () => {} };
  return ctx;
}

export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('prism:theme')||'dark';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){document.documentElement.classList.add('dark')}})()`;
