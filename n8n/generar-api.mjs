// Genera el flujo de n8n que atiende la API de la clínica en producción:
//   n8n/flujos/api-clinica.json
// Uso:  node n8n/generar-api.mjs
//       ORIGEN_PERMITIDO=https://tu-sitio.com node n8n/generar-api.mjs   (CORS del frontend)
// El nodo "Núcleo API" lleva dentro api/nucleo.mjs y api/hojas.mjs tal cual: la misma lógica
// que prueba `npm run verificar` contra el simulador. Si cambias el núcleo, vuelve a generar.
// La variante de prueba (`--prueba`) la usa scripts/probar-n8n.mjs contra un n8n local.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ESTE_ARCHIVO = fileURLToPath(import.meta.url);
const HERE = path.dirname(ESTE_ARCHIVO);
const RAIZ = path.join(HERE, '..');

// Código de un módulo sin `export`, listo para un nodo Code (finales de línea normalizados)
export const codigoDe = (archivo) =>
  fs.readFileSync(path.join(RAIZ, archivo), 'utf8').replace(/\r\n/g, '\n').replace(/^export /gm, '');

// Rutas del contrato (api/nucleo.mjs): una por Webhook
export const RUTAS = [
  ['POST', '/appointments'],
  ['POST', '/auth/magic-link'],
  ['POST', '/auth/verify'],
  ['POST', '/logout'],
  ['GET', '/me'],
  ['GET', '/me/portal'],
  ['PUT', '/me/care'],
  ['GET', '/me/checkins'],
  ['POST', '/me/checkins'],
  ['POST', '/me/sos'],
  ['GET', '/admin/hoy'],
  ['GET', '/admin/citas'],
  ['PATCH', '/admin/citas'],
  ['GET', '/admin/pacientes'],
  ['GET', '/admin/pacientes/ficha'],
  ['PATCH', '/admin/pacientes'],
  ['PUT', '/admin/pacientes/plan'],
  ['GET', '/admin/alertas'],
  ['PATCH', '/admin/alertas'],
  ['POST', '/admin/campanas'],
  ['GET', '/n8n/citas'],
  ['POST', '/n8n/citas'],
  ['GET', '/n8n/seguimiento'],
  ['GET', '/n8n/retoques'],
  ['GET', '/n8n/paciente'],
  ['GET', '/n8n/preparacion'],
  ['POST', '/n8n/resumen'],
  ['POST', '/n8n/baja'],
];

const TABLAS = ['users', 'appointments', 'portal', 'checkins', 'sosAlerts', 'accesos'];

const bodyOf = (fn) => fn.toString().replace(/\r\n/g, '\n').replace(/^[^{]*\{\n?/, '').replace(/\}\s*$/, '').replace(/^ {2}/gm, '');

/**
 * @param {object} [prueba] variante para un n8n local sin credenciales:
 *   { id, sheetsApi, cerebroUrl, secretoSesion, secretoN8n, portalUrl, origen }
 */
export function generarApi(prueba = null) {
  const uuidFrom = (seed) => {
    const h = crypto.createHash('sha1').update(`api:${prueba ? 'prueba:' : ''}${seed}`).digest('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
  };
  const nodes = [];
  const connections = {};
  const add = (name, type, typeVersion, position, parameters, extra = {}) => {
    nodes.push({ parameters, id: uuidFrom(name), name, type, typeVersion, position, ...extra });
    return name;
  };
  const link = (from, to, output = 0) => {
    connections[from] ??= { main: [] };
    while (connections[from].main.length <= output) connections[from].main.push([]);
    connections[from].main[output].push({ node: to, type: 'main', index: 0 });
  };
  const CFG = "$('Configuración API').first().json";
  const origen = prueba?.origen || process.env.ORIGEN_PERMITIDO || 'http://localhost:5173';
  const AUTH_SHEETS = prueba ? { authentication: 'none' } : { authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api' };

  // ── Un Webhook por ruta; el nombre del nodo es "MÉTODO /ruta" y así lo lee "Preparar petición" ──
  const webhooks = RUTAS.map(([metodo, ruta], i) =>
    add(`${metodo} ${ruta}`, 'n8n-nodes-base.webhook', 2, [0, i * 110], {
      httpMethod: metodo,
      path: ruta.slice(1),
      responseMode: 'responseNode',
      options: { allowedOrigins: origen },
    }, { webhookId: uuidFrom(`webhook:${metodo} ${ruta}`) }));

  const PREPARAR = add('Preparar petición', 'n8n-nodes-base.code', 2, [320, 1500], {
    jsCode: bodyOf(() => {
      // El Webhook que se disparó dice el método y la ruta. El contrato no usa parámetros en la ruta:
      // n8n publicaría esas rutas con el id del webhook delante y la URL dejaría de coincidir.
      const w = $input.first().json;
      const [metodo, ruta] = $prevNode.name.split(' ');
      return [{ json: { peticion: { metodo, ruta, query: w.query || {}, body: w.body || {}, headers: w.headers || {} } } }];
    }),
  });

  // ── Configuración: el único lugar con datos de la instalación ──
  const CONFIG_FIELDS = [
    ['sheetsApi', prueba?.sheetsApi || 'https://sheets.googleapis.com/v4'],
    ['sheetId', prueba ? 'hoja-de-prueba' : 'REEMPLAZAR_ID_DE_LA_HOJA_DE_DATOS'],
    ['portalUrl', prueba?.portalUrl || 'http://localhost:5173'],
    ['cerebroWebhookUrl', prueba?.cerebroUrl || 'http://localhost:5678/webhook/clinica/eventos'],
    // Secretos: genera valores largos y distintos (ver n8n/README.md)
    ['sessionSecret', prueba?.secretoSesion || 'REEMPLAZAR_SECRETO_DE_SESION'],
    ['n8nSecret', prueba?.secretoN8n || 'REEMPLAZAR_SECRETO_N8N'],
  ];
  const CONFIG = add('Configuración API', 'n8n-nodes-base.set', 3.4, [540, 1500], {
    assignments: {
      assignments: CONFIG_FIELDS.map(([name, value]) => ({ id: uuidFrom(`cfg:${name}`), name, value, type: 'string' })),
    },
    includeOtherFields: true,
    options: {},
  });

  // ── Una sola lectura de todas las pestañas ──
  const LEER = add('Leer hojas', 'n8n-nodes-base.httpRequest', 4.2, [760, 1500], {
    method: 'GET',
    url: `={{ ${CFG}.sheetsApi }}/spreadsheets/{{ ${CFG}.sheetId }}/values:batchGet?${TABLAS.map((t) => `ranges=${t}`).join('&')}&valueRenderOption=UNFORMATTED_VALUE`,
    ...AUTH_SHEETS,
    options: {},
  }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 1000 });

  const ADAPTADOR = bodyOf(() => {
    // ── Adaptador n8n: hojas → tablas → núcleo → filas que cambiaron ──
    const cfg = $('Configuración API').first().json;
    const { peticion } = $('Preparar petición').first().json;
    const crypto = require('crypto'); // requiere NODE_FUNCTION_ALLOW_BUILTIN=crypto
    const leidas = {};
    for (const vr of $input.first().json.valueRanges || []) leidas[pestanaDe(vr.range)] = leerPestana(vr.values);
    const vacia = leerPestana([]);
    const db = Object.fromEntries(TABLAS.map((t) => [t, (leidas[t] || vacia).registros]));

    const api = crearApi({
      secretoSesion: cfg.sessionSecret,
      secretoN8n: cfg.n8nSecret,
      portalUrl: cfg.portalUrl,
      cripto: {
        hmac: (clave, texto) => crypto.createHmac('sha256', clave).update(texto).digest('hex'),
        sha256: (texto) => crypto.createHash('sha256').update(texto).digest('hex'),
        aleatorio: (bytes) => crypto.randomBytes(bytes).toString('hex'),
        igual: (a, b) => {
          const x = Buffer.from(String(a));
          const y = Buffer.from(String(b));
          return x.length === y.length && crypto.timingSafeEqual(x, y);
        },
      },
    });
    const r = api.manejar(peticion, db);
    const data = Object.entries(r.cambios).flatMap(([tabla, ids]) =>
      escrituraDe(tabla, leidas[tabla] || vacia, ids.map((id) => db[tabla].find((f) => f.id === id))));
    return [{ json: { status: r.status, body: r.body, eventos: r.eventos, hayCambios: data.length > 0, escritura: { valueInputOption: 'RAW', data } } }];
  });
  const NUCLEO = add('Núcleo API', 'n8n-nodes-base.code', 2, [980, 1500], {
    jsCode: `${codigoDe('api/nucleo.mjs')}\n${codigoDe('api/hojas.mjs')}\n${ADAPTADOR}`,
  });

  const HAY_CAMBIOS = add('¿Hay cambios?', 'n8n-nodes-base.if', 2.2, [1200, 1500], {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: uuidFrom('if:cambios'),
        leftValue: '={{ $json.hayCambios }}',
        rightValue: '',
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  });

  const ESCRIBIR = add('Escribir hojas', 'n8n-nodes-base.httpRequest', 4.2, [1420, 1400], {
    method: 'POST',
    url: `={{ ${CFG}.sheetsApi }}/spreadsheets/{{ ${CFG}.sheetId }}/values:batchUpdate`,
    ...AUTH_SHEETS,
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify($json.escritura) }}',
    options: {},
  }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 1000 });

  const RESPONDER = add('Responder', 'n8n-nodes-base.respondToWebhook', 1.1, [1640, 1500], {
    respondWith: 'json',
    responseBody: "={{ JSON.stringify($('Núcleo API').first().json.body) }}",
    options: { responseCode: "={{ $('Núcleo API').first().json.status }}" },
  });

  const EVENTOS = add('Eventos para el cerebro', 'n8n-nodes-base.code', 2, [1860, 1500], {
    jsCode: bodyOf(() => {
      // Después de responder: cada evento (cita, acceso, check-in, SOS, campaña…) va al cerebro
      return ($('Núcleo API').first().json.eventos || []).map((evento) => ({ json: evento }));
    }),
  });

  const ENVIAR = add('Enviar al cerebro', 'n8n-nodes-base.httpRequest', 4.2, [2080, 1500], {
    method: 'POST',
    url: `={{ ${CFG}.cerebroWebhookUrl }}`,
    ...(prueba
      ? { sendHeaders: true, headerParameters: { parameters: [{ name: 'X-N8N-Secret', value: prueba.secretoN8n }] } }
      : { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' }),
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify($json) }}',
    options: {},
  }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 3000, onError: 'continueRegularOutput' });

  webhooks.forEach((w) => link(w, PREPARAR));
  link(PREPARAR, CONFIG);
  link(CONFIG, LEER);
  link(LEER, NUCLEO);
  link(NUCLEO, HAY_CAMBIOS);
  link(HAY_CAMBIOS, ESCRIBIR, 0);
  link(HAY_CAMBIOS, RESPONDER, 1);
  link(ESCRIBIR, RESPONDER);
  link(RESPONDER, EVENTOS);
  link(EVENTOS, ENVIAR);

  add('Nota: API', 'n8n-nodes-base.stickyNote', 1, [300, 1100], {
    content: '## 🔌 API de la clínica\nUn **Webhook** por ruta del contrato. Todas siguen el mismo camino: **Leer hojas** (una sola llamada) → **Núcleo API** (el mismo código que `api/nucleo.mjs`) → **Escribir hojas** (solo las filas que cambiaron) → **Responder** → eventos al **cerebro**.\n\nEdita solo **Configuración API**. Requiere `NODE_FUNCTION_ALLOW_BUILTIN=crypto` en n8n.',
    width: 900,
    height: 260,
    color: 5,
  });

  return {
    ...(prueba ? { id: prueba.id } : {}),
    name: 'Clínica · API',
    nodes,
    connections,
    active: false,
    settings: {
      executionOrder: 'v1',
      timezone: 'America/Costa_Rica',
      // Cada ejecución carga todas las hojas: no se guarda ninguna (privacidad de las pacientes).
      // Para depurar, activa temporalmente "Save failed executions" en la configuración del flujo.
      saveDataSuccessExecution: 'none',
      saveDataErrorExecution: 'none',
      saveManualExecutions: false,
      // En producción se elige a mano en n8n (el id del cerebro lo asigna n8n al importarlo)
      ...(prueba?.errorWorkflow ? { errorWorkflow: prueba.errorWorkflow } : {}),
    },
    pinData: {},
    meta: { templateCredsSetupCompleted: false },
  };
}

// Ejecutado directamente: escribe el flujo de producción
if (process.argv[1] && path.resolve(process.argv[1]) === ESTE_ARCHIVO) {
  const salida = path.join(HERE, 'flujos', 'api-clinica.json');
  const wf = generarApi();
  fs.writeFileSync(salida, JSON.stringify(wf, null, 2) + '\n');
  console.log(`✓ ${path.relative(process.cwd(), salida)}: ${wf.nodes.length} nodos (${RUTAS.length} rutas)`);
}
