// PDF de la factura (tamaño carta), generado en el navegador con pdf-lib: sin servidores externos.
// pdf-lib se descarga solo cuando alguien pulsa "Descargar PDF".
// Las fuentes estándar del PDF no traen el signo ₡: en el documento los montos van con "¢",
// el símbolo que se usa habitualmente en Costa Rica cuando no está disponible ₡.
import { METODOS_PAGO, ESTADOS_FACTURA, fechaFactura, numeroMonto, nombreArchivo } from './factura.js';

const ANCHO = 612;
const ALTO = 792;
const MARGEN = 48;

// Paleta del manual de marca
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const COLOR = {
  oliva: hex('#5C6651'),
  rosa: hex('#DBB299'),
  oro: hex('#B38E5D'),
  tinta: hex('#1C1B1A'),
  gris: hex('#736F6E'),
  claro: hex('#F5F3EF'),
  linea: hex('#E2DED7'),
  alerta: hex('#9B3D4A'),
  blanco: [1, 1, 1],
};
const COLOR_ESTADO = { pagada: COLOR.oliva, pendiente: COLOR.oro, anulada: COLOR.alerta };

const monto = (n) => `¢${numeroMonto(n)}`;

/**
 * Crea el PDF de una factura.
 * @param {object} factura  la factura tal como la devuelve la API (/admin/facturas o /me/facturas)
 * @param {{ clinica: object, logo?: Uint8Array|ArrayBuffer|null, generado?: Date }} opciones
 * @returns {Promise<Uint8Array>}
 */
export async function crearFacturaPdf(factura, { clinica, logo = null, generado = new Date() }) {
  const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.setTitle(`Factura ${factura.numero}`);
  doc.setAuthor(`Clínica ${clinica.nombre}`);
  doc.setSubject(`Factura ${factura.numero} · ${factura.cliente?.nombre || ''}`);
  doc.setCreator('Clínica Dra. Laura Jiménez');

  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const imagenLogo = logo ? await doc.embedPng(logo) : null;
  const c = (arr) => rgb(...arr);

  // Las fuentes estándar solo codifican WinAnsi: cualquier otro carácter se sustituye para no romper el PDF
  const cache = new Map();
  const seguro = (texto) => [...String(texto ?? '')].map((ch) => {
    if (!cache.has(ch)) {
      try { normal.encodeText(ch); cache.set(ch, ch); } catch { cache.set(ch, ch === '₡' ? '¢' : '?'); }
    }
    return cache.get(ch);
  }).join('').replace(/\s+/g, ' ');

  let pagina;
  const texto = (t, x, y, { size = 10, font = normal, color = COLOR.tinta, alinear = 'izq' } = {}) => {
    const s = seguro(t);
    const ancho = font.widthOfTextAtSize(s, size);
    const xReal = alinear === 'der' ? x - ancho : alinear === 'centro' ? x - ancho / 2 : x;
    pagina.drawText(s, { x: xReal, y, size, font, color: c(color) });
    return ancho;
  };
  // Parte un texto en líneas que caben en `ancho`
  const lineas = (t, ancho, size, font = normal) => {
    const palabras = seguro(t).split(' ');
    const out = [];
    let actual = '';
    for (const p of palabras) {
      const prueba = actual ? `${actual} ${p}` : p;
      if (font.widthOfTextAtSize(prueba, size) <= ancho || !actual) actual = prueba;
      else { out.push(actual); actual = p; }
    }
    if (actual) out.push(actual);
    return out.length ? out : [''];
  };
  const rect = (x, y, w, h, color, opciones = {}) => pagina.drawRectangle({ x, y, width: w, height: h, color: c(color), ...opciones });
  const linea = (x1, y1, x2, y2, color = COLOR.linea, grosor = 0.8) =>
    pagina.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: grosor, color: c(color) });

  const nuevaPagina = () => {
    pagina = doc.addPage([ANCHO, ALTO]);
    rect(0, ALTO - 6, ANCHO, 6, COLOR.oliva);
    if (factura.estado === 'anulada') {
      pagina.drawText('ANULADA', {
        x: 150, y: 260, size: 96, font: negrita, color: c(COLOR.alerta), opacity: 0.12, rotate: degrees(35),
      });
    }
  };

  // ── Encabezado ──
  nuevaPagina();
  let y = ALTO - MARGEN - 8;
  if (imagenLogo) {
    const alto = 52;
    const ancho = (imagenLogo.width / imagenLogo.height) * alto;
    pagina.drawImage(imagenLogo, { x: MARGEN, y: y - alto + 8, width: ancho, height: alto });
  } else {
    texto(clinica.nombre, MARGEN, y - 22, { size: 18, font: negrita, color: COLOR.oliva });
  }
  texto('FACTURA', ANCHO - MARGEN, y - 10, { size: 26, font: negrita, alinear: 'der' });
  texto(`N.º ${factura.numero}`, ANCHO - MARGEN, y - 30, { size: 13, font: negrita, color: COLOR.oliva, alinear: 'der' });
  texto(`Fecha: ${fechaFactura(factura.fecha)}`, ANCHO - MARGEN, y - 46, { size: 9.5, color: COLOR.gris, alinear: 'der' });

  // Etiqueta de estado
  const estado = (ESTADOS_FACTURA[factura.estado]?.label || factura.estado).toUpperCase();
  const anchoEstado = negrita.widthOfTextAtSize(estado, 9) + 20;
  rect(ANCHO - MARGEN - anchoEstado, y - 70, anchoEstado, 17, COLOR_ESTADO[factura.estado] || COLOR.gris);
  texto(estado, ANCHO - MARGEN - anchoEstado / 2, y - 64.5, { size: 9, font: negrita, color: COLOR.blanco, alinear: 'centro' });

  // Datos de la clínica
  y -= 66;
  texto(`Clínica ${clinica.nombre}`, MARGEN, y, { size: 11, font: negrita });
  texto('Medicina Estética & Armonización Facial', MARGEN, y - 14, { size: 9, color: COLOR.gris });
  const contacto = [clinica.direccion, [clinica.telefonoVisible, clinica.email].filter(Boolean).join('  ·  ')];
  if (clinica.identificacion) contacto.push(`Identificación: ${clinica.identificacion}`);
  contacto.forEach((l, i) => texto(l, MARGEN, y - 28 - i * 12, { size: 9, color: COLOR.gris }));
  y -= 28 + contacto.length * 12 + 14;
  linea(MARGEN, y, ANCHO - MARGEN, y, COLOR.rosa, 1.2);

  // ── Cliente y pago ──
  y -= 24;
  const col2 = ANCHO / 2 + 10;
  texto('FACTURAR A', MARGEN, y, { size: 8, font: negrita, color: COLOR.oro });
  texto('PAGO', col2, y, { size: 8, font: negrita, color: COLOR.oro });
  const cliente = factura.cliente || {};
  const datosCliente = [
    [cliente.nombre, { size: 11, font: negrita }],
    cliente.identificacion && [`Identificación: ${cliente.identificacion}`],
    cliente.telefono && [`Tel.: ${cliente.telefono}`],
    cliente.email && [cliente.email],
  ].filter(Boolean);
  const metodo = METODOS_PAGO[factura.metodoPago]?.label || factura.metodoPago;
  const datosPago = [
    [metodo, { size: 11, font: negrita }],
    factura.referencia && [`${factura.metodoPago === 'sinpe' ? 'Comprobante SINPE' : 'Referencia'}: ${factura.referencia}`],
    factura.estado === 'pagada' && factura.pagadaEn && [`Pagada el ${fechaFactura(factura.pagadaEn)}`],
    factura.estado === 'pendiente' && ['Pendiente de pago'],
    factura.estado === 'anulada' && [`Anulada${factura.anuladaEn ? ` el ${fechaFactura(factura.anuladaEn)}` : ''}`],
  ].filter(Boolean);
  const fila = (lista, x) => lista.forEach(([t, o = {}], i) => texto(t, x, y - 16 - i * 14, { size: 9.5, color: COLOR.tinta, ...o }));
  fila(datosCliente, MARGEN);
  fila(datosPago, col2);
  y -= 16 + Math.max(datosCliente.length, datosPago.length) * 14 + 18;

  // ── Tabla de servicios ──
  const COLS = { desc: MARGEN + 10, cant: 372, precio: 470, total: ANCHO - MARGEN - 10 };
  const anchoDesc = COLS.cant - 40 - COLS.desc;
  const encabezadoTabla = () => {
    rect(MARGEN, y - 8, ANCHO - 2 * MARGEN, 24, COLOR.oliva);
    texto('Descripción', COLS.desc, y, { size: 9, font: negrita, color: COLOR.blanco });
    texto('Cant.', COLS.cant, y, { size: 9, font: negrita, color: COLOR.blanco, alinear: 'der' });
    texto('Precio unitario', COLS.precio, y, { size: 9, font: negrita, color: COLOR.blanco, alinear: 'der' });
    texto('Total', COLS.total, y, { size: 9, font: negrita, color: COLOR.blanco, alinear: 'der' });
    y -= 26;
  };
  encabezadoTabla();
  (factura.items || []).forEach((item, i) => {
    const ls = lineas(item.descripcion, anchoDesc, 9.5);
    const alto = 10 + ls.length * 12;
    if (y - alto < 210) { // no cabe con los totales: sigue en otra página
      nuevaPagina();
      y = ALTO - MARGEN - 20;
      texto(`Factura ${factura.numero} (continuación)`, MARGEN, y, { size: 10, font: negrita, color: COLOR.oliva });
      y -= 30;
      encabezadoTabla();
    }
    if (i % 2 === 1) rect(MARGEN, y - alto + 12, ANCHO - 2 * MARGEN, alto, COLOR.claro);
    ls.forEach((l, j) => texto(l, COLS.desc, y - j * 12, { size: 9.5 }));
    texto(String(item.cantidad), COLS.cant, y, { size: 9.5, alinear: 'der' });
    texto(monto(item.precio), COLS.precio, y, { size: 9.5, alinear: 'der' });
    texto(monto(item.cantidad * item.precio), COLS.total, y, { size: 9.5, alinear: 'der' });
    y -= alto;
  });
  linea(MARGEN, y + 6, ANCHO - MARGEN, y + 6);

  // ── Totales ──
  y -= 14;
  const xEtiqueta = 400;
  const filaTotal = (etiqueta, valor) => {
    texto(etiqueta, xEtiqueta, y, { size: 9.5, color: COLOR.gris });
    texto(valor, COLS.total, y, { size: 9.5, alinear: 'der' });
    y -= 16;
  };
  filaTotal('Subtotal', monto(factura.subtotal));
  if (Number(factura.descuento) > 0) filaTotal('Descuento', `- ${monto(factura.descuento)}`);
  if (Number(factura.impuesto) > 0) filaTotal(`IVA (${factura.impuesto} %)`, monto(factura.impuestoMonto));

  y -= 8; // Espacio extra para que el recuadro verde no tape el texto de arriba
  rect(xEtiqueta - 12, y - 10, COLS.total + 10 - (xEtiqueta - 12), 28, COLOR.oliva);
  texto('TOTAL', xEtiqueta, y, { size: 11, font: negrita, color: COLOR.blanco });
  texto(monto(factura.total), COLS.total, y, { size: 13, font: negrita, color: COLOR.blanco, alinear: 'der' });

  // Notas (a la izquierda de los totales)
  if (factura.notas) {
    const yNotas = y + 16 * (1 + (Number(factura.descuento) > 0) + (Number(factura.impuesto) > 0));
    texto('NOTAS', MARGEN, yNotas, { size: 8, font: negrita, color: COLOR.oro });
    lineas(factura.notas, xEtiqueta - MARGEN - 30, 9).slice(0, 6)
      .forEach((l, i) => texto(l, MARGEN, yNotas - 14 - i * 12, { size: 9, color: COLOR.gris }));
  }

  // ── Pie de página (todas las páginas) ──
  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    pagina = p;
    linea(MARGEN, 86, ANCHO - MARGEN, 86, COLOR.rosa, 1);
    texto(`Gracias por confiar en la Dra. ${clinica.nombre.replace(/^Dra\.\s*/, '')}.`, ANCHO / 2, 68, { size: 10, font: negrita, color: COLOR.oliva, alinear: 'centro' });
    texto('Comprobante de pago emitido por la clínica. No sustituye al comprobante electrónico del Ministerio de Hacienda.',
      ANCHO / 2, 52, { size: 7.5, color: COLOR.gris, alinear: 'centro' });
    const fechaGen = new Intl.DateTimeFormat('es-CR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Costa_Rica' }).format(generado);
    texto(`Generado el ${fechaGen}`, MARGEN, 34, { size: 7.5, color: COLOR.gris });
    texto(`Página ${i + 1} de ${paginas.length}`, ANCHO - MARGEN, 34, { size: 7.5, color: COLOR.gris, alinear: 'der' });
  });

  return doc.save();
}

// En el navegador: arma el PDF con el logo de la marca y lo descarga
export async function descargarFacturaPdf(factura) {
  const [{ CLINICA }, { default: logoUrl }] = await Promise.all([
    import('../config/clinica.js'),
    import('../assets/brand/logo-main.png'),
  ]);
  let logo = null;
  try {
    logo = await (await fetch(logoUrl)).arrayBuffer();
  } catch {
    // Sin logo, el encabezado lleva el nombre de la clínica
  }
  const bytes = await crearFacturaPdf(factura, { clinica: CLINICA, logo });
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo(factura);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
