// Unitarias: mensajes de error que Aura muestra en el navegador (src/services/asistenteService.js),
// con las clases de error reales de @anthropic-ai/sdk.
import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { mensajeDeError } from '../../src/services/asistenteService.js';

const errorApi = (status, message, type = 'api_error') =>
  Anthropic.APIError.generate(status, { type: 'error', error: { type, message } }, message, new Headers());

describe('mensajeDeError', () => {
  it('503 del proxy: muestra su mensaje amable (sin clave o proveedor no disponible)', () => {
    expect(mensajeDeError(Anthropic, errorApi(503, 'Aura no está disponible por ahora.'))).toBe('Aura no está disponible por ahora.');
  });

  it('429 del proxy: límite propio de preguntas', () => {
    expect(mensajeDeError(Anthropic, errorApi(429, 'Hiciste muchas preguntas seguidas.', 'rate_limit_error'))).toBe('Hiciste muchas preguntas seguidas.');
  });

  it('error a mitad de la respuesta (sin status): mensaje del proxy', () => {
    // Así lo lanza el SDK ante un evento SSE "error" (core/streaming)
    const body = { type: 'error', error: { type: 'api_error', message: 'Aura no está disponible en este momento.' } };
    const err = new Anthropic.APIError(undefined, body, undefined, new Headers(), 'api_error');
    expect(mensajeDeError(Anthropic, err)).toBe('Aura no está disponible en este momento.');
  });

  it('otros errores del proveedor nunca muestran el texto técnico', () => {
    const texto = mensajeDeError(Anthropic, errorApi(529, 'Overloaded', 'overloaded_error'));
    expect(texto).not.toMatch(/Overloaded/);
    expect(texto).toMatch(/no está disponible en este momento.*Inténtalo/);
    expect(mensajeDeError(Anthropic, errorApi(529, 'Overloaded'), true)).toMatch(/Inténtelo más tarde/);
  });

  it('400 sigue siendo conversación inválida y la cancelación no muestra nada', () => {
    expect(mensajeDeError(Anthropic, errorApi(400, 'Conversación inválida.'))).toMatch(/No pudimos procesar la conversación/);
    expect(mensajeDeError(Anthropic, new Anthropic.APIUserAbortError())).toBe('');
  });
});
