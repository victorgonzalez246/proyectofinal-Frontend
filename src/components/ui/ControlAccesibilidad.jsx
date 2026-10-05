import { useEffect, useId, useRef, useState } from 'react';
import { Accessibility, X } from 'lucide-react';
import LectorVoz from './LectorVoz.jsx';
import './accesibilidad.css';

const TAMANOS = [
  { value: 1, label: 'A', hint: 'Texto normal' },
  { value: 1.15, label: 'A+', hint: 'Texto grande' },
  { value: 1.3, label: 'A++', hint: 'Texto muy grande' },
];

function Interruptor({ id, checked, onChange, describedBy }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={describedBy}
      className="a11y-switch"
      onClick={() => onChange(!checked)}
    />
  );
}

/**
 * Selector de accesibilidad: tamaño de texto, alto contraste y reducir animaciones.
 * Usa las mismas preferencias que el portal (usePreferences), así se conservan en todo el sitio.
 * @param {{ prefs: object, update: (patch: object) => void, variante?: 'flotante' | 'cabecera', contenedorLector?: string }} props
 */
export default function ControlAccesibilidad({ prefs, update, variante = 'flotante', contenedorLector }) {
  const [abierto, setAbierto] = useState(false);
  const botonRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();
  const tituloId = useId();
  const textoId = useId();
  const contrasteId = useId();
  const movimientoId = useId();

  // Escape o un clic fuera cierran el panel; el foco vuelve al botón
  useEffect(() => {
    if (!abierto) return undefined;
    panelRef.current?.querySelector('button')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setAbierto(false);
        botonRef.current?.focus();
      }
    };
    const onClick = (e) => {
      if (!panelRef.current?.contains(e.target) && !botonRef.current?.contains(e.target)) setAbierto(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [abierto]);

  const personalizado = prefs.textScale !== 1 || prefs.contrast === 'high' || prefs.reduceMotion;

  return (
    <div className={`a11y a11y--${variante}`}>
      <button
        ref={botonRef}
        type="button"
        className={variante === 'cabecera' ? 'p-icon-btn' : 'a11y-lanzador'}
        aria-expanded={abierto}
        aria-controls={panelId}
        aria-label="Opciones de accesibilidad"
        title="Accesibilidad"
        onClick={() => setAbierto((v) => !v)}
      >
        <Accessibility size={variante === 'cabecera' ? 19 : 22} aria-hidden="true" />
        {personalizado && <span className="a11y-punto" aria-hidden="true" />}
      </button>

      <section
        id={panelId}
        ref={panelRef}
        className="a11y-panel"
        role="dialog"
        aria-modal="false"
        aria-labelledby={tituloId}
        hidden={!abierto}
      >
        <div className="a11y-panel__cabecera">
          <h2 id={tituloId} className="a11y-panel__titulo">Accesibilidad</h2>
          <button
            type="button"
            className="a11y-cerrar"
            aria-label="Cerrar opciones de accesibilidad"
            onClick={() => { setAbierto(false); botonRef.current?.focus(); }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className="a11y-etiqueta" id={textoId}>Tamaño del texto</p>
        <div className="a11y-segmentos" role="group" aria-labelledby={textoId}>
          {TAMANOS.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={prefs.textScale === t.value}
              aria-label={t.hint}
              onClick={() => update({ textScale: t.value })}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="a11y-fila">
          <label htmlFor={contrasteId}>Alto contraste</label>
          <Interruptor
            id={contrasteId}
            checked={prefs.contrast === 'high'}
            onChange={(on) => update({ contrast: on ? 'high' : 'normal' })}
            describedBy={`${contrasteId}-ayuda`}
          />
        </div>
        <p className="a11y-ayuda" id={`${contrasteId}-ayuda`}>Textos más oscuros y enlaces subrayados.</p>

        <div className="a11y-fila">
          <label htmlFor={movimientoId}>Reducir animaciones</label>
          <Interruptor
            id={movimientoId}
            checked={prefs.reduceMotion}
            onChange={(on) => update({ reduceMotion: on })}
            describedBy={`${movimientoId}-ayuda`}
          />
        </div>
        <p className="a11y-ayuda" id={`${movimientoId}-ayuda`}>Detiene los movimientos decorativos.</p>

        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--p-line)', paddingTop: '1.5rem' }}>
          <LectorVoz contenedorId={contenedorLector || 'portal-main'} />
        </div>

        {personalizado && (
          <button
            type="button"
            className="a11y-restablecer"
            onClick={() => update({ textScale: 1, contrast: 'normal', reduceMotion: false })}
          >
            Restablecer
          </button>
        )}
      </section>
    </div>
  );
}
