import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Phone } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { formatDateTime } from '../../portal/lib/format.js';
import { useCarga } from '../useCarga.js';
import { whatsappLink } from '../lib.js';
import Estado from '../components/Estado.jsx';

const MOTIVOS_SOS = { dolor: 'Dolor', inflamacion: 'Inflamación', aspecto: 'Cambio de aspecto', duda: 'Duda' };

function AlertaCard({ alerta, onCambio }) {
  const [abierta, setAbierta] = useState(false);
  const [respuesta, setRespuesta] = useState('');
  const [enviando, setEnviando] = useState(false);

  const marcar = async (estado) => {
    setEnviando(true);
    try {
      await adminService.updateAlerta(alerta.id, { estado, respuesta });
      toast.success(estado === 'atendida' ? 'Alerta marcada como atendida.' : 'Alerta reabierta.');
      onCambio();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const esSos = alerta.tipo === 'sos';
  return (
    <article className="p-panel a-item">
      <div className="a-item__head">
        <div>
          <p className="p-subtitle">{alerta.paciente?.name || 'Paciente'}</p>
          <p className="p-small">{formatDateTime(alerta.createdAt)}</p>
        </div>
        <span className={esSos ? 'p-chip p-chip--alert' : 'p-chip p-chip--rose'}>{esSos ? 'SOS' : 'Check-in'}</span>
      </div>

      <div className="a-item__meta">
        <span>{esSos ? MOTIVOS_SOS[alerta.motivo] || alerta.motivo : alerta.motivo}</span>
        {alerta.paciente?.phone && (
          <a href={whatsappLink(alerta.paciente.phone)} target="_blank" rel="noreferrer" className="p-link"><Phone size={14} /> {alerta.paciente.phone}</a>
        )}
      </div>
      {alerta.nota && <p className="a-quote">{alerta.nota}</p>}
      {alerta.respuesta && <p className="p-small">Atención registrada: {alerta.respuesta}</p>}

      {alerta.estado === 'abierta' ? (
        abierta ? (
          <form className="a-form" onSubmit={(e) => { e.preventDefault(); marcar('atendida'); }}>
            <div>
              <label className="p-label" htmlFor={`resp-${alerta.id}`}>Qué se hizo (opcional)</label>
              <textarea id={`resp-${alerta.id}`} className="p-field" maxLength={400} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} />
            </div>
            <div className="a-item__actions">
              <button type="submit" className="p-btn" disabled={enviando}>Marcar como atendida</button>
              <button type="button" className="p-btn p-btn--quiet" onClick={() => setAbierta(false)}>Volver</button>
            </div>
          </form>
        ) : (
          <div className="a-item__actions">
            <button type="button" className="p-btn" onClick={() => setAbierta(true)}>Atender</button>
            {alerta.paciente?.id && <Link to={`/admin/pacientes/${alerta.paciente.id}`} className="p-link" style={{ marginLeft: 'auto' }}>Ver ficha</Link>}
          </div>
        )
      ) : (
        <div className="a-item__actions">
          <button type="button" className="p-btn p-btn--quiet" disabled={enviando} onClick={() => marcar('abierta')}>Reabrir</button>
        </div>
      )}
    </article>
  );
}

export default function AdminAlertas() {
  const [filtro, setFiltro] = useState('abierta');
  const fetcher = useCallback(() => adminService.getAlertas(filtro), [filtro]);
  const { data, loading, error, reload } = useCarga(fetcher);

  return (
    <>
      <header className="p-page-head">
        <h1 className="p-display">Alertas</h1>
        <p className="p-lead">SOS del portal y check-ins que la regla fija marcó para seguimiento. Cada una ya te llegó por WhatsApp.</p>
      </header>

      <div className="a-toolbar">
        <div className="p-seg" role="group" aria-label="Filtrar alertas">
          <button type="button" aria-pressed={filtro === 'abierta'} onClick={() => setFiltro('abierta')}>Abiertas</button>
          <button type="button" aria-pressed={filtro === 'atendida'} onClick={() => setFiltro('atendida')}>Atendidas</button>
        </div>
      </div>

      <Estado loading={loading} error={error} onRetry={reload}>
        {data && (data.length === 0 ? (
          <p className="p-empty">{filtro === 'abierta' ? 'No hay alertas abiertas.' : 'Todavía no hay alertas atendidas.'}</p>
        ) : (
          <div className="a-list">
            {data.map((alerta) => <AlertaCard key={`${alerta.id}-${alerta.estado}`} alerta={alerta} onCambio={reload} />)}
          </div>
        ))}
      </Estado>
    </>
  );
}
