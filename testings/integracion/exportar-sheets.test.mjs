// Integración: datos de demostración → Excel para importar en la hoja de Google que usa n8n.
// Lee el .xlsx generado (ZIP sin compresión) y comprueba pestañas, encabezados y tipos de celda.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { TABLAS } from '../../api/nucleo.mjs';

// Lector mínimo de ZIP "store": recorre los encabezados locales y verifica el CRC de cada archivo
const leerZip = (buffer) => {
  const archivos = {};
  let i = 0;
  while (buffer.readUInt32LE(i) === 0x04034b50) {
    const crc = buffer.readUInt32LE(i + 14);
    const tamano = buffer.readUInt32LE(i + 18);
    const largoNombre = buffer.readUInt16LE(i + 26);
    const nombre = buffer.toString('utf8', i + 30, i + 30 + largoNombre);
    const datos = buffer.subarray(i + 30 + largoNombre, i + 30 + largoNombre + tamano);
    if (zlib.crc32(datos) !== crc) throw new Error(`CRC inválido en ${nombre}`);
    archivos[nombre] = datos.toString('utf8');
    i += 30 + largoNombre + tamano;
  }
  return archivos;
};

const ejecutar = (script, env) => {
  const r = spawnSync(process.execPath, [script], { env: { ...process.env, ...env }, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout;
};

let archivos;
let salida;
beforeAll(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clinica-sheets-'));
  const db = path.join(dir, 'db.json');
  const xlsx = path.join(dir, 'demo.xlsx');
  ejecutar('scripts/sembrar-demo.mjs', { DB_FILE: db });
  salida = ejecutar('scripts/exportar-sheets.mjs', { DB_FILE: db, SALIDA: xlsx, DOCTORA_TELEFONO: '+506 7000 1234' });
  archivos = leerZip(fs.readFileSync(xlsx));
});

describe('exportación a Google Sheets (.xlsx)', () => {
  it('es un libro válido con una pestaña por tabla, con los nombres que espera n8n', () => {
    expect(Object.keys(archivos)).toContain('xl/workbook.xml');
    for (const tabla of TABLAS) expect(archivos['xl/workbook.xml']).toContain(`<sheet name="${tabla}"`);
    expect(salida).toContain('users (');
  });

  it('usa el número real de la doctora y no exporta enlaces de acceso', () => {
    const users = archivos['xl/worksheets/sheet1.xml'];
    expect(users).toContain('+506 7000 1234');
    expect(users).not.toContain('+506 8888 8888');
    const accesos = archivos[`xl/worksheets/sheet${TABLAS.indexOf('accesos') + 1}.xml`];
    expect(accesos.match(/<row /g)).toHaveLength(1); // solo el encabezado
  });

  it('conserva los tipos: texto como texto, números y verdadero/falso como tales', () => {
    const checkins = archivos[`xl/worksheets/sheet${TABLAS.indexOf('checkins') + 1}.xml`];
    expect(checkins).toMatch(/t="b"><v>[01]<\/v>/); // needsFollowUp
    expect(checkins).toMatch(/<c r="[A-Z]+\d+"><v>\d+<\/v><\/c>/); // pain numérico
    // Fechas y teléfonos van como texto (Sheets no los convierte)
    expect(archivos['xl/worksheets/sheet1.xml']).toMatch(/t="inlineStr"><is><t xml:space="preserve">\+506/);
  });

  it('guarda objetos y listas como JSON en su celda, igual que el flujo API', () => {
    const portal = archivos[`xl/worksheets/sheet${TABLAS.indexOf('portal') + 1}.xml`];
    expect(portal).toContain('[{&quot;id&quot;:&quot;r1&quot;');
  });
});
