// API externa: clima actual en Escazú (Open-Meteo, gratuita y sin clave; https://open-meteo.com)
// Se traduce en recomendaciones de cuidado de la piel según índice UV, humedad y temperatura.
// El origen https://api.open-meteo.com está autorizado en el Content-Security-Policy de index.html.

// Clínica en Escazú, San José
const LAT = 9.9189;
const LON = -84.1397;

export const URL_CLIMA =
  'https://api.open-meteo.com/v1/forecast' +
  `?latitude=${LAT}&longitude=${LON}` +
  '&current=temperature_2m,relative_humidity_2m,uv_index,weather_code,is_day' +
  '&daily=uv_index_max&timezone=America%2FCosta_Rica&forecast_days=1';

// Códigos WMO que devuelve Open-Meteo, agrupados
const describirCielo = (codigo) => {
  if (codigo === 0) return 'Despejado';
  if (codigo <= 2) return 'Parcialmente nublado';
  if (codigo === 3) return 'Nublado';
  if (codigo <= 48) return 'Neblina';
  if (codigo <= 57) return 'Llovizna';
  if (codigo <= 67 || (codigo >= 80 && codigo <= 82)) return 'Lluvia';
  if (codigo >= 95) return 'Tormenta';
  return 'Variable';
};

// Escala de la OMS para el índice UV
export const nivelUV = (uv) => {
  if (uv < 3) return { nivel: 'bajo', etiqueta: 'Bajo' };
  if (uv < 6) return { nivel: 'moderado', etiqueta: 'Moderado' };
  if (uv < 8) return { nivel: 'alto', etiqueta: 'Alto' };
  if (uv < 11) return { nivel: 'muy-alto', etiqueta: 'Muy alto' };
  return { nivel: 'extremo', etiqueta: 'Extremo' };
};

// Recomendaciones de cuidado facial según el clima (texto general, no indicación médica)
export function recomendacionesPiel({ uvMax, humedad, temperatura, lluvia }) {
  const lista = [];
  if (uvMax >= 8) {
    lista.push('Protector solar FPS 50+ y reaplica cada 2 horas, aunque esté nublado: el UV atraviesa las nubes.');
    lista.push('Evita el sol directo entre 10:00 y 15:00, sobre todo si tuviste un tratamiento reciente.');
  } else if (uvMax >= 3) {
    lista.push('Protector solar FPS 30+ al salir y reaplícalo al mediodía.');
  } else {
    lista.push('UV bajo hoy, pero el protector solar diario sigue siendo tu mejor antiedad.');
  }
  if (humedad >= 75) {
    lista.push('Con tanta humedad, prefiere hidratantes en gel o sérums ligeros con ácido hialurónico.');
  } else if (humedad < 45) {
    lista.push('Aire seco: refuerza la hidratación con una crema con ceramidas y bebe agua a lo largo del día.');
  } else {
    lista.push('Humedad equilibrada: mantén tu rutina de hidratación de mañana y noche.');
  }
  if (temperatura >= 28) lista.push('Calor intenso: evita el ejercicio fuerte las primeras 48 h después de un relleno o neuromodulador.');
  if (lluvia) lista.push('Día lluvioso: limpia bien la piel al llegar a casa para retirar sudor y contaminación.');
  return lista;
}

// Convierte la respuesta de Open-Meteo al formato del widget
export function interpretarClima(json) {
  const c = json?.current;
  if (!c || typeof c.temperature_2m !== 'number') throw new Error('Respuesta de clima incompleta');
  const codigo = c.weather_code ?? -1;
  const uv = c.uv_index ?? 0;
  const uvMax = json.daily?.uv_index_max?.[0] ?? uv;
  const lluvia = (codigo >= 51 && codigo <= 67) || (codigo >= 80 && codigo <= 99);
  const datos = {
    temperatura: Math.round(c.temperature_2m),
    humedad: Math.round(c.relative_humidity_2m ?? 0),
    uv: Math.round(uv * 10) / 10,
    uvMax: Math.round(uvMax * 10) / 10,
    cielo: describirCielo(codigo),
    esDeDia: c.is_day === 1,
    lluvia,
    actualizado: c.time,
  };
  return { ...datos, nivel: nivelUV(datos.uvMax), consejos: recomendacionesPiel(datos) };
}

export async function obtenerClima(signal) {
  const res = await fetch(URL_CLIMA, { signal });
  if (!res.ok) throw new Error(`Open-Meteo respondió ${res.status}`);
  return interpretarClima(await res.json());
}
