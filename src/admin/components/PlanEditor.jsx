import { useState } from 'react';
import { toast } from 'sonner';
import { adminService } from '../../services/adminService.js';
import { ROADMAP_KINDS } from '../../portal/config.js';
import { fromLocalInput, toLocalInput } from '../lib.js';
import Filas, { Campo } from './Filas.jsx';

const ESTADOS_PASO = [['done', 'Hecho'], ['current', 'Actual'], ['next', 'Siguiente'], ['future', 'Futuro']];
const TIPOS_PASO = Object.entries(ROADMAP_KINDS);
const POSTERS = [['scrubs', 'Doctora en consultorio'], ['editorial', 'Retrato editorial'], ['clinica', 'Clínica']];

const CAMPOS = {
  roadmap: [
    { key: 'date', label: 'Fecha', type: 'date', required: true },
    { key: 'title', label: 'Paso', max: 120, required: true },
    { key: 'kind', label: 'Tipo', type: 'select', options: TIPOS_PASO },
    { key: 'status', label: 'Estado', type: 'select', options: ESTADOS_PASO },
    { key: 'note', label: 'Nota para la paciente', type: 'textarea', max: 500, wide: true },
  ],
  care: [
    { key: 'type', label: 'Tipo', type: 'select', options: [['do', 'Hacer'], ['dont', 'No hacer']] },
    { key: 'text', label: 'Indicación', max: 200, required: true, wide: true },
    { key: 'hours', label: 'Durante (horas)', type: 'number', min: 1, maxValue: 720, required: true },
  ],
  packages: [
    { key: 'name', label: 'Paquete', max: 120, required: true },
    { key: 'total', label: 'Sesiones', type: 'number', min: 1, maxValue: 50, required: true },
    { key: 'used', label: 'Usadas', type: 'number', min: 0, maxValue: 50, required: true },
    { key: 'validUntil', label: 'Válido hasta', type: 'date', required: true },
  ],
  certificates: [
    { key: 'product', label: 'Producto', max: 120, required: true },
    { key: 'brand', label: 'Marca', max: 80, required: true },
    { key: 'lot', label: 'Lote', max: 40, required: true },
    { key: 'expiry', label: 'Vencimiento', type: 'month', required: true },
    { key: 'appliedOn', label: 'Aplicado el', type: 'date', required: true },
    { key: 'zone', label: 'Zona', max: 80 },
    { key: 'amount', label: 'Cantidad', max: 20, placeholder: '1 ml' },
  ],
  videos: [
    { key: 'title', label: 'Título', max: 120, required: true, wide: true },
    { key: 'duration', label: 'Duración', max: 10, placeholder: '3:40' },
    { key: 'topic', label: 'Tema', max: 40 },
    { key: 'poster', label: 'Portada', type: 'select', options: POSTERS },
    { key: 'url', label: 'Enlace privado (https)', type: 'url', max: 500, wide: true },
  ],
};

const NUEVOS = {
  roadmap: () => ({ date: '', title: '', kind: 'tratamiento', status: 'future', note: '' }),
  care: () => ({ type: 'do', text: '', hours: 24 }),
  packages: () => ({ name: '', total: 1, used: 0, validUntil: '' }),
  certificates: () => ({ product: '', brand: '', lot: '', expiry: '', appliedOn: '', zone: '', amount: '' }),
  videos: () => ({ title: '', duration: '', topic: '', poster: 'scrubs', url: '' }),
};

const conClave = (lista = []) => lista.map((item) => ({ ...item, _key: item.id || crypto.randomUUID() }));
const sinClave = (lista) => lista.map(({ _key, ...item }) => item);

// Del plan guardado al borrador del formulario
const aBorrador = (plan) => ({
  lastTreatment: { name: plan?.lastTreatment?.name || '', date: toLocalInput(plan?.lastTreatment?.date) },
  nextAppointment: {
    date: toLocalInput(plan?.nextAppointment?.date),
    title: plan?.nextAppointment?.title || '',
    place: plan?.nextAppointment?.place || '',
  },
  careTitle: plan?.care?.title || '',
  careSince: toLocalInput(plan?.care?.since),
  roadmap: conClave(plan?.roadmap),
  care: conClave(plan?.care?.items),
  packages: conClave(plan?.packages),
  certificates: conClave(plan?.certificates),
  videos: conClave(plan?.videos).map((v) => ({ ...v, url: v.url || '' })),
});

// Del borrador al plan que valida la API (los campos vacíos opcionales se envían como null)
const aPlan = (b) => ({
  lastTreatment: b.lastTreatment.name || b.lastTreatment.date
    ? { name: b.lastTreatment.name, date: fromLocalInput(b.lastTreatment.date) } : null,
  nextAppointment: b.nextAppointment.title || b.nextAppointment.date
    ? { ...b.nextAppointment, date: fromLocalInput(b.nextAppointment.date) } : null,
  roadmap: sinClave(b.roadmap),
  care: b.careTitle || b.care.length
    ? { title: b.careTitle, since: fromLocalInput(b.careSince), items: sinClave(b.care) } : null,
  packages: sinClave(b.packages),
  certificates: sinClave(b.certificates),
  videos: sinClave(b.videos).map((v) => ({ ...v, url: v.url || null })),
});

export default function PlanEditor({ pacienteId, plan, onGuardado }) {
  const [borrador, setBorrador] = useState(() => aBorrador(plan));
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cambiar = (patch) => {
    setBorrador((prev) => ({ ...prev, ...patch }));
    setSucio(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const guardado = await adminService.savePlan(pacienteId, aPlan(borrador));
      setBorrador(aBorrador(guardado));
      setSucio(false);
      toast.success('Plan guardado: la paciente ya lo ve en su portal.');
      onGuardado?.(guardado);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const campoSimple = (grupo, key, campo) => (
    <Campo
      id={`${grupo}-${key}`}
      campo={campo}
      value={borrador[grupo][key]}
      onChange={(valor) => cambiar({ [grupo]: { ...borrador[grupo], [key]: valor } })}
    />
  );

  return (
    <form className="a-form" onSubmit={guardar}>
      <fieldset className="a-fieldset">
        <legend>Último tratamiento</legend>
        <p className="p-small">Marca el inicio de la recuperación: el portal y el seguimiento de n8n cuentan los días desde aquí.</p>
        <div className="a-grid">
          {campoSimple('lastTreatment', 'name', { label: 'Tratamiento', max: 120 })}
          {campoSimple('lastTreatment', 'date', { label: 'Fecha y hora', type: 'datetime-local' })}
        </div>
      </fieldset>

      <fieldset className="a-fieldset">
        <legend>Próxima cita</legend>
        <div className="a-grid">
          {campoSimple('nextAppointment', 'title', { label: 'Motivo', max: 120 })}
          {campoSimple('nextAppointment', 'date', { label: 'Fecha y hora', type: 'datetime-local' })}
          {campoSimple('nextAppointment', 'place', { label: 'Lugar', max: 120, placeholder: 'Clínica Escazú' })}
        </div>
      </fieldset>

      <Filas
        id="roadmap" titulo="Mapa de belleza" etiqueta="paso"
        ayuda="Los pasos marcados como siguiente o futuro activan el aviso semanal de próximos pasos."
        items={borrador.roadmap} campos={CAMPOS.roadmap} nuevo={NUEVOS.roadmap}
        onChange={(roadmap) => cambiar({ roadmap })}
      />

      <fieldset className="a-fieldset">
        <legend>Protocolo de cuidados</legend>
        <div className="a-grid">
          <Campo id="care-title" campo={{ label: 'Título', max: 120 }} value={borrador.careTitle} onChange={(careTitle) => cambiar({ careTitle })} />
          <Campo id="care-since" campo={{ label: 'Desde', type: 'datetime-local' }} value={borrador.careSince} onChange={(careSince) => cambiar({ careSince })} />
        </div>
      </fieldset>
      <Filas
        id="care" titulo="Indicaciones de cuidado" etiqueta="indicación"
        ayuda="La Enfermera Virtual responde con las indicaciones vigentes (según las horas de cada una)."
        items={borrador.care} campos={CAMPOS.care} nuevo={NUEVOS.care}
        onChange={(care) => cambiar({ care })}
      />

      <Filas
        id="packages" titulo="Paquetes" etiqueta="paquete"
        items={borrador.packages} campos={CAMPOS.packages} nuevo={NUEVOS.packages}
        onChange={(packages) => cambiar({ packages })}
      />

      <Filas
        id="certificates" titulo="Productos aplicados" etiqueta="producto"
        ayuda="Trazabilidad: marca, lote y vencimiento de lo que se aplicó."
        items={borrador.certificates} campos={CAMPOS.certificates} nuevo={NUEVOS.certificates}
        onChange={(certificates) => cambiar({ certificates })}
      />

      <Filas
        id="videos" titulo="Videos de Clínica privada" etiqueta="video"
        ayuda="Usa solo enlaces privados o de corta duración, nunca videos públicos."
        items={borrador.videos} campos={CAMPOS.videos} nuevo={NUEVOS.videos}
        onChange={(videos) => cambiar({ videos })}
      />

      <div className="a-save">
        <p className="p-small" role="status">{sucio ? 'Hay cambios sin guardar.' : 'Todo guardado.'}</p>
        <button type="submit" className="p-btn" disabled={guardando || !sucio}>{guardando ? 'Guardando…' : 'Guardar plan'}</button>
      </div>
    </form>
  );
}
