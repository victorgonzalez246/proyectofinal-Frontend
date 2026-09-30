import { useCallback, useEffect, useId, useState } from 'react';
import { Sun, Moon, Droplets, Thermometer, RefreshCw, CloudOff } from 'lucide-react';
import { obtenerClima } from '../../services/climaService.js';
import './clima.css';

const hora = (iso) => (iso ? iso.slice(11, 16) : '');

/**
 * Clima de hoy en Escazú y recomendaciones para la piel (API externa Open-Meteo).
 * Estados: cargando, error (con reintento) y datos.
 * @param {{ titulo?: string, nivelTitulo?: 'h2' | 'h3' }} props
 */
export default function ClimaPiel({ titulo = 'Tu piel hoy en Escazú', nivelTitulo: Titulo = 'h3' }) {
  const [estado, setEstado] = useState({ datos: null, cargando: true, error: '' });
  const tituloId = useId();

  const cargar = useCallback((signal) => {
    setEstado((prev) => ({ ...prev, cargando: true, error: '' }));
    return obtenerClima(signal)
      .then((datos) => setEstado({ datos, cargando: false, error: '' }))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setEstado({ datos: null, cargando: false, error: 'No pudimos consultar el clima en este momento.' });
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    obtenerClima(controller.signal)
      .then((datos) => setEstado({ datos, cargando: false, error: '' }))
      .catch((err) => {
        if (err.name !== 'AbortError') setEstado({ datos: null, cargando: false, error: 'No pudimos consultar el clima en este momento.' });
      });
    return () => controller.abort();
  }, []);

  const { datos, cargando, error } = estado;

  return (
    <article className="clima" aria-labelledby={tituloId} aria-busy={cargando}>
      <div className="clima__cabecera">
        <Titulo id={tituloId} className="clima__titulo">{titulo}</Titulo>
        {datos && (
          <button type="button" className="clima__recargar" onClick={() => cargar()} aria-label="Actualizar el clima" disabled={cargando}>
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {cargando && !datos && (
        <div className="clima__cargando" role="status">
          <span className="clima__sr">Consultando el clima…</span>
          <span className="clima__esqueleto" aria-hidden="true" />
          <span className="clima__esqueleto clima__esqueleto--corto" aria-hidden="true" />
          <span className="clima__esqueleto" aria-hidden="true" />
        </div>
      )}

      {error && (
        <div className="clima__error" role="alert">
          <CloudOff size={20} aria-hidden="true" />
          <p>{error} Igual recuerda: protector solar todos los días.</p>
          <button type="button" onClick={() => cargar()}>Reintentar</button>
        </div>
      )}

      {datos && (
        <>
          <dl className="clima__datos">
            <div className="clima__dato">
              <dt>{datos.esDeDia ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />} Índice UV máximo</dt>
              <dd>
                <span className="clima__valor">{datos.uvMax}</span>
                <span className={`clima__uv clima__uv--${datos.nivel.nivel}`}>{datos.nivel.etiqueta}</span>
              </dd>
            </div>
            <div className="clima__dato">
              <dt><Thermometer size={18} aria-hidden="true" /> Temperatura</dt>
              <dd><span className="clima__valor">{datos.temperatura}°C</span> <span className="clima__detalle">{datos.cielo}</span></dd>
            </div>
            <div className="clima__dato">
              <dt><Droplets size={18} aria-hidden="true" /> Humedad</dt>
              <dd><span className="clima__valor">{datos.humedad}%</span></dd>
            </div>
          </dl>

          <p className="clima__subtitulo">Recomendaciones para hoy</p>
          <ul className="clima__consejos">
            {datos.consejos.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <p className="clima__fuente">
            Datos de <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
            {datos.actualizado && <> · actualizado a las {hora(datos.actualizado)}</>}. Consejos generales, no sustituyen la indicación de la doctora.
          </p>
        </>
      )}
    </article>
  );
}
