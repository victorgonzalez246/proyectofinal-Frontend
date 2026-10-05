// Integración: errores del proveedor (Anthropic y Gemini) y el camino Gemini del proxy del asistente.
// El fetch del proveedor se simula: no hay red ni costo. Comprueba que la paciente/doctora ven un
// mensaje amable, que la causa real queda en la consola del servidor y que la clave nunca se filtra.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { causaDelError, MENSAJES_ASISTENTE, MODELO_GEMINI, responderAsistente } from '../../api/_asistente.mjs';

const CLAVE_ANTHROPIC = 'sk-ant-clave-secreta-de-prueba';
const CLAVE_GEMINI = 'AQ.clave-secreta-gemini-de-prueba';
const conversacion = { messages: [{ role: 'user', content: 'Hola' }] };

const respuestaJson = (status, cuerpo) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

// Gemini responde con SSE separado por \r\n
const sse = (datos) => new Response(datos.map((d) => `data: ${JSON.stringify(d)}\r\n\r\n`).join(''), {
  status: 200,
  headers: { 'content-type': 'text/event-stream' },
});

const eventos = async (res) =>
  (await res.text()).split('\n').filter((l) => l.startsWith('data: ')).map((l) => JSON.parse(l.slice(6)));

let consola;
beforeEach(() => { consola = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => consola.mockRestore());
const registrado = () => consola.mock.calls.map((c) => c.join(' ')).join('\n');

describe('errores de Anthropic → mensaje amable', () => {
  const casos = [
    ['sin crédito (400 credit balance)', 400, { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }, /no tiene crédito/],
    ['clave inválida (401)', 401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, /clave inválida/],
    ['saturado (529)', 529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }, /saturado/],
    ['límite del proveedor (429)', 429, { type: 'error', error: { type: 'rate_limit_error', message: 'Number of request tokens has exceeded your rate limit' } }, /límite/],
  ];
  for (const [nombre, status, cuerpo, causa] of casos) {
    it(nombre, async () => {
      const fetchImpl = vi.fn(async () => respuestaJson(status, cuerpo));
      const res = await responderAsistente(conversacion, CLAVE_ANTHROPIC, fetchImpl, { geminiApiKey: '' });
      expect(res.status).toBe(503); // ni 400 ni 429: el navegador no lo confunde con conversación inválida o con el límite propio
      expect(res.headers.get('x-should-retry')).toBe('false');
      const body = await res.json();
      expect(body.error.message).toBe(MENSAJES_ASISTENTE.noDisponible.paciente);
      expect(JSON.stringify(body)).not.toMatch(/credit|x-api-key|Overloaded|sk-ant/);
      expect(registrado()).toMatch(causa);
      expect(registrado()).toContain(String(status));
      expect(registrado()).not.toContain(CLAVE_ANTHROPIC);
    });
  }

  it('la doctora recibe el mensaje en "usted"', async () => {
    const fetchImpl = vi.fn(async (url) =>
      String(url).endsWith('/me')
        ? respuestaJson(200, { role: 'doctor' })
        : respuestaJson(400, { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low' } }));
    const res = await responderAsistente(conversacion, CLAVE_ANTHROPIC, fetchImpl, {
      perfil: 'doctora', token: 'tok-doctora-errores', apiUrl: 'http://api.local', geminiApiKey: '',
    });
    expect(res.status).toBe(503);
    expect((await res.json()).error.message).toBe(MENSAJES_ASISTENTE.noDisponible.doctora);
  });

  it('sin ninguna clave: "no está disponible por ahora" sin llamar al proveedor', async () => {
    const fetchImpl = vi.fn();
    const res = await responderAsistente(conversacion, '', fetchImpl, { geminiApiKey: '' });
    expect(res.status).toBe(503);
    expect((await res.json()).error.message).toBe(MENSAJES_ASISTENTE.sinConfigurar.paciente);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('causaDelError resume el cuerpo en una línea', () => {
    const linea = causaDelError('Anthropic', 400, '{"error":{"type":"invalid_request_error","message":"Your credit\\n balance   is too low"}}');
    expect(linea).toBe('[asistente] Anthropic respondió 400 (la cuenta no tiene crédito): invalid_request_error: Your credit balance is too low');
  });
});

describe('camino Gemini', () => {
  it('tiene prioridad sobre Anthropic y manda la clave en x-goog-api-key, no en la URL', async () => {
    const fetchImpl = vi.fn(async () => sse([{ candidates: [{ content: { parts: [{ text: 'Hola' }] } }] }]));
    await responderAsistente(conversacion, CLAVE_ANTHROPIC, fetchImpl, { geminiApiKey: CLAVE_GEMINI });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, opciones] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO_GEMINI}:streamGenerateContent?alt=sse`);
    expect(url).not.toContain(CLAVE_GEMINI);
    expect(opciones.headers['x-goog-api-key']).toBe(CLAVE_GEMINI);
    expect(opciones.headers['x-api-key']).toBeUndefined();
    const enviado = JSON.parse(opciones.body);
    expect(enviado.contents).toEqual([{ role: 'user', parts: [{ text: 'Hola' }] }]);
    expect(enviado.systemInstruction.parts[0].text).toMatch(/Aura/);
  });

  it('sin GEMINI_API_KEY usa Anthropic', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 200, headers: { 'content-type': 'text/event-stream' } }));
    await responderAsistente(conversacion, CLAVE_ANTHROPIC, fetchImpl, { geminiApiKey: '' });
    const [url, opciones] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(opciones.headers['x-api-key']).toBe(CLAVE_ANTHROPIC);
  });

  it('convierte el SSE de Gemini al formato de Anthropic con el modelo real', async () => {
    const fetchImpl = vi.fn(async () => sse([
      { candidates: [{ content: { parts: [{ text: 'Pura ' }] } }] },
      { candidates: [{ content: { parts: [{ text: 'vida' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 3 } },
    ]));
    const res = await responderAsistente(conversacion, '', fetchImpl, { geminiApiKey: CLAVE_GEMINI });
    expect(res.status).toBe(200);
    const ev = await eventos(res);
    expect(ev.map((e) => e.type)).toEqual(['message_start', 'content_block_start', 'content_block_delta', 'content_block_delta', 'content_block_stop', 'message_delta', 'message_stop']);
    expect(ev[0].message.model).toBe(MODELO_GEMINI);
    expect(ev[0].message.model).not.toMatch(/claude/);
    expect(ev.filter((e) => e.type === 'content_block_delta').map((e) => e.delta.text).join('')).toBe('Pura vida');
    expect(ev[5].delta.stop_reason).toBe('end_turn');
    expect(ev[5].usage).toEqual({ input_tokens: 50, output_tokens: 3 });
  });

  it('MAX_TOKENS y SAFETY se traducen a max_tokens y refusal', async () => {
    for (const [razon, esperado] of [['MAX_TOKENS', 'max_tokens'], ['SAFETY', 'refusal']]) {
      const fetchImpl = vi.fn(async () => sse([{ candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: razon }] }]));
      const ev = await eventos(await responderAsistente(conversacion, '', fetchImpl, { geminiApiKey: CLAVE_GEMINI }));
      expect(ev.find((e) => e.type === 'message_delta').delta.stop_reason).toBe(esperado);
    }
  });

  it('un error a mitad del stream llega como evento "error" amable', async () => {
    const fetchImpl = vi.fn(async () => sse([{ error: { code: 503, status: 'UNAVAILABLE', message: 'The model is overloaded.' } }]));
    const ev = await eventos(await responderAsistente(conversacion, '', fetchImpl, { geminiApiKey: CLAVE_GEMINI }));
    const error = ev.find((e) => e.type === 'error');
    expect(error.error.message).toBe(MENSAJES_ASISTENTE.noDisponible.paciente);
    expect(registrado()).toMatch(/overloaded/);
  });

  const errores = [
    ['clave inválida (400 API key not valid)', 400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' } }, /clave inválida/],
    ['sin permiso (403)', 403, { error: { code: 403, status: 'PERMISSION_DENIED', message: 'Permission denied' } }, /sin permiso/],
    ['cuota agotada (429 RESOURCE_EXHAUSTED)', 429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } }, /cuota/],
    ['falla del servicio (500)', 500, { error: { code: 500, status: 'INTERNAL', message: 'Internal error' } }, /falla del proveedor/],
  ];
  for (const [nombre, status, cuerpo, causa] of errores) {
    it(`error ${nombre} → 503 amable`, async () => {
      const fetchImpl = vi.fn(async () => respuestaJson(status, cuerpo));
      const res = await responderAsistente(conversacion, '', fetchImpl, { geminiApiKey: CLAVE_GEMINI });
      expect(res.status).toBe(503);
      const texto = await res.text();
      expect(texto).toContain(MENSAJES_ASISTENTE.noDisponible.paciente);
      expect(texto).not.toMatch(/API key|Quota|INVALID_ARGUMENT/);
      expect(registrado()).toMatch(causa);
      expect(registrado()).not.toContain(CLAVE_GEMINI);
    });
  }
});
