import { describe, expect, it } from 'vitest';
import { calcularTotales, colones, fechaFactura, nombreArchivo, TARIFAS_IVA } from '../../src/lib/factura.js';
import { totalesFactura, TARIFAS_IVA as TARIFAS_SERVIDOR } from '../../api/nucleo.mjs';

describe('facturas: cálculos del formulario', () => {
  it('suma servicios, aplica descuento e IVA sobre la base descontada', () => {
    const items = [{ cantidad: 1, precio: 185000 }, { cantidad: 2, precio: 65000 }];
    expect(calcularTotales(items, 15000, 13)).toEqual({ subtotal: 315000, descuento: 15000, impuesto: 13, impuestoMonto: 39000, total: 339000 });
  });

  it('el descuento nunca pasa del subtotal y una tarifa desconocida cuenta como sin IVA', () => {
    expect(calcularTotales([{ cantidad: 1, precio: 1000 }], 5000, 13)).toMatchObject({ descuento: 1000, total: 0 });
    expect(calcularTotales([{ cantidad: 1, precio: 1000 }], 0, 7)).toMatchObject({ impuesto: 0, total: 1000 });
    expect(calcularTotales([{ cantidad: '2', precio: '1500.5' }], '', '4')).toMatchObject({ subtotal: 3001, impuestoMonto: 120.04, total: 3121.04 });
  });

  it('da exactamente lo mismo que el servidor (la vista previa no puede mentir)', () => {
    expect(TARIFAS_IVA.map((t) => t.valor)).toEqual(TARIFAS_SERVIDOR);
    const casos = [
      [[{ cantidad: 3, precio: 33333.33 }], 1000.5, 13],
      [[{ cantidad: 1, precio: 0.1 }, { cantidad: 7, precio: 0.2 }], 0, 4],
      [[{ cantidad: 99, precio: 49999.99 }], 123456.78, 2],
      [[{ cantidad: 5, precio: 18000 }], 90000, 13],
    ];
    for (const [items, descuento, iva] of casos) {
      expect(calcularTotales(items, descuento, iva)).toEqual(totalesFactura(items, descuento, iva));
    }
  });

  it('formatea colones, fechas y el nombre del archivo PDF', () => {
    expect(colones(339000).replace(/\s/g, ' ')).toBe('₡339 000,00');
    expect(fechaFactura('2026-10-01')).toBe('1 de octubre de 2026');
    expect(nombreArchivo({ numero: 'FAC-0007', cliente: { nombre: 'María José / Solano' } })).toBe('Factura FAC-0007 - María José  Solano.pdf');
  });
});
