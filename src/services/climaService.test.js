import { describe, expect, it } from 'vitest';
import { interpretarClima, nivelUV, recomendacionesPiel } from './climaService.js';

// Forma real de la respuesta de Open-Meteo
const respuesta = {
  current: { time: '2026-09-29T11:00', temperature_2m: 23.7, relative_humidity_2m: 85, uv_index: 7.85, weather_code: 55, is_day: 1 },
  daily: { time: ['2026-09-29'], uv_index_max: [9] },
};

describe('clima y piel (Open-Meteo)', () => {
  it('interpreta la respuesta de la API', () => {
    const clima = interpretarClima(respuesta);
    expect(clima).toMatchObject({ temperatura: 24, humedad: 85, uv: 7.9, uvMax: 9, cielo: 'Llovizna', esDeDia: true, lluvia: true });
    expect(clima.nivel.etiqueta).toBe('Muy alto');
    expect(clima.consejos.some((c) => c.includes('FPS 50+'))).toBe(true);
  });

  it('clasifica el índice UV con la escala de la OMS', () => {
    expect([1, 4, 7, 9, 12].map((uv) => nivelUV(uv).nivel)).toEqual(['bajo', 'moderado', 'alto', 'muy-alto', 'extremo']);
  });

  it('ajusta los consejos a la humedad y el calor', () => {
    const seco = recomendacionesPiel({ uvMax: 2, humedad: 30, temperatura: 30, lluvia: false });
    expect(seco.some((c) => c.includes('ceramidas'))).toBe(true);
    expect(seco.some((c) => c.includes('Calor intenso'))).toBe(true);
  });

  it('rechaza respuestas incompletas', () => {
    expect(() => interpretarClima({})).toThrow();
  });
});
