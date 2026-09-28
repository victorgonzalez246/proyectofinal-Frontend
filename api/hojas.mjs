// ============================================================
// TABLAS ↔ GOOGLE SHEETS
// Cada tabla del núcleo es una pestaña: la fila 1 tiene los nombres de columna y cada fila
// siguiente es un registro. Los objetos y listas se guardan como JSON en su celda.
// Sin imports: n8n/generar-api.mjs copia este archivo dentro del nodo "Núcleo API".
// ============================================================

const aCelda = (valor) => {
  if (valor === undefined || valor === null) return '';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return valor;
};

const deCelda = (celda) => {
  if (celda === '' || celda === undefined || celda === null) return undefined;
  if (typeof celda === 'string' && /^[[{]/.test(celda)) {
    try { return JSON.parse(celda); } catch { return celda; }
  }
  return celda;
};

// Nombre de la pestaña a partir de un rango de la API ("'users'!A1:Z9" → "users")
export const pestanaDe = (rango) => String(rango).split('!')[0].replace(/^'|'$/g, '');

/**
 * Filas de una pestaña → { encabezados, registros, filaDe }.
 * `filaDe` guarda el número de fila de cada id para poder reescribirla en su lugar.
 */
export function leerPestana(valores = []) {
  const [encabezados = [], ...filas] = valores;
  const registros = [];
  const filaDe = {};
  filas.forEach((fila, i) => {
    const registro = {};
    encabezados.forEach((col, j) => {
      const valor = deCelda(fila[j]);
      if (col && valor !== undefined) registro[col] = valor;
    });
    if (registro.id !== undefined) {
      registro.id = String(registro.id);
      registros.push(registro);
      filaDe[registro.id] = i + 2; // fila 1 = encabezados
    }
  });
  return { encabezados: encabezados.map(String), registros, filaDe, ultimaFila: filas.length + 1 };
}

/**
 * Datos para values:batchUpdate con las filas que cambiaron.
 * Las filas nuevas se agregan al final; si aparece una columna nueva se reescribe el encabezado.
 */
export function escrituraDe(pestana, leida, registros) {
  const encabezados = [...leida.encabezados];
  for (const r of registros) for (const col of Object.keys(r)) if (!encabezados.includes(col)) encabezados.push(col);
  const data = [];
  if (encabezados.length !== leida.encabezados.length) {
    data.push({ range: `${pestana}!A1`, values: [encabezados] });
  }
  let siguiente = leida.ultimaFila + 1;
  for (const r of registros) {
    const fila = leida.filaDe[r.id] || siguiente++;
    data.push({ range: `${pestana}!A${fila}`, values: [encabezados.map((col) => aCelda(r[col]))] });
  }
  return data;
}

// Tabla completa → filas (para crear la hoja inicial o el simulador de Sheets)
export function aFilas(registros = []) {
  const encabezados = [];
  for (const r of registros) for (const col of Object.keys(r)) if (!encabezados.includes(col)) encabezados.push(col);
  return [encabezados, ...registros.map((r) => encabezados.map((col) => aCelda(r[col])))];
}
