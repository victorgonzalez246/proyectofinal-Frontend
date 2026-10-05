import { useEffect, useId, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { METODOS_PAGO, TARIFAS_IVA, calcularTotales, colones, hoyCR } from '../../lib/factura.js';

// Sugerencias para la descripción (se puede escribir cualquier otra)
const SERVICIOS = [
  'Valoración médica',
  'Armonización facial',
  'Bioestimulador de colágeno, sesión',
  'Toxina botulínica (rejuvenecimiento de mirada)',
  'Perfilado labial con ácido hialurónico',
  'Skinbooster y mesoterapia, sesión',
  'Rinomodelación sin cirugía',
  'Control post-tratamiento',
];

const itemVacio = () => ({ descripcion: '', cantidad: 1, precio: '' });

/**
 * Formulario de una factura nueva. Los totales son una vista previa: el servidor los recalcula.
 * @param {{ pacienteInicial?: string, onCreada: (factura) => void, onCancelar: () => void }} props
 */
export default function FormFactura({ pacienteInicial = '', onCreada, onCancelar }) {
  const id = useId();
  const [pacientes, setPacientes] = useState([]);
  const [idPaciente, setIdPaciente] = useState(pacienteInicial);
  const [cliente, setCliente] = useState({ nombre: '', identificacion: '', telefono: '', email: '' });
  const [fecha, setFecha] = useState(hoyCR());
  const [items, setItems] = useState([itemVacio()]);
  const [descuento, setDescuento] = useState('');
  const [impuesto, setImpuesto] = useState(0);
  const [metodoPago, setMetodoPago] = useState('sinpe');
  const [referencia, setReferencia] = useState('');
  const [estado, setEstado] = useState('pagada');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Al elegir una paciente se completan sus datos de contacto (se pueden editar)
  const datosDe = (p) => ({ nombre: p.name || '', telefono: p.phone || '', email: p.email || '' });
  const elegirPaciente = (idElegido) => {
    setIdPaciente(idElegido);
    const p = pacientes.find((x) => x.id === idElegido);
    if (p) setCliente((c) => ({ ...c, ...datosDe(p) }));
  };

  // Pacientes para el selector; si se llegó desde una ficha, esa paciente queda elegida
  useEffect(() => {
    let activo = true;
    adminService.getPacientes().then((lista) => {
      if (!activo) return;
      setPacientes(lista);
      const inicial = lista.find((x) => x.id === pacienteInicial);
      if (inicial) setCliente((c) => ({ ...c, ...datosDe(inicial) }));
    }).catch(() => {});
    return () => { activo = false; };
  }, [pacienteInicial]);

  const totales = useMemo(() => calcularTotales(items, descuento, impuesto), [items, descuento, impuesto]);
  const etiquetaReferencia = METODOS_PAGO[metodoPago].referencia;
  const referenciaObligatoria = metodoPago === 'sinpe' && estado === 'pagada';

  const cambiarItem = (i, campo, valor) => setItems((lista) => lista.map((it, j) => (j === i ? { ...it, [campo]: valor } : it)));
  const cambiarCliente = (campo) => (e) => setCliente((c) => ({ ...c, [campo]: e.target.value }));

  const validar = () => {
    if (cliente.nombre.trim().length < 3) return 'Indica el nombre del cliente.';
    const malItem = items.find((it) => !it.descripcion.trim() || !(Number(it.cantidad) >= 1) || it.precio === '' || Number(it.precio) < 0);
    if (malItem) return 'Cada servicio necesita descripción, cantidad y precio.';
    if (referenciaObligatoria && !referencia.trim()) return 'Indica el número de comprobante del SINPE Móvil.';
    if (totales.total <= 0) return 'El total de la factura debe ser mayor a cero.';
    return '';
  };

  const enviar = async (e) => {
    e.preventDefault();
    const problema = validar();
    setError(problema);
    if (problema) return;
    setGuardando(true);
    try {
      const factura = await adminService.crearFactura({
        idPaciente: idPaciente || undefined,
        cliente: { ...cliente, nombre: cliente.nombre.trim() },
        fecha,
        items: items.map((it) => ({ descripcion: it.descripcion.trim(), cantidad: Number(it.cantidad), precio: Number(it.precio) })),
        descuento: Number(descuento) || 0,
        impuesto: Number(impuesto),
        metodoPago,
        referencia: referencia.trim(),
        estado,
        notas: notas.trim(),
      });
      onCreada(factura);
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  };

  return (
    <form className="a-form f-form" onSubmit={enviar} noValidate aria-labelledby="nueva-factura-titulo">
      <h2 className="p-title" id="nueva-factura-titulo">Nueva factura</h2>

      <fieldset className="a-fieldset">
        <legend>Cliente</legend>
        <label className="p-label" htmlFor={`${id}-paciente`}>Paciente registrada</label>
        <select id={`${id}-paciente`} className="p-field" value={idPaciente} onChange={(e) => elegirPaciente(e.target.value)}>
          <option value="">Cliente sin registro (escribe sus datos)</option>
          {pacientes.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.phone}</option>)}
        </select>
        <div className="a-grid">
          <div>
            <label className="p-label" htmlFor={`${id}-nombre`}>Nombre completo *</label>
            <input id={`${id}-nombre`} className="p-field" value={cliente.nombre} onChange={cambiarCliente('nombre')} maxLength={120} autoComplete="off" />
          </div>
          <div>
            <label className="p-label" htmlFor={`${id}-ident`}>Cédula o identificación</label>
            <input id={`${id}-ident`} className="p-field" value={cliente.identificacion} onChange={cambiarCliente('identificacion')} maxLength={30} placeholder="1-2345-6789" />
          </div>
          <div>
            <label className="p-label" htmlFor={`${id}-tel`}>Teléfono</label>
            <input id={`${id}-tel`} className="p-field" type="tel" value={cliente.telefono} onChange={cambiarCliente('telefono')} maxLength={20} />
          </div>
          <div>
            <label className="p-label" htmlFor={`${id}-email`}>Correo</label>
            <input id={`${id}-email`} className="p-field" type="email" value={cliente.email} onChange={cambiarCliente('email')} maxLength={120} />
          </div>
        </div>
      </fieldset>

      <fieldset className="a-fieldset">
        <legend>Servicios</legend>
        <datalist id={`${id}-servicios`}>{SERVICIOS.map((s) => <option key={s} value={s} />)}</datalist>
        {items.map((it, i) => (
          <div key={i} className="f-item" role="group" aria-label={`Servicio ${i + 1}`}>
            <div className="f-item__desc">
              <label className="p-label" htmlFor={`${id}-desc-${i}`}>Descripción</label>
              <input id={`${id}-desc-${i}`} className="p-field" list={`${id}-servicios`} value={it.descripcion} maxLength={160}
                onChange={(e) => cambiarItem(i, 'descripcion', e.target.value)} />
            </div>
            <div>
              <label className="p-label" htmlFor={`${id}-cant-${i}`}>Cant.</label>
              <input id={`${id}-cant-${i}`} className="p-field" type="number" min="1" max="99" step="1" inputMode="numeric"
                value={it.cantidad} onChange={(e) => cambiarItem(i, 'cantidad', e.target.value)} />
            </div>
            <div>
              <label className="p-label" htmlFor={`${id}-precio-${i}`}>Precio (₡)</label>
              <input id={`${id}-precio-${i}`} className="p-field" type="number" min="0" step="any" inputMode="decimal"
                value={it.precio} onChange={(e) => cambiarItem(i, 'precio', e.target.value)} />
            </div>
            <button type="button" className="f-item__quitar" disabled={items.length === 1}
              onClick={() => setItems((lista) => lista.filter((_, j) => j !== i))} aria-label={`Quitar el servicio ${i + 1}`}>
              <Trash2 size={17} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button type="button" className="p-btn p-btn--quiet a-add" disabled={items.length >= 20}
          onClick={() => setItems((lista) => [...lista, itemVacio()])}>
          <Plus size={16} aria-hidden="true" /> Agregar servicio
        </button>
        <div className="a-grid">
          <div>
            <label className="p-label" htmlFor={`${id}-desc`}>Descuento (₡)</label>
            <input id={`${id}-desc`} className="p-field" type="number" min="0" step="any" inputMode="decimal" value={descuento}
              onChange={(e) => setDescuento(e.target.value)} />
          </div>
          <div>
            <label className="p-label" htmlFor={`${id}-iva`}>IVA</label>
            <select id={`${id}-iva`} className="p-field" value={impuesto} onChange={(e) => setImpuesto(Number(e.target.value))}>
              {TARIFAS_IVA.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="p-label" htmlFor={`${id}-fecha`}>Fecha</label>
            <input id={`${id}-fecha`} className="p-field" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>
      </fieldset>

      <fieldset className="a-fieldset">
        <legend>Pago</legend>
        <p className="p-label" id={`${id}-metodo`}>Método de pago</p>
        <div className="p-seg f-seg" role="group" aria-labelledby={`${id}-metodo`}>
          {Object.entries(METODOS_PAGO).map(([valor, m]) => (
            <button key={valor} type="button" aria-pressed={metodoPago === valor} onClick={() => setMetodoPago(valor)}>{m.label}</button>
          ))}
        </div>
        <p className="p-label" id={`${id}-estado`}>Estado</p>
        <div className="p-seg f-seg" role="group" aria-labelledby={`${id}-estado`}>
          <button type="button" aria-pressed={estado === 'pagada'} onClick={() => setEstado('pagada')}>Pagada</button>
          <button type="button" aria-pressed={estado === 'pendiente'} onClick={() => setEstado('pendiente')}>Pendiente de pago</button>
        </div>
        {etiquetaReferencia && (
          <div>
            <label className="p-label" htmlFor={`${id}-ref`}>{etiquetaReferencia}{referenciaObligatoria ? ' *' : ''}</label>
            <input id={`${id}-ref`} className="p-field" value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={60} inputMode="numeric" />
          </div>
        )}
        <div>
          <label className="p-label" htmlFor={`${id}-notas`}>Notas para el cliente (opcional)</label>
          <textarea id={`${id}-notas`} className="p-field" value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={400} rows={2} />
        </div>
      </fieldset>

      <dl className="f-totales" aria-live="polite">
        <div><dt>Subtotal</dt><dd>{colones(totales.subtotal)}</dd></div>
        {totales.descuento > 0 && <div><dt>Descuento</dt><dd>− {colones(totales.descuento)}</dd></div>}
        {totales.impuesto > 0 && <div><dt>IVA ({totales.impuesto} %)</dt><dd>{colones(totales.impuestoMonto)}</dd></div>}
        <div className="f-totales__total"><dt>Total</dt><dd>{colones(totales.total)}</dd></div>
      </dl>

      {error && <p className="p-error" role="alert">{error}</p>}
      <div className="a-item__actions">
        <button type="submit" className="p-btn" disabled={guardando}>{guardando ? 'Guardando…' : 'Emitir factura'}</button>
        <button type="button" className="p-btn p-btn--quiet" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}
