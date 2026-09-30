import { describe, expect, it } from 'vitest';
import { calcularMetricas, ultimosMeses } from './metricas.js';

const HOY = new Date(2026, 8, 29); // 29 de septiembre de 2026

const citas = [
  { fecha: '2026-09-24', estado: 'confirmada', tratamiento: 'Labios', origen: 'recepcionista-ia' },
  { fecha: '2026-09-10', estado: 'pendiente', tratamiento: 'Labios', origen: 'landing-cita' },
  { fecha: '2026-08-02', estado: 'cancelada', tratamiento: 'Botox' },
  { fecha: '2026-07-15', estado: 'confirmada', tratamiento: 'Bioestimuladores' },
  { fecha: '2025-01-15', estado: 'confirmada', tratamiento: 'Fuera de rango' },
];
const pacientes = [{ dateJoined: '2026-09-01T10:00:00.000Z' }, { dateJoined: '2026-06-12T15:00:00.000Z' }, { dateJoined: '2024-01-01' }];

describe('métricas del panel', () => {
  it('genera los meses del periodo, del más antiguo al actual', () => {
    const meses = ultimosMeses(3, HOY);
    expect(meses.map((m) => m.clave)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(ultimosMeses(12, HOY)[0].clave).toBe('2025-10');
  });

  it('cuenta citas por mes y estado solo dentro del periodo', () => {
    const m = calcularMetricas(citas, pacientes, { meses: 3, hoy: HOY });
    expect(m.porMes.at(-2)).toMatchObject({ clave: '2026-09', confirmada: 1, pendiente: 1, cancelada: 0, total: 2 });
    expect(m.porMes.at(-1)).toMatchObject({ clave: '2026-10', total: 0 }); // mes siguiente: citas agendadas
    expect(m.porMes[1]).toMatchObject({ clave: '2026-08', cancelada: 1, total: 1 });
    expect(m.kpis).toMatchObject({ total: 4, confirmadas: 2, pendientes: 1, canceladas: 1, tasaConfirmacion: 50, porcentajeIA: 25, porConfirmar: 1 });
    const conFutura = calcularMetricas([...citas, { fecha: '2026-10-05', estado: 'pendiente' }], [], { meses: 3, hoy: HOY });
    expect(conFutura.kpis.porConfirmar).toBe(2);
  });

  it('ordena los tratamientos más solicitados sin contar canceladas', () => {
    const m = calcularMetricas(citas, pacientes, { meses: 3, hoy: HOY });
    expect(m.tratamientos).toEqual([{ nombre: 'Labios', total: 2 }, { nombre: 'Bioestimuladores', total: 1 }]);
  });

  it('agrupa en "Otros" desde el séptimo tratamiento', () => {
    const muchas = Array.from({ length: 8 }, (_, i) => ({ fecha: '2026-09-01', estado: 'pendiente', tratamiento: `T${i}` }));
    const m = calcularMetricas(muchas, [], { meses: 1, hoy: HOY });
    expect(m.tratamientos).toHaveLength(7);
    expect(m.tratamientos.at(-1)).toEqual({ nombre: 'Otros', total: 2 });
  });

  it('cuenta pacientes nuevas por mes y funciona sin datos', () => {
    const m = calcularMetricas(citas, pacientes, { meses: 6, hoy: HOY });
    expect(m.kpis.pacientesNuevas).toBe(2);
    const vacio = calcularMetricas([], [], { hoy: HOY });
    expect(vacio.kpis).toMatchObject({ total: 0, tasaConfirmacion: 0, pacientesNuevas: 0 });
    expect(vacio.porMes).toHaveLength(7);
  });
});
