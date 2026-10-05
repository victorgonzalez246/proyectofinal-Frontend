// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api.js';
import { TOKEN_KEY, USER_KEY } from './session.js';

const respuesta = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('cliente HTTP (fetch)', () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('envía el token, el cuerpo JSON y los parámetros de la query', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'tok');
    fetchMock.mockResolvedValue(respuesta(200, { ok: true }));
    const { data } = await api.patch('/admin/citas', { estado: 'confirmada' }, { params: { id: 'apt 1', vacio: '' } });
    const [url, opciones] = fetchMock.mock.calls[0];
    // En desarrollo el cliente usa rutas relativas ('/admin/citas?...') para que el proxy de Vite
    // reenvíe a localhost:3001 sin problemas de CORS. En producción será la URL completa de n8n.
    expect(url).toMatch(/\/admin\/citas\?id=apt\+1$/);
    expect(opciones.method).toBe('PATCH');
    expect(opciones.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(opciones.body)).toEqual({ estado: 'confirmada' });
    expect(data).toEqual({ ok: true });
  });

  it('un error conserva la forma { response: { status, data } } que usan los servicios', async () => {
    fetchMock.mockResolvedValue(respuesta(400, { error: 'Datos inválidos.' }));
    await expect(api.post('/appointments', {})).rejects.toMatchObject({ message: 'Datos inválidos.', response: { status: 400, data: { error: 'Datos inválidos.' } } });
  });

  it('un 401 con sesión la cierra; sin sesión no redirige', async () => {
    const location = { href: '/portal' };
    vi.stubGlobal('location', location);
    fetchMock.mockResolvedValue(respuesta(401, { error: 'x' }));

    await expect(api.get('/me')).rejects.toBeTruthy();
    expect(location.href).toBe('/portal');

    sessionStorage.setItem(TOKEN_KEY, 'vencido');
    sessionStorage.setItem(USER_KEY, '{}');
    await expect(api.get('/me')).rejects.toBeTruthy();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(USER_KEY)).toBeNull();
    expect(location.href).toBe('/portal/acceso');
  });
});
