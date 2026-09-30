// Exporta los datos de db.json a un Excel (.xlsx) listo para importar en la hoja de Google que usa n8n:
//   npm run sembrar:demo && npm run exportar:sheets
//   DOCTORA_TELEFONO="+506 7000 0000" npm run exportar:sheets   ← número real de WhatsApp de la doctora
// Una pestaña por tabla (users, appointments, portal, checkins, sosAlerts, accesos), con el mismo formato
// que escribe el flujo API (api/hojas.mjs): encabezados en la fila 1 y objetos/listas como JSON en su celda.
// Se usa .xlsx y no CSV porque conserva los tipos: el texto sigue siendo texto (fechas y teléfonos "+506"
// no se convierten) y los números y verdadero/falso llegan como tales, igual que los lee n8n.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { aFilas } from '../api/hojas.mjs';
import { TABLAS } from '../api/nucleo.mjs';

const ENTRADA = process.env.DB_FILE || 'db.json';
const SALIDA = process.env.SALIDA || 'datos-demo-sheets.xlsx';
const TELEFONO_DOCTORA = process.env.DOCTORA_TELEFONO || '';

const db = JSON.parse(fs.readFileSync(ENTRADA, 'utf8'));
// Los enlaces de acceso de desarrollo no se exportan: en n8n se generan nuevos
db.accesos = [];
if (TELEFONO_DOCTORA) {
  db.users = db.users.map((u) => (u.role === 'doctor' ? { ...u, phone: TELEFONO_DOCTORA } : u));
}

// ── Hojas en formato SpreadsheetML ──
const xml = (texto) => String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const columna = (i) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
const celda = (valor, ref) => {
  if (valor === '' || valor === undefined || valor === null) return '';
  if (typeof valor === 'number') return `<c r="${ref}"><v>${valor}</v></c>`;
  if (typeof valor === 'boolean') return `<c r="${ref}" t="b"><v>${valor ? 1 : 0}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(valor)}</t></is></c>`;
};
const hoja = (filas) =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
  filas.map((fila, i) => `<row r="${i + 1}">${fila.map((v, j) => celda(v, `${columna(j)}${i + 1}`)).join('')}</row>`).join('') +
  '</sheetData></worksheet>';

const archivos = {
  '[Content_Types].xml':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    TABLAS.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
    '</Types>',
  '_rels/.rels':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>',
  'xl/workbook.xml':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    TABLAS.map((t, i) => `<sheet name="${t}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
    '</sheets></workbook>',
  'xl/_rels/workbook.xml.rels':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    TABLAS.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
    '</Relationships>',
};
TABLAS.forEach((tabla, i) => {
  // Una pestaña vacía conserva al menos la columna id, que la API necesita para leerla
  const filas = db[tabla]?.length ? aFilas(db[tabla]) : [['id']];
  archivos[`xl/worksheets/sheet${i + 1}.xml`] = hoja(filas);
});

// ── Empaquetado ZIP (sin compresión: método "store") ──
function zip(entradas) {
  const locales = [];
  const centrales = [];
  let desplazamiento = 0;
  for (const [nombre, contenido] of Object.entries(entradas)) {
    const datos = Buffer.from(contenido, 'utf8');
    const nombreB = Buffer.from(nombre, 'utf8');
    const crc = zlib.crc32(datos);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(datos.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(nombreB.length, 26);
    locales.push(local, nombreB, datos);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(datos.length, 20);
    central.writeUInt32LE(datos.length, 24);
    central.writeUInt16LE(nombreB.length, 28);
    central.writeUInt32LE(desplazamiento, 42);
    centrales.push(central, nombreB);
    desplazamiento += local.length + nombreB.length + datos.length;
  }
  const directorio = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(Object.keys(entradas).length, 8);
  fin.writeUInt16LE(Object.keys(entradas).length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat([...locales, directorio, fin]);
}

fs.writeFileSync(SALIDA, zip(archivos));
console.log(`✓ ${SALIDA}: ${TABLAS.map((t) => `${t} (${db[t]?.length || 0})`).join(', ')}`);
if (!TELEFONO_DOCTORA) {
  console.log('⚠️  La doctora quedó con el número de demostración. Para recibir su enlace por WhatsApp: DOCTORA_TELEFONO="+506 …" npm run exportar:sheets');
}
