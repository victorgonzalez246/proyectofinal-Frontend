// Contenido clínico que revisa y aprueba la doctora (fuente única: REVISION-DOCTORA.md en la raíz).
// Lo usan generar-cerebro.mjs (instrucciones previas, señales de emergencia, motivos de aviso de la Enfermera)
// y la Base clínica (n8n/base-clinica-ejemplo.csv, que se copia a la hoja de Google).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ARCHIVO_REVISION = path.join(HERE, '..', 'REVISION-DOCTORA.md');
export const ARCHIVO_CSV = path.join(HERE, 'base-clinica-ejemplo.csv');

// Mismos nombres que el formulario de cita (src/components/landing/AppointmentSection.jsx)
export const TRATAMIENTOS = [
  'Armonización Facial',
  'Bioestimuladores de Colágeno',
  'Rejuvenecimiento de Mirada',
  'Labios de Alta Definición',
  'Skinbooster & Mesoterapia',
  'Rinomodelación Sin Cirugía',
  'Valoración General',
];
const RIESGOS = ['bajo', 'medio', 'alto'];
const AVISO_BORRADOR = 'EJEMPLO - LA DOCTORA DEBE VALIDAR CADA FILA ANTES DE USARLA';

// Igual que la "Red de seguridad clínica": minúsculas y sin tildes
export const normalizar = (texto) => String(texto).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Lee el texto de REVISION-DOCTORA.md y devuelve el contenido validado. Lanza un error que dice qué corregir. */
export function leerContenidoClinico(md) {
  const lineas = md.replace(/\r\n/g, '\n').split('\n');
  const errores = [];
  const bloque = (id) => {
    const inicio = lineas.findIndex((l) => l.trim() === `<!-- bloque:${id} -->`);
    if (inicio < 0) {
      errores.push(`Falta la marca <!-- bloque:${id} -->`);
      return [];
    }
    const fin = lineas.findIndex((l, i) => i > inicio && l.trim() === '<!-- fin -->');
    if (fin < 0) {
      errores.push(`Falta <!-- fin --> después de <!-- bloque:${id} -->`);
      return [];
    }
    return lineas.slice(inicio + 1, fin).map((texto, i) => ({ texto: texto.trim(), n: inicio + i + 2 })).filter((l) => l.texto);
  };
  const vinetas = (id) =>
    bloque(id).flatMap(({ texto, n }) => {
      if (!texto.startsWith('- ')) {
        errores.push(`Línea ${n}: cada elemento debe empezar con "- " → ${texto}`);
        return [];
      }
      return [{ texto: texto.slice(2).trim(), n }];
    });

  // 1. Instrucciones previas
  const instrucciones = {};
  let general = '';
  for (const { texto, n } of vinetas('instrucciones')) {
    const dosPuntos = texto.indexOf(':');
    const nombre = texto.slice(0, dosPuntos).trim();
    const valor = texto.slice(dosPuntos + 1).trim();
    if (dosPuntos < 0 || !valor) errores.push(`Línea ${n}: escribe "Tratamiento: instrucción" → ${texto}`);
    else if (nombre === 'General') general = valor;
    else if (!TRATAMIENTOS.includes(nombre)) errores.push(`Línea ${n}: "${nombre}" no es un tratamiento. Usa uno de: ${TRATAMIENTOS.join(', ')} o General`);
    else if (instrucciones[nombre]) errores.push(`Línea ${n}: "${nombre}" aparece dos veces`);
    else instrucciones[nombre] = valor;
  }
  if (!general) errores.push('Instrucciones: falta la línea "- General: ..."');

  // 2. Señales de emergencia (normalizadas para compararlas con el mensaje de la paciente)
  const senales = [...new Set(vinetas('senales').map(({ texto }) => normalizar(texto)))];
  if (!senales.length) errores.push('Señales de emergencia: la lista no puede quedar vacía');
  for (const s of senales) if (s.length < 4) errores.push(`Señal "${s}": muy corta, detectaría mensajes que no son emergencias`);

  // 3. Motivos para que la Enfermera avise a la doctora
  const motivos = vinetas('motivos').map(({ texto }) => texto.replace(/[.;,]+$/, ''));
  if (!motivos.length) errores.push('Cuándo la Enfermera avisa: la lista no puede quedar vacía');

  // 4. Base clínica (tabla Markdown)
  const base = [];
  for (const { texto, n } of bloque('base')) {
    if (/^\|?\s*:?-{3,}/.test(texto)) continue; // separador |---|
    if (!texto.startsWith('|')) {
      errores.push(`Línea ${n}: cada fila de la base clínica debe empezar con "|"`);
      continue;
    }
    const celdas = texto.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    if (normalizar(celdas[0]) === 'tema') continue; // encabezado
    if (celdas.length !== 4) {
      errores.push(`Línea ${n}: la fila debe tener 4 columnas (Tema | Pregunta | Respuesta | Riesgo) y tiene ${celdas.length}. ¿Usaste "|" dentro del texto?`);
      continue;
    }
    const [tema, pregunta, respuesta, riesgo] = celdas;
    if (!tema || !pregunta || !respuesta) errores.push(`Línea ${n}: tema, pregunta y respuesta son obligatorios`);
    else if (!RIESGOS.includes(normalizar(riesgo))) errores.push(`Línea ${n}: el riesgo debe ser bajo, medio o alto (dice "${riesgo}")`);
    else base.push({ tema, pregunta, respuesta, riesgo: normalizar(riesgo) });
  }
  if (!base.length) errores.push('Base clínica: no tiene ninguna fila');

  // Aprobación
  const textoAprobado = normalizar(bloque('aprobado').map((l) => l.texto).join(' '));
  const aprobado = /:\s*\**\s*si\b/.test(textoAprobado);

  if (errores.length) {
    throw new Error(`REVISION-DOCTORA.md tiene ${errores.length} error(es):\n  - ${errores.join('\n  - ')}`);
  }
  return { instrucciones, general, senales, motivos, base, aprobado };
}

export const cargarContenidoClinico = () => leerContenidoClinico(fs.readFileSync(ARCHIVO_REVISION, 'utf8'));

// "a, b, c, o d": lista natural para el prompt de la Enfermera
export const listaNatural = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')}, o ${items.at(-1)}`);

/** CSV de la hoja BaseClinica. Mientras no esté aprobado, la primera fila avisa que es un ejemplo. */
export function baseClinicaCsv({ base, aprobado }) {
  const campo = (v, siempre = false) => (siempre || /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const filas = [
    'tema,pregunta,respuesta,nivel_riesgo',
    ...(aprobado ? [] : [`${AVISO_BORRADOR},,,`]),
    ...base.map((f) => [campo(f.tema), campo(f.pregunta), campo(f.respuesta, true), f.riesgo].join(',')),
  ];
  return `${filas.join('\r\n')}\r\n`;
}
