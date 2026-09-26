/* eslint-disable no-unused-vars -- las funciones de HELPERS se usan dentro de n8n, no aquí */
// Genera el flujo único de n8n: n8n/flujos/cerebro-maestro-clinica.json
// Uso: node n8n/generar-cerebro.mjs
// Si editas el flujo dentro de n8n, puedes simplemente exportarlo y reemplazar el JSON.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OUT_FILE = path.join(HERE, 'flujos', 'cerebro-maestro-clinica.json');

// IDs estables (mismo nombre -> mismo id) para que los diffs de git sean limpios
const uuidFrom = (seed) => {
  const h = crypto.createHash('sha1').update(`cerebro:${seed}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

// Cuerpo de una función como texto: el código de los nodos Code se escribe como JS real
const bodyOf = (fn) => fn.toString().replace(/^[^{]*\{\n?/, '').replace(/\}\s*$/, '').replace(/^ {2}/gm, '');

// ── Código compartido por los nodos "Mensajes: …" ──
const HELPERS = bodyOf(() => {
  // Configuración editable (nodo "Configuración")
  const cfg = $('Configuración').first().json;
  // WhatsApp exige el número con código de país y sin símbolos (Costa Rica: 506)
  const toWa = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits.length === 8 ? '506' + digits : digits;
  };
  const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';
  const fechaLarga = (iso) =>
    new Date(String(iso).slice(0, 10) + 'T12:00:00-06:00').toLocaleDateString('es-CR', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Costa_Rica',
    });
  // Las variables de plantilla no admiten saltos de línea ni espacios repetidos
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 900);
  const msg = (to, template, params) => ({ json: { to: toWa(to), template, params: params.map(clean) } });
});

// ── Constructores de nodos ──
const nodes = [];
const connections = {};

const add = (name, type, typeVersion, position, parameters, extra = {}) => {
  nodes.push({ parameters, id: uuidFrom(name), name, type, typeVersion, position, ...extra });
  return name;
};

// Conecta from -> to. `output` es la salida del nodo origen (el Switch tiene varias)
const link = (from, to, output = 0) => {
  connections[from] ??= { main: [] };
  const outs = connections[from].main;
  while (outs.length <= output) outs.push([]);
  outs[output].push({ node: to, type: 'main', index: 0 });
};

const code = (name, position, fn, { helpers = true } = {}) =>
  add(name, 'n8n-nodes-base.code', 2, position, { jsCode: helpers ? `${HELPERS}\n${bodyOf(fn)}` : bodyOf(fn) });

const setAccion = (name, position, accion) =>
  add(name, 'n8n-nodes-base.set', 3.4, position, {
    assignments: { assignments: [{ id: uuidFrom(`${name}:accion`), name: 'accion', value: accion, type: 'string' }] },
    options: {},
  });

const cron = (name, position, expression) =>
  add(name, 'n8n-nodes-base.scheduleTrigger', 1.2, position, {
    rule: { interval: [{ field: 'cronExpression', expression }] },
  });

// Consulta a la API del simulador (o la futura) autenticada con X-N8N-Secret
const apiGet = (name, position, route) =>
  add(name, 'n8n-nodes-base.httpRequest', 4.2, position, {
    url: `={{ $('Configuración').first().json.apiUrl }}${route}`,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    options: {},
  });

// ── Columna 1: disparadores ──
const WEBHOOK = add('Webhook clínica', 'n8n-nodes-base.webhook', 2, [0, 0], {
  httpMethod: 'POST',
  path: 'clinica/eventos',
  authentication: 'headerAuth',
  responseMode: 'responseNode',
  options: {},
}, { webhookId: uuidFrom('webhook') });

const CRON_RECORDATORIO = cron('Diario 8:00 · Recordatorios', [0, 260], '0 8 * * *');
const CRON_SEGUIMIENTO = cron('Diario 10:00 · Seguimiento', [0, 420], '0 10 * * *');
const CRON_PASOS = cron('Lunes 9:00 · Próximos pasos', [0, 580], '0 9 * * 1');
const MANUAL = add('Probar ahora', 'n8n-nodes-base.manualTrigger', 1, [0, 740], {});

// ── Columna 2: cada disparador define su "accion" ──
const RESPONDER = add('Responder OK', 'n8n-nodes-base.respondToWebhook', 1.1, [240, 0], {
  respondWith: 'json',
  responseBody: '{\n  "ok": true\n}',
  options: {},
});

const NORMALIZAR = code('Normalizar evento', [480, 0], () => {
  // Traduce el evento que envía el servidor a una acción del cerebro
  const body = $('Webhook clínica').first().json.body || {};
  const ACCIONES = {
    'appointment.created': 'cita_recibida',
    'auth.magic_link': 'acceso_portal',
    'checkin.alert': 'alerta',
    'sos.triggered': 'alerta',
  };
  return [{ json: { accion: ACCIONES[body.event] || 'desconocido', evento: body.event || '', payload: body } }];
}, { helpers: false });

const RUTINA_RECORDATORIO = setAccion('Rutina: recordatorio 24 h', [480, 260], 'recordatorio_cita');
const RUTINA_SEGUIMIENTO = setAccion('Rutina: seguimiento', [480, 420], 'seguimiento');
const RUTINA_PASOS = setAccion('Rutina: próximos pasos', [480, 580], 'proximos_pasos');
const TODAS = code('Todas las rutinas', [480, 740], () => {
  // Prueba manual: ejecuta las tres rutinas programadas de una vez
  return ['recordatorio_cita', 'seguimiento', 'proximos_pasos'].map((accion) => ({ json: { accion } }));
}, { helpers: false });

// ── Configuración central (única para toda la clínica) ──
const CONFIG_FIELDS = [
  ['whatsappPhoneNumberId', 'REEMPLAZAR_PHONE_NUMBER_ID'],
  ['graphApiVersion', 'v21.0'],
  ['templateLanguage', 'es'],
  ['clinicWhatsapp', '50688888888'],
  ['portalUrl', 'http://localhost:5173'],
  ['apiUrl', 'http://localhost:3001'],
];
const CONFIG = add('Configuración', 'n8n-nodes-base.set', 3.4, [720, 360], {
  assignments: {
    assignments: CONFIG_FIELDS.map(([name, value]) => ({ id: uuidFrom(`cfg:${name}`), name, value, type: 'string' })),
  },
  includeOtherFields: true,
  options: {},
});

// ── Router ──
const RUTAS = [
  ['cita_recibida', 'Cita recibida'],
  ['acceso_portal', 'Acceso al portal'],
  ['alerta', 'Alertas'],
  ['recordatorio_cita', 'Recordatorio 24 h'],
  ['seguimiento', 'Seguimiento'],
  ['proximos_pasos', 'Próximos pasos'],
];
const SWITCH = add('Router por acción', 'n8n-nodes-base.switch', 3.2, [960, 360], {
  rules: {
    values: RUTAS.map(([accion, etiqueta]) => ({
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{
          id: uuidFrom(`ruta:${accion}`),
          leftValue: '={{ $json.accion }}',
          rightValue: accion,
          operator: { type: 'string', operation: 'equals' },
        }],
        combinator: 'and',
      },
      renameOutput: true,
      outputKey: etiqueta,
    })),
  },
  options: { fallbackOutput: 'extra', renameFallbackOutput: 'Evento desconocido' },
});

// ── Ramas ──
const MSG_CITA = code('Mensajes: cita recibida', [1440, 0], () => {
  const cita = $input.first().json.payload.appointment || {};
  if (!cita.telefono) return [];
  const mensajes = [
    // A la paciente: sin nombrar el tratamiento (discreción) y con acceso a su portal
    msg(cita.telefono, 'cita_recibida', [firstName(cita.nombre), fechaLarga(cita.fecha), cfg.portalUrl + '/portal/acceso']),
  ];
  if (cfg.clinicWhatsapp) {
    mensajes.push(msg(cfg.clinicWhatsapp, 'nueva_solicitud_cita', [cita.nombre, cita.telefono, cita.tratamiento, fechaLarga(cita.fecha)]));
  }
  return mensajes;
});

const MSG_ACCESO = code('Mensajes: acceso al portal', [1440, 160], () => {
  const evento = $input.first().json.payload;
  if (!evento.phone || !evento.link) return [];
  return [msg(evento.phone, 'acceso_portal', [firstName(evento.name), evento.link])];
});

const MSG_ALERTAS = code('Mensajes: alertas', [1440, 320], () => {
  const evento = $input.first().json.payload;
  const paciente = evento.patient || {};
  const ANIMOS = { 'muy-bien': 'Muy bien', bien: 'Bien', regular: 'Regular', molestias: 'Con molestias', preocupacion: 'Con preocupación' };
  const MOTIVOS = { dolor: 'Dolor fuerte', inflamacion: 'La inflamación aumentó', aspecto: 'Algo no se ve como esperaba', duda: 'Duda urgente' };

  if (evento.event === 'checkin.alert') {
    const c = evento.checkin || {};
    const detalle = 'Check-in: ' + (ANIMOS[c.mood] || c.mood) + ', molestia ' + c.pain + '/10' + (c.note ? '. Nota: ' + c.note : '');
    return [msg(cfg.clinicWhatsapp, 'alerta_clinica', ['Seguimiento', paciente.name, paciente.phone, detalle])];
  }
  const a = evento.alert || {};
  const detalle = 'SOS: ' + (MOTIVOS[a.reason] || a.reason) + (a.note ? '. Nota: ' + a.note : '');
  return [
    msg(cfg.clinicWhatsapp, 'alerta_clinica', ['Urgente', paciente.name, paciente.phone, detalle]),
    msg(paciente.phone, 'sos_recibido', [firstName(paciente.name)]),
  ];
});

const API_CITAS = apiGet('API: citas confirmadas de mañana', [1200, 480],
  "/n8n/citas?estado=confirmada&fecha={{ $now.setZone('America/Costa_Rica').plus({ days: 1 }).toFormat('yyyy-MM-dd') }}");
const MSG_RECORDATORIO = code('Mensajes: recordatorio 24 h', [1440, 480], () => {
  // Textos de ejemplo: la doctora debe validarlos antes de activar el flujo
  const INSTRUCCIONES = {
    'Armonización Facial': 'Evita aspirina, ibuprofeno y alcohol 48 h antes y llega con el rostro limpio.',
    'Bioestimuladores de Colágeno': 'Evita aspirina, ibuprofeno y alcohol 48 h antes. Avísanos si tomas anticoagulantes.',
    'Rejuvenecimiento de Mirada': 'Llega sin maquillaje en ojos y frente y evita el ejercicio intenso ese día.',
    'Labios de Alta Definición': 'Evita aspirina, ibuprofeno y alcohol 48 h antes. Avísanos si has tenido herpes labial.',
    'Skinbooster & Mesoterapia': 'Llega con la piel limpia y no te exfolies en las 48 h previas.',
    'Rinomodelación Sin Cirugía': 'Evita aspirina, ibuprofeno y alcohol 48 h antes.',
  };
  const GENERAL = 'Llega 10 minutos antes y con el rostro limpio.';
  const citas = $input.first().json.items || [];
  return citas.map((cita) =>
    msg(cita.telefono, 'recordatorio_cita', [
      firstName(cita.nombre),
      fechaLarga(cita.fecha),
      cita.hora || 'la hora acordada',
      INSTRUCCIONES[cita.tratamiento] || GENERAL,
    ])
  );
});

const API_SEGUIMIENTO = apiGet('API: pacientes en recuperación', [1200, 640], '/n8n/seguimiento');
const MSG_SEGUIMIENTO = code('Mensajes: seguimiento', [1440, 640], () => {
  // Días después del tratamiento en los que preguntamos cómo se siente
  const DIAS = [1, 3, 7, 14];
  const pacientes = $input.first().json.items || [];
  return pacientes
    .filter((p) => DIAS.includes(p.diasDesdeTratamiento))
    .map((p) => msg(p.phone, 'seguimiento_tratamiento', [firstName(p.name), cfg.portalUrl + '/portal']));
});

// Cada lunes: pasos de los próximos 7 días (hoy + 6), así cada paso se avisa una sola vez
const API_PASOS = apiGet('API: pasos de esta semana', [1200, 800], '/n8n/retoques?dias=6');
const MSG_PASOS = code('Mensajes: próximos pasos', [1440, 800], () => {
  const pasos = $input.first().json.items || [];
  const mensajes = pasos.map((p) =>
    msg(p.phone, 'proximo_paso_mapa', [firstName(p.name), fechaLarga(p.fecha), cfg.portalUrl + '/portal/mapa'])
  );
  if (pasos.length && cfg.clinicWhatsapp) {
    const resumen = pasos.map((p) => p.name + ' (' + p.titulo + ', ' + p.fecha + ')').join('; ');
    mensajes.push(msg(cfg.clinicWhatsapp, 'resumen_semana_clinica', [String(pasos.length), resumen]));
  }
  return mensajes;
});

const IGNORAR = add('Ignorar evento', 'n8n-nodes-base.noOp', 1, [1200, 960], {});

// ── Salida única: WhatsApp Cloud API ──
const ENVIAR = add('Enviar WhatsApp', 'n8n-nodes-base.httpRequest', 4.2, [1720, 400], {
  method: 'POST',
  url: "=https://graph.facebook.com/{{ $('Configuración').first().json.graphApiVersion }}/{{ $('Configuración').first().json.whatsappPhoneNumberId }}/messages",
  authentication: 'genericCredentialType',
  genericAuthType: 'httpHeaderAuth',
  sendBody: true,
  specifyBody: 'json',
  jsonBody:
    "={{ JSON.stringify({ messaging_product: 'whatsapp', to: $json.to, type: 'template', template: { name: $json.template, language: { code: $('Configuración').first().json.templateLanguage }, components: [{ type: 'body', parameters: $json.params.map(text => ({ type: 'text', text })) }] } }) }}",
  options: {},
}, { retryOnFail: true, maxTries: 3, waitBetweenTries: 3000, onError: 'continueRegularOutput' });

// ── Conexiones ──
link(WEBHOOK, RESPONDER);
link(RESPONDER, NORMALIZAR);
link(CRON_RECORDATORIO, RUTINA_RECORDATORIO);
link(CRON_SEGUIMIENTO, RUTINA_SEGUIMIENTO);
link(CRON_PASOS, RUTINA_PASOS);
link(MANUAL, TODAS);
[NORMALIZAR, RUTINA_RECORDATORIO, RUTINA_SEGUIMIENTO, RUTINA_PASOS, TODAS].forEach((n) => link(n, CONFIG));
link(CONFIG, SWITCH);

const RAMAS = [MSG_CITA, MSG_ACCESO, MSG_ALERTAS, API_CITAS, API_SEGUIMIENTO, API_PASOS];
RAMAS.forEach((n, i) => link(SWITCH, n, i));
link(SWITCH, IGNORAR, RAMAS.length); // salida de respaldo: evento desconocido
link(API_CITAS, MSG_RECORDATORIO);
link(API_SEGUIMIENTO, MSG_SEGUIMIENTO);
link(API_PASOS, MSG_PASOS);
[MSG_CITA, MSG_ACCESO, MSG_ALERTAS, MSG_RECORDATORIO, MSG_SEGUIMIENTO, MSG_PASOS].forEach((n) => link(n, ENVIAR));

// Notas visibles en el lienzo de n8n
const nota = (name, position, width, height, content) =>
  add(name, 'n8n-nodes-base.stickyNote', 1, position, { content, width, height });
nota('Nota: disparadores', [-40, -200], 700, 160,
  '## Cerebro maestro · Clínica Dra. Laura\nUn webhook recibe los eventos del sitio (citas, acceso, alertas). Los CRON lanzan las rutinas diarias. **Probar ahora** ejecuta las tres rutinas.');
nota('Nota: configuración', [680, 120], 420, 200,
  '### Configuración única\nEdita aquí el Phone Number ID de WhatsApp, el WhatsApp de la clínica, la URL del portal y la de la API. El **Router** decide la rama según `accion`.');

const workflow = {
  name: 'Clínica · Cerebro maestro',
  nodes,
  connections,
  active: false,
  settings: {
    executionOrder: 'v1',
    timezone: 'America/Costa_Rica',
    // Privacidad: no guardar en n8n los datos de ejecuciones exitosas (contienen datos de pacientes)
    saveDataSuccessExecution: 'none',
    saveDataErrorExecution: 'all',
    saveManualExecutions: false,
  },
  pinData: {},
  meta: { templateCredsSetupCompleted: false },
};

fs.writeFileSync(OUT_FILE, JSON.stringify(workflow, null, 2) + '\n');
console.log(`✓ ${path.basename(OUT_FILE)}: ${nodes.length} nodos`);
