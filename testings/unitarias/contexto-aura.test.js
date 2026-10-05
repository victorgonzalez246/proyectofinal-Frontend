// Unitarias: qué fichas de pacientes adjunta Aura del panel según la pregunta de la doctora
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/adminService.js', () => ({ adminService: {} }));
const { pacientesMencionadas } = await import('../../src/admin/contextoAura.js');

const pacientes = [
  { id: 'p1', name: 'Valeria Rojas', tienePlan: true },
  { id: 'p2', name: 'Mariana Solís Vargas', tienePlan: false },
  { id: 'p3', name: 'Daniela Castro Mora', tienePlan: true },
];

describe('Aura del panel: fichas que adjunta', () => {
  it('adjunta a la paciente que la doctora nombra (con o sin tildes)', () => {
    expect(pacientesMencionadas('¿Cómo va Mariana Solis?', pacientes).map((p) => p.id)).toEqual(['p2']);
    expect(pacientesMencionadas('qué productos tiene valeria', pacientes).map((p) => p.id)).toEqual(['p1']);
  });

  it('si pregunta por productos o vencimientos sin nombrar a nadie, adjunta a las pacientes con plan', () => {
    expect(pacientesMencionadas('¿Qué productos vencen pronto?', pacientes).map((p) => p.id)).toEqual(['p1', 'p3']);
  });

  it('una pregunta general no adjunta fichas', () => {
    expect(pacientesMencionadas('¿Qué tengo hoy?', pacientes)).toEqual([]);
    expect(pacientesMencionadas('hola', null)).toEqual([]);
  });
});
