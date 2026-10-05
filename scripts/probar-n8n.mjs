// Prueba los dos flujos de n8n en un n8n real y local: npm run probar:n8n
// - n8n corre con una carpeta de datos temporal (no toca tu instalación de n8n).
// - Google Sheets y la API de WhatsApp (Meta) se reemplazan por simuladores locales.
// - Flujo "API": recorre el mismo contrato que `npm run verificar` (scripts/contrato.mjs).
// - Flujo "Cerebro": recibe los eventos reales que emitió la API y se comprueban los WhatsApp
//   que envía; además el chat ("BAJA" y una emergencia) y el aviso de fallas.
//   Las ramas con IA no se ejercitan (necesitan la credencial de Google Gemini); sí su respaldo sin IA.
// Requiere n8n instalado (`npm i -g n8n`) o N8N_BIN con la ruta del ejecutable.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { generarApi } from '../n8n/generar-api.mjs';
import { aFilas } from '../api/hojas.mjs';
import { TABLAS } from '../api/nucleo.mjs';
import { crearReceptorEventos, crearCliente, probarContrato, ORIGIN } from './contrato.mjs';

const N8N_PORT = 5690;
const SHEETS_PORT = 3992;
const GRAPH_PORT = 3994;
const SECRET = 'secreto-n8n-de-prueba';
const CLINICA = '50688888888';
const API_ID = 'ApiClinicaPrueba';
const CEREBRO_ID = 'CerebroDePrueba1';
const N8N_BIN = process.env.N8N_BIN || 'n8n';
const API = `http://localhost:${N8N_PORT}/webhook`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clinica-n8n-'));

let fallos = 0;
const ok = (cond, texto) => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${texto}`);
  if (!cond) fallos += 1;
};

const leerCuerpo = (req) => new Promise((resolve) => {
  let cuerpo = '';
  req.on('data', (c) => { cuerpo += c; });
  req.on('end', () => resolve(cuerpo));
});

// ── Simulador de la API de Google Sheets ──
const datos = JSON.parse(fs.readFileSync('db.example.json', 'utf8'));
const pestanas = Object.fromEntries(TABLAS.map((t) => [t, aFilas(datos[t] || [])]));
let escrituras = 0;
let lecturasQueFallan = 0; // para provocar una falla real del flujo API
const sheets = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const cuerpo = await leerCuerpo(req);
  const responder = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.method === 'GET' && url.pathname.endsWith('/values:batchGet')) {
    if (lecturasQueFallan > 0) {
      lecturasQueFallan -= 1;
      return responder(500, { error: { message: 'Falla simulada de Google Sheets' } });
    }
    const valueRanges = url.searchParams.getAll('ranges').map((t) => ({ range: `${t}!A1:Z${pestanas[t].length}`, majorDimension: 'ROWS', values: pestanas[t] }));
    return responder(200, { spreadsheetId: 'hoja-de-prueba', valueRanges });
  }
  if (req.method === 'POST' && url.pathname.endsWith('/values:batchUpdate')) {
    const { valueInputOption, data } = JSON.parse(cuerpo);
    if (valueInputOption !== 'RAW') return responder(400, { error: 'Se esperaba valueInputOption RAW' });
    for (const { range, values } of data) {
      const [, tab, fila] = /^(\w+)!A(\d+)$/.exec(range);
      pestanas[tab][Number(fila) - 1] = values[0];
      escrituras += 1;
    }
    return responder(200, { totalUpdatedRows: data.length });
  }
  responder(404, {});
});

// ── Simulador de la API de WhatsApp (Meta): guarda cada mensaje que envía el cerebro ──
const whatsapp = [];
// También sirve los medios entrantes: GET /<versión>/<media-id> da la URL temporal y GET /descargas/<id> el archivo
const MEDIOS = {
  'media.foto': { mime_type: 'image/png', archivo: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') },
  'media.audio': { mime_type: 'audio/ogg', archivo: Buffer.from('OggS-prueba') },
};
const graph = http.createServer(async (req, res) => {
  if (req.method === 'GET') {
    const descarga = req.url.match(/^\/descargas\/(.+)$/);
    const id = descarga ? descarga[1] : req.url.split('/').pop();
    const medio = MEDIOS[id];
    if (!medio) { res.writeHead(404); res.end(); return; }
    if (descarga) { res.writeHead(200, { 'Content-Type': medio.mime_type }); res.end(medio.archivo); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id, mime_type: medio.mime_type, file_size: medio.archivo.length, url: `http://localhost:${GRAPH_PORT}/descargas/${id}` }));
    return;
  }
  const cuerpo = await leerCuerpo(req);
  try { whatsapp.push(JSON.parse(cuerpo)); } catch { /* ignorado */ }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ messages: [{ id: `wamid.${whatsapp.length}` }] }));
});
const textos = (m) => (m.template?.components?.[0]?.parameters || []).map((p) => p.text);
const esperarWhatsapp = async (cumple) => {
  for (let i = 0; i < 40; i += 1) {
    const m = whatsapp.find(cumple);
    if (m) return m;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
};
const plantilla = (nombre, to, cumple = () => true) =>
  esperarWhatsapp((m) => m.template?.name === nombre && (!to || m.to === to) && cumple(textos(m)));

// El cerebro de producción, adaptado a los simuladores y sin credenciales
const cerebroDePrueba = () => {
  const wf = JSON.parse(fs.readFileSync('n8n/flujos/cerebro-maestro-clinica.json', 'utf8'));
  wf.id = CEREBRO_ID;
  const CONFIG = { apiUrl: API, portalUrl: 'http://localhost:5173', whatsappPhoneNumberId: 'PRUEBA', clinicWhatsapp: CLINICA };
  for (const n of wf.nodes) {
    if (n.name === 'Configuración') {
      for (const a of n.parameters.assignments.assignments) if (a.name in CONFIG) a.value = CONFIG[a.name];
    }
    if (n.parameters.authentication === 'genericCredentialType') {
      n.parameters.authentication = 'none';
      delete n.parameters.genericAuthType;
      n.parameters.sendHeaders = true;
      n.parameters.headerParameters = { parameters: [{ name: 'X-N8N-Secret', value: SECRET }] };
    }
    if (typeof n.parameters.url === 'string') n.parameters.url = n.parameters.url.replace('https://graph.facebook.com/', `http://localhost:${GRAPH_PORT}/`);
    if (n.name === 'Webhook clínica') n.parameters.authentication = 'none';
    // Los nodos de Gemini traen su credencial por nombre; aquí no existe y n8n se negaría a ejecutar el flujo
    delete n.credentials;
  }
  // El disparador de WhatsApp se registra en Meta: aquí lo reemplaza un Webhook que entrega lo mismo
  const trigger = wf.nodes.find((n) => n.name === 'WhatsApp entrante');
  Object.assign(trigger, { type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: 'return [{ json: $input.first().json.body }];' } });
  delete trigger.webhookId;
  wf.nodes.push({ parameters: { httpMethod: 'POST', path: 'prueba/whatsapp', options: {} }, id: 'b0b0b0b0-0000-4000-a000-000000000001', name: 'WhatsApp (prueba)', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-200, 200], webhookId: 'b0b0b0b0-0000-4000-a000-000000000002' });
  wf.connections['WhatsApp (prueba)'] = { main: [[{ node: 'WhatsApp entrante', type: 'main', index: 0 }]] };
  // Sin Gemini, la Enfermera se simula con lo que devuelve el agente real (returnIntermediateSteps):
  // para ENFERMERA_DESPIERTA usó despertar_doctora; para los demás números, la IA no respondió.
  const enfermera = wf.nodes.find((n) => n.name === 'Agente IA 1 · Enfermera Virtual');
  Object.assign(enfermera, {
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    parameters: {
      jsCode: `const p = $('Red de seguridad clínica').first().json.payload;
if (p.from !== '${ENFERMERA_DESPIERTA}') return [{ json: { error: 'Sin IA en la prueba' } }];
return [{ json: { output: 'Ya le escribí a la doctora para que te contacte.', intermediateSteps: [{ action: { tool: 'despertar_doctora', toolInput: { motivo: 'Zona morada y dolor que aumenta al día 2' }, toolCallId: 'call_1', type: 'tool_call' }, observation: '{"messages":[{"id":"wamid.x"}]}' }] } }];`,
    },
  });
  for (const tipos of Object.values(wf.connections)) {
    for (const [tipo, salidas] of Object.entries(tipos)) {
      if (tipo !== 'main') tipos[tipo] = salidas.map((s) => s.filter((c) => c.node !== enfermera.name));
    }
  }
  return wf;
};
const ENFERMERA_DESPIERTA = '50686665566';
const mensajeWhatsapp = (from, texto) => ({
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ value: { contacts: [{ profile: { name: 'Prueba' } }], messages: [{ from, id: `wamid.in.${Date.now()}`, type: 'text', text: { body: texto } }] } }] }],
});

const esperar = async (condicion, ms, texto) => {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    if (await condicion().catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Tiempo agotado: ${texto}`);
};

const env = {
  ...process.env,
  N8N_USER_FOLDER: tmp,
  N8N_PORT: String(N8N_PORT),
  NODE_FUNCTION_ALLOW_BUILTIN: 'crypto',
  N8N_DIAGNOSTICS_ENABLED: 'false',
  N8N_PERSONALIZATION_ENABLED: 'false',
  N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
  N8N_SECURE_COOKIE: 'false',
  N8N_LOG_LEVEL: 'warn',
};
const cli = (...args) => {
  const r = spawnSync(`${N8N_BIN} ${args.join(' ')}`, { env, shell: true, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`n8n ${args.join(' ')} falló:\n${r.stdout}\n${r.stderr}`);
};
const importar = (wf, nombre) => {
  const archivo = path.join(tmp, nombre);
  fs.writeFileSync(archivo, JSON.stringify(wf));
  cli('import:workflow', `--input="${archivo}"`);
  cli('publish:workflow', `--id=${wf.id}`);
};

const receptor = crearReceptorEventos(3993);
let n8n;
try {
  await new Promise((r) => sheets.listen(SHEETS_PORT, r));
  await new Promise((r) => graph.listen(GRAPH_PORT, r));
  await receptor.iniciar();

  console.log(`\nPreparando n8n local (carpeta temporal ${tmp})…`);
  importar(generarApi({
    id: API_ID,
    sheetsApi: `http://localhost:${SHEETS_PORT}/v4`,
    cerebroUrl: receptor.url, // en el contrato los eventos van al receptor; luego se reenvían al cerebro
    secretoSesion: 'secreto-de-sesion-de-prueba',
    secretoN8n: SECRET,
    portalUrl: 'http://localhost:5173',
    origen: ORIGIN,
    errorWorkflow: CEREBRO_ID,
  }), 'api.json');
  importar(cerebroDePrueba(), 'cerebro.json');

  n8n = spawn(`${N8N_BIN} start`, { env, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  n8n.stdout.on('data', (d) => { log += d; });
  n8n.stderr.on('data', (d) => { log += d; });
  try {
    await esperar(async () => (await fetch(`${API}/me`)).status === 401, 180_000, 'n8n no respondió en el webhook /me');
  } catch (err) {
    console.log(log.slice(-3000));
    throw err;
  }
  console.log('n8n listo.');

  // ── Flujo API ──
  console.log('\n═══ Flujo API: contrato completo ═══');
  const { sesionDoc } = await probarContrato({ api: API, secreto: SECRET, receptor, ok });

  console.log('\nParticularidades de n8n');
  const preflight = await fetch(`${API}/admin/pacientes`, {
    method: 'OPTIONS',
    headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization,content-type' },
  });
  ok(preflight.headers.get('access-control-allow-origin') === ORIGIN, 'CORS: el navegador del sitio puede llamar a la API');
  const call = crearCliente(API);
  const sinConsentimiento = await call('POST', '/appointments', { body: { nombre: 'Sin Consentimiento', telefono: '8111 2222', tratamiento: 'Valoración General', fecha: '2030-01-01' } });
  ok(sinConsentimiento.status === 400 && pestanas.appointments.every((f) => !f.includes('Sin Consentimiento')), 'Un error no escribe en las hojas');
  ok(escrituras > 0 && pestanas.accesos[0].includes('hash'), `Las escrituras llegaron a las hojas (${escrituras} filas)`);

  // ── Flujo Cerebro ──
  console.log('\n═══ Flujo Cerebro: WhatsApp que envía con los eventos reales de la API ═══');
  const eventos = receptor.eventos.map(({ _secreto, ...e }) => e);
  for (const e of eventos) {
    await fetch(`${API}/clinica/eventos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e) });
  }
  const paciente = '50687776655';
  ok(Boolean(await plantilla('cita_recibida_v2', paciente, (t) => t.length === 2 && !t.join(' ').includes('Labios'))), 'Cita recibida: aviso a la paciente, sin nombrar el tratamiento (el portal va en un botón fijo)');
  ok(Boolean(await plantilla('nueva_solicitud_cita', CLINICA)), 'Cita recibida: aviso a la doctora');
  // Plantilla de Autenticación: el código va en el cuerpo y como parámetro del botón "Copiar código"
  const codigoAcceso = (to) => esperarWhatsapp((m) => m.template?.name === 'codigo_acceso' && m.to === to
    && /^\d{6}$/.test(textos(m)[0]) && m.template.components?.[1]?.sub_type === 'url'
    && m.template.components[1].parameters?.[0]?.text === textos(m)[0]);
  ok(Boolean(await codigoAcceso('50688880001')), 'Acceso: la paciente recibe su código (cuerpo y botón "Copiar código")');
  ok(Boolean(await codigoAcceso(CLINICA)), 'Acceso: la doctora recibe el suyo');
  ok(Boolean(await plantilla('sos_recibido', '50688880001')) && Boolean(await plantilla('alerta_clinica', CLINICA, (t) => t[0] === 'Urgente')), 'SOS: contención a la paciente y alerta a la doctora');
  ok(Boolean(await plantilla('alerta_clinica', CLINICA, (t) => t[0] === 'Seguimiento urgente' && t[3].includes('regla'))), 'Check-in preocupante: sin IA disponible, escala por la regla fija');
  ok(Boolean(await plantilla('cita_confirmada_v2', paciente, (t) => t.length === 3 && t[2] === '15:30')), 'Cita confirmada desde el panel: aviso con fecha y hora');
  ok(Boolean(await plantilla('cita_cancelada', paciente)), 'Cita cancelada desde el panel: aviso a la paciente');
  ok(Boolean(await plantilla('promocion', paciente, (t) => t[1].includes('skinboosters'))), 'Campaña: la promoción llega a quien la aceptó');

  console.log('\nChat de WhatsApp (sin IA)');
  const chat = (from, texto) => fetch(`${API}/prueba/whatsapp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mensajeWhatsapp(from, texto)) });
  await chat('50686665544', 'BAJA');
  ok(Boolean(await esperarWhatsapp((m) => m.type === 'text' && m.to === '50686665544' && m.text.body.startsWith('Listo: ya no te enviaremos'))), '"BAJA" se registra en la API y se confirma a la paciente');
  await chat('50686665544', 'Ayuda, no puedo respirar bien');
  ok(Boolean(await plantilla('alerta_clinica', CLINICA, (t) => t[0] === 'EMERGENCIA')), 'Emergencia: la red de seguridad avisa a la doctora sin pasar por la IA');
  ok(Boolean(await esperarWhatsapp((m) => m.type === 'text' && m.to === '50686665544' && m.text.body.includes('911'))), 'Emergencia: la paciente recibe la indicación de llamar al 911');

  console.log('\nChat de WhatsApp: notas de voz, fotos y otros formatos');
  const adjunto = (from, mensaje) => fetch(`${API}/prueba/whatsapp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { contacts: [{ profile: { name: 'Prueba' } }], messages: [{ from, id: `wamid.in.${Date.now()}`, ...mensaje }] } }] }] }),
  });
  await adjunto('50686665511', { type: 'video', video: { id: 'media.video' } });
  ok(Boolean(await esperarWhatsapp((m) => m.type === 'text' && m.to === '50686665511' && m.text.body.includes('escuchar notas de voz y ver fotos'))), 'Video: respuesta corta sin IA');
  await adjunto('50686665522', { type: 'image', image: { id: 'media.foto', mime_type: 'image/png', caption: 'Así va la zona tratada' } });
  ok(Boolean(await plantilla('alerta_clinica', CLINICA, (t) => t[2] === '50686665522' && t[3].includes('[Foto enviada: Así va la zona tratada]'))),
    'Foto: se descarga de Meta y llega a la Enfermera con su pie (sin IA disponible, la doctora recibe el aviso)');
  await adjunto('50686665533', { type: 'image', image: { id: 'media.foto', caption: 'Ayuda, no puedo respirar bien' } });
  ok(Boolean(await plantilla('alerta_clinica', CLINICA, (t) => t[0] === 'EMERGENCIA' && t[2] === '50686665533')), 'Foto: una emergencia en el pie de foto va directo a la doctora');
  await adjunto('50686665544', { type: 'audio', audio: { id: 'media.audio', mime_type: 'audio/ogg; codecs=opus', voice: true } });
  ok(Boolean(await esperarWhatsapp((m) => m.type === 'text' && m.to === '50686665544' && m.text.body.includes('nota de voz'))), 'Nota de voz: si Gemini no responde, se le pide amablemente que lo escriba');
  await adjunto('50686665555', { type: 'image', image: { id: 'media.no-existe' } });
  ok(Boolean(await esperarWhatsapp((m) => m.type === 'text' && m.to === '50686665555' && m.text.body.includes('No pude abrir tu foto'))), 'Foto: si Meta no la entrega, respuesta amable');

  console.log('\nAlertas en el panel de la doctora (cerebro → POST /n8n/alerta → API)');
  const alertaEnPanel = async (cumple) => {
    for (let i = 0; i < 40; i += 1) {
      const r = await call('GET', '/admin/alertas', { token: sesionDoc });
      const a = Array.isArray(r.data) ? r.data.find((x) => x.tipo === 'whatsapp' && cumple(x)) : null;
      if (a) return a;
      await new Promise((res) => setTimeout(res, 500));
    }
    return null;
  };
  const termina = (tel) => (a) => String(a.paciente?.phone || '').replace(/\D/g, '').endsWith(tel);
  const deEmergencia = await alertaEnPanel((a) => a.subtipo === 'emergencia' && termina('86665544')(a));
  ok(Boolean(deEmergencia) && deEmergencia.paciente?.id && deEmergencia.nota.includes('no puedo respirar'), 'Emergencia del chat: la alerta queda en el panel, enlazada a la paciente');
  const sinRespuesta = await alertaEnPanel((a) => a.subtipo === 'ia_sin_respuesta' && termina('86665522')(a));
  ok(Boolean(sinRespuesta) && !sinRespuesta.paciente?.id && sinRespuesta.paciente?.name === 'Prueba', 'IA sin respuesta: la alerta queda en el panel con nombre y teléfono de WhatsApp (sin ficha)');
  await chat(ENFERMERA_DESPIERTA, 'Tengo la zona morada y me duele cada vez más');
  ok(Boolean(await esperarWhatsapp((m) => m.type === 'text' && m.to === ENFERMERA_DESPIERTA && m.text.body.includes('Ya le escribí'))), 'despertar_doctora: la paciente recibe la respuesta de la Enfermera');
  const deEnfermera = await alertaEnPanel((a) => a.subtipo === 'enfermera' && termina(ENFERMERA_DESPIERTA.slice(-8))(a));
  ok(deEnfermera?.motivo === 'Zona morada y dolor que aumenta al día 2' && deEnfermera.estado === 'abierta', 'despertar_doctora: la alerta queda en el panel con el motivo que escribió la IA');
  const atendidaWa = deEnfermera && await call('PATCH', `/admin/alertas?id=${deEnfermera.id}`, { token: sesionDoc, body: { estado: 'atendida', respuesta: 'La llamé' } });
  ok(atendidaWa?.status === 200 && atendidaWa.data?.estado === 'atendida', 'La doctora marca atendida la alerta de WhatsApp');

  console.log('\nFallas');
  lecturasQueFallan = 3; // Google Sheets no responde en los 3 intentos de "Leer hojas"
  const caida = await call('GET', '/me', { token: 'x' }).catch(() => ({ status: 0 }));
  ok(caida.status >= 500, 'Si Google Sheets falla, la API responde con error (no con datos a medias)');
  ok(Boolean(await plantilla('alerta_clinica', CLINICA, (t) => t[0] === 'Falla del sistema' && t[2] === 'Clínica · API')), 'La doctora recibe por WhatsApp el aviso de la falla');
} catch (err) {
  ok(false, `Error inesperado: ${err.message}`);
} finally {
  if (n8n?.pid) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(n8n.pid), '/T', '/F'], { stdio: 'ignore' });
    else n8n.kill();
  }
  await receptor.detener();
  sheets.close();
  graph.close();
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}

console.log(fallos ? `\n✗ ${fallos} verificación(es) fallaron\n` : '\n✓ Los flujos de n8n cumplen el contrato\n');
process.exit(fallos ? 1 : 0);
