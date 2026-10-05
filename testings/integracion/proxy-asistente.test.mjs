// Integración: el proxy del asistente como middleware HTTP real (el mismo que usa el servidor de Vite).
// Solo prueba las respuestas que no llaman a la API del modelo (sin costo y sin red).
import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { middlewareAsistente, RUTA_ASISTENTE } from '../../api/_asistente.mjs';

const levantar = (apiKey) =>
  new Promise((resolve) => {
    const siguiente = (req, res) => { res.statusCode = 404; res.end('siguiente'); };
    const server = http.createServer((req, res) => middlewareAsistente(apiKey, '', '')(req, res, () => siguiente(req, res)));
    server.listen(0, () => resolve({ server, url: `http://localhost:${server.address().port}` }));
  });

describe('proxy del asistente (HTTP)', () => {
  let sinClave;
  let conClave;
  beforeAll(async () => {
    sinClave = await levantar('');
    conClave = await levantar('clave-de-prueba');
  });
  afterAll(() => {
    sinClave.server.close();
    conClave.server.close();
  });

  const post = (base, body) =>
    fetch(`${base.url}${RUTA_ASISTENTE}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });

  it('sin clave en el servidor responde 503 con un error que entiende el SDK', async () => {
    const res = await post(sinClave, JSON.stringify({ messages: [{ role: 'user', content: 'Hola' }] }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.type).toBe('error');
    expect(body.error.message).toMatch(/no está disponible por ahora/);
    expect(res.headers.get('x-should-retry')).toBe('false'); // el SDK del navegador no reintenta
  });

  it('rechaza conversaciones inválidas antes de llamar al modelo', async () => {
    expect((await post(conClave, 'esto no es json')).status).toBe(400);
    expect((await post(conClave, JSON.stringify({ messages: [{ role: 'assistant', content: 'x' }] }))).status).toBe(400);
  });

  it('rechaza cuerpos demasiado grandes', async () => {
    const enorme = JSON.stringify({ messages: [{ role: 'user', content: 'x'.repeat(450_000) }] }); // por encima de los 400 KB que admite (la foto del panel de la doctora cabe)
    expect((await post(conClave, enorme)).status).toBe(413);
  });

  it('solo acepta POST y deja pasar las demás rutas', async () => {
    expect((await fetch(`${conClave.url}${RUTA_ASISTENTE}`)).status).toBe(405);
    const otra = await fetch(`${conClave.url}/otra-ruta`);
    expect(otra.status).toBe(404);
    expect(await otra.text()).toBe('siguiente');
  });
});
