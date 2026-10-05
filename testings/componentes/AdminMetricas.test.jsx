// @vitest-environment jsdom
import '../setup-dom.js';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Se simula la API del panel (las mismas rutas que atiende n8n en producción)
const { adminService } = vi.hoisted(() => ({
  adminService: { getCitas: vi.fn(), getPacientes: vi.fn(), getAlertas: vi.fn(), getPaciente: vi.fn() },
}));
vi.mock('../../src/services/adminService.js', () => ({ adminService }));

import AdminMetricas from '../../src/admin/pages/AdminMetricas.jsx';

// Fechas relativas a hoy para que siempre caigan en el periodo
const haceDias = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const CITAS = [
  { id: '1', userId: 'a', fecha: haceDias(3), hora: '10:00', estado: 'confirmada', tratamiento: 'Labios', origen: 'recepcionista-ia', createdAt: `${haceDias(10)}T12:00:00.000Z` },
  { id: '2', userId: 'a', fecha: haceDias(40), hora: '15:00', estado: 'confirmada', tratamiento: 'Labios', createdAt: `${haceDias(45)}T12:00:00.000Z` },
  { id: '3', userId: 'b', fecha: haceDias(5), estado: 'cancelada', tratamiento: 'Botox', createdAt: `${haceDias(8)}T12:00:00.000Z` },
  { id: '4', userId: 'c', fecha: haceDias(-60), estado: 'pendiente', tratamiento: 'Skinbooster', createdAt: `${haceDias(1)}T12:00:00.000Z` },
];
const PACIENTES = [
  { id: 'a', tienePlan: true, promociones: true, dateJoined: `${haceDias(50)}T12:00:00.000Z` },
  { id: 'b', tienePlan: false, promociones: false, dateJoined: `${haceDias(9)}T12:00:00.000Z` },
];
const ALERTAS = [
  { id: 's1', tipo: 'sos', motivo: 'inflamacion', estado: 'abierta', createdAt: new Date().toISOString() },
  { id: 'k1', tipo: 'checkin', motivo: 'Ánimo: molestias', estado: 'atendida', createdAt: new Date().toISOString() },
];
const FICHA_A = {
  plan: { lastTreatment: { name: 'Labios', date: haceDias(3) } },
  checkins: [
    { createdAt: `${haceDias(3)}T18:00:00.000Z`, mood: 'molestias', pain: 6 },
    { createdAt: `${haceDias(0)}T18:00:00.000Z`, mood: 'muy-bien', pain: 1 },
  ],
};

describe('<AdminMetricas /> (dashboard de la doctora)', () => {
  beforeEach(() => {
    adminService.getCitas.mockResolvedValue(CITAS);
    adminService.getPacientes.mockResolvedValue(PACIENTES);
    adminService.getAlertas.mockResolvedValue(ALERTAS);
    adminService.getPaciente.mockResolvedValue(FICHA_A);
  });

  it('muestra las cifras clave calculadas con los datos de la API', async () => {
    render(<AdminMetricas />);
    expect(await screen.findByText('Solicitudes de cita')).toBeInTheDocument();
    expect(screen.getByText('1 por confirmar hoy')).toBeInTheDocument();
    expect(screen.getByText('2 de 3 solicitudes')).toBeInTheDocument(); // la pendiente es a futuro
    expect(screen.getByText('1 abiertas de 2')).toBeInTheDocument(); // alertas atendidas: 50%
    expect(screen.getByText('6 → 1 de 10 en la recuperación')).toBeInTheDocument();
  });

  it('pide la ficha solo de las pacientes con plan', async () => {
    render(<AdminMetricas />);
    await screen.findByText('Solicitudes de cita');
    expect(adminService.getPaciente).toHaveBeenCalledTimes(1);
    expect(adminService.getPaciente).toHaveBeenCalledWith('a');
  });

  it('incluye las secciones de agenda y de evolución con sus gráficos', async () => {
    render(<AdminMetricas />);
    await screen.findByText('Solicitudes de cita');
    for (const titulo of ['Citas por mes', 'Canal de reserva', 'Tratamientos más solicitados', 'Demanda por día de la semana',
      'Anticipación con que reservan', 'Curva de recuperación promedio', 'Motivos de las alertas', 'Pacientes nuevas por mes']) {
      expect(screen.getByRole('heading', { name: titulo })).toBeInTheDocument();
    }
    expect(screen.getByRole('table', { name: 'Solicitudes por tratamiento' })).toHaveTextContent('Labios');
  });

  it('cambia el periodo con un grupo de botones accesible', async () => {
    render(<AdminMetricas />);
    await screen.findByText('Solicitudes de cita');
    const doce = screen.getByRole('button', { name: '12 meses' });
    fireEvent.click(doce);
    expect(doce).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/de los últimos 12 meses/)).toBeInTheDocument();
  });

  it('si la API falla muestra el error y permite reintentar', async () => {
    adminService.getCitas.mockRejectedValueOnce(new Error('No pudimos cargar las citas.'));
    render(<AdminMetricas />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar las citas.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Solicitudes de cita')).toBeInTheDocument();
  });
});
