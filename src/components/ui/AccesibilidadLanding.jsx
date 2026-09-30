import { useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { usePreferences } from '../../portal/usePreferences.js';
import ControlAccesibilidad from './ControlAccesibilidad.jsx';

// Aplica las preferencias de accesibilidad al sitio público: el tamaño de texto lo escala
// usePreferences (rem del documento); contraste y animaciones se aplican como clases en <html>.
export default function AccesibilidadLanding({ children }) {
  const { prefs, update } = usePreferences();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('a11y-alto-contraste', prefs.contrast === 'high');
    root.classList.toggle('a11y-sin-animaciones', prefs.reduceMotion);
    return () => root.classList.remove('a11y-alto-contraste', 'a11y-sin-animaciones');
  }, [prefs.contrast, prefs.reduceMotion]);

  return (
    <MotionConfig reducedMotion={prefs.reduceMotion ? 'always' : 'user'}>
      {children}
      <ControlAccesibilidad prefs={prefs} update={update} variante="flotante" />
    </MotionConfig>
  );
}
