import { useCallback, useEffect, useState } from 'react';
import { Pill, Timer, CircleCheck, CircleAlert, CalendarClock } from 'lucide-react';
import { portalService } from '../../services/portalService.js';
import { formatDate, toDate } from '../lib/format.js';

const hoy = () => new Date().toISOString().slice(0, 10);

const estadoTratamiento = (t) => {
  const hoyStr = hoy();
  if (t.fechaFin < hoyStr) return 'finalizado';
  if (t.fechaInicio <= hoyStr && t.fechaFin >= hoyStr) return 'activo';
  return 'futuro';
};

const diasRestantes = (fechaFin) => {
  const diff = Math.ceil((toDate(fechaFin) - new Date()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
};

const progresoPorcentaje = (fechaInicio, fechaFin) => {
  const inicio = toDate(fechaInicio).getTime();
  const fin = toDate(fechaFin).getTime();
  const ahora = Date.now();
  if (ahora >= fin) return 100;
  if (ahora <= inicio) return 0;
  return Math.round(((ahora - inicio) / (fin - inicio)) * 100);
};

export default function PortalTratamientos() {
  const [tratamientos, setTratamientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await portalService.getTratamientos();
      setTratamientos(data);
    } catch (err) {
      setError(err.message || 'No pudimos cargar tus tratamientos.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial: el estado se actualiza cuando llega la respuesta
  useEffect(() => {
    let activo = true;
    portalService.getTratamientos()
      .then((data) => { if (activo) { setTratamientos(data); setLoading(false); } })
      .catch((err) => { if (activo) { setError(err.message || 'No pudimos cargar tus tratamientos.'); setLoading(false); } });
    return () => { activo = false; };
  }, []);

  const activos = tratamientos.filter((t) => estadoTratamiento(t) === 'activo');
  const finalizados = tratamientos.filter((t) => estadoTratamiento(t) === 'finalizado');
  const futuros = tratamientos.filter((t) => estadoTratamiento(t) === 'futuro');

  if (loading) return <p className="p-small" role="status">Cargando tus tratamientos…</p>;
  if (error) return (
    <div className="p-empty" role="alert">
      <p>{error}</p>
      <button type="button" className="p-btn p-btn--quiet" style={{ marginTop: '1rem' }} onClick={cargar}>Reintentar</button>
    </div>
  );

  return (
    <>
      <header className="p-page-head">
        <h1 className="p-display">Mis tratamientos</h1>
        <p className="p-lead">Medicamentos, indicaciones y seguimiento de tus tratamientos.</p>
      </header>

      {tratamientos.length === 0 ? (
        <div className="p-empty">
          <Pill size={40} strokeWidth={1.2} />
          <p className="p-subtitle" style={{ marginTop: '0.75rem' }}>No tienes tratamientos registrados todavía.</p>
          <p className="p-small" style={{ marginTop: '0.35rem' }}>
            La Dra. Laura registrará tus indicaciones después de tu consulta.
          </p>
        </div>
      ) : (
        <>
          {/* Tratamientos activos */}
          {activos.length > 0 && (
            <section className="pt-seccion" aria-labelledby="activos-title">
              <h2 className="p-title" id="activos-title" style={{ marginBottom: '1rem' }}>
                <CircleAlert size={18} style={{ verticalAlign: '-3px', marginRight: '0.4rem', color: 'var(--p-rose-ink)' }} />
                Tratamientos activos ({activos.length})
              </h2>
              <div className="pt-lista">
                {activos.map((t) => (
                  <article key={t.id} className="p-panel pt-card pt-card--activo">
                    <div className="pt-card__head">
                      <div className="pt-card__icono"><Pill size={22} /></div>
                      <div>
                        <p className="p-subtitle">{t.medicamento}</p>
                        <p className="p-small">{t.dosis} · {t.frecuencia}</p>
                      </div>
                    </div>

                    {/* Barra de progreso */}
                    <div className="pt-progreso">
                      <div className="pt-progreso__head">
                        <span className="p-small"><CalendarClock size={13} style={{ verticalAlign: '-2px' }} /> {formatDate(t.fechaInicio)} → {formatDate(t.fechaFin)}</span>
                        <strong className="p-small">{diasRestantes(t.fechaFin)} días restantes</strong>
                      </div>
                      <div className="pt-progreso__pista">
                        <span style={{ width: `${progresoPorcentaje(t.fechaInicio, t.fechaFin)}%` }} />
                      </div>
                    </div>

                    {t.notas && (
                      <div className="pt-card__notas">
                        <p className="p-small"><strong>Indicaciones:</strong> {t.notas}</p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Tratamientos futuros */}
          {futuros.length > 0 && (
            <section className="pt-seccion" aria-labelledby="futuros-title">
              <h2 className="p-title" id="futuros-title" style={{ marginBottom: '1rem' }}>
                <Timer size={18} style={{ verticalAlign: '-3px', marginRight: '0.4rem' }} />
                Próximos tratamientos ({futuros.length})
              </h2>
              <div className="pt-lista">
                {futuros.map((t) => (
                  <article key={t.id} className="p-panel pt-card">
                    <div className="pt-card__head">
                      <div className="pt-card__icono pt-card__icono--muted"><Timer size={22} /></div>
                      <div>
                        <p className="p-subtitle">{t.medicamento}</p>
                        <p className="p-small">{t.dosis} · {t.frecuencia}</p>
                        <p className="p-small">Inicia: {formatDate(t.fechaInicio)}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Tratamientos finalizados */}
          {finalizados.length > 0 && (
            <section className="pt-seccion" aria-labelledby="finalizados-title">
              <h2 className="p-title" id="finalizados-title" style={{ marginBottom: '1rem' }}>
                <CircleCheck size={18} style={{ verticalAlign: '-3px', marginRight: '0.4rem', color: 'var(--p-olive)' }} />
                Tratamientos finalizados ({finalizados.length})
              </h2>
              <div className="pt-lista">
                {finalizados.map((t) => (
                  <article key={t.id} className="p-panel pt-card pt-card--fin">
                    <div className="pt-card__head">
                      <div className="pt-card__icono pt-card__icono--done"><CircleCheck size={22} /></div>
                      <div>
                        <p className="p-subtitle">{t.medicamento}</p>
                        <p className="p-small">{t.dosis} · {t.frecuencia}</p>
                        <p className="p-small">{formatDate(t.fechaInicio)} → {formatDate(t.fechaFin)}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
