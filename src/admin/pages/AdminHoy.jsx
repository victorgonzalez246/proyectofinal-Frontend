import { Link } from 'react-router-dom';
import { adminService } from '../../services/adminService.js';
import { formatDate, formatDateTime, greeting } from '../../portal/lib/format.js';
import { useCarga } from '../useCarga.js';
import Estado from '../components/Estado.jsx';
import { distintivoAlerta } from '../lib.js';

export default function AdminHoy() {
  const { data, loading, error, reload } = useCarga(adminService.getHoy);

  return (
    <>
      <header className="p-page-head">
        <h1 className="p-display">{greeting()}, doctora</h1>
        <p className="p-lead">{data ? formatDate(data.fecha, { weekday: 'long', day: 'numeric', month: 'long' }) : 'Resumen del día'}</p>
      </header>

      <Estado loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="a-stats">
              <div className="p-panel a-stat">
                <p className="p-small">Consultas confirmadas hoy</p>
                <p className="a-stat__value">{data.citas.length}</p>
              </div>
              <Link to="/admin/citas" className="p-panel a-stat">
                <p className="p-small">Solicitudes por confirmar</p>
                <p className="a-stat__value">{data.solicitudesPendientes}</p>
                <span className="p-link">Revisar citas</span>
              </Link>
              <Link to="/admin/alertas" className="p-panel a-stat">
                <p className="p-small">Alertas abiertas</p>
                <p className="a-stat__value" style={data.alertasAbiertas ? { color: 'var(--p-alert)' } : undefined}>{data.alertasAbiertas}</p>
                <span className="p-link">Ver bandeja</span>
              </Link>
            </div>

            <section className="p-section" aria-labelledby="consultas-title">
              <h2 className="p-title" id="consultas-title" style={{ marginBottom: '1rem' }}>Consultas de hoy</h2>
              {data.citas.length === 0 ? (
                <p className="p-empty">No hay consultas confirmadas para hoy.</p>
              ) : (
                <div className="a-list">
                  {data.citas.map((cita) => (
                    <article key={cita.id} className="p-panel a-item">
                      <div className="a-item__head">
                        <div>
                          <p className="p-subtitle">{cita.hora || 'Sin hora'} · {cita.nombre}</p>
                          <p className="p-small">{cita.tratamiento}</p>
                        </div>
                        {cita.userId && <Link to={`/admin/pacientes/${cita.userId}`} className="p-link">Ver ficha</Link>}
                      </div>
                      {cita.resumen ? (
                        <div>
                          <p className="p-small" style={{ marginBottom: '0.35rem' }}>Resumen de la Recepcionista</p>
                          <ol className="a-points">
                            {cita.resumen.puntos.map((punto) => <li key={punto}>{punto}</li>)}
                          </ol>
                        </div>
                      ) : (
                        <p className="p-small">El resumen de 3 puntos llega a las 7:00 por WhatsApp y aparece aquí.</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="p-section" aria-labelledby="alertas-title">
              <div className="p-section__head">
                <h2 className="p-title" id="alertas-title">Alertas abiertas</h2>
                {data.alertasAbiertas > 0 && <Link to="/admin/alertas" className="p-link">Atender</Link>}
              </div>
              {data.alertas.length === 0 ? (
                <p className="p-empty">Ninguna paciente necesita atención ahora.</p>
              ) : (
                <div className="a-list">
                  {data.alertas.map((alerta) => {
                    const distintivo = distintivoAlerta(alerta);
                    return (
                      <article key={alerta.id} className="p-panel a-item">
                        <div className="a-item__head">
                          <p className="p-subtitle">{alerta.paciente?.name || 'Paciente'}</p>
                          <span className={distintivo.chip}>{distintivo.etiqueta}</span>
                        </div>
                        <p className="p-small">
                          {distintivo.detalle && `${distintivo.detalle} · `}{alerta.motivo} · {formatDateTime(alerta.createdAt)}
                        </p>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </Estado>
    </>
  );
}
