// Integración: REVISION-DOCTORA.md → lector → nodos REALES del cerebro (recordatorio y red de seguridad) y CSV de la Base clínica
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ARCHIVO_CSV, TRATAMIENTOS, baseClinicaCsv, cargarContenidoClinico, leerContenidoClinico, listaNatural,
} from '../../n8n/contenido-clinico.mjs';

const md = fs.readFileSync('REVISION-DOCTORA.md', 'utf8');
const flujo = JSON.parse(fs.readFileSync('n8n/flujos/cerebro-maestro-clinica.json', 'utf8'));
const nodo = (nombre) => flujo.nodes.find((n) => n.name === nombre);
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const ejecutar = async (nombre, payload) => {
  const cfg = { modoPruebas: 'no', templateLanguage: 'es', portalUrl: 'https://x' };
  const $ = () => ({ first: () => ({ json: cfg }) });
  const $input = { first: () => ({ json: { payload, items: payload } }) };
  return (await new AsyncFunction('$', '$input', nodo(nombre).parameters.jsCode)($, $input)).map((i) => i.json);
};

describe('REVISION-DOCTORA.md: contenido clínico editable', () => {
  it('se lee sin errores y trae las cuatro secciones', () => {
    const c = cargarContenidoClinico();
    expect(Object.keys(c.instrucciones).length).toBeGreaterThan(0);
    expect(c.general).toBeTruthy();
    expect(c.senales).toContain('no puedo respirar');
    expect(c.motivos.length).toBeGreaterThan(0);
    expect(c.base.length).toBeGreaterThan(0);
  });

  it('los tratamientos son los mismos del formulario de cita', () => {
    const formulario = fs.readFileSync('src/components/landing/AppointmentSection.jsx', 'utf8');
    for (const t of TRATAMIENTOS) expect(formulario).toContain(`'${t}'`);
  });

  it('el CSV de la Base clínica está al día con el archivo (correr npm run generar:n8n)', () => {
    expect(fs.readFileSync(ARCHIVO_CSV, 'utf8')).toBe(baseClinicaCsv(cargarContenidoClinico()));
  });

  it('el cerebro generado usa los textos del archivo', async () => {
    const c = cargarContenidoClinico();
    expect(nodo('Agente IA 1 · Enfermera Virtual').parameters.options.systemMessage).toContain(listaNatural(c.motivos));

    const [m] = await ejecutar('Mensajes: recordatorio 24 h', [
      { nombre: 'Ana Mora', telefono: '88880001', tratamiento: 'Labios de Alta Definición', fecha: '2026-10-15', hora: '10:00' },
    ]);
    expect(m.params[3]).toBe(c.instrucciones['Labios de Alta Definición']);
    const [general] = await ejecutar('Mensajes: recordatorio 24 h', [{ nombre: 'Ana', telefono: '88880001', tratamiento: 'Valoración General', fecha: '2026-10-15' }]);
    expect(general.params[3]).toBe(c.general);
  });

  it('la red de seguridad detecta las señales con o sin tildes', async () => {
    const [r] = await ejecutar('Red de seguridad clínica', { texto: 'Doctora, PERDÍ LA VISTA de un ojo' });
    expect(r).toMatchObject({ ruta: 'emergencia', senal: 'perdi la vista' });
    const [tranquila] = await ejecutar('Red de seguridad clínica', { texto: 'Hola, ¿puedo hacer ejercicio?' });
    expect(tranquila.ruta).toBe('conversacion');
  });

  it('al aprobarlo, el CSV ya no lleva la fila de aviso de borrador', () => {
    const aprobado = leerContenidoClinico(md.replace('Aprobado por la doctora: no', 'Aprobado por la doctora: **sí**'));
    expect(aprobado.aprobado).toBe(true);
    expect(baseClinicaCsv(aprobado)).not.toContain('EJEMPLO');
    expect(baseClinicaCsv(cargarContenidoClinico())).toContain('EJEMPLO');
  });

  it('un error de formato dice qué línea corregir', () => {
    const roto = md
      .replace('- Rinomodelación Sin Cirugía:', '- Rinoplastia:')
      .replace('Te contactamos ya. | alto |', 'Te contactamos ya. | urgente |')
      .replace('- General: Llega', 'General: Llega');
    let mensaje = '';
    try { leerContenidoClinico(roto); } catch (err) { mensaje = err.message; }
    expect(mensaje).toMatch(/"Rinoplastia" no es un tratamiento/);
    expect(mensaje).toMatch(/el riesgo debe ser bajo, medio o alto/);
    expect(mensaje).toMatch(/Línea \d+: cada elemento debe empezar con "- "/);
    expect(() => leerContenidoClinico(md.replace('<!-- bloque:senales -->', ''))).toThrow(/Falta la marca/);
  });
});
