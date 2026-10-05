import { useCallback, useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { adminService } from '../../services/adminService.js';
import { formatDate } from '../../portal/lib/format.js';
import { hoyCR } from '../../lib/factura.js';
import { useCarga } from '../useCarga.js';
import Estado from './Estado.jsx';

const vacio = () => ({ medicamento: '', dosis: '', frecuencia: '', fechaInicio: hoyCR(), fechaFin: '', notas: '' });

const estado = (t, hoy) => (t.fechaFin < hoy ? 'Finalizado' : t.fechaInicio > hoy ? 'Próximo' : 'Activo');
const CHIP = { Activo: 'p-chip p-chip--alert', Próximo: 'p-chip', Finalizado: 'p-chip' };

/**
 * Tratamientos (medicamento, dosis, frecuencia) de una paciente: los ve en "Mis tratamientos" de su portal.
 * @param {{ pacienteId: string }} props
 */
export default function TratamientosPaciente({ pacienteId }) {
  const id = useId();
  const fetcher = useCallback(
    () => adminService.getTratamientos().then((lista) => lista.filter((t) => t.idPaciente === pacienteId)),
    [pacienteId],
  );
  const { data, loading, error, reload } = useCarga(fetcher);
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState(vacio);
  const [problema, setProblema] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const cerrar = () => { setAbierto(false); setForm(vacio()); setProblema(''); };

  const validar = () => {
    if (!form.medicamento.trim() || !form.dosis.trim() || !form.frecuencia.trim()) return 'Completa medicamento, dosis y frecuencia.';
    if (!form.fechaInicio || !form.fechaFin) return 'Indica la fecha de inicio y de fin.';
    if (form.fechaFin < form.fechaInicio) return 'La fecha de fin no puede ser anterior a la de inicio.';
    return '';
  };

  const enviar = async (e) => {
    e.preventDefault();
    const p = validar();
    setProblema(p);
    if (p) return;
    setGuardando(true);
    try {
      await adminService.crearTratamiento({
        idPaciente: pacienteId,
        medicamento: form.medicamento.trim(),
        dosis: form.dosis.trim(),
        frecuencia: form.frecuencia.trim(),
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        notas: form.notas.trim(),
      });
      toast.success('Tratamiento registrado. Ya aparece en su portal.');
      cerrar();
      reload();
    } catch (err) {
      setProblema(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const hoy = hoyCR();

  return (
    <>
      <Estado loading={loading} error={error} onRetry={reload}>
        {data && (data.length === 0 ? <p className="p-small">Sin tratamientos registrados.</p> : (
          <ul className="a-list">
            {data.map((t) => (
              <li key={t.id}>
                <div className="a-item__head">
                  <span className="p-subtitle">{t.medicamento}</span>
                  <span className={CHIP[estado(t, hoy)]}>{estado(t, hoy)}</span>
                </div>
                <p className="p-small">{t.dosis} · {t.frecuencia} · {formatDate(t.fechaInicio)} → {formatDate(t.fechaFin)}</p>
                {t.notas && <p className="a-quote" style={{ marginTop: '0.25rem' }}>{t.notas}</p>}
              </li>
            ))}
          </ul>
        ))}
      </Estado>

      {!abierto ? (
        <button type="button" className="p-btn p-btn--quiet a-add" onClick={() => setAbierto(true)}>
          <Plus size={16} aria-hidden="true" /> Agregar tratamiento
        </button>
      ) : (
        <form className="a-form" onSubmit={enviar} noValidate aria-label="Nuevo tratamiento" style={{ marginTop: '1rem' }}>
          <div className="a-grid">
            <div>
              <label className="p-label" htmlFor={`${id}-med`}>Medicamento o producto *</label>
              <input id={`${id}-med`} className="p-field" value={form.medicamento} onChange={cambiar('medicamento')} maxLength={120} autoComplete="off" />
            </div>
            <div>
              <label className="p-label" htmlFor={`${id}-dosis`}>Dosis *</label>
              <input id={`${id}-dosis`} className="p-field" value={form.dosis} onChange={cambiar('dosis')} maxLength={80} placeholder="Capa fina" />
            </div>
            <div>
              <label className="p-label" htmlFor={`${id}-frec`}>Frecuencia *</label>
              <input id={`${id}-frec`} className="p-field" value={form.frecuencia} onChange={cambiar('frecuencia')} maxLength={80} placeholder="2 veces al día" />
            </div>
            <div>
              <label className="p-label" htmlFor={`${id}-ini`}>Inicio *</label>
              <input id={`${id}-ini`} className="p-field" type="date" value={form.fechaInicio} onChange={cambiar('fechaInicio')} />
            </div>
            <div>
              <label className="p-label" htmlFor={`${id}-fin`}>Fin *</label>
              <input id={`${id}-fin`} className="p-field" type="date" value={form.fechaFin} min={form.fechaInicio} onChange={cambiar('fechaFin')} />
            </div>
          </div>
          <div>
            <label className="p-label" htmlFor={`${id}-notas`}>Indicaciones para la paciente (opcional)</label>
            <textarea id={`${id}-notas`} className="p-field" value={form.notas} onChange={cambiar('notas')} maxLength={400} rows={2} />
          </div>
          {problema && <p className="p-error" role="alert">{problema}</p>}
          <div className="a-item__actions">
            <button type="submit" className="p-btn" disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar tratamiento'}</button>
            <button type="button" className="p-btn p-btn--quiet" onClick={cerrar}>Cancelar</button>
          </div>
        </form>
      )}
    </>
  );
}
