/* eslint-disable no-unused-vars -- las funciones de HELPERS se usan dentro de n8n, no aquí */
// Genera los flujos importables de n8n en n8n/flujos/*.json
// Uso: node n8n/generar-flujos.mjs
// Si editas un flujo dentro de n8n, expórtalo y reemplaza su JSON (o ajusta este generador).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const OUT_DIR = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'flujos');

// IDs estables (mismo nombre -> mismo id) para que los diffs de git sean limpios
const uuidFrom = (seed) => {
  const h = crypto.createHash('sha1').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

// Cuerpo de una función como texto: el código de los nodos Code se escribe como JS real
const bodyOf = (fn) => fn.toString().replace(/^[^{]*\{\n?/, '').replace(/\}\s*$/, '').replace(/^ {2}/gm, '');

// ── Código compartido por los nodos "Preparar mensajes" ──
const HELPERS = bodyOf(() => {
  // Configuración editable del flujo (nodo "Configuración")
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
const node = (flow, name, type, typeVersion, position, parameters, extra = {}) => ({
  parameters,
  id: uuidFrom(`${flow}:${name}`),
  name,
  type,
  typeVersion,
  position,
  ...extra,
});

const webhook = (flow, pathName) =>
  node(flow, 'Webhook', 'n8n-nodes-base.webhook', 2, [0, 0], {
    httpMethod: 'POST',
    path: pathName,
    authentication: 'headerAuth',
    responseMode: 'responseNode',
    options: {},
  }, { webhookId: uuidFrom(`${flow}:webhook`) });

const schedule = (flow, cron) =>
  node(flow, 'Programación', 'n8n-nodes-base.scheduleTrigger', 1.2, [0, 0], {
    rule: { interval: [{ field: 'cronExpression', expression: cron }] },
  });

// Disparador extra en los flujos programados para probarlos con un clic
const manual = (flow) => node(flow, 'Probar ahora', 'n8n-nodes-base.manualTrigger', 1, [0, 200], {});

const CONFIG_FIELDS = [
  ['whatsappPhoneNumberId', 'REEMPLAZAR_PHONE_NUMBER_ID'],
  ['graphApiVersion', 'v21.0'],
  ['templateLanguage', 'es'],
  ['clinicWhatsapp', '50688888888'],
  ['portalUrl', 'http://localhost:5173'],
  ['apiUrl', 'http://localhost:3001'],
];

const config = (flow, x) =>
  node(flow, 'Configuración', 'n8n-nodes-base.set', 3.4, [x, 0], {
    assignments: {
      assignments: CONFIG_FIELDS.map(([name, value]) => ({ id: uuidFrom(`${flow}:cfg:${name}`), name, value, type: 'string' })),
    },
    options: {},
  });

const respond = (flow, x) =>
  node(flow, 'Responder OK', 'n8n-nodes-base.respondToWebhook', 1.1, [x, 0], {
    respondWith: 'json',
    responseBody: '{\n  "ok": true\n}',
    options: {},
  });

const code = (flow, name, x, fn) =>
  node(flow, name, 'n8n-nodes-base.code', 2, [x, 0], { jsCode: `${HELPERS}\n${bodyOf(fn)}` });

// Consulta al simulador (o a la API futura) autenticada con X-N8N-Secret
const apiGet = (flow, name, x, urlExpression) =>
  node(flow, name, 'n8n-nodes-base.httpRequest', 4.2, [x, 0], {
    url: urlExpression,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    options: {},
  });

const sendWhatsapp = (flow, x) =>
  node(flow, 'Enviar WhatsApp', 'n8n-nodes-base.httpRequest', 4.2, [x, 0], {
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

// Une los nodos en cadena lineal y arma el flujo.
// Los flujos programados suman un disparador manual conectado al segundo nodo.
const workflow = (name, nodes) => {
  const connections = {};
  nodes.slice(0, -1).forEach((n, i) => {
    connections[n.name] = { main: [[{ node: nodes[i + 1].name, type: 'main', index: 0 }]] };
  });
  const extra = [];
  if (nodes[0].type === 'n8n-nodes-base.scheduleTrigger') {
    const trigger = manual(name);
    connections[trigger.name] = { main: [[{ node: nodes[1].name, type: 'main', index: 0 }]] };
    extra.push({ ...trigger, position: [0, 200] });
  }
  return {
    name,
    nodes: [...nodes.map((n, i) => ({ ...n, position: [i * 240, 0] })), ...extra],
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
};

// ── Flujos ──
const flows = {};

flows['01-cita-recibida.json'] = workflow('Clínica · 01 Cita recibida desde la landing', [
  webhook('01', 'clinica/cita-recibida'),
  config('01'),
  respond('01'),
  code('01', 'Preparar mensajes', 0, () => {
    const body = $('Webhook').first().json.body || {};
    const cita = body.appointment || {};
    if (body.event !== 'appointment.created' || !cita.telefono) return [];

    const mensajes = [
      // A la paciente: sin nombrar el tratamiento (discreción) y con acceso a su portal
      msg(cita.telefono, 'cita_recibida', [firstName(cita.nombre), fechaLarga(cita.fecha), cfg.portalUrl + '/portal/acceso']),
    ];
    if (cfg.clinicWhatsapp) {
      mensajes.push(msg(cfg.clinicWhatsapp, 'nueva_solicitud_cita', [cita.nombre, cita.telefono, cita.tratamiento, fechaLarga(cita.fecha)]));
    }
    return mensajes;
  }),
  sendWhatsapp('01'),
]);

flows['02-acceso-portal-whatsapp.json'] = workflow('Clínica · 02 Acceso al portal por WhatsApp', [
  webhook('02', 'clinica/acceso-portal'),
  config('02'),
  respond('02'),
  code('02', 'Preparar mensajes', 0, () => {
    const body = $('Webhook').first().json.body || {};
    if (body.event !== 'auth.magic_link' || !body.phone || !body.link) return [];
    return [msg(body.phone, 'acceso_portal', [firstName(body.name), body.link])];
  }),
  sendWhatsapp('02'),
]);

flows['03-alertas-clinica.json'] = workflow('Clínica · 03 Alertas: check-in y línea de tranquilidad', [
  webhook('03', 'clinica/alertas'),
  config('03'),
  respond('03'),
  code('03', 'Preparar mensajes', 0, () => {
    const body = $('Webhook').first().json.body || {};
    const paciente = body.patient || {};
    const ANIMOS = { 'muy-bien': 'Muy bien', bien: 'Bien', regular: 'Regular', molestias: 'Con molestias', preocupacion: 'Con preocupación' };
    const MOTIVOS = { dolor: 'Dolor fuerte', inflamacion: 'La inflamación aumentó', aspecto: 'Algo no se ve como esperaba', duda: 'Duda urgente' };

    if (body.event === 'checkin.alert') {
      const c = body.checkin || {};
      const detalle = 'Check-in: ' + (ANIMOS[c.mood] || c.mood) + ', molestia ' + c.pain + '/10' + (c.note ? '. Nota: ' + c.note : '');
      return [msg(cfg.clinicWhatsapp, 'alerta_clinica', ['Seguimiento', paciente.name, paciente.phone, detalle])];
    }
    if (body.event === 'sos.triggered') {
      const a = body.alert || {};
      const detalle = 'SOS: ' + (MOTIVOS[a.reason] || a.reason) + (a.note ? '. Nota: ' + a.note : '');
      return [
        msg(cfg.clinicWhatsapp, 'alerta_clinica', ['Urgente', paciente.name, paciente.phone, detalle]),
        msg(paciente.phone, 'sos_recibido', [firstName(paciente.name)]),
      ];
    }
    return [];
  }),
  sendWhatsapp('03'),
]);

flows['04-recordatorio-cita-24h.json'] = workflow('Clínica · 04 Recordatorio de cita 24 h antes', [
  schedule('04', '0 8 * * *'),
  config('04'),
  apiGet('04', 'Citas confirmadas de mañana', 0,
    "={{ $('Configuración').first().json.apiUrl }}/n8n/citas?estado=confirmada&fecha={{ $now.setZone('America/Costa_Rica').plus({ days: 1 }).toFormat('yyyy-MM-dd') }}"),
  code('04', 'Preparar mensajes', 0, () => {
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

    const citas = $('Citas confirmadas de mañana').first().json.items || [];
    return citas.map((cita) =>
      msg(cita.telefono, 'recordatorio_cita', [
        firstName(cita.nombre),
        fechaLarga(cita.fecha),
        cita.hora || 'la hora acordada',
        INSTRUCCIONES[cita.tratamiento] || GENERAL,
      ])
    );
  }),
  sendWhatsapp('04'),
]);

flows['05-seguimiento-post-tratamiento.json'] = workflow('Clínica · 05 Seguimiento post-tratamiento', [
  schedule('05', '0 10 * * *'),
  config('05'),
  apiGet('05', 'Pacientes en recuperación', 0, "={{ $('Configuración').first().json.apiUrl }}/n8n/seguimiento"),
  code('05', 'Preparar mensajes', 0, () => {
    // Días después del tratamiento en los que preguntamos cómo se siente
    const DIAS = [1, 3, 7, 14];
    const pacientes = $('Pacientes en recuperación').first().json.items || [];
    return pacientes
      .filter((p) => DIAS.includes(p.diasDesdeTratamiento))
      .map((p) => msg(p.phone, 'seguimiento_tratamiento', [firstName(p.name), cfg.portalUrl + '/portal']));
  }),
  sendWhatsapp('05'),
]);

flows['06-proximos-pasos-mapa.json'] = workflow('Clínica · 06 Próximos pasos del mapa de belleza', [
  schedule('06', '0 9 * * 1'),
  config('06'),
  // Cada lunes: pasos de los próximos 7 días (hoy + 6), así cada paso se avisa una sola vez
  apiGet('06', 'Pasos de esta semana', 0, "={{ $('Configuración').first().json.apiUrl }}/n8n/retoques?dias=6"),
  code('06', 'Preparar mensajes', 0, () => {
    const pasos = $('Pasos de esta semana').first().json.items || [];
    const mensajes = pasos.map((p) =>
      msg(p.phone, 'proximo_paso_mapa', [firstName(p.name), fechaLarga(p.fecha), cfg.portalUrl + '/portal/mapa'])
    );
    if (pasos.length && cfg.clinicWhatsapp) {
      const resumen = pasos.map((p) => p.name + ' (' + p.titulo + ', ' + p.fecha + ')').join('; ');
      mensajes.push(msg(cfg.clinicWhatsapp, 'resumen_semana_clinica', [String(pasos.length), resumen]));
    }
    return mensajes;
  }),
  sendWhatsapp('06'),
]);

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [file, flow] of Object.entries(flows)) {
  fs.writeFileSync(path.join(OUT_DIR, file), JSON.stringify(flow, null, 2) + '\n');
  console.log('✓', file);
}
