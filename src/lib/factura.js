// Facturas: datos y cálculos compartidos por el panel, el portal y el PDF.
// El servidor (api/nucleo.mjs, totalesFactura) recalcula siempre los totales; este cálculo es la vista previa
// del formulario y debe dar exactamente lo mismo (lo comprueba testings/unitarias/factura.test.js).

export const METODOS_PAGO = {
  sinpe: { label: 'SINPE Móvil', referencia: 'Número de comprobante SINPE' },
  efectivo: { label: 'Efectivo', referencia: null },
  tarjeta: { label: 'Tarjeta', referencia: 'Número de autorización (opcional)' },
  transferencia: { label: 'Transferencia', referencia: 'Número de transferencia (opcional)' },
};

export const ESTADOS_FACTURA = {
  pagada: { label: 'Pagada', chip: 'p-chip' },
  pendiente: { label: 'Pendiente', chip: 'p-chip p-chip--rose' },
  anulada: { label: 'Anulada', chip: 'p-chip p-chip--muted' },
};

// Tarifas de IVA de Costa Rica (%). Confirmar con el contador cuál aplica a cada servicio.
export const TARIFAS_IVA = [
  { valor: 0, label: 'Sin IVA' },
  { valor: 1, label: 'IVA 1 %' },
  { valor: 2, label: 'IVA 2 %' },
  { valor: 4, label: 'IVA 4 %' },
  { valor: 13, label: 'IVA 13 %' },
];

const redondear = (n) => Math.round(n * 100) / 100;

export function calcularTotales(items = [], descuento = 0, impuesto = 0) {
  const validos = items.map((i) => ({ cantidad: Number(i.cantidad) || 0, precio: Number(i.precio) || 0 }));
  const subtotal = redondear(validos.reduce((s, i) => s + i.cantidad * i.precio, 0));
  const desc = redondear(Math.min(Math.max(Number(descuento) || 0, 0), subtotal));
  const tasa = TARIFAS_IVA.some((t) => t.valor === Number(impuesto)) ? Number(impuesto) : 0;
  const impuestoMonto = redondear(((subtotal - desc) * tasa) / 100);
  return { subtotal, descuento: desc, impuesto: tasa, impuestoMonto, total: redondear(subtotal - desc + impuestoMonto) };
}

// ₡45 000,00 → en pantalla; el PDF usa su propio formato (sus fuentes no tienen el signo ₡)
const NUMERO = new Intl.NumberFormat('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const colones = (monto) => `₡${NUMERO.format(Number(monto) || 0)}`;
export const numeroMonto = (monto) => NUMERO.format(Number(monto) || 0);

// "2026-10-01" → "1 de octubre de 2026"
export const fechaFactura = (iso) =>
  new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${String(iso).slice(0, 10)}T12:00:00Z`));

// Hoy en Costa Rica (UTC-6), en el formato de <input type="date">
export const hoyCR = () => new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const nombreArchivo = (factura) =>
  `Factura ${factura.numero} - ${String(factura.cliente?.nombre || 'cliente').replace(/[\\/:*?"<>|]/g, '')}.pdf`;
