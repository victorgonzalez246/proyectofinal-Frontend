/* eslint-disable no-unused-vars -- las funciones de HELPERS se usan dentro de n8n, no aquí */
// Genera el flujo único de n8n: n8n/flujos/cerebro-maestro-clinica.json
// Uso: node n8n/generar-cerebro.mjs
// Si editas el flujo dentro de n8n, puedes simplemente exportarlo y reemplazar el JSON.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PLANTILLAS } from './plantillas.mjs';
import { cargarContenidoClinico, baseClinicaCsv, listaNatural, ARCHIVO_CSV } from './contenido-clinico.mjs';

// Textos clínicos aprobados por la doctora: REVISION-DOCTORA.md (si tiene un error de formato, se detiene aquí)
const CLINICO = cargarContenidoClinico();

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
  // boton: valor de la variable de un botón (URL dinámica o código de verificación); las URL fijas van en la plantilla
  // texto: el mismo mensaje ya rellenado, para el modo pruebas (texto libre mientras Meta revisa las plantillas)
  const msg = (to, template, params, boton) => ({
    json: { to: toWa(to), template, params: params.map(clean), ...(boton ? { boton: clean(boton) } : {}), texto: textoPrueba(template, params.map(clean)) },
  });
  // ── Modo pruebas (Configuración: modoPruebas = "si") ──
  // PLANTILLAS se inserta al generar el flujo (n8n/plantillas.mjs)
  const textoPrueba = (template, params) => {
    const p = PLANTILLAS[template];
    if (!p) return params.join(' · ');
    const cuerpo = p.cuerpo.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] ?? '');
    return p.boton ? `${cuerpo}\n\n${p.boton.texto}: ${cfg.portalUrl}${p.boton.ruta}` : cuerpo;
  };
  const enPruebas = String(cfg.modoPruebas || '').trim().toLowerCase() === 'si';
  // En pruebas solo se escribe a los números de la lista (con código de país): evita escribir a pacientes ficticias
  const numerosPrueba = String(cfg.numerosPrueba || '').split(',').map((n) => toWa(n)).filter(Boolean);
  const filtrarPruebas = (salida) =>
    enPruebas && Array.isArray(salida)
      ? salida.filter((item) => !item?.json?.to || numerosPrueba.includes(item.json.to))
      : salida;
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
// `index` es la entrada del nodo destino (p. ej. 1 = "Fallback Model" de un agente)
const link = (from, to, output = 0, kind = 'main', index = 0) => {
  connections[from] ??= {};
  connections[from][kind] ??= [];
  const outs = connections[from][kind];
  while (outs.length <= output) outs.push([]);
  outs[output].push({ node: to, type: kind, index });
};

// Los nodos con HELPERS pasan su salida por filtrarPruebas (en modo pruebas solo quedan los números de la lista)
// vars: constantes que se insertan al inicio del nodo (p. ej. los textos de REVISION-DOCTORA.md)
const code = (name, position, fn, { helpers = true, vars = {} } = {}) => {
  const consts = Object.entries(vars).map(([k, v]) => `const ${k} = ${JSON.stringify(v)};\n`).join('');
  return add(name, 'n8n-nodes-base.code', 2, position, {
    jsCode: helpers
      ? `${consts}const PLANTILLAS = ${JSON.stringify(PLANTILLAS)};\n${HELPERS}\nreturn filtrarPruebas(await (async () => {\n${bodyOf(fn)}\n})());`
      : consts + bodyOf(fn),
  });
};

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
// Los 5 modelos son "Google Gemini Chat Model" (multimodal: las agentes ven las fotos gracias a
// passthroughBinaryImages). Gemini 3.6 Flash para las dos agentes que conversan (3.5 Flash devolvía 503
// "high demand" y tardaba 11-17 s); Flash-Lite (más rápido y barato) para clasificar, analizar check-ins y
// resumir, y como modelo de respaldo ("Fallback Model") de cada agente si el principal falla.
// La credencial se referencia solo por nombre: al importar, n8n la enlaza con la credencial
// "Google Gemini(PaLM) Api" de ese nombre. La API key vive solo en n8n.
const MODELO_PRINCIPAL = 'models/gemini-3.6-flash';
const MODELO_RAPIDO = 'models/gemini-3.5-flash-lite';
const MODELO_RESPALDO = MODELO_RAPIDO;
const CRED_GEMINI = { credentials: { googlePalmApi: { name: 'Gemini - Aura y WhatsApp' } } };
// Reintentos ante errores pasajeros de Gemini (503 "high demand", 429)
const REINTENTOS_IA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 };

// entrada: 0 = modelo principal; 1 = modelo de respaldo del agente (requiere needsFallback en el agente)
const modelo = (name, position, modelName, target, temperature, entrada = 0) => {
  add(name, '@n8n/n8n-nodes-langchain.lmChatGoogleGemini', 1.1, position, {
    modelName,
    options: temperature === undefined ? {} : { temperature },
  }, { ...REINTENTOS_IA, ...CRED_GEMINI });
  link(name, target, 0, 'ai_languageModel', entrada);
};

// Una sola conversación por paciente: la Enfermera y la Recepcionista comparten el historial
// (el clasificador puede mandar cada mensaje a un agente distinto sin que se pierda el contexto)
const memoria = (name, position, target) => {
  add(name, '@n8n/n8n-nodes-langchain.memoryBufferWindow', 1.3, position, {
    sessionIdType: 'customKey',
    sessionKey: `={{ 'chat-' + ${CHAT}.from }}`,
    contextWindowLength: 20,
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
// Notas de voz y fotos (se insertan en los prompts; en Cloud se pegan tal cual, ver n8n/README.md sección 8)
const PROMPT_MEDIOS_ENFERMERA = `Notas de voz y fotos
Si el mensaje empieza con "[Nota de voz transcrita]", es lo que la paciente te dijo en audio (la transcripción puede tener errores pequeños). Si dice "[Foto enviada]", la paciente te mandó una foto y la puedes ver: coméntala con prudencia y calidez, sin diagnosticar, relacionándola con su tratamiento y lo que la doctora aprobó. Ante signos de alarma visibles (zonas blancas, pálidas o moradas que sugieran necrosis, ampollas, pus o signos de infección, asimetría súbita importante) usa "despertar_doctora" de inmediato y díselo con calma.`;
const PROMPT_MEDIOS_RECEPCION = `Notas de voz y fotos: si el mensaje empieza con "[Nota de voz transcrita]", es lo que la paciente dijo en audio. Si dice "[Foto enviada]", puedes verla, pero no evalúas fotos de la zona tratada ni diagnosticas: dile con cariño que la enfermera de la clínica la revisa y que te cuente cómo se siente. Si en la foto ves signos de alarma (zonas blancas, pálidas o moradas, ampollas, pus, asimetría súbita importante), pídele que describa lo que siente para que la enfermera avise a la doctora de inmediato y, si empeora, que llame al 911.`;
const PROMPT_ENFERMERA = `Eres la enfermera de la clínica de armonización facial de la Dra. Laura Jiménez, en Escazú, Costa Rica. Conversas por WhatsApp con pacientes de la doctora, casi siempre en los días después de un tratamiento, que es cuando aparecen las dudas, la hinchazón inesperada y a veces el miedo.

Quién eres en esta conversación
No eres un menú de respuestas. Eres alguien que escucha de verdad: lees lo que la paciente dice y también lo que no dice (el susto detrás de un "¿es normal?", el cansancio, la vergüenza de preguntar algo "tonto"). Respondes a la persona, no solo a la pregunta. Si está asustada, primero la acompañas y después explicas. Si está contenta con su resultado, te alegras con ella. Si solo saluda o agradece, conversas con naturalidad y le preguntas cómo va; un saludo no es una emergencia.

Cómo piensas antes de responder
1. Consulta "ficha_paciente" para saber quién es, qué tratamiento se hizo, en qué día de recuperación va y qué cuidados le indicó la doctora. Usa su nombre y ese contexto: no es lo mismo una hinchazón al día 2 que al día 10.
2. Consulta "base_clinica": es el criterio clínico que la doctora aprobó. Razona a partir de él y de la ficha para responder la situación concreta de la paciente con tus propias palabras, como lo explicaría una enfermera con experiencia. No lo copies literal y no inventes datos clínicos que no salgan de ahí o de la ficha.
3. Si la duda clínica no está cubierta por lo que la doctora aprobó, no improvises: dile con honestidad que esa respuesta debe dártela la doctora, que ya le avisas, y usa "despertar_doctora".
4. Ten en cuenta todo el historial de la conversación (lo comparte la recepción): retoma lo que ya contó, no repitas preguntas y nota si algo va mejorando o empeorando entre mensajes.

Lo que nunca cambia, por la seguridad de la paciente
- No diagnosticas, no recomiendas medicamentos ni dosis y no contradices ni cambias indicaciones de la doctora.
- Usa "despertar_doctora" si la paciente menciona: ${listaNatural(CLINICO.motivos)}. Ante la duda, avisa: es preferible una alerta de más que una de menos. Cuando lo hagas, díselo a la paciente con calma ("ya le escribí a la doctora para que te contacte").
- Si hay dificultad para respirar, hinchazón de garganta o lengua, dolor en el pecho o pérdida de visión: pídele que llame al 911 de inmediato y usa "despertar_doctora".
- Nunca compartas datos de otras pacientes.
- Si te preguntan si eres una persona o una IA, di la verdad con naturalidad: eres la asistente virtual de la clínica y la doctora supervisa lo que conversan.

${PROMPT_MEDIOS_ENFERMERA}

Citas, horarios y pagos los lleva la recepción: si salen en la conversación, dile con gusto que la ayudan y pídele qué día y hora le quedan mejor.

Cómo hablas
Español de Costa Rica, cercano y sereno, de tú. Mensajes de WhatsApp: cortos, humanos, sin listas ni tecnicismos, sin sonar a formulario. Normalmente 2 a 5 frases; si la paciente está angustiada, puedes extenderte un poco para acompañarla. Varía tus palabras: nada de frases hechas repetidas en cada mensaje.`;

const PROMPT_RECEPCIONISTA = `Eres la Recepcionista VIP de la clínica de armonización facial de la Dra. Laura Jiménez (Costa Rica). Atiendes por WhatsApp solo temas administrativos: agendar, reprogramar o cancelar citas, horarios, ubicación y paquetes.

Datos de la clínica: Escazú, San José. Atención de lunes a viernes de 9:00 a 18:00 (hora de Costa Rica, UTC-06:00). Cada cita dura 60 minutos. Hoy es {{ $now.setZone('America/Costa_Rica').toFormat("cccc d 'de' LLLL yyyy", { locale: 'es' }) }}.

Cómo agendas:
1. Usa "ficha_recepcion" para saludar por su nombre y ver su próxima cita y sus paquetes.
2. Pregunta qué tratamiento le interesa y qué días le quedan mejor.
3. Usa "disponibilidad_agenda" y ofrece como máximo 3 horarios libres dentro del horario de atención.
4. Solo cuando la paciente confirme de forma explícita un horario: usa primero "bloquear_agenda" y después "registrar_cita". Si alguna falla, no confirmes y ofrece otro horario.
5. Confirma la fecha y la hora en una frase clara.

Reglas: no inventes precios (la doctora los define en la valoración), no das información clínica y no ves historiales médicos. Si la paciente habla de síntomas, dolor o cuidados, dile con amabilidad que la enfermera de la clínica la atiende y que le cuente su duda.

${PROMPT_MEDIOS_RECEPCION}

Cómo hablas: como una recepcionista de confianza que conoce a sus pacientes, no como un sistema de reservas. Español de Costa Rica, cálido y de tú; mensajes cortos de WhatsApp (2 a 4 frases), sin listas largas ni frases hechas repetidas. Si la paciente cuenta algo personal (está nerviosa, es su primera vez, viene por un evento especial), respóndele a eso también. Usa el historial compartido para no volver a preguntar lo que ya dijo.`;

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
  // Mensajes de pacientes. Se ignoran estados de entrega (statuses), reacciones, stickers y avisos del sistema.
  // tipo: "texto" (también botones y listas, con su título), "audio" (se transcribe), "imagen" (la ve el agente)
  // o "no_texto" (video, documento, ubicación...: respuesta corta sin IA).
  // contenido: lo que dijo o escribió la paciente (la red de seguridad lo revisa); texto: lo que leen la IA y la memoria.
  const raw = $input.first().json;
  const value = raw.messages ? raw : (raw.entry?.[0]?.changes?.[0]?.value || {});
  const mensaje = (value.messages || [])[0];
  if (!mensaje) return [];
  const OTROS = ['video', 'document', 'location', 'contacts', 'unsupported'];
  const opcion = mensaje.interactive?.button_reply || mensaje.interactive?.list_reply;
  let contenido = '';
  let tipo = 'texto';
  let medio = null;
  if (mensaje.type === 'text') contenido = mensaje.text?.body || '';
  else if (mensaje.type === 'button') contenido = mensaje.button?.text || mensaje.button?.payload || '';
  else if (mensaje.type === 'interactive') contenido = opcion?.title || '';
  else if (mensaje.type === 'audio' || mensaje.type === 'voice') {
    tipo = 'audio';
    medio = mensaje[mensaje.type] || {};
  } else if (mensaje.type === 'image') {
    tipo = 'imagen';
    medio = mensaje.image || {};
    contenido = medio.caption || '';
  } else if (OTROS.includes(mensaje.type)) {
    tipo = 'no_texto';
    contenido = mensaje[mensaje.type]?.caption || '';
  } else return [];
  if (tipo === 'texto' && !String(contenido).trim()) return [];
  contenido = String(contenido).slice(0, 1400);
  const texto = tipo === 'imagen' ? '[Foto enviada' + (contenido ? ': ' + contenido : '') + ']' : contenido;
  const contacto = (value.contacts || [])[0] || {};
  return [{
    json: {
      accion: 'chat_whatsapp',
      payload: {
        from: mensaje.from, nombre: contacto.profile?.name || '', texto, contenido, messageId: mensaje.id,
        tipo, tipoOriginal: mensaje.type, mediaId: medio?.id || '',
      },
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
  // Meta retira cada versión unos 2 años después de lanzarla: v26.0 (jul 2026) es la vigente más reciente
  ['graphApiVersion', 'v26.0'],
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
  // "si": mientras Meta revisa las plantillas, los mensajes salen como texto libre (solo llegan a quien escribió
  // a la clínica en las últimas 24 h) y únicamente a numerosPrueba (con código de país, separados por coma)
  ['modoPruebas', 'no'],
  ['numerosPrueba', ''],
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
const Y_MEDIO = Y_CHAT - 760;

// ── Notas de voz y fotos: se descargan de Meta antes de la red de seguridad ──
// Modo pruebas: los audios, fotos y demás formatos de números fuera de numerosPrueba no se procesan ni se responden
const REVISAR_ADJUNTO = code('Revisar adjunto', [1140, Y_MEDIO], () => {
  const cfg = $('Configuración').first().json;
  const item = $input.first().json;
  const p = item.payload;
  if (p.tipo === 'texto') return [{ json: item }];
  const toWa = (n) => {
    const d = String(n || '').replace(/\D/g, '');
    return d.length === 8 ? '506' + d : d;
  };
  const enPruebas = String(cfg.modoPruebas || '').trim().toLowerCase() === 'si';
  const numerosPrueba = String(cfg.numerosPrueba || '').split(',').map(toWa).filter(Boolean);
  if (enPruebas && !numerosPrueba.includes(toWa(p.from))) return [];
  if ((p.tipo === 'audio' || p.tipo === 'imagen') && !p.mediaId) return [{ json: { ...item, payload: { ...p, tipo: 'medio_fallido' } } }];
  return [{ json: item }];
}, { helpers: false });

const RUTA_ADJUNTO = router('¿Nota de voz o foto?', [1360, Y_MEDIO], 'payload.tipo', [['audio', 'Nota de voz'], ['imagen', 'Foto']], 'Texto u otro');

// 1) Meta da una URL temporal (5 min) del medio; 2) se descarga con el mismo token (credencial "WhatsApp Cloud API")
const META_INFO = add('Meta: datos del medio', 'n8n-nodes-base.httpRequest', 4.2, [1580, Y_MEDIO], {
  url: `=https://graph.facebook.com/{{ ${CFG}.graphApiVersion }}/{{ $json.payload.mediaId }}`,
  ...AUTH_API,
  options: { timeout: 15000 },
}, { retryOnFail: true, maxTries: 2, waitBetweenTries: 1000, onError: 'continueRegularOutput' });
const META_DESCARGA = add('Meta: descargar medio', 'n8n-nodes-base.httpRequest', 4.2, [1800, Y_MEDIO], {
  url: '={{ $json.url }}',
  ...AUTH_API,
  options: { timeout: 30000, response: { response: { responseFormat: 'file', outputPropertyName: 'data' } } },
}, { retryOnFail: true, maxTries: 2, waitBetweenTries: 1000, onError: 'continueRegularOutput' });

const REVISAR_DESCARGA = code('Revisar descarga', [2020, Y_MEDIO], () => {
  // Límites de WhatsApp: audio 16 MB, imagen 5 MB (el tope lo pone WhatsApp; Gemini acepta hasta 20 MB por petición)
  const LIMITE_MB = { audio: 16, imagen: 5 };
  const item = $('Revisar adjunto').first().json;
  const p = item.payload;
  const info = $('Meta: datos del medio').first().json || {};
  const entrada = $input.first();
  const archivo = entrada.binary?.data;
  const mimeType = String(info.mime_type || archivo?.mimeType || '').split(';')[0].trim();
  const bytes = Number(info.file_size) || 0;
  const ok = archivo && !entrada.json?.error && bytes <= LIMITE_MB[p.tipo] * 1024 * 1024
    && mimeType.startsWith(p.tipo === 'audio' ? 'audio/' : 'image/');
  if (!ok) return [{ json: { ...item, payload: { ...p, tipo: 'medio_fallido' } } }];
  return [{ json: item, binary: { data: { ...archivo, mimeType } } }];
}, { helpers: false });

const RUTA_AUDIO = router('¿Es nota de voz?', [2240, Y_MEDIO], 'payload.tipo', [['audio', 'Nota de voz']], 'Foto o fallo');

// Nodo nativo de Google Gemini (credencial "Gemini - Aura y WhatsApp", la misma de los modelos): transcribe el audio descargado
const PROMPT_TRANSCRIPCION = 'Transcribe literalmente esta nota de voz de WhatsApp, en el idioma en que se habla (normalmente español de Costa Rica). Devuelve solo la transcripción: sin comentarios, sin marcas de tiempo y sin etiquetas de hablante. Si no se entiende nada, responde exactamente [inaudible].';
const GEMINI = add('Gemini · Transcribir nota de voz', '@n8n/n8n-nodes-langchain.googleGemini', 1, [2460, Y_MEDIO], {
  resource: 'audio',
  operation: 'analyze',
  modelId: { __rl: true, mode: 'id', value: 'models/gemini-3.5-flash' },
  text: PROMPT_TRANSCRIPCION,
  inputType: 'binary',
  binaryPropertyName: 'data',
  simplify: true,
  options: {},
}, { ...REINTENTOS_IA, onError: 'continueRegularOutput', ...CRED_GEMINI });

const TEXTO_AUDIO = code('Texto de la nota de voz', [2680, Y_MEDIO], () => {
  // La transcripción pasa a ser el mensaje (y queda así en la memoria de la conversación)
  const item = $('Revisar adjunto').first().json;
  const p = item.payload;
  const r = $input.first().json || {};
  const t = (r.content?.parts || []).filter((x) => !x.thought).map((x) => x.text || '').join(' ').replace(/\s+/g, ' ').trim();
  if (!t || /^\[?inaudible\]?\.?$/i.test(t)) return [{ json: { ...item, payload: { ...p, tipo: 'medio_fallido' } } }];
  const contenido = t.slice(0, 1400);
  return [{ json: { ...item, payload: { ...p, contenido, texto: '[Nota de voz transcrita] ' + contenido } } }];
}, { helpers: false });

const SEGURIDAD = code('Red de seguridad clínica', [1140, Y_CHAT], () => {
  // Regla fija, sin IA: una emergencia nunca depende de un modelo de lenguaje.
  // Revisa lo que la paciente escribió, dijo en la nota de voz (transcrita) o puso al pie de la foto.
  const entrada = $input.first();
  const item = entrada.json;
  const texto = String(item.payload.contenido ?? item.payload.texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // SENALES: REVISION-DOCTORA.md, sección 2 (se inserta al generar, ya sin tildes)
  const senal = SENALES.find((s) => texto.includes(s));
  // "BAJA" (solo esa palabra) deja de enviar promociones; una emergencia siempre tiene prioridad
  const baja = !senal && /^\s*(baja|stop)\s*[.!]*\s*$/.test(texto);
  // Video, documento, ubicación... o un audio/foto que no se pudo abrir: respuesta corta sin IA
  const noSoportado = !senal && !baja && ['no_texto', 'medio_fallido'].includes(item.payload.tipo);
  const ruta = senal ? 'emergencia' : baja ? 'baja' : noSoportado ? 'no_soportado' : 'conversacion';
  // La foto (binario) sigue hasta el agente para que la vea
  return [{ json: { ...item, ruta, senal: senal || '' }, ...(entrada.binary ? { binary: entrada.binary } : {}) }];
}, { helpers: false, vars: { SENALES: CLINICO.senales } });

const RUTA_CHAT = router('¿Emergencia?', [1360, Y_CHAT], 'ruta', [['emergencia', 'Emergencia'], ['conversacion', 'Conversación'], ['baja', 'Baja de promociones'], ['no_soportado', 'Formato no soportado']]);

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

// Sin IA (el modo pruebas ya lo aplicó "Revisar adjunto")
const TXT_NO_SOPORTADO = code('Respuesta: formato no soportado', [1600, Y_CHAT + 900], () => {
  const p = $('Red de seguridad clínica').first().json.payload;
  const FALLO = {
    audio: 'No logré escuchar bien tu nota de voz 🙏 ¿Me la envías de nuevo o me lo escribes?',
    voice: 'No logré escuchar bien tu nota de voz 🙏 ¿Me la envías de nuevo o me lo escribes?',
    image: 'No pude abrir tu foto 🙏 ¿Me la envías de nuevo o me cuentas por escrito qué notas?',
  };
  const texto = p.tipo === 'medio_fallido'
    ? FALLO[p.tipoOriginal] || 'No pude abrir lo que me enviaste 🙏 ¿Me lo escribes?'
    : 'Por ahora puedo leer texto, escuchar notas de voz y ver fotos 🙏 ¿Me lo cuentas así?';
  return [{ json: { to: p.from, texto } }];
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
      { category: 'clinica', description: 'Dudas de salud, síntomas, dolor, inflamación, cuidados posteriores, fotos de la zona tratada, emociones o miedo después de un tratamiento.' },
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
  needsFallback: true,
  // returnIntermediateSteps: "Alerta para el panel · Enfermera" ve si usó despertar_doctora y con qué motivo
  options: { systemMessage: PROMPT_ENFERMERA, maxIterations: 8, passthroughBinaryImages: true, returnIntermediateSteps: true },
}, { onError: 'continueRegularOutput' });
modelo('Modelo · Enfermera', [1780, Y_CHAT + 260], MODELO_PRINCIPAL, ENFERMERA);
modelo('Modelo respaldo · Enfermera', [1780, Y_CHAT + 380], MODELO_RESPALDO, ENFERMERA, undefined, 1);
memoria('Memoria · Enfermera', [1900, Y_CHAT + 260], ENFERMERA);
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
  // En modo pruebas la alerta sale como texto libre (la plantilla alerta_clinica aún no está aprobada)
  body: `((motivo) => String(${CFG}.modoPruebas || '').trim().toLowerCase() === 'si'
    ? { messaging_product: 'whatsapp', to: ${CFG}.clinicWhatsapp, type: 'text', text: { body: 'Hola doctora, alerta de la Enfermera IA. Paciente: ' + (${CHAT}.nombre || 'Paciente') + ', teléfono ' + ${CHAT}.from + '. Lo que ocurrió: ' + motivo + '. Puede ver los detalles en el panel médico.' } }
    : { messaging_product: 'whatsapp', to: ${CFG}.clinicWhatsapp, type: 'template', template: { name: 'alerta_clinica', language: { code: ${CFG}.templateLanguage }, components: [{ type: 'body', parameters: [{ type: 'text', text: 'Enfermera IA' }, { type: 'text', text: ${CHAT}.nombre || 'Paciente' }, { type: 'text', text: ${CHAT}.from }, { type: 'text', text: motivo }] }] } })(String(${ia('motivo', 'Motivo de la alerta en una sola frase')}).replace(/\\s+/g, ' ').slice(0, 900))`,
});

// Agente IA 2 · Recepcionista VIP
const RECEPCIONISTA = add('Agente IA 2 · Recepcionista VIP', '@n8n/n8n-nodes-langchain.agent', 3.1, [1900, Y_CHAT + 500], {
  promptType: 'define',
  text: `={{ ${CHAT}.texto }}`,
  needsFallback: true,
  options: { systemMessage: `=${PROMPT_RECEPCIONISTA}`, maxIterations: 10, passthroughBinaryImages: true },
}, { onError: 'continueRegularOutput' });
modelo('Modelo · Recepcionista', [1780, Y_CHAT + 700], MODELO_PRINCIPAL, RECEPCIONISTA);
modelo('Modelo respaldo · Recepcionista', [1780, Y_CHAT + 820], MODELO_RESPALDO, RECEPCIONISTA, undefined, 1);
memoria('Memoria · Recepcionista', [1900, Y_CHAT + 700], RECEPCIONISTA);
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

// ── Alertas para el panel de la doctora (Alertas y Hoy) ──
// Cada aviso urgente por WhatsApp queda también registrado en la API (POST /n8n/alerta).
// Van DESPUÉS del aviso: n8n (orden v1) ejecuta primero la rama más alta del lienzo, así que estos nodos
// están más abajo que sus hermanos de WhatsApp. "API: registrar alerta" tiene onError y timeout corto:
// si la API falla, la doctora y la paciente ya recibieron su mensaje y el flujo sigue.
const ALERTA_EMERGENCIA = code('Alerta para el panel · emergencia', [1820, Y_CHAT - 40], () => {
  const item = $input.first().json;
  const p = item.payload || {};
  return [{
    json: {
      telefono: p.from, nombre: p.nombre || '', origen: 'whatsapp', tipo: 'emergencia',
      motivo: 'Señal de alarma en el chat' + (item.senal ? ': "' + item.senal + '"' : ''),
      nota: String('Escribió: ' + (p.texto || '')).slice(0, 1000),
    },
  }];
}, { helpers: false });

// despertar_doctora es una herramienta (HTTP Request Tool) del agente: hace UNA sola petición (el WhatsApp).
// En lugar de darle a la IA una segunda herramienta que podría olvidar usar, el agente devuelve sus pasos
// (returnIntermediateSteps) y este nodo registra la alerta si la herramienta se usó, con el motivo que escribió la IA.
const ALERTA_ENFERMERA = code('Alerta para el panel · Enfermera', [2240, Y_CHAT + 160], () => {
  const r = $input.first().json || {};
  const pasos = Array.isArray(r.intermediateSteps) ? r.intermediateSteps : [];
  const usos = pasos.filter((s) => String(s?.action?.tool || '').toLowerCase().includes('despertar_doctora'));
  if (!usos.length) return [];
  const p = $('Red de seguridad clínica').first().json.payload;
  const entrada = usos[usos.length - 1].action.toolInput || {};
  const motivo = String(entrada.motivo ?? entrada.input?.motivo ?? (typeof entrada === 'string' ? entrada : '')).replace(/\s+/g, ' ').trim();
  return [{
    json: {
      telefono: p.from, nombre: p.nombre || '', origen: 'whatsapp', tipo: 'enfermera',
      motivo: (motivo || 'La Enfermera IA pidió que la doctora revise este caso').slice(0, 300),
      nota: String('Escribió: ' + (p.texto || '')).slice(0, 1000),
    },
  }];
}, { helpers: false });

const ALERTA_SIN_IA = code('Alerta para el panel · sin respuesta', [2400, Y_CHAT + 400], () => {
  const r = $input.first().json || {};
  if (!r.sinIA) return [];
  const p = $('Red de seguridad clínica').first().json.payload;
  return [{
    json: {
      telefono: p.from, nombre: p.nombre || '', origen: 'whatsapp', tipo: 'ia_sin_respuesta',
      motivo: 'La IA (' + r.agente + ') no pudo responder; la paciente recibió un mensaje de espera',
      nota: String('Escribió: ' + (p.texto || '')).slice(0, 1000),
    },
  }];
}, { helpers: false });

const API_ALERTA = add('API: registrar alerta', 'n8n-nodes-base.httpRequest', 4.2, [2640, Y_CHAT + 400], {
  method: 'POST',
  url: `={{ ${CFG}.apiUrl }}/n8n/alerta`,
  authentication: 'genericCredentialType',
  genericAuthType: 'httpHeaderAuth',
  sendBody: true,
  specifyBody: 'json',
  jsonBody: '={{ JSON.stringify($json) }}',
  options: { timeout: 10000 },
}, { retryOnFail: true, maxTries: 2, waitBetweenTries: 1000, onError: 'continueRegularOutput', credentials: { httpHeaderAuth: { name: 'Clínica · Secreto n8n' } } });

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
modelo('Modelo · Analista', [1340, Y_CHECKIN + 200], MODELO_RAPIDO, ANALISTA, 0);
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
    // El enlace al portal es un botón con URL fija en la plantilla (Meta no aprueba enlaces como variable)
    msg(cita.telefono, 'cita_recibida_v2', [firstName(cita.nombre), fechaLarga(cita.fecha)]),
  ];
  if (cfg.clinicWhatsapp) {
    mensajes.push(msg(cfg.clinicWhatsapp, 'nueva_solicitud_cita', [cita.nombre, cita.telefono, cita.tratamiento, fechaLarga(cita.fecha)]));
  }
  return mensajes;
});

const MSG_ACCESO = code('Mensajes: acceso al portal', [1140, 1020], () => {
  const evento = $input.first().json.payload;
  if (!evento.phone || !evento.codigo) return [];
  // Plantilla de Autenticación de Meta: el código va en el cuerpo y en el botón "Copiar código".
  // Es la misma para pacientes y doctora (Meta no aprueba accesos de un solo uso en otra categoría).
  return [msg(evento.phone, 'codigo_acceso', [evento.codigo], evento.codigo)];
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
modelo('Modelo · Resumen', [1540, Y_PREP + 200], MODELO_RAPIDO, RESUMIDOR, 0.2);
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
  // INSTRUCCIONES y GENERAL: REVISION-DOCTORA.md, sección 1 (se insertan al generar)
  const citas = $input.first().json.items || [];
  return citas.map((cita) =>
    msg(cita.telefono, 'recordatorio_cita', [
      firstName(cita.nombre),
      fechaLarga(cita.fecha),
      cita.hora || 'la hora acordada',
      INSTRUCCIONES[cita.tratamiento] || GENERAL,
    ])
  );
}, { vars: { INSTRUCCIONES: CLINICO.instrucciones, GENERAL: CLINICO.general } });

const API_SEGUIMIENTO = apiGet('API: pacientes en recuperación', [1140, 1500], '/n8n/seguimiento');
const MSG_SEGUIMIENTO = code('Mensajes: seguimiento', [1360, 1500], () => {
  // Días después del tratamiento en los que preguntamos cómo se siente
  const DIAS = [1, 3, 7, 14];
  const pacientes = $input.first().json.items || [];
  return pacientes
    .filter((p) => DIAS.includes(p.diasDesdeTratamiento))
    .map((p) => msg(p.phone, 'seguimiento_tratamiento_v2', [firstName(p.name)]));
});

// Cada lunes: pasos de los próximos 7 días (hoy + 6), así cada paso se avisa una sola vez
const API_PASOS = apiGet('API: pasos de esta semana', [1140, 1660], '/n8n/retoques?dias=6');
const MSG_PASOS = code('Mensajes: próximos pasos', [1360, 1660], () => {
  const pasos = $input.first().json.items || [];
  const mensajes = pasos.map((p) =>
    msg(p.phone, 'proximo_paso_mapa_v2', [firstName(p.name), fechaLarga(p.fecha)])
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
  return [msg(patient.phone, 'cita_confirmada_v2', [firstName(patient.name), fechaLarga(cita.fecha), cita.hora])];
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
    // Modo pruebas: el mismo texto como mensaje libre (Meta lo entrega dentro de la ventana de 24 h)
    `={{ JSON.stringify(String(${CFG}.modoPruebas || '').trim().toLowerCase() === 'si' ? { messaging_product: 'whatsapp', to: $json.to, type: 'text', text: { body: $json.texto, preview_url: true } } : { messaging_product: 'whatsapp', to: $json.to, type: 'template', template: { name: $json.template, language: { code: ${CFG}.templateLanguage }, components: [...($json.params.length ? [{ type: 'body', parameters: $json.params.map(text => ({ type: 'text', text })) }] : []), ...($json.boton ? [{ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: $json.boton }] }] : [])] } }) }}`,
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
const SALIDAS = [REVISAR_ADJUNTO, CONTEXTO_CHECKIN, MSG_SOS, MSG_CITA, MSG_ACCESO, API_PREP, API_CITAS, API_SEGUIMIENTO, API_PASOS,
  MSG_CONFIRMADA, MSG_CANCELADA, MSG_CAMPANA, RESPALDO, MSG_FALLA];
if (SALIDAS.length !== RUTAS.length) throw new Error('Cada ruta del Router necesita su nodo de salida');
SALIDAS.forEach((n, i) => link(ROUTER, n, i));
link(ROUTER, IGNORAR, RUTAS.length);

// Chat: adjuntos (nota de voz → Gemini; foto → binario para el agente) → red de seguridad → emergencia o clasificador → agentes
link(REVISAR_ADJUNTO, RUTA_ADJUNTO);
link(RUTA_ADJUNTO, META_INFO, 0);
link(RUTA_ADJUNTO, META_INFO, 1);
link(RUTA_ADJUNTO, SEGURIDAD, 2);
link(META_INFO, META_DESCARGA);
link(META_DESCARGA, REVISAR_DESCARGA);
link(REVISAR_DESCARGA, RUTA_AUDIO);
link(RUTA_AUDIO, GEMINI, 0);
link(RUTA_AUDIO, SEGURIDAD, 1);
link(GEMINI, TEXTO_AUDIO);
link(TEXTO_AUDIO, SEGURIDAD);
link(SEGURIDAD, RUTA_CHAT);
link(RUTA_CHAT, MSG_EMERGENCIA, 0);
link(RUTA_CHAT, TXT_EMERGENCIA, 0);
link(RUTA_CHAT, CLASIFICADOR, 1);
link(RUTA_CHAT, API_BAJA, 2);
link(API_BAJA, TXT_BAJA);
link(RUTA_CHAT, TXT_NO_SOPORTADO, 3);
link(CLASIFICADOR, ENFERMERA, 0); // clinica
link(CLASIFICADOR, RECEPCIONISTA, 1); // administrativa
link(CLASIFICADOR, ENFERMERA, 2); // sin categoría clara → la opción clínica es la más segura
link(ENFERMERA, RESPUESTA_ENFERMERA);
link(RECEPCIONISTA, RESPUESTA_RECEPCION);
[TXT_EMERGENCIA, RESPUESTA_ENFERMERA, RESPUESTA_RECEPCION, TXT_BAJA, TXT_NO_SOPORTADO].forEach((n) => link(n, RESPONDER_WA));
[RESPUESTA_ENFERMERA, RESPUESTA_RECEPCION].forEach((n) => link(n, AVISO_SIN_IA));
// Alertas para el panel (después de los avisos por WhatsApp; ver "Alerta para el panel · …")
link(RUTA_CHAT, ALERTA_EMERGENCIA, 0);
link(ENFERMERA, ALERTA_ENFERMERA);
[RESPUESTA_ENFERMERA, RESPUESTA_RECEPCION].forEach((n) => link(n, ALERTA_SIN_IA));
[ALERTA_EMERGENCIA, ALERTA_ENFERMERA, ALERTA_SIN_IA].forEach((n) => link(n, API_ALERTA));

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
  '## 🤖 Equipo de agentes\n**Red de seguridad (sin IA)** → emergencias directo a la doctora. **Clasificador** → **Agente IA 1 · Enfermera Virtual** (triaje clínico, puede despertar a la doctora) o **Agente IA 2 · Recepcionista VIP** (agenda y reservas). Cada agente tiene su propio modelo (Google Gemini, credencial *Gemini - Aura y WhatsApp*), memoria y herramientas: la recepcionista no ve datos clínicos y la enfermera no puede reservar.', 5);
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

// Parche para n8n Cloud (sin reimportar): solo los nodos nuevos de notas de voz y fotos, con sus conexiones internas.
// Se copia el archivo entero y se pega (Ctrl+V) en el lienzo del cerebro. Ver n8n/README.md, sección 8.
const NODOS_PARCHE = [REVISAR_ADJUNTO, RUTA_ADJUNTO, META_INFO, META_DESCARGA, REVISAR_DESCARGA, RUTA_AUDIO, GEMINI, TEXTO_AUDIO, TXT_NO_SOPORTADO];
const PARCHE_FILE = path.join(HERE, 'flujos', 'parche-cloud-notas-de-voz-y-fotos.json');
const parche = {
  nodes: nodes.filter((n) => NODOS_PARCHE.includes(n.name)),
  connections: Object.fromEntries(Object.entries(connections)
    .filter(([origen]) => NODOS_PARCHE.includes(origen))
    .map(([origen, tipos]) => [origen, { main: tipos.main.map((salida) => salida.filter((c) => NODOS_PARCHE.includes(c.node))) }])),
};
fs.writeFileSync(PARCHE_FILE, JSON.stringify(parche, null, 2) + '\n');
console.log(`✓ ${path.relative(process.cwd(), PARCHE_FILE)}: ${parche.nodes.length} nodos para pegar en Cloud`);

// Base clínica para la hoja de Google (pestaña BaseClinica), desde REVISION-DOCTORA.md
fs.writeFileSync(ARCHIVO_CSV, baseClinicaCsv(CLINICO));
console.log(`✓ ${path.relative(process.cwd(), ARCHIVO_CSV)}: ${CLINICO.base.length} filas${CLINICO.aprobado ? '' : ' (borrador: la doctora aún no la aprueba)'}`);
