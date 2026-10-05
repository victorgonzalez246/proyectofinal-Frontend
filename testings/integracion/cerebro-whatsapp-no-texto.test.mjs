// Integración: notas de voz, fotos, botones y demás mensajes de WhatsApp que no son texto simple.
// Ejecuta el código REAL de los nodos Code del cerebro (n8n/flujos/cerebro-maestro-clinica.json) como lo haría n8n;
// de los nodos HTTP, Gemini y agentes se comprueba la configuración y las conexiones.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const flujo = JSON.parse(fs.readFileSync('n8n/flujos/cerebro-maestro-clinica.json', 'utf8'));
const parche = JSON.parse(fs.readFileSync('n8n/flujos/parche-cloud-notas-de-voz-y-fotos.json', 'utf8'));
const nodo = (nombre) => flujo.nodes.find((n) => n.name === nombre);
const destinos = (origen, salida = 0) => (flujo.connections[origen]?.main[salida] || []).map((c) => c.node);
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

const CONFIG = { clinicWhatsapp: '50662643156', modoPruebas: 'no', numerosPrueba: '', graphApiVersion: 'v26.0' };
const PACIENTE = '50688880001';

// Corre el jsCode de un nodo Code: `entrada` es el item que recibe ({ json, binary }); `nodos`, lo que dan otros nodos con $('...')
const correr = async (nombre, entrada, nodos = {}) => {
  const $ = (n) => ({ first: () => ({ json: nodos[n] ?? {} }) });
  const $input = { first: () => entrada, all: () => [entrada] };
  return new AsyncFunction('$', '$input', nodo(nombre).parameters.jsCode)($, $input);
};

const webhook = (value) => ({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value }] }] });
const entrante = (mensaje, from = PACIENTE) =>
  webhook({ contacts: [{ profile: { name: 'Valeria' } }], messages: [{ from, id: 'wamid.1', ...mensaje }] });
const AUDIO = { type: 'audio', audio: { id: 'media.audio', mime_type: 'audio/ogg; codecs=opus', voice: true } };
const FOTO = (caption) => ({ type: 'image', image: { id: 'media.foto', mime_type: 'image/jpeg', ...(caption ? { caption } : {}) } });
const ARCHIVO = (mimeType) => ({ data: { data: 'AAAA', mimeType, fileName: 'medio' } });

// Recorre el chat como n8n: Normalizar → Revisar adjunto → (Meta → Revisar descarga → Gemini → Texto) → Red de seguridad
// meta: lo que responden Meta y Gemini ({ info, transcripcion, falla })
const chat = async (webhookMeta, { config = {}, meta = {} } = {}) => {
  const [normalizado] = await correr('Normalizar mensaje', { json: webhookMeta });
  if (!normalizado) return { ignorado: true };
  const [adjunto] = await correr('Revisar adjunto', normalizado, { Configuración: { ...CONFIG, ...config } });
  if (!adjunto) return { sinRespuesta: true };
  let hacia = adjunto;
  const tipo = adjunto.json.payload.tipo;
  if (tipo === 'audio' || tipo === 'imagen') {
    const info = meta.falla
      ? { error: { message: 'Bad request' } }
      : { url: 'https://lookaside.fbsbx.com/x', file_size: 1000, ...(meta.info || {}) };
    const descarga = meta.falla
      ? { json: { error: { message: 'Invalid URL' } } }
      : { json: {}, binary: ARCHIVO(tipo === 'audio' ? 'audio/ogg' : 'image/jpeg') };
    [hacia] = await correr('Revisar descarga', descarga, { 'Revisar adjunto': adjunto.json, 'Meta: datos del medio': info });
    if (hacia.json.payload.tipo === 'audio') {
      const gemini = { content: { parts: [{ text: meta.transcripcion ?? '' }] } };
      [hacia] = await correr('Texto de la nota de voz', { json: gemini }, { 'Revisar adjunto': adjunto.json });
    }
  }
  const [seguridad] = await correr('Red de seguridad clínica', hacia);
  const resultado = { ruta: seguridad.json.ruta, payload: seguridad.json.payload, binary: seguridad.binary };
  if (seguridad.json.ruta === 'no_soportado') {
    const salida = await correr('Respuesta: formato no soportado', { json: {} }, { 'Red de seguridad clínica': seguridad.json });
    resultado.respuestas = salida.map((i) => i.json);
  }
  return resultado;
};

describe('cerebro de n8n: notas de voz', () => {
  it('la nota de voz se transcribe y pasa como texto marcado a la IA y a la memoria', async () => {
    const r = await chat(entrante(AUDIO), { meta: { transcripcion: 'Hola, quería saber si puedo hacer ejercicio mañana' } });
    expect(r.ruta).toBe('conversacion');
    expect(r.payload.texto).toBe('[Nota de voz transcrita] Hola, quería saber si puedo hacer ejercicio mañana');
    // Los agentes leen ese texto (y la memoria lo guarda como el mensaje de la paciente)
    expect(nodo('Agente IA 1 · Enfermera Virtual').parameters.text).toBe("={{ $('Red de seguridad clínica').first().json.payload.texto }}");
  });

  it('la red de seguridad revisa la transcripción ANTES de la IA (emergencia y BAJA)', async () => {
    expect((await chat(entrante(AUDIO), { meta: { transcripcion: 'Ayuda, no puedo respirar bien' } })).ruta).toBe('emergencia');
    expect((await chat(entrante(AUDIO), { meta: { transcripcion: 'Baja.' } })).ruta).toBe('baja');
  });

  it('si Meta o Gemini fallan, la paciente recibe una respuesta amable pidiendo que lo escriba', async () => {
    for (const meta of [{ falla: true }, { transcripcion: '' }, { transcripcion: '[inaudible]' }, { info: { file_size: 17 * 1024 * 1024 } }]) {
      const r = await chat(entrante(AUDIO), { meta });
      expect(r.ruta).toBe('no_soportado');
      expect(r.respuestas).toEqual([{ to: PACIENTE, texto: expect.stringContaining('nota de voz') }]);
    }
  });

  it('Meta → descarga → Gemini están configurados y conectados', () => {
    const info = nodo('Meta: datos del medio').parameters;
    expect(info.url).toBe("=https://graph.facebook.com/{{ $('Configuración').first().json.graphApiVersion }}/{{ $json.payload.mediaId }}");
    expect(info.genericAuthType).toBe('httpHeaderAuth');
    const descarga = nodo('Meta: descargar medio').parameters;
    expect(descarga.url).toBe('={{ $json.url }}');
    expect(descarga.genericAuthType).toBe('httpHeaderAuth');
    expect(descarga.options.response.response).toEqual({ responseFormat: 'file', outputPropertyName: 'data' });
    for (const n of ['Meta: datos del medio', 'Meta: descargar medio', 'Gemini · Transcribir nota de voz']) {
      expect(nodo(n).onError).toBe('continueRegularOutput');
    }

    const gemini = nodo('Gemini · Transcribir nota de voz');
    expect(gemini.type).toBe('@n8n/n8n-nodes-langchain.googleGemini');
    expect(gemini.parameters).toMatchObject({ resource: 'audio', operation: 'analyze', inputType: 'binary', binaryPropertyName: 'data' });
    expect(gemini.parameters.modelId.value).toBe('models/gemini-3.5-flash');
    expect(JSON.stringify(flujo)).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/); // ninguna API key en el repo

    expect(destinos('Router por acción', 0)).toEqual(['Revisar adjunto']);
    expect(destinos('Revisar adjunto')).toEqual(['¿Nota de voz o foto?']);
    expect(destinos('¿Nota de voz o foto?', 0)).toEqual(['Meta: datos del medio']);
    expect(destinos('¿Nota de voz o foto?', 1)).toEqual(['Meta: datos del medio']);
    expect(destinos('¿Nota de voz o foto?', 2)).toEqual(['Red de seguridad clínica']);
    expect(destinos('Meta: datos del medio')).toEqual(['Meta: descargar medio']);
    expect(destinos('Meta: descargar medio')).toEqual(['Revisar descarga']);
    expect(destinos('Revisar descarga')).toEqual(['¿Es nota de voz?']);
    expect(destinos('¿Es nota de voz?', 0)).toEqual(['Gemini · Transcribir nota de voz']);
    expect(destinos('¿Es nota de voz?', 1)).toEqual(['Red de seguridad clínica']);
    expect(destinos('Gemini · Transcribir nota de voz')).toEqual(['Texto de la nota de voz']);
    expect(destinos('Texto de la nota de voz')).toEqual(['Red de seguridad clínica']);
  });
});

describe('cerebro de n8n: modelos de IA (Google Gemini)', () => {
  const CREDENCIAL = { googlePalmApi: { name: 'Gemini - Aura y WhatsApp' } };

  const REINTENTOS = { retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 };

  it('los 5 modelos son Gemini Chat Model con el modelo, la temperatura, la credencial y los reintentos esperados', () => {
    const esperado = {
      'Modelo · Enfermera': ['models/gemini-3.6-flash', {}, 'Agente IA 1 · Enfermera Virtual'],
      'Modelo · Recepcionista': ['models/gemini-3.6-flash', {}, 'Agente IA 2 · Recepcionista VIP'],
      'Modelo · Clasificador': ['models/gemini-3.5-flash-lite', { temperature: 0 }, 'Clasificador de intención'],
      'Modelo · Analista': ['models/gemini-3.5-flash-lite', { temperature: 0 }, 'Enfermera · Analista emocional'],
      'Modelo · Resumen': ['models/gemini-3.5-flash-lite', { temperature: 0.2 }, 'Recepcionista · Resumen ejecutivo'],
    };
    for (const [nombre, [modelName, options, destino]] of Object.entries(esperado)) {
      const n = nodo(nombre);
      expect(n.type).toBe('@n8n/n8n-nodes-langchain.lmChatGoogleGemini');
      expect(n.typeVersion).toBe(1.1);
      expect(n.parameters).toEqual({ modelName, options });
      expect(n).toMatchObject(REINTENTOS);
      // Solo el nombre: sin id ni clave en el repo
      expect(n.credentials).toEqual(CREDENCIAL);
      // Modelo principal: entrada 0 del nodo de IA
      expect(flujo.connections[nombre].ai_languageModel[0]).toEqual([{ node: destino, type: 'ai_languageModel', index: 0 }]);
    }
    expect(nodo('Gemini · Transcribir nota de voz').credentials).toEqual(CREDENCIAL);
    expect(nodo('Gemini · Transcribir nota de voz')).toMatchObject(REINTENTOS);
  });

  it('cada agente tiene un modelo de respaldo (Fallback Model) Flash-Lite en la entrada 1', () => {
    for (const [agente, respaldo] of [
      ['Agente IA 1 · Enfermera Virtual', 'Modelo respaldo · Enfermera'],
      ['Agente IA 2 · Recepcionista VIP', 'Modelo respaldo · Recepcionista'],
    ]) {
      const a = nodo(agente);
      expect(a.typeVersion).toBe(3.1);
      expect(a.parameters.needsFallback).toBe(true);
      const r = nodo(respaldo);
      expect(r.type).toBe('@n8n/n8n-nodes-langchain.lmChatGoogleGemini');
      expect(r.parameters).toEqual({ modelName: 'models/gemini-3.5-flash-lite', options: {} });
      expect(r).toMatchObject(REINTENTOS);
      expect(r.credentials).toEqual(CREDENCIAL);
      expect(flujo.connections[respaldo].ai_languageModel[0]).toEqual([{ node: agente, type: 'ai_languageModel', index: 1 }]);
    }
    // 5 modelos + 2 de respaldo
    expect(flujo.nodes.filter((n) => n.type.endsWith('lmChatGoogleGemini'))).toHaveLength(7);
  });

  it('no queda ningún nodo ni referencia de Anthropic/Claude en los flujos', () => {
    expect(flujo.nodes.some((n) => /anthropic/i.test(n.type))).toBe(false);
    for (const f of [flujo, parche]) expect(JSON.stringify(f)).not.toMatch(/anthropic|claude/i);
  });
});

describe('cerebro de n8n: fotos', () => {
  it('la foto llega al agente como imagen (binario) y el pie de foto como texto', async () => {
    const r = await chat(entrante(FOTO('Así amanecí hoy, día 3')));
    expect(r.ruta).toBe('conversacion');
    expect(r.payload.texto).toBe('[Foto enviada: Así amanecí hoy, día 3]');
    expect(r.binary.data.mimeType).toBe('image/jpeg');
    for (const agente of ['Agente IA 1 · Enfermera Virtual', 'Agente IA 2 · Recepcionista VIP']) {
      expect(nodo(agente).parameters.options.passthroughBinaryImages).toBe(true);
    }
    expect((await chat(entrante(FOTO()))).payload.texto).toBe('[Foto enviada]');
  });

  it('una emergencia en el pie de foto va a la red de seguridad, sin IA', async () => {
    expect((await chat(entrante(FOTO('No puedo respirar bien')))).ruta).toBe('emergencia');
  });

  it('una foto demasiado grande o que no es imagen no llega a la IA', async () => {
    const grande = await chat(entrante(FOTO('mira')), { meta: { info: { file_size: 6 * 1024 * 1024 } } });
    expect(grande.ruta).toBe('no_soportado');
    expect(grande.respuestas[0].texto).toContain('foto');
    const rara = await chat(entrante(FOTO('mira')), { meta: { info: { mime_type: 'application/pdf' } } });
    expect(rara.ruta).toBe('no_soportado');
  });

  it('los prompts piden prudencia con las fotos y despertar a la doctora ante signos de alarma', () => {
    const enfermera = nodo('Agente IA 1 · Enfermera Virtual').parameters.options.systemMessage;
    expect(enfermera).toContain('[Foto enviada]');
    expect(enfermera).toContain('sin diagnosticar');
    expect(enfermera).toMatch(/necrosis[\s\S]*despertar_doctora/);
    expect(nodo('Agente IA 2 · Recepcionista VIP').parameters.options.systemMessage).toContain('[Nota de voz transcrita]');
  });
});

describe('cerebro de n8n: otros mensajes de WhatsApp', () => {
  it('video, documento, ubicación y contacto reciben la respuesta corta, sin IA', async () => {
    for (const mensaje of [
      { type: 'video', video: { id: 'm' } },
      { type: 'document', document: { id: 'm', filename: 'receta.pdf' } },
      { type: 'location', location: { latitude: 9.9, longitude: -84.1 } },
      { type: 'contacts', contacts: [{ name: { formatted_name: 'Ana' } }] },
      { type: 'unsupported' },
    ]) {
      const r = await chat(entrante(mensaje));
      expect(r.ruta, mensaje.type).toBe('no_soportado');
      expect(r.respuestas, mensaje.type).toEqual([{ to: PACIENTE, texto: expect.stringContaining('escuchar notas de voz y ver fotos') }]);
    }
    expect(destinos('¿Emergencia?', 3)).toEqual(['Respuesta: formato no soportado']);
    expect(destinos('Respuesta: formato no soportado')).toEqual(['Responder por WhatsApp (texto)']);
  });

  it('un botón o una opción de lista se tratan como texto con su título', async () => {
    const boton = await chat(entrante({ type: 'button', button: { text: 'Confirmar', payload: 'CONFIRMAR' } }));
    expect(boton).toMatchObject({ ruta: 'conversacion', payload: { from: PACIENTE, texto: 'Confirmar', tipo: 'texto' } });
    const respuesta = await chat(entrante({ type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'b1', title: 'Quiero agendar' } } }));
    expect(respuesta.payload.texto).toBe('Quiero agendar');
    const lista = await chat(entrante({ type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'l1', title: 'Martes 10:00' } } }));
    expect(lista.payload.texto).toBe('Martes 10:00');
    expect((await chat(entrante({ type: 'button', button: { text: 'BAJA', payload: 'BAJA' } }))).ruta).toBe('baja');
  });

  it('el texto normal sigue igual', async () => {
    const r = await chat(entrante({ type: 'text', text: { body: 'Hola, ¿cómo están?' } }));
    expect(r).toMatchObject({ ruta: 'conversacion', payload: { texto: 'Hola, ¿cómo están?', nombre: 'Valeria' } });
    expect(r.binary).toBeUndefined();
  });

  it('reacciones, stickers, estados de entrega y avisos del sistema se ignoran', async () => {
    expect(await chat(entrante({ type: 'reaction', reaction: { message_id: 'wamid.0', emoji: '❤️' } }))).toEqual({ ignorado: true });
    expect(await chat(entrante({ type: 'sticker', sticker: { id: 'm' } }))).toEqual({ ignorado: true });
    expect(await chat(entrante({ type: 'system', system: { body: 'cambió de número' } }))).toEqual({ ignorado: true });
    expect(await chat(webhook({ statuses: [{ id: 'wamid.0', status: 'read', recipient_id: PACIENTE }] }))).toEqual({ ignorado: true });
  });

  it('en modo pruebas, audios, fotos y otros formatos de números fuera de numerosPrueba no se procesan ni se responden', async () => {
    const pruebas = { modoPruebas: 'si', numerosPrueba: '50685758780' };
    for (const m of [AUDIO, FOTO('hola'), { type: 'video', video: { id: 'm' } }]) {
      expect(await chat(entrante(m), { config: pruebas, meta: { transcripcion: 'hola' } })).toEqual({ sinRespuesta: true });
    }
    const dentro = await chat(entrante(AUDIO), {
      config: { modoPruebas: 'Si ', numerosPrueba: '50685758780, +506 8888-0001' },
      meta: { transcripcion: 'hola' },
    });
    expect(dentro.ruta).toBe('conversacion');
  });

  it('Configuración usa una versión vigente de la Graph API', () => {
    const campos = Object.fromEntries(nodo('Configuración').parameters.assignments.assignments.map((a) => [a.name, a.value]));
    expect(Number(campos.graphApiVersion.replace(/^v/, ''))).toBeGreaterThanOrEqual(26);
  });

  it('el parche para Cloud trae los nodos nuevos, idénticos a los del flujo', () => {
    const nombres = parche.nodes.map((n) => n.name);
    expect(nombres).toEqual(expect.arrayContaining(['Revisar adjunto', 'Gemini · Transcribir nota de voz', 'Respuesta: formato no soportado']));
    for (const n of parche.nodes) expect(n).toEqual(nodo(n.name));
    expect(nombres).not.toContain('Red de seguridad clínica'); // los nodos que ya existen se editan a mano
  });
});
