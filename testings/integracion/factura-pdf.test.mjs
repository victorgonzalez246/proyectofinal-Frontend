// Integración: genera PDF reales de facturas (pdf-lib en Node) y los vuelve a abrir para comprobarlos
import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { crearFacturaPdf } from '../../src/lib/facturaPdf.js';
import { CLINICA } from '../../src/config/clinica.js';

const FACTURA = {
  numero: 'FAC-0007',
  fecha: '2026-10-01',
  estado: 'pagada',
  pagadaEn: '2026-10-01T18:00:00Z',
  metodoPago: 'sinpe',
  referencia: '202610010012345',
  cliente: { nombre: 'María José Solano Ruiz', identificacion: '1-1234-0567', telefono: '+506 8888 0021', email: 'mj@example.com' },
  items: [
    { descripcion: 'Perfilado labial con ácido hialurónico — técnica de alta definición', cantidad: 1, precio: 185000 },
    { descripcion: 'Skinbooster de hidratación profunda', cantidad: 2, precio: 65000 },
  ],
  subtotal: 315000, descuento: 15000, impuesto: 13, impuestoMonto: 39000, total: 339000,
  notas: '¡Gracias! Próximo control el 15 de octubre.',
};
const logo = fs.readFileSync('src/assets/brand/logo-main.png');
const abrir = async (bytes) => PDFDocument.load(bytes);

describe('PDF de la factura', () => {
  it('genera un PDF válido de una página, con logo, título y metadatos', async () => {
    const bytes = await crearFacturaPdf(FACTURA, { clinica: CLINICA, logo });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
    const pdf = await abrir(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe('Factura FAC-0007');
    const [pagina] = pdf.getPages();
    expect(Math.round(pagina.getWidth())).toBe(612); // tamaño carta
    expect(Math.round(pagina.getHeight())).toBe(792);
  });

  it('las facturas largas siguen en otra página', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      descripcion: `Servicio ${i + 1} con una descripción larga para que ocupe más de una línea en la tabla de la factura`,
      cantidad: 1, precio: 10000,
    }));
    const pdf = await abrir(await crearFacturaPdf({ ...FACTURA, items }, { clinica: CLINICA }));
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it('acepta acentos, ñ, ¿¡ y reemplaza caracteres que la fuente no tiene (sin romperse)', async () => {
    const raro = { ...FACTURA, cliente: { nombre: 'Íñigo Peña 😊 →' }, notas: 'Ñandú ¿listo? ¡Sí! ✨' };
    const pdf = await abrir(await crearFacturaPdf(raro, { clinica: CLINICA }));
    expect(pdf.getPageCount()).toBe(1);
  });

  it('genera también facturas anuladas y pendientes sin logo', async () => {
    for (const estado of ['anulada', 'pendiente']) {
      const pdf = await abrir(await crearFacturaPdf({ ...FACTURA, estado, anuladaEn: '2026-10-02T15:00:00Z' }, { clinica: CLINICA, logo: null }));
      expect(pdf.getPageCount()).toBe(1);
    }
  });
});
