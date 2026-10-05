import { useId } from 'react';
import { MODOS_DALTONISMO } from './daltonismo.js';
import './accesibilidad.css';

/**
 * Modos para daltonismo como grupo de radios nativos: TalkBack y VoiceOver anuncian
 * "botón de opción, 2 de 5, marcado" sin ARIA extra.
 * @param {{ valor: string, onChange: (modo: string) => void }} props
 */
export default function SelectorDaltonismo({ valor = 'ninguno', onChange }) {
  const nombre = useId();
  return (
    <fieldset className="dalt">
      <legend className="dalt__titulo">Daltonismo</legend>
      <div className="dalt__opciones">
        {MODOS_DALTONISMO.map((m) => (
          <label key={m.id} className={`dalt__opcion${m.id === 'ninguno' ? ' dalt__opcion--ancha' : ''}`}>
            <input
              type="radio"
              name={nombre}
              value={m.id}
              checked={valor === m.id}
              onChange={() => onChange(m.id)}
            />
            <span className="dalt__muestra" data-modo={m.id} aria-hidden="true" />
            <span className="dalt__texto">
              <span className="dalt__nombre">{m.label}</span>
              {m.id !== 'ninguno' && <span className="dalt__hint">{m.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
