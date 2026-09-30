// Integración: ejecuta el código REAL de los nodos del cerebro de n8n (n8n/flujos/cerebro-maestro-clinica.json)
// simulando lo que n8n les entrega ($ y $input), para comprobar las plantillas, los botones y el modo pruebas.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLANTILLAS } from '../../n8n/plantillas.mjs';

const flujo = JSON.parse(fs.readFileSync('n8n/flujos/cerebro-maestro-clinica.json', 'utf8'));
const nodo = (nombre) => flujo.nodes.find((n) => n.name === nombre);
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

const CONFIG = {
  portalUrl: 'https://clinica-dra-laura.vercel.app',
  clinicWhatsapp: '50662643156',
  templateLanguage: 'es',
  modoPruebas: 'no',
  numerosPrueba: '',
};

// Corre el jsCode de un nodo Code como lo haría n8n
const ejecutar = async (nombre, payload, config = {}) => {
  const cfg = { ...CONFIG, ...config };
  const $ = (n) => ({ first: () => ({ json: n === 'Configuración' ? cfg : {} }) });
  const $input = { first: () => ({ json: { payload } }), all: () => [{ json: { payload } }] };
  const salida = await new AsyncFunction('$', '$input', nodo(nombre).parameters.jsCode)($, $input);
  return salida.map((item) => item.json);
};

const doctora = { phone: '+506 8575 8780', name: 'Dra. Laura Jiménez', role: 'doctor', codigo: '482913', link: 'https://x/portal/verificar#t' };
const cita = { nombre: 'Andrea Solís', telefono: '8888 0003', tratamiento: 'Armonización Facial', fecha: '2026-10-15' };

describe('cerebro de n8n: plantillas y modo pruebas', () => {
  it('el acceso usa la plantilla de Autenticación con el código en el cuerpo y en el botón', async () => {
    const [m] = await ejecutar('Mensajes: acceso al portal', doctora);
    expect(m).toMatchObject({ to: '50685758780', template: 'codigo_acceso', params: ['482913'], boton: '482913' });
    expect(m.texto).toBe('*482913* es tu código de verificación. Por tu seguridad, no lo compartas. Vence en 15 minutos.');
  });

  it('la cita recibida no lleva el enlace como variable: va en el botón (y en el texto de pruebas)', async () => {
    const [paciente, clinica] = await ejecutar('Mensajes: cita recibida', { appointment: cita });
    expect(paciente.template).toBe('cita_recibida_v2');
    expect(paciente.params).toHaveLength(2);
    expect(paciente.params.join(' ')).not.toContain('Armonización'); // discreción: sin el tratamiento
    expect(paciente.texto).toContain('Hola Andrea');
    expect(paciente.texto).toContain('Ir a mi portal: https://clinica-dra-laura.vercel.app/portal/acceso');
    expect(clinica).toMatchObject({ to: '50662643156', template: 'nueva_solicitud_cita' });
  });

  it('el texto de pruebas rellena todas las variables de cada plantilla', async () => {
    const [paciente, clinica] = await ejecutar('Mensajes: cita recibida', { appointment: cita });
    for (const m of [paciente, clinica]) expect(m.texto).not.toMatch(/\{\{\d+\}\}/);
    expect(Object.keys(PLANTILLAS)).toContain(paciente.template);
  });

  it('en modo pruebas solo quedan los mensajes a los números de la lista', async () => {
    const sinPruebas = await ejecutar('Mensajes: cita recibida', { appointment: cita });
    expect(sinPruebas).toHaveLength(2);
    const enPruebas = await ejecutar('Mensajes: cita recibida', { appointment: cita }, { modoPruebas: 'si', numerosPrueba: '6264 3156' });
    expect(enPruebas.map((m) => m.to)).toEqual(['50662643156']); // la paciente ficticia se omite
    const doctoraEnLista = await ejecutar('Mensajes: acceso al portal', doctora, { modoPruebas: 'Si ', numerosPrueba: '+506 8575-8780, 50662643156' });
    expect(doctoraEnLista).toHaveLength(1);
  });

  it('el nodo de envío manda texto libre en modo pruebas y la plantilla con botón si no', () => {
    const cuerpo = nodo('Enviar WhatsApp (plantilla)').parameters.jsonBody;
    const CFG = "$('Configuración').first().json";
    const expresion = cuerpo.slice(cuerpo.indexOf('{{') + 2, cuerpo.lastIndexOf('}}')).replaceAll(CFG, 'cfg');
    const armar = (json, cfg) => JSON.parse(new Function('$json', 'cfg', `return ${expresion};`)(json, cfg));
    const m = { to: '50685758780', template: 'codigo_acceso', params: ['482913'], boton: '482913', texto: '*482913* es tu código…' };

    const plantilla = armar(m, { ...CONFIG });
    expect(plantilla.type).toBe('template');
    expect(plantilla.template.components).toEqual([
      { type: 'body', parameters: [{ type: 'text', text: '482913' }] },
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: '482913' }] },
    ]);

    const libre = armar(m, { ...CONFIG, modoPruebas: 'si' });
    expect(libre).toEqual({ messaging_product: 'whatsapp', to: '50685758780', type: 'text', text: { body: m.texto, preview_url: true } });
  });

  it('Configuración trae los campos del modo pruebas apagados por defecto', () => {
    const campos = Object.fromEntries(nodo('Configuración').parameters.assignments.assignments.map((a) => [a.name, a.value]));
    expect(campos.modoPruebas).toBe('no');
    expect(campos.numerosPrueba).toBe('');
  });
});
