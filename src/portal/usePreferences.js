import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { aplicarDaltonismo } from '../components/ui/daltonismo.js';

// Preferencias de visualización de este dispositivo (no son datos clínicos)
const STORAGE_KEY = 'portal-prefs';
const DEFAULTS = {
  theme: 'system',
  discreet: false,
  textScale: 1,
  contrast: 'normal',
  reduceMotion: false,
  daltonismo: 'ninguno',
};

const read = () => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
};

// Un solo estado compartido por todo el sitio: el panel de accesibilidad, los ajustes del
// portal y Aura (que cambia preferencias desde el chat) ven siempre los mismos valores.
let estado = null;
const oyentes = new Set();
const obtener = () => (estado ??= read());
const suscribir = (fn) => {
  if (oyentes.size === 0) estado = read(); // al volver a montarse, parte de lo guardado
  oyentes.add(fn);
  return () => oyentes.delete(fn);
};

/** Cambia preferencias desde cualquier parte (también fuera de React, p. ej. el chat de Aura). */
export function actualizarPreferencias(patch) {
  estado = { ...obtener(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  } catch {
    // Almacenamiento bloqueado (modo privado): las preferencias duran solo esta visita
  }
  oyentes.forEach((fn) => fn());
}

export const leerPreferencias = obtener;

const systemPrefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function usePreferences() {
  const prefs = useSyncExternalStore(suscribir, obtener, () => DEFAULTS);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

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

  // El modo de daltonismo filtra los colores de toda la página
  useEffect(() => {
    aplicarDaltonismo(prefs.daltonismo);
    return () => aplicarDaltonismo('ninguno');
  }, [prefs.daltonismo]);

  const update = useCallback((patch) => actualizarPreferencias(patch), []);

  const resolvedTheme = prefs.theme === 'system' ? (systemDark ? 'dark' : 'light') : prefs.theme;

  return { prefs, update, resolvedTheme };
}
