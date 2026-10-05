// Integración: las alertas urgentes del chat de WhatsApp (emergencia, despertar_doctora y IA sin respuesta)
// además del WhatsApp a la doctora quedan registradas en la API (POST /n8n/alerta) para el panel.
// Ejecuta el código REAL de los nodos Code del cerebro y revisa la configuración y las conexiones del nodo HTTP.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TIPOS_ALERTA_WHATSAPP } from '../../api/nucleo.mjs';

const flujo = JSON.parse(fs.readFileSync('n8n/flujos/cerebro-maestro-clinica.json', 'utf8'));
const nodo = (nombre) => flujo.nodes.find((n) => n.name === nombre);
const destinos = (origen, salida = 0) => (flujo.connections[origen]?.main[salida] || []).map((c) => c.node);
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

const PACIENTE = { from: '50688880001', nombre: 'Valeria', texto: 'Tengo la zona morada y me duele mucho' };
const correr = async (nombre, entrada) => {
  const $ = (n) => ({ first: () => ({ json: n === 'Red de seguridad clínica' ? { payload: PACIENTE } : {} }) });
  const $input = { first: () => ({ json: entrada }), all: () => [{ json: entrada }] };
  const salida = await new AsyncFunction('$', '$input', nodo(nombre).parameters.jsCode)($, $input);
  return salida.map((i) => i.json);
};

const API = 'API: registrar alerta';
const EMERGENCIA = 'Alerta para el panel · emergencia';
const ENFERMERA = 'Alerta para el panel · Enfermera';
const SIN_IA = 'Alerta para el panel · sin respuesta';

describe('cerebro: alertas para el panel de la doctora', () => {
  it('"API: registrar alerta" llama a /n8n/alerta con el secreto de n8n y nunca detiene el flujo', () => {
    const n = nodo(API);
    expect(n.type).toBe('n8n-nodes-base.httpRequest');
    expect(n.parameters).toMatchObject({
      method: 'POST',
      url: "={{ $('Configuración').first().json.apiUrl }}/n8n/alerta",
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json) }}',
    });
    expect(n.parameters.options.timeout).toBeLessThanOrEqual(10000);
    expect(n.onError).toBe('continueRegularOutput');
    expect(n.maxTries).toBeLessThanOrEqual(2);
    // Credencial por nombre (al importar, n8n la enlaza con la de ese nombre)
    expect(n.credentials).toEqual({ httpHeaderAuth: { name: 'Clínica · Secreto n8n' } });
    expect(flujo.connections[API]).toBeUndefined(); // es el final de la rama
  });

  it('las tres rutas llegan al nodo y SIGUEN avisando por WhatsApp como antes', () => {
    expect(destinos('¿Emergencia?', 0)).toEqual(expect.arrayContaining(['Alerta de emergencia', 'Respuesta de emergencia', EMERGENCIA]));
    expect(destinos('Alerta de emergencia')).toEqual(['Enviar WhatsApp (plantilla)']);
    expect(destinos('Respuesta de emergencia')).toEqual(['Responder por WhatsApp (texto)']);
    expect(destinos('Agente IA 1 · Enfermera Virtual')).toEqual(['Respuesta · Enfermera', ENFERMERA]);
    for (const r of ['Respuesta · Enfermera', 'Respuesta · Recepcionista']) {
      expect(destinos(r)).toEqual(['Responder por WhatsApp (texto)', 'Aviso: mensaje sin responder', SIN_IA]);
    }
    expect(destinos('Aviso: mensaje sin responder')).toEqual(['Enviar WhatsApp (plantilla)']);
    for (const n of [EMERGENCIA, ENFERMERA, SIN_IA]) expect(destinos(n)).toEqual([API]);
    // despertar_doctora sigue siendo la herramienta de WhatsApp de la Enfermera
    expect(flujo.connections.despertar_doctora.ai_tool[0]).toEqual([{ node: 'Agente IA 1 · Enfermera Virtual', type: 'ai_tool', index: 0 }]);
  });

  it('n8n (orden v1, de arriba abajo) ejecuta el aviso por WhatsApp ANTES de registrar la alerta', () => {
    const y = (n) => nodo(n).position[1];
    expect(flujo.settings.executionOrder).toBe('v1');
    expect(y(EMERGENCIA)).toBeGreaterThan(Math.max(y('Alerta de emergencia'), y('Respuesta de emergencia')));
    expect(y(ENFERMERA)).toBeGreaterThan(y('Respuesta · Enfermera'));
    expect(y(SIN_IA)).toBeGreaterThan(Math.max(y('Aviso: mensaje sin responder'), y('Responder por WhatsApp (texto)')));
  });

  it('emergencia: registra teléfono, nombre, señal y lo que escribió la paciente', async () => {
    const [a] = await correr(EMERGENCIA, { ruta: 'emergencia', senal: 'no puedo respirar', payload: { ...PACIENTE, texto: 'Ayuda, no puedo respirar' } });
    expect(a).toEqual({
      telefono: '50688880001', nombre: 'Valeria', origen: 'whatsapp', tipo: 'emergencia',
      motivo: 'Señal de alarma en el chat: "no puedo respirar"', nota: 'Escribió: Ayuda, no puedo respirar',
    });
    expect(TIPOS_ALERTA_WHATSAPP).toContain(a.tipo);
  });

  it('despertar_doctora: el agente devuelve sus pasos y se registra la alerta con el motivo de la IA', async () => {
    expect(nodo('Agente IA 1 · Enfermera Virtual').parameters.options.returnIntermediateSteps).toBe(true);
    // Forma real de intermediateSteps del AI Agent v3.1 (utils/agent-execution/buildSteps de n8n 2.38)
    const pasos = [
      { action: { tool: 'ficha_paciente', toolInput: {}, toolCallId: 'c1', type: 'tool_call' }, observation: '{}' },
      { action: { tool: 'despertar_doctora', toolInput: { motivo: '  Zona morada\n y dolor que aumenta ' }, toolCallId: 'c2', type: 'tool_call' }, observation: '{}' },
    ];
    const [a] = await correr(ENFERMERA, { output: 'Ya le escribí a la doctora.', intermediateSteps: pasos });
    expect(a).toMatchObject({ telefono: '50688880001', nombre: 'Valeria', tipo: 'enfermera', origen: 'whatsapp', motivo: 'Zona morada y dolor que aumenta' });
    expect(a.nota).toBe('Escribió: Tengo la zona morada y me duele mucho');
  });

  it('si la Enfermera no despertó a la doctora (o el agente falló) no se registra nada', async () => {
    expect(await correr(ENFERMERA, { output: 'Todo normal', intermediateSteps: [{ action: { tool: 'base_clinica', toolInput: {} } }] })).toEqual([]);
    expect(await correr(ENFERMERA, { output: 'Hola' })).toEqual([]);
    expect(await correr(ENFERMERA, { error: 'The model is overloaded' })).toEqual([]);
  });

  it('IA sin respuesta: solo cuando la paciente recibió el mensaje de espera', async () => {
    expect(await correr(SIN_IA, { to: '50688880001', texto: 'Hola', sinIA: false, agente: 'Enfermera' })).toEqual([]);
    const [a] = await correr(SIN_IA, { to: '50688880001', texto: 'Recibimos tu mensaje…', sinIA: true, agente: 'Recepcionista' });
    expect(a).toMatchObject({ telefono: '50688880001', tipo: 'ia_sin_respuesta', origen: 'whatsapp' });
    expect(a.motivo).toContain('Recepcionista');
  });
});
