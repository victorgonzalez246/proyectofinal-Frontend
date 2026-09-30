// @vitest-environment jsdom
import '../setup-dom.js';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EvolucionPaciente from '../../src/components/analitica/EvolucionPaciente.jsx';

const plan = {
  lastTreatment: { name: 'Perfilado labial', date: '2026-09-24T15:00:00-06:00' },
  care: { items: [{ id: 'c1', type: 'do' }, { id: 'c2', type: 'do' }, { id: 'c3', type: 'dont' }] },
  careDone: ['c1'],
  roadmap: [
    { id: 'r1', status: 'done', title: 'Valoración' },
    { id: 'r2', status: 'current', title: 'Perfilado labial' },
    { id: 'r3', status: 'next', title: 'Control de labios' },
  ],
  packages: [{ id: 'p1', total: 4, used: 1 }],
};
const checkins = [
  { id: 'a', createdAt: '2026-09-24T10:00:00-06:00', mood: 'molestias', pain: 6 },
  { id: 'b', createdAt: '2026-09-26T10:00:00-06:00', mood: 'bien', pain: 2 },
];

describe('<EvolucionPaciente /> (dashboard de evolución)', () => {
  it('muestra las cifras de la recuperación de la paciente', () => {
    render(<EvolucionPaciente plan={plan} checkins={checkins} vista="paciente" />);
    expect(screen.getByText('6 → 2')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument(); // mejora de la molestia
    expect(screen.getByText('3/5')).toBeInTheDocument(); // bienestar promedio
    expect(screen.getByText('50%')).toBeInTheDocument(); // cuidados cumplidos
    expect(screen.getByText(/Tu molestia pasó de/)).toHaveTextContent('Tu molestia pasó de 6 a 2 de 10 (67% menos).');
  });

  it('cada gráfico tiene su tabla de datos equivalente', () => {
    render(<EvolucionPaciente plan={plan} checkins={checkins} />);
    const tabla = screen.getByRole('table', { name: 'Molestia y bienestar por día de recuperación' });
    const filas = within(tabla).getAllByRole('row');
    expect(filas).toHaveLength(3); // encabezado + día 1 + día 3
    expect(within(filas[2]).getByRole('rowheader')).toHaveTextContent('3');
    expect(screen.getByRole('table', { name: 'Registros por estado de ánimo' })).toBeInTheDocument();
  });

  it('muestra el avance del plan con barras de progreso accesibles', () => {
    render(<EvolucionPaciente plan={plan} checkins={checkins} />);
    expect(screen.getByRole('progressbar', { name: 'Mapa de belleza' })).toHaveAttribute('aria-valuetext', '1 de 3 pasos');
    expect(screen.getByRole('progressbar', { name: 'Sesiones de paquetes usadas' })).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText('Control de labios')).toBeInTheDocument();
  });

  it('en la vista de la doctora habla de "la paciente" y nombra el tratamiento', () => {
    render(<EvolucionPaciente plan={plan} checkins={checkins} vista="doctora" />);
    expect(screen.getByText(/La molestia pasó de/)).toBeInTheDocument();
    expect(screen.getByText(/«Perfilado labial»/)).toBeInTheDocument();
  });

  it('sin check-ins explica cómo empezar a registrar', () => {
    render(<EvolucionPaciente plan={plan} checkins={[]} vista="paciente" />);
    expect(screen.getByText(/Responde “¿Cómo te sientes hoy\?”/)).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Molestia y bienestar por día de recuperación' })).not.toBeInTheDocument();
  });
});
