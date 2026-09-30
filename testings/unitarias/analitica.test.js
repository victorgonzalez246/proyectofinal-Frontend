import { describe, expect, it } from 'vitest';
import {
  adherenciaCuidados, curvaPromedio, curvaRecuperacion, diaDeRecuperacion, distribucionAnimo,
  progresoPlan, resumenRecuperacion, usoPaquetes,
} from '../../src/lib/analitica.js';

const TRATAMIENTO = '2026-09-24T15:00:00-06:00';
// Horas que caen el mismo día en Costa Rica y en UTC (la integración continua corre en UTC)
const checkin = (fecha, mood, pain) => ({ createdAt: `${fecha}T10:00:00-06:00`, mood, pain });

const checkins = [
  checkin('2026-09-24', 'molestias', 6),
  checkin('2026-09-25', 'molestias', 5),
  checkin('2026-09-26', 'regular', 3),
  checkin('2026-09-28', 'muy-bien', 1),
];

describe('analítica de la paciente: recuperación', () => {
  it('cuenta el día del tratamiento como día 1', () => {
    expect(diaDeRecuperacion('2026-09-24T10:00:00-06:00', TRATAMIENTO)).toBe(1);
    expect(diaDeRecuperacion('2026-09-28', TRATAMIENTO)).toBe(5);
  });

  it('arma la curva ordenada por día y promedia los registros del mismo día', () => {
    const curva = curvaRecuperacion([...checkins, checkin('2026-09-25', 'regular', 3)], TRATAMIENTO);
    expect(curva.map((p) => p.dia)).toEqual([1, 2, 3, 5]);
    expect(curva[1]).toEqual({ dia: 2, molestia: 4, bienestar: 2.5, registros: 2 });
  });

  it('ignora check-ins anteriores al tratamiento y sin fecha de tratamiento no hay curva', () => {
    expect(curvaRecuperacion([checkin('2026-09-20', 'bien', 1)], TRATAMIENTO)).toEqual([]);
    expect(curvaRecuperacion(checkins, undefined)).toEqual([]);
  });

  it('resume la mejora de la molestia y la tendencia', () => {
    expect(resumenRecuperacion(checkins, TRATAMIENTO)).toEqual({
      molestiaInicial: 6,
      molestiaActual: 1,
      mejora: 83,
      bienestarPromedio: 3,
      diasRegistrados: 4,
      tendencia: 'mejora',
    });
  });

  it('detecta cuando la molestia aumenta y nunca informa mejora negativa', () => {
    const peor = resumenRecuperacion([checkin('2026-09-24', 'bien', 2), checkin('2026-09-26', 'preocupacion', 8)], TRATAMIENTO);
    expect(peor.tendencia).toBe('empeora');
    expect(peor.mejora).toBe(0);
    expect(resumenRecuperacion([], TRATAMIENTO)).toBeNull();
  });
});

describe('analítica de la paciente: plan, cuidados y paquetes', () => {
  it('mide la adherencia solo sobre los cuidados "sí hacer"', () => {
    const care = { items: [{ id: 'a', type: 'do' }, { id: 'b', type: 'do' }, { id: 'c', type: 'dont' }] };
    expect(adherenciaCuidados(care, ['a', 'c'])).toEqual({ hechos: 1, total: 2, porcentaje: 50 });
    expect(adherenciaCuidados(null, [])).toBeNull();
  });

  it('calcula el avance del mapa de belleza contando el paso en curso como medio', () => {
    const roadmap = [
      { status: 'done', title: 'Valoración' },
      { status: 'done', title: 'Sesión 1' },
      { status: 'current', title: 'Sesión 2' },
      { status: 'next', title: 'Control' },
    ];
    const avance = progresoPlan(roadmap);
    expect(avance).toMatchObject({ completados: 2, enCurso: 1, total: 4, porcentaje: 63 });
    expect(avance.siguiente.title).toBe('Control');
    expect(progresoPlan([])).toBeNull();
  });

  it('suma las sesiones de paquetes sin pasarse del total', () => {
    expect(usoPaquetes([{ total: 3, used: 2 }, { total: 4, used: 9 }])).toEqual({ usadas: 6, total: 7, restantes: 1, porcentaje: 86 });
    expect(usoPaquetes([])).toBeNull();
  });

  it('cuenta los registros de cada ánimo, en orden de mejor a peor', () => {
    const distribucion = distribucionAnimo(checkins);
    expect(distribucion.map((d) => d.id)).toEqual(['muy-bien', 'bien', 'regular', 'molestias', 'preocupacion']);
    expect(distribucion.find((d) => d.id === 'molestias').total).toBe(2);
  });
});

describe('analítica de la clínica: curva promedio', () => {
  it('promedia la molestia de varias pacientes por tramo de días', () => {
    const otra = [checkin('2026-09-10', 'molestias', 8), checkin('2026-09-11', 'regular', 4)];
    const tramos = curvaPromedio([
      { checkins, fechaTratamiento: TRATAMIENTO },
      { checkins: otra, fechaTratamiento: '2026-09-10' },
    ]);
    expect(tramos[0]).toEqual({ etiqueta: 'Día 1', molestia: 7, bienestar: 2, registros: 2 });
    expect(tramos[1]).toMatchObject({ etiqueta: 'Día 2', molestia: 4.5, registros: 2 });
    expect(tramos.at(-1)).toMatchObject({ molestia: null, registros: 0 });
  });
});
