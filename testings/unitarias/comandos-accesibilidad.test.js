import { describe, expect, it } from 'vitest';
import { interpretarComando, respuestaComando } from '../../src/components/asistente/comandosAccesibilidad.js';

describe('órdenes de accesibilidad para Aura', () => {
  it.each([
    ['Activa el modo protanopia', { tipo: 'daltonismo', modo: 'protanopia' }],
    ['tengo deuteranopia', { tipo: 'daltonismo', modo: 'deuteranopia' }],
    ['¿Puedes poner tritanopia?', { tipo: 'daltonismo', modo: 'tritanopia' }],
    ['pon la página en blanco y negro', { tipo: 'daltonismo', modo: 'acromatopsia' }],
    ['no distingo bien el verde', { tipo: 'daltonismo', modo: 'deuteranopia' }],
    ['quita el daltonismo', { tipo: 'daltonismo', modo: 'ninguno' }],
    ['Colores normales, por favor', { tipo: 'daltonismo', modo: 'ninguno' }],
    ['soy daltónico', { tipo: 'ayuda-daltonismo' }],
    ['Léeme la página', { tipo: 'lectura', accion: 'leer' }],
    ['lee para mí la página', { tipo: 'lectura', accion: 'leer' }],
    ['para de leer', { tipo: 'lectura', accion: 'detener' }],
    ['detén la lectura', { tipo: 'lectura', accion: 'detener' }],
    ['pausa', { tipo: 'lectura', accion: 'pausar' }],
    ['continúa la lectura', { tipo: 'lectura', accion: 'reanudar' }],
    ['activa el alto contraste', { tipo: 'contraste', activo: true }],
    ['quita el alto contraste', { tipo: 'contraste', activo: false }],
    ['pon la letra más grande', { tipo: 'texto', escala: 1.15 }],
    ['texto muy grande', { tipo: 'texto', escala: 1.3 }],
  ])('«%s»', (frase, esperado) => {
    expect(interpretarComando(frase)).toEqual(esperado);
  });

  it.each([
    'Tengo manchas rojas en la cara',
    '¿El láser sirve para vello blanco y negro?',
    '¿Qué colores de ropa uso sin maquillaje?',
    '¿Hay más contraste con el peeling?',
    '¿El texto del consentimiento es largo?',
    '¿Qué tratamiento me ayuda con las ojeras?',
  ])('no confunde una consulta con una orden: «%s»', (frase) => {
    expect(interpretarComando(frase)).toBeNull();
  });

  it('confirma cada orden con un texto claro', () => {
    expect(respuestaComando({ tipo: 'daltonismo', modo: 'tritanopia' })).toMatch(/tritanopia/);
    expect(respuestaComando({ tipo: 'lectura', accion: 'leer' }, { lecturaOk: false })).toMatch(/TalkBack/);
  });
});
