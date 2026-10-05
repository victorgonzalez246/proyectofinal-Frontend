// ============================================================
// SERVIDOR SIMULADO (solo desarrollo)
// Atiende el mismo contrato que en producción atiende n8n (flujo "API de la clínica"),
// con la misma lógica: api/nucleo.mjs. Aquí las tablas viven en db.json; en n8n, en Google Sheets.
// Este archivo solo agrega lo que en producción hace la infraestructura:
// HTTP, CORS, límite de intentos y el envío de eventos al cerebro de n8n.
// ============================================================
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import { crearApi, TABLAS } from './api/nucleo.mjs';

const DB_FILE = process.env.DB_FILE || 'db.json';
const PORT = Number(process.env.PORT) || 3001;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4173').split(',');
// Webhook del cerebro maestro de n8n (opcional). Recibe los eventos: citas, acceso, check-ins, SOS, campañas.
// Se queda en el servidor: el navegador nunca ve la URL.
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';
// Secreto compartido con n8n: viaja en X-N8N-Secret en ambos sentidos
const N8N_SHARED_SECRET = process.env.N8N_SHARED_SECRET || '';
const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:5173';
const SESSION_SECRET = process.env.SESSION_SECRET || 'solo-desarrollo-cambia-SESSION_SECRET';
if (!process.env.SESSION_SECRET) console.warn('⚠️  SESSION_SECRET no está definido: se usa uno de desarrollo.');

// db.json contiene datos de pacientes y no se versiona: se crea desde la plantilla
if (!fs.existsSync(DB_FILE)) {
  fs.copyFileSync('db.example.json', DB_FILE);
  console.log('📄 db.json creado desde db.example.json');
}

const api = crearApi({
  secretoSesion: SESSION_SECRET,
  secretoN8n: N8N_SHARED_SECRET,
  portalUrl: PORTAL_URL,
  // Sin n8n conectado, el enlace mágico se muestra en pantalla en lugar de enviarse por WhatsApp
  modoDesarrollo: !N8N_WEBHOOK_URL,
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

// Envía un evento al cerebro de n8n sin bloquear la respuesta al usuario
const notifyN8n = ({ event, ...payload }) => {
  if (!N8N_WEBHOOK_URL) return;
  fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-N8N-Secret': N8N_SHARED_SECRET },
    body: JSON.stringify({ event, ...payload }),
  }).catch((err) => console.error(`⚠️  No se pudo notificar a n8n (${event}):`, err.message));
};

// Límite simple de solicitudes por IP para endpoints públicos (en producción: reglas del proxy)
const LIMITES = {
  'POST /appointments': [5, 10 * 60 * 1000],
  'POST /auth/magic-link': [5, 15 * 60 * 1000],
  'POST /auth/verify': [10, 15 * 60 * 1000],
  'POST /me/checkins': [10, 60 * 60 * 1000],
  'POST /me/sos': [3, 10 * 60 * 1000],
};
const rateBuckets = new Map();
const excedeLimite = (clave, ip) => {
  const limite = LIMITES[clave];
  if (!limite) return false;
  const [max, windowMs] = limite;
  const key = `${clave}:${ip}`;
  const now = Date.now();
  const hits = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) return true;
  hits.push(now);
  rateBuckets.set(key, hits);
  return false;
};

const leerCuerpo = (req) => new Promise((resolve, reject) => {
  let data = '';
  req.on('data', (chunk) => {
    data += chunk;
    if (data.length > 100_000) reject(new Error('Cuerpo demasiado grande'));
  });
  req.on('end', () => {
    try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('JSON inválido')); }
  });
  req.on('error', reject);
});

const server = http.createServer(async (req, res) => {
  const enviar = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };

  // CORS restringido a los orígenes del frontend
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
  }
  if (req.method === 'OPTIONS') return enviar(204);

  const url = new URL(req.url, 'http://localhost');
  if (excedeLimite(`${req.method} ${url.pathname}`, req.socket.remoteAddress)) {
    return enviar(429, { error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' });
  }

  let body;
  try {
    body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await leerCuerpo(req) : {};
  } catch (err) {
    return enviar(400, { error: err.message });
  }

  // Lectura y escritura síncronas: cada petición ve y deja db.json completo
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  let resultado;
  try {
    resultado = api.manejar({ metodo: req.method, ruta: url.pathname + url.search, body, headers: req.headers }, db);
  } catch (err) {
    console.error('❌ Error inesperado:', err);
    return enviar(500, { error: 'Error interno del servidor.' });
  }
  if (Object.keys(resultado.cambios).length > 0) {
    const datos = Object.fromEntries(TABLAS.map((t) => [t, db[t]]));
    fs.writeFileSync(DB_FILE, JSON.stringify(datos, null, 2) + '\n');
  }
  if (resultado.body?.devLink) console.log(`🔑 Enlace mágico (modo desarrollo): ${resultado.body.devLink}`);
  resultado.eventos.forEach(notifyN8n);
  enviar(resultado.status, resultado.body);
});

server.listen(PORT, () => {
  console.log(`✅ Simulador de la API corriendo en el puerto ${PORT}`);
  console.log(N8N_WEBHOOK_URL ? '🧠 Cerebro maestro de n8n: CONECTADO' : '🧠 Cerebro maestro de n8n: no configurado (N8N_WEBHOOK_URL)');
});
