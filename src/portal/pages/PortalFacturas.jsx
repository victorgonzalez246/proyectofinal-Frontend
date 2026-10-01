import { useCallback, useEffect, useState } from 'react';
import { Receipt, CircleCheck, Clock, FileDown } from 'lucide-react';
import { portalService } from '../../services/portalService.js';
import { ESTADOS_FACTURA, METODOS_PAGO, colones, fechaFactura } from '../../lib/factura.js';

// Facturas de la paciente: las mismas que emite la doctora, descargables en PDF
export default function PortalFacturas() {
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [descargando, setDescargando] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setFacturas(await portalService.getFacturas());
    } catch {
      setError('No pudimos cargar tus facturas. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }, []);

  // Carga inicial: el estado se actualiza cuando llega la respuesta
  useEffect(() => {
    let activo = true;
    portalService.getFacturas()
      .then((lista) => { if (activo) { setFacturas(lista); setCargando(false); } })
      .catch(() => { if (activo) { setError('No pudimos cargar tus facturas. Revisa tu conexión e intenta de nuevo.'); setCargando(false); } });
    return () => { activo = false; };
  }, []);

  const descargar = async (factura) => {
    setDescargando(factura.id);
    try {
      const { descargarFacturaPdf } = await import('../../lib/facturaPdf.js');
      await descargarFacturaPdf(factura);
    } catch {
      setError('No pudimos generar el PDF. Intenta de nuevo.');
    } finally {
      setDescargando('');
    }
  };

  if (cargando) return <p className="p-small" role="status">Cargando tus facturas…</p>;

  const pagado = facturas.filter((f) => f.estado === 'pagada').reduce((s, f) => s + (Number(f.total) || 0), 0);
  const pendiente = facturas.filter((f) => f.estado === 'pendiente').reduce((s, f) => s + (Number(f.total) || 0), 0);

  return (
    <>
      <header className="p-page-head">
        <h1 className="p-display">Mis facturas</h1>
        <p className="p-lead">Tus pagos en la clínica. Descarga cada factura en PDF cuando la necesites.</p>
      </header>

      {error && (
        <div className="p-empty" role="alert">
          <p>{error}</p>
          <button type="button" className="p-btn p-btn--quiet" style={{ marginTop: '1rem' }} onClick={cargar}>Reintentar</button>
        </div>
      )}

      <div className="pp-resumen">
        <div className="p-panel pp-kpi">
          <CircleCheck size={22} className="pp-kpi__icon pp-kpi__icon--ok" aria-hidden="true" />
          <div>
            <p className="p-small">Total pagado</p>
            <p className="pp-kpi__valor">{colones(pagado)}</p>
          </div>
        </div>
        <div className="p-panel pp-kpi">
          <Clock size={22} className="pp-kpi__icon pp-kpi__icon--warn" aria-hidden="true" />
          <div>
            <p className="p-small">Pendiente de pago</p>
            <p className="pp-kpi__valor" data-warn={pendiente > 0 || undefined}>{colones(pendiente)}</p>
          </div>
        </div>
      </div>

      {facturas.length === 0 ? (
        <div className="p-empty">
          <Receipt size={40} strokeWidth={1.2} aria-hidden="true" />
          <p className="p-subtitle" style={{ marginTop: '0.75rem' }}>Todavía no tienes facturas.</p>
        </div>
      ) : (
        <section className="pp-lista" aria-label="Tus facturas">
          {facturas.map((f) => (
            <article key={f.id} className="p-panel pp-pago" aria-labelledby={`factura-${f.id}`}>
              <div className="pp-pago__head">
                <div>
                  <p className="p-subtitle" id={`factura-${f.id}`}>{f.numero}</p>
                  <p className="p-small">{fechaFactura(f.fecha)} · {METODOS_PAGO[f.metodoPago]?.label}</p>
                </div>
                <span className={ESTADOS_FACTURA[f.estado]?.chip}>{ESTADOS_FACTURA[f.estado]?.label}</span>
              </div>
              <div className="pp-pago__foot">
                <p className="pp-pago__monto">{colones(f.total)}</p>
                <button type="button" className="p-btn p-btn--quiet pp-pago__recibo" onClick={() => descargar(f)}
                  disabled={descargando === f.id} aria-label={`Descargar la factura ${f.numero} en PDF`}>
                  <FileDown size={15} aria-hidden="true" /> {descargando === f.id ? 'Generando…' : 'PDF'}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
