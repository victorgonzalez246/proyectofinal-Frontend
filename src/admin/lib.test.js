import { describe, expect, it } from 'vitest';
import { fromLocalInput, toLocalInput, whatsappLink } from './lib.js';

describe('panel: fechas y enlaces', () => {
  it('convierte entre el formato guardado y el de <input type="datetime-local">', () => {
    expect(toLocalInput('2026-09-24T15:00:00-06:00')).toBe('2026-09-24T15:00');
    expect(fromLocalInput('2026-09-24T15:00')).toBe('2026-09-24T15:00:00-06:00');
    expect(fromLocalInput(toLocalInput('2026-09-24T15:00:00-06:00'))).toBe('2026-09-24T15:00:00-06:00');
  });

  it('los valores vacíos o inválidos quedan vacíos', () => {
    expect(toLocalInput('')).toBe('');
    expect(toLocalInput(undefined)).toBe('');
    expect(toLocalInput('mañana')).toBe('');
    expect(fromLocalInput('')).toBe('');
  });

  it('arma el enlace de WhatsApp con el código de Costa Rica cuando falta', () => {
    expect(whatsappLink('8888 0001')).toBe('https://wa.me/50688880001');
    expect(whatsappLink('+506 8888-0001')).toBe('https://wa.me/50688880001');
  });
});
