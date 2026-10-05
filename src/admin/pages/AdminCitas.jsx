import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Phone } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { formatDate } from '../../portal/lib/format.js';
import { useCarga } from '../useCarga.js';
import { ESTADOS_CITA, whatsappLink } from '../lib.js';
import Estado from '../components/Estado.jsx';

const FILTROS = [
  ['pendiente', 'Por confirmar'],
  ['confirmada', 'Confirmadas'],
  ['cancelada', 'Canceladas'],
  ['', 'Todas'],
];

function CitaCard({ cita, onCambio }) {
  const [modo, setModo] = useState(null); // null | 'confirmar' | 'cancelar'
  const [fecha, setFecha] = useState(cita.fecha);
  const [hora, setHora] = useState(cita.hora || '');
  const [enviando, setEnviando] = useState(false);
  const estado = ESTADOS_CITA[cita.estado] || ESTADOS_CITA.pendiente;

  const actualizar = async (cambios, mensaje) => {
    setEnviando(true);
    try {
      await adminService.updateCita(cita.id, cambios);
      toast.success(mensaje);
      setModo(null);
      onCambio();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const confirmar = (e) => {
    e.preventDefault();
    const reprogramada = cita.estado === 'confirmada';
    actualizar({ estado: 'confirmada', fecha, hora }, reprogramada ? 'Cita reprogramada: avisamos a la paciente.' : 'Cita confirmada: avisamos a la paciente.');
  };

  return (
    <article className="p-panel a-item">
      <div className="a-item__head">
        <div>
          <p className="p-subtitle">{cita.nombre}</p>
          <p className="p-small">{cita.tratamiento}</p>
        </div>
        <span className={estado.chip}>{estado.label}</span>
      </div>

      <div className="a-item__meta">
        <span>{formatDate(cita.fecha, { weekday: 'long', day: 'numeric', month: 'long' })}{cita.hora ? ` · ${cita.hora}` : ''}</span>
        <a href={whatsappLink(cita.telefono)} target="_blank" rel="noreferrer" className="p-link"><Phone size={14} /> {cita.telefono}</a>
        {cita.origen === 'recepcionista-ia' && <span>Reservada por la Recepcionista</span>}
      </div>

      {cita.mensaje && <p className="a-quote">{cita.mensaje}</p>}

      {cita.resumen && (
        <ol className="a-points">
          {cita.resumen.puntos.map((punto) => <li key={punto}>{punto}</li>)}
        </ol>
      )}

      {modo === 'confirmar' && (
        <form className="a-form" onSubmit={confirmar}>
          <div className="a-grid">
            <div>
              <label className="p-label" htmlFor={`fecha-${cita.id}`}>Fecha</label>
              <input id={`fecha-${cita.id}`} className="p-field" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <label className="p-label" htmlFor={`hora-${cita.id}`}>Hora</label>
              <input id={`hora-${cita.id}`} className="p-field" type="time" required value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </div>
          <div className="a-item__actions">
            <button type="submit" className="p-btn" disabled={enviando}>{enviando ? 'Guardando…' : 'Confirmar y avisar'}</button>
            <button type="button" className="p-btn p-btn--quiet" onClick={() => setModo(null)}>Volver</button>
          </div>
        </form>
      )}

      {modo === 'cancelar' && (
        <div className="a-item__actions" role="group" aria-label="Confirmar cancelación">
          <p className="p-small" style={{ width: '100%' }}>¿Cancelar esta cita? La paciente recibe un aviso por WhatsApp.</p>
          <button type="button" className="p-btn p-btn--alert" disabled={enviando} onClick={() => actualizar({ estado: 'cancelada' }, 'Cita cancelada: avisamos a la paciente.')}>
            Sí, cancelar
          </button>
          <button type="button" className="p-btn p-btn--quiet" onClick={() => setModo(null)}>No</button>
        </div>
      )}

      {modo === null && (
        <div className="a-item__actions">
          {cita.estado === 'pendiente' && <button type="button" className="p-btn" onClick={() => setModo('confirmar')}>Confirmar</button>}
          {cita.estado === 'confirmada' && <button type="button" className="p-btn p-btn--quiet" onClick={() => setModo('confirmar')}>Reprogramar</button>}
          {cita.estado !== 'cancelada' && <button type="button" className="p-btn p-btn--quiet" onClick={() => setModo('cancelar')}>Cancelar</button>}
          {cita.estado === 'cancelada' && (
            <button type="button" className="p-btn p-btn--quiet" disabled={enviando} onClick={() => actualizar({ estado: 'pendiente' }, 'La cita volvió a quedar por confirmar.')}>
              Reactivar
            </button>
          )}
          {cita.userId && <Link to={`/admin/pacientes/${cita.userId}`} className="p-link" style={{ marginLeft: 'auto' }}>Ver ficha</Link>}
        </div>
      )}
    </article>
  );
}

export default function AdminCitas() {
  const [filtro, setFiltro] = useState('pendiente');
  const fetcher = useCallback(() => adminService.getCitas(filtro), [filtro]);
  const { data, loading, error, reload } = useCarga(fetcher);

  return (
    <>
      <header className="p-page-head">
        <h1 className="p-display">Citas</h1>
        <p className="p-lead">Confirma las solicitudes con su hora: solo las confirmadas reciben el recordatorio de 24 h.</p>
      </header>

      <div className="a-toolbar">
        <div className="p-seg" role="group" aria-label="Filtrar citas">
          {FILTROS.map(([valor, label]) => (
            <button key={label} type="button" aria-pressed={filtro === valor} onClick={() => setFiltro(valor)}>{label}</button>
          ))}
        </div>
      </div>

      <Estado loading={loading} error={error} onRetry={reload}>
        {data && (data.length === 0 ? (
          <p className="p-empty">No hay citas en esta lista.</p>
        ) : (
          <div className="a-list">
            {data.map((cita) => <CitaCard key={`${cita.id}-${cita.estado}-${cita.fecha}-${cita.hora}`} cita={cita} onCambio={reload} />)}
          </div>
        ))}
      </Estado>
    </>
  );
}
