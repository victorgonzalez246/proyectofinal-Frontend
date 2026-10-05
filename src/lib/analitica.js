// Analítica de la evolución de cada paciente, calculada en el navegador con los datos que ya entrega la API
// (check-ins, plan del portal). La usan el portal de la paciente y la ficha / métricas del panel de la doctora.

const DIA_MS = 24 * 60 * 60 * 1000;

// Ánimo del check-in convertido a una escala de bienestar de 1 a 5
export const BIENESTAR = { 'muy-bien': 5, bien: 4, regular: 3, molestias: 2, preocupacion: 1 };

const inicioDelDia = (valor) => {
  const d = typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T00:00:00`) : new Date(valor);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

// Día de recuperación (1 = día del tratamiento) en que se registró algo
export const diaDeRecuperacion = (fecha, fechaTratamiento) =>
  Math.round((inicioDelDia(fecha) - inicioDelDia(fechaTratamiento)) / DIA_MS) + 1;

/**
 * Check-ins ordenados por día de recuperación. Si hay varios el mismo día, se promedian.
 * @returns {{ dia: number, molestia: number, bienestar: number, registros: number }[]}
 */
export function curvaRecuperacion(checkins = [], fechaTratamiento) {
  if (!fechaTratamiento) return [];
  const porDia = new Map();
  for (const c of checkins) {
    const dia = diaDeRecuperacion(c.createdAt, fechaTratamiento);
    if (dia < 1) continue; // registros anteriores al tratamiento
    const acumulado = porDia.get(dia) || { molestia: 0, bienestar: 0, registros: 0 };
    acumulado.molestia += Number(c.pain) || 0;
    acumulado.bienestar += BIENESTAR[c.mood] ?? 3;
    acumulado.registros += 1;
    porDia.set(dia, acumulado);
  }
  return [...porDia]
    .sort(([a], [b]) => a - b)
    .map(([dia, a]) => ({
      dia,
      molestia: Math.round((a.molestia / a.registros) * 10) / 10,
      bienestar: Math.round((a.bienestar / a.registros) * 10) / 10,
      registros: a.registros,
    }));
}

/** Cifras clave de la recuperación: de cuánto a cuánto bajó la molestia y cómo va el ánimo */
export function resumenRecuperacion(checkins = [], fechaTratamiento) {
  const curva = curvaRecuperacion(checkins, fechaTratamiento);
  if (curva.length === 0) return null;
  const primero = curva[0];
  const ultimo = curva.at(-1);
  const mejora = primero.molestia > 0 ? Math.round(((primero.molestia - ultimo.molestia) / primero.molestia) * 100) : 0;
  const bienestarPromedio = Math.round((curva.reduce((s, p) => s + p.bienestar, 0) / curva.length) * 10) / 10;
  let tendencia = 'estable';
  if (ultimo.molestia < primero.molestia) tendencia = 'mejora';
  else if (ultimo.molestia > primero.molestia) tendencia = 'empeora';
  return {
    molestiaInicial: primero.molestia,
    molestiaActual: ultimo.molestia,
    mejora: Math.max(mejora, 0),
    bienestarPromedio,
    diasRegistrados: curva.length,
    tendencia,
  };
}

/** Cuántos de los cuidados "sí hacer" marcó la paciente */
export function adherenciaCuidados(care, careDone = []) {
  const recomendados = (care?.items || []).filter((i) => i.type === 'do');
  if (recomendados.length === 0) return null;
  const hechos = recomendados.filter((i) => careDone.includes(i.id)).length;
  return { hechos, total: recomendados.length, porcentaje: Math.round((hechos / recomendados.length) * 100) };
}

/** Avance del mapa de belleza: pasos hechos, el actual y el siguiente */
export function progresoPlan(roadmap = []) {
  if (roadmap.length === 0) return null;
  const completados = roadmap.filter((s) => s.status === 'done').length;
  const enCurso = roadmap.filter((s) => s.status === 'current').length;
  const siguiente = roadmap.find((s) => s.status === 'next') || roadmap.find((s) => s.status === 'future') || null;
  return {
    completados,
    enCurso,
    total: roadmap.length,
    // El paso en curso cuenta como medio avance
    porcentaje: Math.round(((completados + enCurso * 0.5) / roadmap.length) * 100),
    siguiente,
  };
}

/** Sesiones usadas de los paquetes vigentes */
export function usoPaquetes(packages = []) {
  const total = packages.reduce((s, p) => s + (p.total || 0), 0);
  if (!total) return null;
  const usadas = packages.reduce((s, p) => s + Math.min(p.used || 0, p.total || 0), 0);
  return { usadas, total, restantes: total - usadas, porcentaje: Math.round((usadas / total) * 100) };
}

/** Cuántas veces registró cada ánimo (para la distribución del estado emocional) */
export function distribucionAnimo(checkins = []) {
  return Object.keys(BIENESTAR).map((id) => ({ id, total: checkins.filter((c) => c.mood === id).length }));
}

/**
 * Curva de recuperación promedio de varias pacientes (panel de la doctora).
 * Agrupa por tramos de días para que cada punto junte suficientes registros.
 * @param {{ checkins: object[], fechaTratamiento: string }[]} pacientes
 */
export const TRAMOS_RECUPERACION = [
  { desde: 1, hasta: 1, etiqueta: 'Día 1' },
  { desde: 2, hasta: 2, etiqueta: 'Día 2' },
  { desde: 3, hasta: 4, etiqueta: 'Días 3-4' },
  { desde: 5, hasta: 7, etiqueta: 'Días 5-7' },
  { desde: 8, hasta: 10, etiqueta: 'Días 8-10' },
  { desde: 11, hasta: 14, etiqueta: 'Días 11-14' },
];

export function curvaPromedio(pacientes = []) {
  const puntos = pacientes.flatMap(({ checkins, fechaTratamiento }) => curvaRecuperacion(checkins, fechaTratamiento));
  return TRAMOS_RECUPERACION.map((t) => {
    const delTramo = puntos.filter((p) => p.dia >= t.desde && p.dia <= t.hasta);
    const promedio = (campo) =>
      delTramo.length ? Math.round((delTramo.reduce((s, p) => s + p[campo], 0) / delTramo.length) * 10) / 10 : null;
    return { etiqueta: t.etiqueta, molestia: promedio('molestia'), bienestar: promedio('bienestar'), registros: delTramo.length };
  });
}
