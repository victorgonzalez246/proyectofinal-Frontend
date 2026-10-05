// @vitest-environment jsdom
import '../setup-dom.js';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClimaPiel from '../../src/components/clima/ClimaPiel.jsx';

// Respuesta real de Open-Meteo (forma), con UV muy alto y humedad alta
const OPEN_METEO = {
  current: { time: '2026-09-29T11:00', temperature_2m: 23.7, relative_humidity_2m: 85, uv_index: 7.85, weather_code: 3, is_day: 1 },
  daily: { time: ['2026-09-29'], uv_index_max: [9] },
};
const ok = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });

describe('<ClimaPiel /> (API externa Open-Meteo)', () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('muestra el estado de carga y luego el clima con recomendaciones', async () => {
    fetchMock.mockReturnValue(ok(OPEN_METEO));
    render(<ClimaPiel />);

    expect(screen.getByRole('status')).toHaveTextContent('Consultando el clima');
    expect(await screen.findByText('Muy alto')).toBeInTheDocument();
    expect(screen.getByText('24°C')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText(/FPS 50\+/)).toBeInTheDocument();
    expect(screen.getByText(/hidratantes en gel/)).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toContain('api.open-meteo.com');
  });

  it('si la API falla muestra un error accesible y permite reintentar', async () => {
    fetchMock.mockReturnValueOnce(Promise.resolve({ ok: false, status: 503, json: async () => ({}) }));
    render(<ClimaPiel />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos consultar el clima');

    fetchMock.mockReturnValueOnce(ok(OPEN_METEO));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Muy alto')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('usa el título y el nivel de encabezado indicados', async () => {
    fetchMock.mockReturnValue(ok(OPEN_METEO));
    render(<ClimaPiel titulo="El clima de hoy y tu piel" nivelTitulo="h2" />);
    expect(screen.getByRole('heading', { level: 2, name: 'El clima de hoy y tu piel' })).toBeInTheDocument();
    await screen.findByText('Muy alto');
  });
});
