import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { adminService } from '../../services/adminService.js';
import { formatDate, formatDateTime } from '../../portal/lib/format.js';
import { MOODS } from '../../portal/config.js';
import { useCarga } from '../useCarga.js';
import { ESTADOS_CITA, ORIGENES, whatsappLink } from '../lib.js';
import Estado from '../components/Estado.jsx';
import PlanEditor from '../components/PlanEditor.jsx';
import EvolucionPaciente from '../../components/analitica/EvolucionPaciente.jsx';

const animo = (id) => MOODS.find((m) => m.id === id)?.label || id;

export default function AdminPaciente() {
  const { id } = useParams();
  const fetcher = useCallback(() => adminService.getPaciente(id), [id]);
  const { data, loading, error, reload } = useCarga(fetcher);
  const [retirando, setRetirando] = useState(false);

  const retirarPromociones = async () => {
    setRetirando(true);
    try {
      await adminService.retirarPromociones(id);
      toast.success('Ya no recibirá promociones.');
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRetirando(false);
    }
  };

  const p = data?.paciente;

  return (
    <>
      <Link to="/admin/pacientes" className="p-link" style={{ marginBottom: '1.25rem' }}><ArrowLeft size={16} /> Pacientes</Link>

      <Estado loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <header className="p-page-head">
              <h1 className="p-display">{p.name}</h1>
              <div className="a-item__meta" style={{ marginTop: '0.75rem' }}>
                <a href={whatsappLink(p.phone)} target="_blank" rel="noreferrer" className="p-link"><Phone size={14} /> {p.phone}</a>
                {p.email && <span>{p.email}</span>}
                <span>{ORIGENES[p.source] || 'Registro manual'}</span>
                {p.dateJoined && <span>Desde el {formatDate(p.dateJoined)}</span>}
              </div>
              {p.promociones && (
                <p className="p-small" style={{ marginTop: '0.75rem' }}>
                  Acepta promociones por WhatsApp.{' '}
                  <button type="button" className="p-link" disabled={retirando} onClick={retirarPromociones}>Retirar consentimiento</button>
                </p>
              )}
            </header>

            <div className="p-next">
              <section className="p-panel" aria-labelledby="citas-title">
                <h2 className="p-subtitle" id="citas-title" style={{ marginBottom: '0.75rem' }}>Citas</h2>
                {data.citas.length === 0 ? <p className="p-small">Sin citas.</p> : (
                  <ul className="a-list">
                    {data.citas.slice(0, 6).map((c) => (
                      <li key={c.id} className="a-item__head">
                        <span className="p-small">{formatDate(c.fecha)}{c.hora ? ` · ${c.hora}` : ''} · {c.tratamiento}</span>
                        <span className={ESTADOS_CITA[c.estado]?.chip}>{ESTADOS_CITA[c.estado]?.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="p-panel" aria-labelledby="checkins-title">
                <h2 className="p-subtitle" id="checkins-title" style={{ marginBottom: '0.75rem' }}>Check-ins recientes</h2>
                {data.checkins.length === 0 ? <p className="p-small">Todavía no registra check-ins.</p> : (
                  <ul className="a-list">
                    {data.checkins.slice(0, 6).map((c) => (
                      <li key={c.id}>
                        <p className="p-small">
                          {formatDateTime(c.createdAt)} · {animo(c.mood)} · molestia {c.pain}/10
                          {c.needsFollowUp && <> · <span className="p-chip p-chip--alert">Seguimiento</span></>}
                        </p>
                        {c.note && <p className="a-quote" style={{ marginTop: '0.25rem' }}>{c.note}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className="p-section" aria-labelledby="evolucion-title">
              <h2 className="p-title" id="evolucion-title">Evolución del tratamiento</h2>
              <p className="p-small" style={{ margin: '0.35rem 0 1.25rem' }}>
                {data.plan?.lastTreatment
                  ? `Recuperación de «${data.plan.lastTreatment.name}» según sus check-ins, cuidados y avance del plan.`
                  : 'Aparecerá cuando la paciente tenga un tratamiento registrado en su plan.'}
              </p>
              {data.plan?.lastTreatment && <EvolucionPaciente plan={data.plan} checkins={data.checkins} vista="doctora" />}
            </section>

            <section className="p-section" aria-labelledby="plan-title">
              <h2 className="p-title" id="plan-title">Plan de la paciente</h2>
              <p className="p-small" style={{ margin: '0.35rem 0 1.25rem' }}>
                {data.plan ? 'Lo que ella ve en su portal.' : 'Todavía no tiene plan: su portal muestra que la primera valoración está pendiente.'}
              </p>
              <PlanEditor key={data.plan?.updatedAt || 'nuevo'} pacienteId={p.id} plan={data.plan} />
            </section>
          </>
        )}
      </Estado>
    </>
  );
}
