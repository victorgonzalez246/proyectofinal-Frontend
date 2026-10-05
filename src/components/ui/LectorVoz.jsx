import { useSyncExternalStore } from 'react';
import { Volume2, VolumeOff, Pause, Play, SkipForward } from 'lucide-react';
import {
  VELOCIDADES,
  cambiarVelocidad,
  detenerLectura,
  estadoLectura,
  lecturaSoportada,
  leerPagina,
  pausarLectura,
  reanudarLectura,
  siguienteBloque,
  suscribirLectura,
} from './lectura.js';
import './lector.css';

/**
 * LectorVoz: botón "Leer página" y controles de la lectura en voz alta.
 * Todos los botones controlan el mismo lector (lectura.js), también el que Aura activa desde el chat.
 * Usa la Web Speech API con voz en español (Chrome, Edge, Safari y Firefox).
 * @param {{ contenedorId?: string }} props  id del contenido que se lee
 */
export default function LectorVoz({ contenedorId = 'portal-main' }) {
  const { estado, indice, total, velocidad } = useSyncExternalStore(suscribirLectura, estadoLectura, estadoLectura);

  if (!lecturaSoportada()) return null;

  const activo = estado !== 'inactivo';
  const progreso = total > 0 ? Math.round(((indice + 1) / total) * 100) : 0;
  const siguienteVelocidad = () => {
    const idx = VELOCIDADES.indexOf(velocidad);
    cambiarVelocidad(VELOCIDADES[(idx + 1) % VELOCIDADES.length]);
  };

  return (
    <div className="lector">
      {!activo ? (
        <button
          type="button"
          className="lector-btn lector-btn--principal"
          onClick={() => leerPagina(contenedorId)}
          aria-label="Leer esta página en voz alta"
          title="Leer página en voz alta"
        >
          <Volume2 size={22} aria-hidden="true" />
          <span className="lector-btn__texto">Leer página</span>
        </button>
      ) : (
        <div className="lector-controles" role="toolbar" aria-label="Controles de lectura en voz alta">
          <div className="lector-progreso" aria-hidden="true">
            <div className="lector-progreso__barra" style={{ width: `${progreso}%` }} />
          </div>

          <div className="lector-botones">
            <button
              type="button"
              className="lector-btn"
              onClick={estado === 'leyendo' ? pausarLectura : reanudarLectura}
              aria-label={estado === 'leyendo' ? 'Pausar lectura' : 'Continuar lectura'}
            >
              {estado === 'leyendo' ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
            </button>

            <button type="button" className="lector-btn" onClick={siguienteBloque} aria-label="Saltar al siguiente párrafo">
              <SkipForward size={18} aria-hidden="true" />
            </button>

            <button
              type="button"
              className="lector-btn lector-btn--vel"
              onClick={siguienteVelocidad}
              aria-label={`Velocidad de lectura: ${velocidad}x. Pulsa para cambiar.`}
            >
              {velocidad}×
            </button>

            <button type="button" className="lector-btn lector-btn--detener" onClick={detenerLectura} aria-label="Detener lectura">
              <VolumeOff size={18} aria-hidden="true" />
            </button>
          </div>

          {/* Sin aria-live: anunciarlo en cada párrafo haría que TalkBack interrumpa a la propia lectura */}
          <p className="lector-info sr-only">
            Leyendo párrafo {indice + 1} de {total}
          </p>
        </div>
      )}
    </div>
  );
}
