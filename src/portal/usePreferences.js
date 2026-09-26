import { useCallback, useEffect, useState } from 'react';

// Preferencias de visualización de este dispositivo (no son datos clínicos)
const STORAGE_KEY = 'portal-prefs';
const DEFAULTS = { theme: 'system', discreet: false, textScale: 1, contrast: 'normal', reduceMotion: false };

const read = () => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
};

const systemPrefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function usePreferences() {
  const [prefs, setPrefs] = useState(read);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Almacenamiento bloqueado (modo privado): las preferencias duran solo esta visita
    }
  }, [prefs]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  // El tamaño de texto escala el rem de todo el documento mientras el portal está abierto
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = `${prefs.textScale * 100}%`;
    return () => { root.style.fontSize = ''; };
  }, [prefs.textScale]);

  const update = useCallback((patch) => setPrefs((prev) => ({ ...prev, ...patch })), []);

  const resolvedTheme = prefs.theme === 'system' ? (systemDark ? 'dark' : 'light') : prefs.theme;

  return { prefs, update, resolvedTheme };
}
