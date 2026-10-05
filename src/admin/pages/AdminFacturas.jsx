import { useId, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { FileDown, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { adminService } from '../../services/adminService.js';
import { useCarga } from '../useCarga.js';
import Estado from '../components/Estado.jsx';
import FormFactura from '../components/FormFactura.jsx';
import Sheet from '../../portal/components/Sheet.jsx';
import { Cifra } from '../../components/analitica/Grafico.jsx';
import { ESTADOS_FACTURA, METODOS_PAGO, colones, fechaFactura, hoyCR } from '../../lib/factura.js';

const FILTROS = [
  { id: '', label: 'Todas' },
  { id: 'pagada', label: 'Pagadas' },
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'anulada', label: 'Anuladas' },
];

// Descarga el PDF (pdf-lib se carga solo en ese momento)
const descargar = async (factura) => {
  try {
    const { descargarFacturaPdf } = await import('../../lib/facturaPdf.js');
    await descargarFacturaPdf(factura);
  } catch {
    toast.error('No pudimos generar el PDF. Intenta de nuevo.');
  }
};

// Registrar el pago de una factura pendiente (método y comprobante)
function CobrarFactura({ factura, onListo, onCerrar }) {
  const id = useId();
  const [metodoPago, setMetodoPago] = useState(factura.metodoPago);
  const [referencia, setReferencia] = useState(factura.referencia || '');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const etiqueta = METODOS_PAGO[metodoPago].referencia;

  const guardar = async (e) => {
    e.preventDefault();
    if (metodoPago === 'sinpe' && !referencia.trim()) { setError('Indica el número de comprobante del SINPE Móvil.'); return; }
    setGuardando(true);
    try {
      onListo(await adminService.actualizarFactura(factura.id, { estado: 'pagada', metodoPago, referencia: referencia.trim() }));
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  };

  return (
    <Sheet labelledBy={`${id}-t`} onClose={onCerrar}>
      <form className="a-form" onSubmit={guardar} noValidate>
        <h2 className="p-title" id={`${id}-t`}>Registrar pago · {factura.numero}</h2>
        <p className="p-small">{factura.cliente?.nombre} · {colones(factura.total)}</p>
        <p className="p-label" id={`${id}-m`}>Método de pago</p>
        <div className="p-seg f-seg" role="group" aria-labelledby={`${id}-m`}>
          {Object.entries(METODOS_PAGO).map(([valor, m]) => (
            <button key={valor} type="button" aria-pressed={metodoPago === valor} onClick={() => setMetodoPago(valor)}>{m.label}</button>
          ))}
        </div>
        {etiqueta && (
          <div>
            <label className="p-label" htmlFor={`${id}-r`}>{etiqueta}{metodoPago === 'sinpe' ? ' *' : ''}</label>
            <input id={`${id}-r`} className="p-field" value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={60} />
          </div>
        )}
        {error && <p className="p-error" role="alert">{error}</p>}
        <div className="a-item__actions">
          <button type="submit" className="p-btn" disabled={guardando}>{guardando ? 'Guardando…' : 'Marcar como pagada'}</button>
          <button type="button" className="p-btn p-btn--quiet" onClick={onCerrar}>Cancelar</button>
        </div>
      </form>
    </Sheet>
  );
}

// Anular (la factura no se borra: conserva su número y queda marcada en el PDF)
function AnularFactura({ factura, onListo, onCerrar }) {
  const id = useId();
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const anular = async (e) => {
    e.preventDefault();
    if (motivo.trim().length < 3) { setError('Escribe el motivo de la anulación.'); return; }
    setGuardando(true);
    try {
      onListo(await adminService.actualizarFactura(factura.id, { estado: 'anulada', motivo: motivo.trim() }));
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  };

  return (
    <Sheet labelledBy={`${id}-t`} onClose={onCerrar}>
      <form className="a-form" onSubmit={anular} noValidate>
        <h2 className="p-title" id={`${id}-t`}>Anular {factura.numero}</h2>
        <p className="p-lead">La factura no se borra: conserva su número y su PDF queda marcado como anulado. Esta acción no se puede deshacer.</p>
        <label className="p-label" htmlFor={`${id}-mot`}>Motivo *</label>
        <input id={`${id}-mot`} className="p-field" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200}
          placeholder="Por ejemplo: monto incorrecto" />
        {error && <p className="p-error" role="alert">{error}</p>}
        <div className="a-item__actions">
          <button type="submit" className="p-btn p-btn--alert" disabled={guardando}>{guardando ? 'Anulando…' : 'Anular factura'}</button>
          <button type="button" className="p-btn p-btn--quiet" onClick={onCerrar}>Cancelar</button>
        </div>
      </form>
    </Sheet>
  );
}

export default function AdminFacturas() {
  const { data, loading, error, reload } = useCarga(adminService.getFacturas);
  const [params, setParams] = useSearchParams();
  const pacienteInicial = params.get('paciente') || '';
  const [nueva, setNueva] = useState(Boolean(pacienteInicial));
  const [cobrar, setCobrar] = useState(null);
  const [anular, setAnular] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const facturas = useMemo(() => data || [], [data]);
  const mes = hoyCR().slice(0, 7);
  const delMes = facturas.filter((f) => f.fecha?.slice(0, 7) === mes && f.estado !== 'anulada');
  const suma = (lista) => lista.reduce((s, f) => s + (Number(f.total) || 0), 0);
  const cobrado = suma(delMes.filter((f) => f.estado === 'pagada'));
  const pendiente = suma(facturas.filter((f) => f.estado === 'pendiente'));

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return facturas.filter((f) => (!filtro || f.estado === filtro)
      && (!q || f.numero.toLowerCase().includes(q) || String(f.cliente?.nombre || '').toLowerCase().includes(q)));
  }, [facturas, filtro, busqueda]);

  const cerrarNueva = () => {
    setNueva(false);
    if (pacienteInicial) setParams({}, { replace: true });
  };
  const creada = (factura) => {
    cerrarNueva();
    reload();
    toast.success(`Factura ${factura.numero} emitida por ${colones(factura.total)}.`, {
      action: { label: 'Descargar PDF', onClick: () => descargar(factura) },
      duration: 10000,
    });
  };
  const actualizada = (mensaje) => (factura) => {
    setCobrar(null);
    setAnular(null);
    reload();
    toast.success(`${factura.numero}: ${mensaje}.`);
  };

  return (
    <>
      <header className="p-page-head">
        <h1 className="p-display">Facturas</h1>
        <p className="p-lead">Registra cada cobro (SINPE Móvil, efectivo, tarjeta o transferencia) y entrega la factura en PDF.</p>
      </header>

      <div className="a-toolbar">
        <div className="p-seg" role="group" aria-label="Filtrar por estado">
          {FILTROS.map((f) => (
            <button key={f.id || 'todas'} type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.label}</button>
          ))}
        </div>
        <button type="button" className="p-btn" onClick={() => setNueva(true)}>
          <Plus size={17} aria-hidden="true" /> Nueva factura
        </button>
      </div>

      <Estado loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="an-cifras">
              <Cifra etiqueta="Cobrado este mes" valor={colones(cobrado)} detalle={`${delMes.filter((f) => f.estado === 'pagada').length} facturas pagadas`} tono="bien" />
              <Cifra etiqueta="Pendiente por cobrar" valor={colones(pendiente)} detalle={`${facturas.filter((f) => f.estado === 'pendiente').length} facturas pendientes`}
                tono={pendiente > 0 ? 'alerta' : undefined} />
              <Cifra etiqueta="Facturas emitidas" valor={delMes.length} detalle="En el mes (sin anuladas)" />
            </div>

            <div className="f-buscar">
              <Search size={17} aria-hidden="true" />
              <label className="an-sr" htmlFor="buscar-factura">Buscar factura</label>
              <input id="buscar-factura" className="p-field" type="search" placeholder="Buscar por cliente o número (FAC-0001)"
                value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>

            {visibles.length === 0 ? (
              <p className="p-empty">{facturas.length === 0 ? 'Todavía no hay facturas. Crea la primera con "Nueva factura".' : 'No hay facturas con ese filtro.'}</p>
            ) : (
              <div className="a-list">
                {visibles.map((f) => (
                  <article key={f.id} className="p-panel a-item" aria-labelledby={`fac-${f.id}`}>
                    <div className="a-item__head">
                      <div>
                        <p className="p-subtitle" id={`fac-${f.id}`}>{f.numero} · {f.cliente?.nombre}</p>
                        <p className="p-small">
                          {fechaFactura(f.fecha)} · {METODOS_PAGO[f.metodoPago]?.label}
                          {f.referencia ? ` · comprobante ${f.referencia}` : ''}
                        </p>
                      </div>
                      <div className="f-monto">
                        <strong>{colones(f.total)}</strong>
                        <span className={ESTADOS_FACTURA[f.estado]?.chip}>{ESTADOS_FACTURA[f.estado]?.label}</span>
                      </div>
                    </div>
                    <p className="p-small">{(f.items || []).map((i) => (i.cantidad > 1 ? `${i.cantidad} × ${i.descripcion}` : i.descripcion)).join(' · ')}</p>
                    {f.estado === 'anulada' && f.motivoAnulacion && <p className="a-quote">Anulada: {f.motivoAnulacion}</p>}
                    <div className="a-item__actions">
                      <button type="button" className="p-btn p-btn--quiet" onClick={() => descargar(f)}>
                        <FileDown size={16} aria-hidden="true" /> Descargar PDF
                      </button>
                      {f.estado === 'pendiente' && (
                        <button type="button" className="p-btn" onClick={() => setCobrar(f)}>Registrar pago</button>
                      )}
                      {f.estado !== 'anulada' && (
                        <button type="button" className="p-btn p-btn--quiet f-anular" onClick={() => setAnular(f)}>Anular</button>
                      )}
                      {f.idPaciente && <Link to={`/admin/pacientes/${f.idPaciente}`} className="p-link">Ver ficha</Link>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </Estado>

      <AnimatePresence>
        {nueva && (
          <Sheet labelledBy="nueva-factura-titulo" onClose={cerrarNueva}>
            <FormFactura pacienteInicial={pacienteInicial} onCreada={creada} onCancelar={cerrarNueva} />
          </Sheet>
        )}
        {cobrar && <CobrarFactura factura={cobrar} onListo={actualizada('pago registrado')} onCerrar={() => setCobrar(null)} />}
        {anular && <AnularFactura factura={anular} onListo={actualizada('anulada')} onCerrar={() => setAnular(null)} />}
      </AnimatePresence>
    </>
  );
}
