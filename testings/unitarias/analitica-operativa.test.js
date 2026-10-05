import { describe, expect, it } from 'vitest';
import { analiticaOperativa } from '../../src/admin/metricas.js';

const HOY = new Date(2026, 8, 29); // 29 de septiembre de 2026

// 2026-09-21 es lunes; 2026-09-25, viernes
const citas = [
  { userId: 'a', fecha: '2026-09-21', hora: '09:30', estado: 'confirmada', origen: 'recepcionista-ia', createdAt: '2026-09-19T12:00:00.000Z' },
  { userId: 'a', fecha: '2026-08-10', hora: '15:00', estado: 'confirmada', createdAt: '2026-07-20T12:00:00.000Z' },
  { userId: 'b', fecha: '2026-09-25', hora: '14:00', estado: 'confirmada', createdAt: '2026-09-15T12:00:00.000Z' },
  { userId: 'c', fecha: '2026-09-25', estado: 'cancelada', createdAt: '2026-09-24T12:00:00.000Z' },
  { userId: 'd', fecha: '2025-01-10', hora: '10:00', estado: 'confirmada', createdAt: '2025-01-01T12:00:00.000Z' }, // fuera del periodo
];
const pacientes = [
  { id: 'a', tienePlan: true, promociones: true },
  { id: 'b', tienePlan: false, promociones: true },
  { id: 'c', tienePlan: false, promociones: false },
  { id: 'd', tienePlan: false, promociones: false },
];
const alertas = [
  { tipo: 'sos', motivo: 'inflamacion', estado: 'abierta' },
  { tipo: 'sos', motivo: 'duda', estado: 'atendida' },
  { tipo: 'checkin', motivo: 'Ánimo: molestias · molestia 7/10', estado: 'atendida' },
  { tipo: 'checkin', motivo: 'Ánimo: preocupacion · molestia 6/10', estado: 'atendida' },
];

describe('analítica operativa de la clínica', () => {
  const op = analiticaOperativa(citas, pacientes, alertas, { meses: 3, hoy: HOY });

  it('cuenta la demanda por día de la semana sin las canceladas', () => {
    expect(op.porDiaSemana.map((d) => d.dia)).toEqual(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']);
    expect(op.porDiaSemana.find((d) => d.dia === 'Lun').total).toBe(2); // 21 sep y 10 ago
    expect(op.porDiaSemana.find((d) => d.dia === 'Vie').total).toBe(1);
    expect(op.diaMasSolicitado).toMatchObject({ dia: 'Lun', nombre: 'lunes' });
  });

  it('separa las citas confirmadas por franja horaria', () => {
    expect(op.franjas.map((f) => f.total)).toEqual([1, 2]);
  });

  it('mide la anticipación de reserva por tramos y en promedio', () => {
    // 2, 21, 10 y 1 días de anticipación
    expect(op.anticipacion.map((t) => t.total)).toEqual([2, 0, 1, 1]);
    expect(op.anticipacionMedia).toBe(9);
  });

  it('separa el canal de reserva por mes', () => {
    const septiembre = op.canalPorMes.find((m) => m.clave === '2026-09');
    expect(septiembre).toMatchObject({ web: 2, ia: 1 });
  });

  it('calcula la tasa de retorno con todas las citas confirmadas', () => {
    // a: 2 confirmadas; b y d: 1
    expect(op.fidelizacion).toEqual({ atendidas: 3, recurrentes: 1, tasaRetorno: 33 });
  });

  it('resume planes y consentimientos de las pacientes', () => {
    expect(op.pacientes).toEqual({ total: 4, conPlan: 1, porcentajePlan: 25, conPromociones: 2, porcentajePromociones: 50 });
  });

  it('agrupa las alertas por motivo y mide cuántas se atendieron', () => {
    expect(op.alertas).toMatchObject({ total: 4, abiertas: 1, atendidas: 3, tasaAtencion: 75 });
    expect(op.alertas.porMotivo[0]).toEqual({ motivo: 'Check-in con molestias', total: 2 });
    expect(op.alertas.porMotivo.map((m) => m.motivo)).toContain('Inflamación');
  });

  it('funciona sin datos', () => {
    const vacia = analiticaOperativa([], [], [], { hoy: HOY });
    expect(vacia.anticipacionMedia).toBe(0);
    expect(vacia.fidelizacion.tasaRetorno).toBe(0);
    expect(vacia.alertas.porMotivo).toEqual([]);
  });
});

describe('demanda por día de la semana', () => {
  it('agrega el domingo solo cuando hubo citas ese día (no se pierden datos)', () => {
    const domingo = { userId: 'x', fecha: '2026-09-27', hora: '10:00', estado: 'confirmada', createdAt: '2026-09-20T12:00:00.000Z' };
    const sinDomingo = analiticaOperativa(citas, pacientes, alertas, { meses: 3, hoy: HOY });
    const conDomingo = analiticaOperativa([...citas, domingo], pacientes, alertas, { meses: 3, hoy: HOY });
    expect(sinDomingo.porDiaSemana).toHaveLength(6);
    expect(conDomingo.porDiaSemana.at(-1)).toMatchObject({ dia: 'Dom', total: 1 });
  });
});
