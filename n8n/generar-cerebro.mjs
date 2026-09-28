/* eslint-disable no-unused-vars -- las funciones de HELPERS se usan dentro de n8n, no aquí */
// Genera el flujo único de n8n: n8n/flujos/cerebro-maestro-clinica.json
// Uso: node n8n/generar-cerebro.mjs
// Si editas el flujo dentro de n8n, puedes simplemente exportarlo y reemplazar el JSON.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(HERE, 'flujos', 'cerebro-maestro-clinica.json');

// IDs estables (mismo nombre -> mismo id) para que los diffs de git sean limpios
const uuidFrom = (seed) => {
  const h = crypto.createHash('sha1').update(`cerebro:${seed}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

// Cuerpo de una función como texto: el código de los nodos Code se escribe como JS real
// (finales de línea normalizados: en Windows el archivo puede tener CRLF)
const bodyOf = (fn) => fn.toString().replace(/\r\n/g, '\n').replace(/^[^{]*\{\n?/, '').replace(/\}\s*$/, '').replace(/^ {2}/gm, '');

// ── Código compartido por los nodos que preparan mensajes ──
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

// ── Constructores ──
const nodes = [];
const connections = {};
const CFG = "$('Configuración').first().json";
// Mensaje original del chat: se lee siempre de aquí, aunque un nodo de IA intermedio falle
const CHAT = "$('Red de seguridad clínica').first().json.payload";

const add = (name, type, typeVersion, position, parameters, extra = {}) => {
  nodes.push({ parameters, id: uuidFrom(name), name, type, typeVersion, position, ...extra });
  return name;
};

// Conecta from -> to. `output` es la salida del nodo origen; `kind` distingue las conexiones de IA
const link = (from, to, output = 0, kind = 'main') => {
  connections[from] ??= {};
  connections[from][kind] ??= [];
  const outs = connections[from][kind];
  while (outs.length <= output) outs.push([]);
  outs[output].push({ node: to, type: kind, index: 0 });
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

// Consulta a la API de la clínica autenticada con X-N8N-Secret
const apiGet = (name, position, route) =>
  add(name, 'n8n-nodes-base.httpRequest', 4.2, position, {
    url: `={{ ${CFG}.apiUrl }}${route}`,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    options: {},
  });

// Switch v3.2: una salida por valor de `campo`
const router = (name, position, campo, rutas, fallback) =>
  add(name, 'n8n-nodes-base.switch', 3.2, position, {
    rules: {
      values: rutas.map(([valor, etiqueta]) => ({
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
          conditions: [{
            id: uuidFrom(`${name}:${valor}`),
            leftValue: `={{ $json.${campo} }}`,
            rightValue: valor,
            operator: { type: 'string', operation: 'equals' },
          }],
          combinator: 'and',
        },
        renameOutput: true,
        outputKey: etiqueta,
      })),
    },
    options: fallback ? { fallbackOutput: 'extra', renameFallbackOutput: fallback } : {},
  });

// ── Piezas de IA ──
const MODELO_PRINCIPAL = { __rl: true, mode: 'list', value: 'claude-sonnet-5', cachedResultName: 'Claude Sonnet 5' };
const MODELO_RAPIDO = { __rl: true, mode: 'id', value: 'claude-haiku-4-5-20251001' };

const modelo = (name, position, model, target, temperature = 0.3) => {
  add(name, '@n8n/n8n-nodes-langchain.lmChatAnthropic', 1.6, position, { model, options: { temperature } });
  link(name, target, 0, 'ai_languageModel');
};

const memoria = (name, position, prefijo, target) => {
  add(name, '@n8n/n8n-nodes-langchain.memoryBufferWindow', 1.3, position, {
    sessionIdType: 'customKey',
    sessionKey: `={{ '${prefijo}-' + ${CHAT}.from }}`,
    contextWindowLength: 10,
  });
  link(name, target, 0, 'ai_memory');
};

const parser = (name, position, schema, target) => {
  add(name, '@n8n/n8n-nodes-langchain.outputParserStructured', 1.3, position, {
    schemaType: 'manual',
    inputSchema: JSON.stringify(schema, null, 2),
  });
  link(name, target, 0, 'ai_outputParser');
};

// Herramienta HTTP para un agente (HTTP Request Tool). Solo los valores con ia(...) los decide la IA;
// lo demás lo fija el flujo (por ejemplo, el teléfono sale del mensaje entrante, nunca de la IA).
const herramienta = (name, position, target, { descripcion, method = 'GET', url, body, auth }) => {
  add(name, 'n8n-nodes-base.httpRequestTool', 4.2, position, {
    toolDescription: descripcion,
    method,
    url,
    ...auth,
    // El cuerpo se arma con JSON.stringify: comillas o saltos de línea de la IA no pueden romperlo
    ...(body ? { sendBody: true, specifyBody: 'json', jsonBody: `={{ JSON.stringify(${body}) }}` } : {}),
    options: {},
  });
  link(name, target, 0, 'ai_tool');
};
// Valor que completa la IA al usar la herramienta (sin apóstrofos en la descripción)
const ia = (nombre, descripcion) => `$fromAI('${nombre}', '${descripcion}', 'string')`;
const AUTH_API = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };
const AUTH_GOOGLE = (tipo) => ({ authentication: 'predefinedCredentialType', nodeCredentialType: tipo });

// ── Prompts de los perfiles ──
const PROMPT_ENFERMERA = `Eres la Enfermera Virtual de la clínica de armonización facial de la Dra. Laura Jiménez (Costa Rica). Atiendes por WhatsApp a pacientes que ya se hicieron un tratamiento.

Tu misión: tranquilizar con calidez y claridad y, ante el menor riesgo médico, despertar a la doctora.

Cómo trabajas:
1. Antes de responder usa "ficha_paciente" para saber qué tratamiento tuvo, en qué día de recuperación está y qué cuidados tiene vigentes.
2. Responde solo con información de "base_clinica" (aprobada por la doctora) y de la ficha. Si la respuesta no está ahí, dilo con honestidad y usa "despertar_doctora".
3. No diagnosticas, no recomiendas medicamentos ni dosis y no cambias indicaciones de la doctora.
4. Usa "despertar_doctora" si la paciente menciona: dolor fuerte o que aumenta, piel blanca, morada o con manchas en la zona tratada, ampollas, fiebre, secreción, cambios en la visión, hinchazón que empeora después de 72 horas, bultos que duelen, asimetría marcada, reacción alérgica, o si está muy angustiada. Ante la duda, avisa: es preferible una alerta de más.
5. Si hay dificultad para respirar, hinchazón de garganta o lengua, dolor en el pecho o pérdida de visión: pide que llame al 911 de inmediato y usa "despertar_doctora".
6. Si pregunta por citas, horarios o pagos, dile que la recepción la atiende y que escriba su consulta.

Estilo: español cercano y sereno, tuteo, máximo 5 frases, sin tecnicismos. Nunca compartas datos de otras pacientes. Si te preguntan qué eres, di que eres la asistente virtual de la clínica, supervisada por la doctora.`;

const PROMPT_RECEPCIONISTA = `Eres la Recepcionista VIP de la clínica de armonización facial de la Dra. Laura Jiménez (Costa Rica). Atiendes por WhatsApp solo temas administrativos: agendar, reprogramar o cancelar citas, horarios, ubicación y paquetes.

Datos de la clínica: Escazú, San José. Atención de lunes a viernes de 9:00 a 18:00 (hora de Costa Rica, UTC-06:00). Cada cita dura 60 minutos. Hoy es {{ $now.setZone('America/Costa_Rica').toFormat("cccc d 'de' LLLL yyyy", { locale: 'es' }) }}.

Cómo agendas:
1. Usa "ficha_recepcion" para saludar por su nombre y ver su próxima cita y sus paquetes.
2. Pregunta qué tratamiento le interesa y qué días le quedan mejor.
3. Usa "disponibilidad_agenda" y ofrece como máximo 3 horarios libres dentro del horario de atención.
4. Solo cuando la paciente confirme de forma explícita un horario: usa primero "bloquear_agenda" y después "registrar_cita". Si alguna falla, no confirmes y ofrece otro horario.
5. Confirma la fecha y la hora en una frase clara.

Reglas: no inventes precios (la doctora los define en la valoración), no das información clínica y no ves historiales médicos. Si la paciente habla de síntomas, dolor o cuidados, dile con amabilidad que la enfermera virtual la atiende y que escriba su duda. Estilo: español cálido y profesional, tuteo, máximo 4 frases.`;

const PROMPT_ANALISTA = `Eres la Enfermera Virtual de la clínica de la Dra. Laura Jiménez en su rol de analista emocional. Lee el check-in que una paciente hizo en su portal después de un tratamiento estético y clasifica el nivel de atención que necesita.

- "rojo": miedo intenso, angustia, dolor fuerte (7 o más), o cualquier señal de complicación (piel blanca o morada, ampollas, fiebre, secreción, visión, hinchazón que empeora, bultos dolorosos). La doctora debe escribirle ya.
- "amarillo": preocupación moderada, molestia media o dudas que conviene atender hoy.
- "verde": evolución tranquila.

Ante la duda entre dos niveles, elige el más alto. En "motivo" escribe una sola frase para la doctora, sin datos personales.

Check-in:
{{ $json.contexto }}`;

const PROMPT_RESUMEN = `Eres la Recepcionista VIP de la clínica de la Dra. Laura Jiménez. Antes de cada consulta preparas para la doctora un resumen ejecutivo de exactamente 3 puntos, breve y útil para decidir en la consulta:
1. Qué viene a hacer hoy y qué dijo la paciente al agendar.
2. Tratamientos y productos anteriores relevantes (con fechas).
3. Cómo se ha sentido últimamente (check-ins) y cualquier alerta a considerar.

Cada punto en una sola frase de máximo 30 palabras. No inventes información: si falta un dato, dilo.

Datos de la consulta:
{{ $json.contexto }}`;

// ════════════════════ Columna 1 · Disparadores ════════════════════
const WEBHOOK = add('Webhook clínica', 'n8n-nodes-base.webhook', 2, [0, 0], {
  httpMethod: 'POST',
  path: 'clinica/eventos',
  authentication: 'headerAuth',
  responseMode: 'responseNode',
  options: {},
}, { webhookId: uuidFrom('webhook') });

const WHATSAPP_IN = add('WhatsApp entrante', 'n8n-nodes-base.whatsAppTrigger', 1, [0, 200], {
  updates: ['messages'],
  options: {},
}, { webhookId: uuidFrom('whatsapp-trigger') });

const CRON_PREPARACION = cron('Diario 7:00 · Preparar consultas', [0, 400], '0 7 * * *');
const CRON_RECORDATORIO = cron('Diario 8:00 · Recordatorios', [0, 560], '0 8 * * *');
const CRON_SEGUIMIENTO = cron('Diario 10:00 · Seguimiento', [0, 720], '0 10 * * *');
const CRON_PASOS = cron('Lunes 9:00 · Próximos pasos', [0, 880], '0 9 * * 1');
const MANUAL = add('Probar ahora', 'n8n-nodes-base.manualTrigger', 1, [0, 1040], {});
const CRON_RESPALDO = cron('Domingo 23:00 · Respaldo', [0, 1200], '0 23 * * 0');
// Se dispara cuando falla cualquier flujo que tenga este como "Error workflow" (ver n8n/README.md)
const ERROR_IN = add('Falla en un flujo', 'n8n-nodes-base.errorTrigger', 1, [0, 1360], {});

// ════════════════════ Columna 2 · Cada disparador define su "accion" ════════════════════
const RESPONDER = add('Responder OK', 'n8n-nodes-base.respondToWebhook', 1.1, [220, 0], {
  respondWith: 'json',
  responseBody: '{\n  "ok": true\n}',
  options: {},
});

const NORMALIZAR = code('Normalizar evento', [440, 0], () => {
  // Traduce el evento que envía el servidor a una acción del cerebro
  const body = $('Webhook clínica').first().json.body || {};
  const ACCIONES = {
    'appointment.created': 'cita_recibida',
    'appointment.confirmed': 'cita_confirmada',
    'appointment.cancelled': 'cita_cancelada',
    'auth.magic_link': 'acceso_portal',
    'checkin.created': 'checkin',
    'sos.triggered': 'sos',
    'campaign.sent': 'campana',
  };
  return [{ json: { accion: ACCIONES[body.event] || 'desconocido', evento: body.event || '', payload: body } }];
}, { helpers: false });

const NORMALIZAR_WA = code('Normalizar mensaje', [440, 200], () => {
  // Solo mensajes de texto de pacientes (se ignoran estados de entrega, audios, etc.)
  const raw = $input.first().json;
  const value = raw.messages ? raw : (raw.entry?.[0]?.changes?.[0]?.value || {});
  const mensaje = (value.messages || [])[0];
  if (!mensaje || mensaje.type !== 'text' || !mensaje.text?.body) return [];
  const contacto = (value.contacts || [])[0] || {};
  return [{
    json: {
      accion: 'chat_whatsapp',
      payload: { from: mensaje.from, nombre: contacto.profile?.name || '', texto: mensaje.text.body.slice(0, 1500), messageId: mensaje.id },
    },
  }];
}, { helpers: false });

const NORMALIZAR_ERROR = code('Normalizar falla', [440, 1360], () => {
  // Datos mínimos de la falla para avisar a la doctora (sin el contenido de la ejecución)
  const e = $input.first().json;
  return [{
    json: {
      accion: 'falla_sistema',
      payload: {
        flujo: e.workflow?.name || 'Flujo desconocido',
        nodo: e.execution?.lastNodeExecuted || e.trigger?.error?.node?.name || '',
        mensaje: String(e.execution?.error?.message || e.trigger?.error?.message || 'Error desconocido').slice(0, 300),
      },
    },
  }];
}, { helpers: false });

const RUTINA_PREPARACION = setAccion('Rutina: preparar consultas', [440, 400], 'preparacion_consultas');
const RUTINA_RECORDATORIO = setAccion('Rutina: recordatorio 24 h', [440, 560], 'recordatorio_cita');
const RUTINA_SEGUIMIENTO = setAccion('Rutina: seguimiento', [440, 720], 'seguimiento');
const RUTINA_PASOS = setAccion('Rutina: próximos pasos', [440, 880], 'proximos_pasos');
const RUTINA_RESPALDO = setAccion('Rutina: respaldo', [440, 1200], 'respaldo');
const TODAS = code('Todas las rutinas', [440, 1040], () => {
  // Prueba manual: ejecuta todas las rutinas programadas de una vez
  return ['preparacion_consultas', 'recordatorio_cita', 'seguimiento', 'proximos_pasos'].map((accion) => ({ json: { accion } }));
}, { helpers: false });

// ════════════════════ Configuración central + Router ════════════════════
const CONFIG_FIELDS = [
  ['whatsappPhoneNumberId', 'REEMPLAZAR_PHONE_NUMBER_ID'],
  ['graphApiVersion', 'v21.0'],
  ['templateLanguage', 'es'],
  ['clinicWhatsapp', '50688888888'],
  ['portalUrl', 'http://localhost:5173'],
  ['apiUrl', 'http://localhost:3001'],
  ['googleCalendarId', 'primary'],
  ['baseClinicaSheetId', 'REEMPLAZAR_ID_DE_LA_HOJA'],
  ['baseClinicaRango', 'BaseClinica!A:D'],
  // Hoja de datos de la API (la misma de "Configuración API") y carpeta privada de Drive para su respaldo semanal
  ['datosSheetId', 'REEMPLAZAR_ID_DE_LA_HOJA_DE_DATOS'],
  ['respaldoCarpetaId', 'REEMPLAZAR_ID_DE_LA_CARPETA_DE_RESPALDOS'],
];
const CONFIG = add('Configuración', 'n8n-nodes-base.set', 3.4, [680, 520], {
  assignments: {
    assignments: CONFIG_FIELDS.map(([name, value]) => ({ id: uuidFrom(`cfg:${name}`), name, value, type: 'string' })),
  },
  includeOtherFields: true,
  options: {},
});

const RUTAS = [
  ['chat_whatsapp', 'Chat WhatsApp (agentes)'],
  ['checkin', 'Check-in (analista emocional)'],
  ['sos', 'SOS'],
  ['cita_recibida', 'Cita recibida'],
  ['acceso_portal', 'Acceso al portal'],
  ['preparacion_consultas', 'Preparar consultas'],
  ['recordatorio_cita', 'Recordatorio 24 h'],
  ['seguimiento', 'Seguimiento'],
  ['proximos_pasos', 'Próximos pasos'],
  ['cita_confirmada', 'Cita confirmada'],
  ['cita_cancelada', 'Cita cancelada'],
  ['campana', 'Campaña'],
  ['respaldo', 'Respaldo semanal'],
  ['falla_sistema', 'Falla del sistema'],
];
const ROUTER = router('Router por acción', [900, 520], 'accion', RUTAS, 'Evento desconocido');

// ════════════════════ Rama 1 · Chat WhatsApp (multi-agente) ════════════════════
const Y_CHAT = -560;
const SEGURIDAD = code('Red de seguridad clínica', [1140, Y_CHAT], () => {
  // Regla fija, sin IA: una emergencia nunca depende de un modelo de lenguaje
  const item = $input.first().json;
  const texto = String(item.payload.texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const SENALES = [
    'no puedo respirar', 'me ahogo', 'me falta el aire', 'dificultad para respirar',
    'se me cierra la garganta', 'garganta hinchada', 'lengua hinchada', 'dolor en el pecho',
    'no veo', 'perdi la vista', 'vision borrosa', 'veo borroso', 'veo doble',
    'piel morada', 'se puso morad', 'piel blanca', 'se puso blanc', 'desmay', 'convuls',
    'sangra mucho', 'sangrado abundante', 'fiebre alta',
  ];
  const senal = SENALES.find((s) => texto.includes(s));
  // "BAJA" (solo esa palabra) deja de enviar promociones; una emergencia siempre tiene prioridad
  const baja = !senal && /^\s*(baja|stop)\s*[.!]*\s*$/.test(texto);
  return [{ json: { ...item, ruta: senal ? 'emergencia' : baja ? 'baja' : 'conversacion', senal: senal || '' } }];
}, { helpers: false });

const RUTA_CHAT = router('¿Emergencia?', [1360, Y_CHAT], 'ruta', [['emergencia', 'Emergencia'], ['conversacion', 'Conversación'], ['baja', 'Baja de promociones']]);

const API_BAJA = add('API: baja de promociones', 'n8n-nodes-base.httpRequest', 4.2, [1600, Y_CHAT - 340], {
  method: 'POST',
  url: `={{ ${CFG}.apiUrl }}/n8n/baja`,
  authentication: 'genericCredentialType',
  genericAuthType: 'httpHeaderAuth',
  sendBody: true,
  specifyBody: 'json',
  jsonBody: `={{ JSON.stringify({ telefono: ${CHAT}.from }) }}`,
  options: {},
}, { retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 });
const TXT_BAJA = code('Respuesta de baja', [1820, Y_CHAT - 340], () => {
  const p = $('Red de seguridad clínica').first().json.payload;
  return [{ json: { to: p.from, texto: 'Listo: ya no te enviaremos promociones. Seguirás recibiendo los avisos de tus citas y cuidados.' } }];
}, { helpers: false });

const MSG_EMERGENCIA = code('Alerta de emergencia', [1600, Y_CHAT - 200], () => {
  const p = $input.first().json.payload;
  return [msg(cfg.clinicWhatsapp, 'alerta_clinica', ['EMERGENCIA', p.nombre || 'Paciente', p.from, 'Escribió: ' + p.texto])];
});
const TXT_EMERGENCIA = code('Respuesta de emergencia', [1600, Y_CHAT - 60], () => {
  const p = $input.first().json.payload;
  return [{
    json: {
      to: p.from,
      texto: 'Lo que describes necesita atención inmediata. Llama ya al 911. Ya avisamos a la Dra. Laura y te va a contactar en minutos.',
    },
  }];
}, { helpers: false });

const CLASIFICADOR = add('Clasificador de intención', '@n8n/n8n-nodes-langchain.textClassifier', 1.1, [1600, Y_CHAT + 160], {
  inputText: '={{ $json.payload.texto }}',
  categories: {
    categories: [
      { category: 'clinica', description: 'Dudas de salud, síntomas, dolor, inflamación, cuidados posteriores, emociones o miedo después de un tratamiento.' },
      { category: 'administrativa', description: 'Agendar, cambiar o cancelar citas, horarios, ubicación, pagos, paquetes o información general de la clínica.' },
    ],
  },
  options: { fallback: 'other' },
}, { onError: 'continueRegularOutput' });
modelo('Modelo · Clasificador', [1600, Y_CHAT + 340], MODELO_RAPIDO, CLASIFICADOR, 0);

// Agente IA 1 · Enfermera Virtual
const ENFERMERA = add('Agente IA 1 · Enfermera Virtual', '@n8n/n8n-nodes-langchain.agent', 3.1, [1900, Y_CHAT + 60], {
  promptType: 'define',
  text: `={{ ${CHAT}.texto }}`,
  options: { systemMessage: PROMPT_ENFERMERA, maxIterations: 8 },
}, { onError: 'continueRegularOutput' });
modelo('Modelo · Enfermera', [1780, Y_CHAT + 260], MODELO_PRINCIPAL, ENFERMERA, 0.2);
memoria('Memoria · Enfermera', [1900, Y_CHAT + 260], 'enfermera', ENFERMERA);
herramienta('ficha_paciente', [2020, Y_CHAT + 260], ENFERMERA, {
  descripcion: 'Ficha clínica mínima de la paciente que escribe: nombre, último tratamiento, día de recuperación, cuidados vigentes y últimos check-ins.',
  url: `={{ ${CFG}.apiUrl }}/n8n/paciente?perfil=clinico&telefono={{ encodeURIComponent(${CHAT}.from) }}`,
  auth: AUTH_API,
});
herramienta('base_clinica', [2140, Y_CHAT + 260], ENFERMERA, {
  descripcion: 'Base de conocimientos clínicos aprobada por la doctora: preguntas frecuentes post-tratamiento con su respuesta y nivel de riesgo.',
  url: `=https://sheets.googleapis.com/v4/spreadsheets/{{ ${CFG}.baseClinicaSheetId }}/values/{{ encodeURIComponent(${CFG}.baseClinicaRango) }}`,
  auth: AUTH_GOOGLE('googleSheetsOAuth2Api'),
});
herramienta('despertar_doctora', [2260, Y_CHAT + 260], ENFERMERA, {
  descripcion: 'Alerta urgente por WhatsApp a la Dra. Laura con el motivo. Úsala ante cualquier riesgo médico o angustia fuerte.',
  method: 'POST',
  url: `=https://graph.facebook.com/{{ ${CFG}.graphApiVersion }}/{{ ${CFG}.whatsappPhoneNumberId }}/messages`,
  auth: AUTH_API,
  body: `{ messaging_product: 'whatsapp', to: ${CFG}.clinicWhatsapp, type: 'template', template: { name: 'alerta_clinica', language: { code: ${CFG}.templateLanguage }, components: [{ type: 'body', parameters: [{ type: 'text', text: 'Enfermera IA' }, { type: 'text', text: ${CHAT}.nombre || 'Paciente' }, { type: 'text', text: ${CHAT}.from }, { type: 'text', text: String(${ia('motivo', 'Motivo de la alerta en una sola frase')}).replace(/\\s+/g, ' ').slice(0, 900) }] }] } }`,
});

// Agente IA 2 · Recepcionista VIP
const RECEPCIONISTA = add('Agente IA 2 · Recepcionista VIP', '@n8n/n8n-nodes-langchain.agent', 3.1, [1900, Y_CHAT + 500], {
  promptType: 'define',
  text: `={{ ${CHAT}.texto }}`,
  options: { systemMessage: `=${PROMPT_RECEPCIONISTA}`, maxIterations: 10 },
}, { onError: 'continueRegularOutput' });
modelo('Modelo · Recepcionista', [1780, Y_CHAT + 700], MODELO_PRINCIPAL, RECEPCIONISTA, 0.4);
memoria('Memoria · Recepcionista', [1900, Y_CHAT + 700], 'recepcion', RECEPCIONISTA);
herramienta('ficha_recepcion', [2020, Y_CHAT + 700], RECEPCIONISTA, {
  descripcion: 'Datos administrativos de la paciente que escribe: nombre, próxima cita y paquetes. No incluye información clínica.',
  url: `={{ ${CFG}.apiUrl }}/n8n/paciente?perfil=recepcion&telefono={{ encodeURIComponent(${CHAT}.from) }}`,
  auth: AUTH_API,
});
herramienta('disponibilidad_agenda', [2140, Y_CHAT + 700], RECEPCIONISTA, {
  descripcion: 'Consulta los bloques ocupados de la agenda de la doctora entre dos fechas. Todo lo que no aparezca como ocupado dentro del horario de atención está libre.',
  method: 'POST',
  url: 'https://www.googleapis.com/calendar/v3/freeBusy',
  auth: AUTH_GOOGLE('googleCalendarOAuth2Api'),
  body: `{ timeMin: ${ia('desde', 'Inicio del rango en ISO 8601 con zona -06:00, por ejemplo 2026-10-05T09:00:00-06:00')}, timeMax: ${ia('hasta', 'Fin del rango en ISO 8601 con zona -06:00, por ejemplo 2026-10-09T18:00:00-06:00')}, timeZone: 'America/Costa_Rica', items: [{ id: ${CFG}.googleCalendarId }] }`,
});
herramienta('bloquear_agenda', [2260, Y_CHAT + 700], RECEPCIONISTA, {
  descripcion: 'Crea la cita en la agenda de la doctora. Úsala solo después de que la paciente confirme el horario.',
  method: 'POST',
  url: `=https://www.googleapis.com/calendar/v3/calendars/{{ encodeURIComponent(${CFG}.googleCalendarId) }}/events`,
  auth: AUTH_GOOGLE('googleCalendarOAuth2Api'),
  // Sin teléfono en el evento: el calendario solo necesita nombre y motivo
  body: `{ summary: 'Cita: ' + (${CHAT}.nombre || 'Paciente') + ' (' + ${ia('tratamiento', 'Tratamiento o motivo de la cita')} + ')', description: 'Reservada por la Recepcionista VIP por WhatsApp', start: { dateTime: ${ia('inicio', 'Inicio de la cita en ISO 8601 con zona -06:00')}, timeZone: 'America/Costa_Rica' }, end: { dateTime: ${ia('fin', 'Fin de la cita, 60 minutos despues del inicio, en ISO 8601 con zona -06:00')}, timeZone: 'America/Costa_Rica' } }`,
});
herramienta('registrar_cita', [2380, Y_CHAT + 700], RECEPCIONISTA, {
  descripcion: 'Registra la cita confirmada en el sistema de la clínica (portal y recordatorios). Úsala después de bloquear_agenda.',
  method: 'POST',
  url: `={{ ${CFG}.apiUrl }}/n8n/citas`,
  auth: AUTH_API,
  body: `{ nombre: ${CHAT}.nombre || 'Paciente WhatsApp', telefono: ${CHAT}.from, fecha: ${ia('fecha', 'Fecha de la cita en formato AAAA-MM-DD')}, hora: ${ia('hora', 'Hora de la cita, por ejemplo 3:30 p. m.')}, tratamiento: ${ia('tratamiento', 'Tratamiento o motivo de la cita')} }`,
});

// Si el agente no pudo responder (IA caída), la paciente recibe contención y la doctora un aviso
const RESPUESTA_ENFERMERA = code('Respuesta · Enfermera', [2240, Y_CHAT + 60], () => {
  const p = $('Red de seguridad clínica').first().json.payload;
  const salida = $input.first().json.output;
  const texto = salida || 'Recibimos tu mensaje. La Dra. Laura lo está revisando y te escribe muy pronto. Si empeoras o es urgente, llama al 911.';
  return [{ json: { to: p.from, texto, sinIA: !salida, agente: 'Enfermera' } }];
}, { helpers: false });
const RESPUESTA_RECEPCION = code('Respuesta · Recepcionista', [2240, Y_CHAT + 500], () => {
  const p = $('Red de seguridad clínica').first().json.payload;
  const salida = $input.first().json.output;
  const texto = salida || 'Gracias por escribir. En un momento te respondemos por aquí para coordinar tu cita.';
  return [{ json: { to: p.from, texto, sinIA: !salida, agente: 'Recepcionista' } }];
}, { helpers: false });
const AVISO_SIN_IA = code('Aviso: mensaje sin responder', [2400, Y_CHAT + 280], () => {
  const r = $input.first().json;
  if (!r.sinIA) return [];
  const p = $('Red de seguridad clínica').first().json.payload;
  return [msg(cfg.clinicWhatsapp, 'alerta_clinica', ['Mensaje sin responder (' + r.agente + ')', p.nombre || 'Paciente', p.from, 'La IA no pudo responder. Escribió: ' + p.texto])];
});

// ════════════════════ Rama 2 · Check-in (Enfermera como analista emocional) ════════════════════
const Y_CHECKIN = 460;
const CONTEXTO_CHECKIN = code('Contexto del check-in', [1140, Y_CHECKIN], () => {
  // Minimización de datos: a la IA solo le llega el check-in, sin nombre ni teléfono
  const evento = $input.first().json.payload;
  const c = evento.checkin || {};
  const ANIMOS = { 'muy-bien': 'Muy bien', bien: 'Bien', regular: 'Regular', molestias: 'Con molestias', preocupacion: 'Con preocupación' };
  const contexto = [
    'Ánimo elegido: ' + (ANIMOS[c.mood] || c.mood),
    'Molestia en la zona tratada: ' + c.pain + ' de 10',
    'Día de recuperación: ' + (evento.recoveryDay != null ? evento.recoveryDay + 1 : 'sin tratamiento reciente'),
    'Nota de la paciente: ' + (c.note ? '"' + c.note + '"' : '(sin nota)'),
  ].join('\n');
  return [{ json: { contexto, evento } }];
}, { helpers: false });

const ANALISTA = add('Enfermera · Analista emocional', '@n8n/n8n-nodes-langchain.chainLlm', 1.9, [1400, Y_CHECKIN], {
  promptType: 'define',
  text: `=${PROMPT_ANALISTA}`,
  hasOutputParser: true,
}, { onError: 'continueRegularOutput' });
modelo('Modelo · Analista', [1340, Y_CHECKIN + 200], MODELO_PRINCIPAL, ANALISTA, 0);
parser('Formato del triaje', [1480, Y_CHECKIN + 200], {
  type: 'object',
  properties: {
    nivel: { type: 'string', enum: ['rojo', 'amarillo', 'verde'] },
    emociones: { type: 'array', items: { type: 'string' } },
    motivo: { type: 'string' },
  },
  required: ['nivel', 'motivo'],
}, ANALISTA);

const DECIDIR = code('Decidir escalamiento', [1700, Y_CHECKIN], () => {
  const { evento } = $('Contexto del check-in').first().json;
  const paciente = evento.patient || {};
  const c = evento.checkin || {};
  const ia = $input.first().json.output || null;
  // Regla fija de respaldo: si la IA falla o subestima, la regla del servidor manda
  const nivel = ia?.nivel || (c.needsFollowUp ? 'rojo' : 'verde');
  const escalar = nivel === 'rojo' || nivel === 'amarillo' || c.needsFollowUp;
  if (!escalar) return [];
  const etiqueta = nivel === 'rojo' || c.needsFollowUp ? 'Seguimiento urgente' : 'Atención hoy';
  const detalle = 'Check-in: molestia ' + c.pain + '/10. ' + (ia?.motivo || 'Análisis de IA no disponible; escalado por regla.') + (c.note ? ' Nota: ' + c.note : '');
  return [msg(cfg.clinicWhatsapp, 'alerta_clinica', [etiqueta, paciente.name, paciente.phone, detalle])];
});

// ════════════════════ Rama 3 · SOS (sin IA: respuesta inmediata) ════════════════════
const MSG_SOS = code('Mensajes: SOS', [1140, 700], () => {
  const evento = $input.first().json.payload;
  const paciente = evento.patient || {};
  const a = evento.alert || {};
  const MOTIVOS = { dolor: 'Dolor fuerte', inflamacion: 'La inflamación aumentó', aspecto: 'Algo no se ve como esperaba', duda: 'Duda urgente' };
  const detalle = 'SOS: ' + (MOTIVOS[a.reason] || a.reason) + (a.note ? '. Nota: ' + a.note : '');
  return [
    msg(cfg.clinicWhatsapp, 'alerta_clinica', ['Urgente', paciente.name, paciente.phone, detalle]),
    msg(paciente.phone, 'sos_recibido', [firstName(paciente.name)]),
  ];
});

// ════════════════════ Ramas 4 y 5 · Citas y acceso ════════════════════
const MSG_CITA = code('Mensajes: cita recibida', [1140, 860], () => {
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

const MSG_ACCESO = code('Mensajes: acceso al portal', [1140, 1020], () => {
  const evento = $input.first().json.payload;
  if (!evento.phone || !evento.link) return [];
  // La doctora entra al panel médico con su propia plantilla
  if (evento.role === 'doctor') return [msg(evento.phone, 'acceso_panel', [evento.link])];
  return [msg(evento.phone, 'acceso_portal', [firstName(evento.name), evento.link])];
});

// ════════════════════ Rama 6 · Preparar consultas (Recepcionista: resumen ejecutivo) ════════════════════
const Y_PREP = 1180;
const API_PREP = apiGet('API: consultas de hoy', [1140, Y_PREP],
  "/n8n/preparacion?fecha={{ $now.setZone('America/Costa_Rica').toFormat('yyyy-MM-dd') }}");
const SEPARAR = code('Separar consultas', [1360, Y_PREP], () => {
  // Una consulta por item. A la IA no le llegan teléfonos ni nombres.
  return ($input.first().json.items || []).map((c) => ({
    json: {
      citaId: c.citaId,
      paciente: c.paciente,
      hora: c.hora,
      contexto: [
        'Motivo de la cita: ' + c.motivo,
        'Mensaje al agendar: ' + (c.mensajeDeLaPaciente || '(ninguno)'),
        'Tratamientos previos: ' + (c.tratamientosPrevios.join('; ') || '(primera vez)'),
        'Productos aplicados: ' + (c.productosAplicados.join('; ') || '(ninguno registrado)'),
        'Próximos pasos del plan: ' + (c.proximosPasosDelPlan.join('; ') || '(sin plan todavía)'),
        'Últimos check-ins: ' + (c.ultimosCheckins.join('; ') || '(sin registros)'),
      ].join('\n'),
    },
  }));
}, { helpers: false });

const RESUMIDOR = add('Recepcionista · Resumen ejecutivo', '@n8n/n8n-nodes-langchain.chainLlm', 1.9, [1600, Y_PREP], {
  promptType: 'define',
  text: `=${PROMPT_RESUMEN}`,
  hasOutputParser: true,
}, { onError: 'continueRegularOutput' });
modelo('Modelo · Resumen', [1540, Y_PREP + 200], MODELO_PRINCIPAL, RESUMIDOR, 0.2);
parser('Formato del resumen', [1680, Y_PREP + 200], {
  type: 'object',
  properties: { punto_1: { type: 'string' }, punto_2: { type: 'string' }, punto_3: { type: 'string' } },
  required: ['punto_1', 'punto_2', 'punto_3'],
}, RESUMIDOR);

const MSG_RESUMEN = code('Mensajes: resumen para la doctora', [1860, Y_PREP], () => {
  const consultas = $('Separar consultas').all();
  return $input.all().map((item, i) => {
    const c = consultas[i].json;
    const r = item.json.output;
    // Sin IA disponible, la doctora igual recibe los datos crudos más importantes
    const lineas = c.contexto.split('\n');
    const puntos = r ? [r.punto_1, r.punto_2, r.punto_3] : [lineas[0], lineas[2], lineas[5]];
    return msg(cfg.clinicWhatsapp, 'resumen_consulta', [c.paciente, c.hora || 'hoy', ...puntos]);
  });
});

// El mismo resumen queda en la vista "Hoy" del panel de la doctora
const GUARDAR_RESUMEN = code('Resumen para el panel', [1860, Y_PREP + 160], () => {
  const consultas = $('Separar consultas').all();
  return $input.all().flatMap((item, i) => {
    const r = item.json.output;
    const c = consultas[i].json;
    if (!r || !c.citaId) return []; // sin IA, el panel muestra que el resumen no llegó
    return [{ json: { citaId: c.citaId, puntos: [r.punto_1, r.punto_2, r.punto_3] } }];
  });
}, { helpers: false });
const API_RESUMEN = add('API: guardar resumen', 'n8n-nodes-base.httpRequest', 4.2, [2080, Y_PREP + 160], {
  method: 'POST',
  url: `={{ ${CFG}.apiUrl }}/n8n/resumen`,
  authentication: 'genericCredentialType',
  genericAuthType: 'httpHeaderAuth',
  sendBody: true,
  specifyBody: 'json',
  jsonBody: '={{ JSON.stringify($json) }}',
  options: {},
}, { retryOnFail: true, maxTries: 3, waitBetweenTries: 2000, onError: 'continueRegularOutput' });

// ════════════════════ Ramas 7-9 · Rutinas de seguimiento ════════════════════
const API_CITAS = apiGet('API: citas confirmadas de mañana', [1140, 1340],
  "/n8n/citas?estado=confirmada&fecha={{ $now.setZone('America/Costa_Rica').plus({ days: 1 }).toFormat('yyyy-MM-dd') }}");
const MSG_RECORDATORIO = code('Mensajes: recordatorio 24 h', [1360, 1340], () => {
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

const API_SEGUIMIENTO = apiGet('API: pacientes en recuperación', [1140, 1500], '/n8n/seguimiento');
const MSG_SEGUIMIENTO = code('Mensajes: seguimiento', [1360, 1500], () => {
  // Días después del tratamiento en los que preguntamos cómo se siente
  const DIAS = [1, 3, 7, 14];
  const pacientes = $input.first().json.items || [];
  return pacientes
    .filter((p) => DIAS.includes(p.diasDesdeTratamiento))
    .map((p) => msg(p.phone, 'seguimiento_tratamiento', [firstName(p.name), cfg.portalUrl + '/portal']));
});

// Cada lunes: pasos de los próximos 7 días (hoy + 6), así cada paso se avisa una sola vez
const API_PASOS = apiGet('API: pasos de esta semana', [1140, 1660], '/n8n/retoques?dias=6');
const MSG_PASOS = code('Mensajes: próximos pasos', [1360, 1660], () => {
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

// ════════════════════ Ramas 10-12 · Panel de la doctora: confirmación, cancelación y campañas ════════════════════
const MSG_CONFIRMADA = code('Mensajes: cita confirmada', [1140, 1820], () => {
  const { patient = {}, cita = {} } = $input.first().json.payload;
  if (!patient.phone) return [];
  // Sin nombrar el tratamiento (discreción); sirve también para una cita reprogramada
  return [msg(patient.phone, 'cita_confirmada', [firstName(patient.name), fechaLarga(cita.fecha), cita.hora, cfg.portalUrl + '/portal'])];
});
const MSG_CANCELADA = code('Mensajes: cita cancelada', [1140, 1980], () => {
  const { patient = {}, cita = {} } = $input.first().json.payload;
  if (!patient.phone) return [];
  return [msg(patient.phone, 'cita_cancelada', [firstName(patient.name), fechaLarga(cita.fecha)])];
});
const MSG_CAMPANA = code('Mensajes: campaña', [1140, 2140], () => {
  // La API ya filtró a quienes aceptaron promociones; la plantilla incluye cómo darse de baja
  const { mensaje, destinatarios = [] } = $input.first().json.payload;
  return destinatarios.map((d) => msg(d.phone, 'promocion', [d.name, mensaje]));
});

// ════════════════════ Ramas 13-14 · Mantenimiento: respaldo y fallas ════════════════════
const RESPALDO = add('Respaldar hoja de datos', 'n8n-nodes-base.httpRequest', 4.2, [1140, 2300], {
  method: 'POST',
  url: `=https://www.googleapis.com/drive/v3/files/{{ ${CFG}.datosSheetId }}/copy`,
  authentication: 'predefinedCredentialType',
  nodeCredentialType: 'googleDriveOAuth2Api',
  sendBody: true,
  specifyBody: 'json',
  jsonBody: `={{ JSON.stringify({ name: 'Respaldo clínica ' + $now.setZone('America/Costa_Rica').toFormat('yyyy-MM-dd'), parents: [${CFG}.respaldoCarpetaId] }) }}`,
  options: {},
  // Sin onError: si el respaldo falla, el aviso de fallas le escribe a la doctora
}, { retryOnFail: true, maxTries: 3, waitBetweenTries: 10000 });
const MSG_FALLA = code('Mensajes: falla del sistema', [1140, 2460], () => {
  const p = $input.first().json.payload;
  return [msg(cfg.clinicWhatsapp, 'alerta_clinica', ['Falla del sistema', 'n8n', p.flujo, (p.nodo ? 'Nodo: ' + p.nodo + '. ' : '') + p.mensaje])];
});

const IGNORAR = add('Ignorar evento', 'n8n-nodes-base.noOp', 1, [1140, 2620], {});

// ════════════════════ Salidas: WhatsApp Cloud API ════════════════════
const RETRY = { retryOnFail: true, maxTries: 3, waitBetweenTries: 3000, onError: 'continueRegularOutput' };
const GRAPH_URL = `=https://graph.facebook.com/{{ ${CFG}.graphApiVersion }}/{{ ${CFG}.whatsappPhoneNumberId }}/messages`;

// Plantillas aprobadas (mensajes que inicia la clínica)
const ENVIAR = add('Enviar WhatsApp (plantilla)', 'n8n-nodes-base.httpRequest', 4.2, [2560, 700], {
  method: 'POST',
  url: GRAPH_URL,
  ...AUTH_API,
  sendBody: true,
  specifyBody: 'json',
  jsonBody:
    `={{ JSON.stringify({ messaging_product: 'whatsapp', to: $json.to, type: 'template', template: { name: $json.template, language: { code: ${CFG}.templateLanguage }, components: [{ type: 'body', parameters: $json.params.map(text => ({ type: 'text', text })) }] } }) }}`,
  options: {},
}, RETRY);

// Texto libre: solo para responder dentro de la ventana de 24 h que abre la paciente al escribir
const RESPONDER_WA = add('Responder por WhatsApp (texto)', 'n8n-nodes-base.httpRequest', 4.2, [2560, Y_CHAT + 200], {
  method: 'POST',
  url: GRAPH_URL,
  ...AUTH_API,
  sendBody: true,
  specifyBody: 'json',
  jsonBody: "={{ JSON.stringify({ messaging_product: 'whatsapp', to: $json.to, type: 'text', text: { body: String($json.texto).slice(0, 4000) } }) }}",
  options: {},
}, RETRY);

// ════════════════════ Conexiones ════════════════════
link(WEBHOOK, RESPONDER);
link(RESPONDER, NORMALIZAR);
link(WHATSAPP_IN, NORMALIZAR_WA);
link(CRON_PREPARACION, RUTINA_PREPARACION);
link(CRON_RECORDATORIO, RUTINA_RECORDATORIO);
link(CRON_SEGUIMIENTO, RUTINA_SEGUIMIENTO);
link(CRON_PASOS, RUTINA_PASOS);
link(MANUAL, TODAS);
link(CRON_RESPALDO, RUTINA_RESPALDO);
link(ERROR_IN, NORMALIZAR_ERROR);
[NORMALIZAR, NORMALIZAR_WA, RUTINA_PREPARACION, RUTINA_RECORDATORIO, RUTINA_SEGUIMIENTO, RUTINA_PASOS, TODAS, RUTINA_RESPALDO, NORMALIZAR_ERROR]
  .forEach((n) => link(n, CONFIG));
link(CONFIG, ROUTER);

// Salidas del Router en el mismo orden que RUTAS (+ respaldo)
const SALIDAS = [SEGURIDAD, CONTEXTO_CHECKIN, MSG_SOS, MSG_CITA, MSG_ACCESO, API_PREP, API_CITAS, API_SEGUIMIENTO, API_PASOS,
  MSG_CONFIRMADA, MSG_CANCELADA, MSG_CAMPANA, RESPALDO, MSG_FALLA];
if (SALIDAS.length !== RUTAS.length) throw new Error('Cada ruta del Router necesita su nodo de salida');
SALIDAS.forEach((n, i) => link(ROUTER, n, i));
link(ROUTER, IGNORAR, RUTAS.length);

// Chat: red de seguridad → emergencia o clasificador → agentes
link(SEGURIDAD, RUTA_CHAT);
link(RUTA_CHAT, MSG_EMERGENCIA, 0);
link(RUTA_CHAT, TXT_EMERGENCIA, 0);
link(RUTA_CHAT, CLASIFICADOR, 1);
link(RUTA_CHAT, API_BAJA, 2);
link(API_BAJA, TXT_BAJA);
link(CLASIFICADOR, ENFERMERA, 0); // clinica
link(CLASIFICADOR, RECEPCIONISTA, 1); // administrativa
link(CLASIFICADOR, ENFERMERA, 2); // sin categoría clara → la opción clínica es la más segura
link(ENFERMERA, RESPUESTA_ENFERMERA);
link(RECEPCIONISTA, RESPUESTA_RECEPCION);
[TXT_EMERGENCIA, RESPUESTA_ENFERMERA, RESPUESTA_RECEPCION, TXT_BAJA].forEach((n) => link(n, RESPONDER_WA));
[RESPUESTA_ENFERMERA, RESPUESTA_RECEPCION].forEach((n) => link(n, AVISO_SIN_IA));

// Check-in y preparación de consultas
link(CONTEXTO_CHECKIN, ANALISTA);
link(ANALISTA, DECIDIR);
link(API_PREP, SEPARAR);
link(SEPARAR, RESUMIDOR);
link(RESUMIDOR, MSG_RESUMEN);
link(RESUMIDOR, GUARDAR_RESUMEN);
link(GUARDAR_RESUMEN, API_RESUMEN);
link(API_CITAS, MSG_RECORDATORIO);
link(API_SEGUIMIENTO, MSG_SEGUIMIENTO);
link(API_PASOS, MSG_PASOS);

[MSG_EMERGENCIA, AVISO_SIN_IA, DECIDIR, MSG_SOS, MSG_CITA, MSG_ACCESO, MSG_RESUMEN, MSG_RECORDATORIO, MSG_SEGUIMIENTO, MSG_PASOS,
  MSG_CONFIRMADA, MSG_CANCELADA, MSG_CAMPANA, MSG_FALLA]
  .forEach((n) => link(n, ENVIAR));

// ════════════════════ Notas en el lienzo ════════════════════
const nota = (name, position, width, height, content, color) =>
  add(name, 'n8n-nodes-base.stickyNote', 1, position, { content, width, height, ...(color ? { color } : {}) });
nota('Nota: cerebro', [-40, -300], 820, 240,
  '## 🧠 Cerebro maestro · Clínica Dra. Laura\n**Entradas:** eventos de la API (citas, confirmaciones, acceso, check-in, SOS, campañas), WhatsApp entrante (chat con agentes y "BAJA"), CRON diarios, respaldo del domingo y **Falla en un flujo**.\nTodo pasa por **Configuración** (edítala una sola vez) y el **Router por acción**.\n**Probar ahora** ejecuta las rutinas diarias. En *Settings → Error workflow* de este flujo y del flujo **API** elige este mismo flujo.');
nota('Nota: multi-agente', [1100, Y_CHAT - 420], 1480, 180,
  '## 🤖 Equipo de agentes\n**Red de seguridad (sin IA)** → emergencias directo a la doctora. **Clasificador** → **Agente IA 1 · Enfermera Virtual** (triaje clínico, puede despertar a la doctora) o **Agente IA 2 · Recepcionista VIP** (agenda y reservas). Cada agente tiene su propio modelo, memoria y herramientas: la recepcionista no ve datos clínicos y la enfermera no puede reservar.', 5);
nota('Nota: IA con respaldo', [1100, Y_CHECKIN - 180], 820, 140,
  '### Check-in y resumen con respaldo\nSi la IA falla, el check-in se escala con la regla fija del servidor y la doctora recibe el resumen con los datos crudos. A la IA nunca le llegan teléfonos.', 4);

// ════════════════════ Flujo ════════════════════
const workflow = {
  name: 'Clínica · Cerebro maestro multi-agente',
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
console.log(`✓ ${path.relative(process.cwd(), OUT_FILE)}: ${nodes.length} nodos`);
