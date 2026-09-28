import { describe, expect, it } from 'vitest';
import { aFilas, escrituraDe, leerPestana, pestanaDe } from './hojas.mjs';

describe('hojas: tablas ↔ Google Sheets', () => {
  const registros = [
    { id: 'a1', nombre: 'Ana', edad: 30, activo: true, plan: { pasos: [1, 2] } },
    { id: 'b2', nombre: 'Bea', notas: ['x'] },
  ];

  it('ida y vuelta conserva tipos, objetos y listas', () => {
    const { registros: leidos } = leerPestana(aFilas(registros));
    expect(leidos).toEqual(registros);
  });

  it('las celdas vacías no crean campos', () => {
    const { registros: leidos } = leerPestana([['id', 'nombre', 'edad'], ['c3', 'Carla', '']]);
    expect(leidos).toEqual([{ id: 'c3', nombre: 'Carla' }]);
  });

  it('ignora filas sin id y convierte ids numéricos a texto', () => {
    const { registros: leidos } = leerPestana([['id', 'nombre'], ['', 'sin id'], [42, 'numérico']]);
    expect(leidos).toEqual([{ id: '42', nombre: 'numérico' }]);
  });

  it('reescribe una fila existente en su lugar y agrega las nuevas al final', () => {
    const leida = leerPestana(aFilas(registros));
    const data = escrituraDe('users', leida, [{ ...registros[1], nombre: 'Beatriz' }, { id: 'n3', nombre: 'Nueva' }]);
    expect(data.map((d) => d.range)).toEqual(['users!A3', 'users!A4']);
    expect(data[0].values[0][1]).toBe('Beatriz');
  });

  it('si aparece una columna nueva, reescribe también los encabezados', () => {
    const leida = leerPestana([['id', 'nombre'], ['a1', 'Ana']]);
    const data = escrituraDe('users', leida, [{ id: 'a1', nombre: 'Ana', promociones: { acepta: true } }]);
    expect(data[0]).toEqual({ range: 'users!A1', values: [['id', 'nombre', 'promociones']] });
    expect(data[1].values[0][2]).toBe('{"acepta":true}');
  });

  it('una pestaña vacía recibe encabezados y la primera fila en A2', () => {
    const data = escrituraDe('accesos', leerPestana(undefined), [{ id: 'x1', usado: false }]);
    expect(data.map((d) => d.range)).toEqual(['accesos!A1', 'accesos!A2']);
  });

  it('extrae el nombre de la pestaña de un rango de la API', () => {
    expect(pestanaDe("'sosAlerts'!A1:Z9")).toBe('sosAlerts');
    expect(pestanaDe('users!A1:D3')).toBe('users');
  });
});
