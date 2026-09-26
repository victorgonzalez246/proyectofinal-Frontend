// ============================================================
// SERVIDOR SIMULADO (solo desarrollo) — json-server + candado local
// Replica el contrato que más adelante expondrán los webhooks de n8n:
//   POST /register, POST /login, POST /logout, GET /me, POST /appointments
//   Portal de pacientes: POST /auth/magic-link, POST /auth/verify,
//   GET /me/portal, GET|POST /me/checkins, PUT /me/care, POST /me/sos
//   Para n8n (con X-N8N-Secret): GET /n8n/citas, GET /n8n/seguimiento, GET /n8n/retoques
// ============================================================
import fs from 'node:fs';
import crypto from 'node:crypto';
import jsonServer from 'json-server';
import bcrypt from 'bcryptjs';
import { WELCOME_COUPONS } from './src/data/welcomeCoupons.js';

const DB_FILE = process.env.DB_FILE || 'db.json';
const PORT = Number(process.env.PORT) || 3001;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4173').split(',');
// Webhook único del cerebro maestro de n8n (opcional). Recibe todos los eventos:
// appointment.created, auth.magic_link, checkin.alert, sos.triggered.
// Se queda en el servidor: el navegador nunca ve la URL.
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';
// Secreto compartido con n8n: viaja en X-N8N-Secret en ambos sentidos
const N8N_SHARED_SECRET = process.env.N8N_SHARED_SECRET || '';
const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:5173';
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutos, un solo uso

// db.json contiene datos de pacientes y no se versiona: se crea desde la plantilla
if (!fs.existsSync(DB_FILE)) {
  fs.copyFileSync('db.example.json', DB_FILE);
  console.log('📄 db.json creado desde db.example.json');
}

const server = jsonServer.create();
const router = jsonServer.router(DB_FILE);
const db = router.db;
db.defaults({ users: [], appointments: [], portal: [], checkins: [], sosAlerts: [] }).write();

// CORS restringido a los orígenes del frontend (en vez del CORS abierto por defecto)
server.use((req, res, next) => {
  const origin = req.header('Origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
server.use(jsonServer.defaults({ noCors: true, static: 'public' }));
server.use(jsonServer.bodyParser);

// ── Utilidades ─────────────────────────────────────────────
const sessions = new Map(); // token -> { userId, role, expiresAt }

const withoutPassword = (user) => {
  if (!user || typeof user !== 'object') return user;
  const { password: _password, ...safe } = user;
  return safe;
};

const issueSession = (user) => {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, role: user.role, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
};

const getSession = (req) => {
  const header = req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { ...session, token };
};

// Envía un evento a un webhook de n8n sin bloquear la respuesta al usuario
const notifyN8n = (event, payload) => {
  if (!N8N_WEBHOOK_URL) return;
  fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-N8N-Secret': N8N_SHARED_SECRET },
    body: JSON.stringify({ event, sentAt: new Date().toISOString(), ...payload }),
  }).catch((err) => console.error(`⚠️  No se pudo notificar a n8n (${event}):`, err.message));
};

const str = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const phoneKey = (phone) => String(phone || '').replace(/\D/g, '').slice(-8); // últimos 8 dígitos (CR)
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Límite simple de solicitudes por IP para endpoints públicos (anti-spam / fuerza bruta)
const rateBuckets = new Map();
const rateLimit = (max, windowMs) => (req, res, next) => {
  const key = `${req.path}:${req.ip}`;
  const now = Date.now();
  const hits = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' });
  }
  hits.push(now);
  rateBuckets.set(key, hits);
  next();
};

// ── Endpoints públicos ─────────────────────────────────────
server.post('/register', rateLimit(5, 15 * 60 * 1000), (req, res) => {
  const name = str(req.body.name, 80);
  const email = str(req.body.email, 120).toLowerCase();
  const phone = str(req.body.phone, 20);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (name.length < 2 || !isEmail(email) || password.length < 8 || password.length > 72) {
    return res.status(400).json({ error: 'Datos de registro inválidos.' });
  }
  if (db.get('users').find({ email }).value()) {
    return res.status(409).json({ error: 'Este correo electrónico ya se encuentra registrado.' });
  }

  const user = {
    id: `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    name,
    email,
    phone,
    password: bcrypt.hashSync(password, 10),
    role: 'member', // Nunca se acepta el rol desde el cliente
    dateJoined: new Date().toISOString(),
    subscribedToOffers: req.body.subscribeOffers !== false,
    coupons: [...WELCOME_COUPONS],
  };
  db.get('users').push(user).write();

  res.status(201).json({ token: issueSession(user), user: withoutPassword(user) });
});

server.post('/login', rateLimit(10, 15 * 60 * 1000), (req, res) => {
  const email = str(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = db.get('users').find({ email }).value();

  // Mismo mensaje para correo inexistente o contraseña incorrecta (no revela qué cuentas existen)
  // Pacientes creados desde una cita no tienen contraseña: solo entran con enlace mágico
  if (!user || !user.password || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Credenciales inválidas. Por favor verifica tu correo y contraseña.' });
  }

  res.json({ token: issueSession(user), user: withoutPassword(user) });
});

// Solicitud de cita desde la landing (visitantes sin sesión)
server.post('/appointments', rateLimit(5, 10 * 60 * 1000), (req, res) => {
  const appointment = {
    id: `apt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    nombre: str(req.body.nombre, 80),
    telefono: str(req.body.telefono, 20),
    email: str(req.body.email, 120),
    tratamiento: str(req.body.tratamiento, 80),
    fecha: str(req.body.fecha, 10),
    mensaje: str(req.body.mensaje, 500),
    estado: 'pendiente', // El estado lo decide el servidor, no el cliente
    createdAt: new Date().toISOString(),
  };

  if (appointment.nombre.length < 3 || appointment.telefono.length < 8 || !appointment.tratamiento || !/^\d{4}-\d{2}-\d{2}$/.test(appointment.fecha)) {
    return res.status(400).json({ error: 'Datos de la cita inválidos.' });
  }

  // Conecta la landing con el portal: quien agenda queda registrado como paciente
  // (sin contraseña) y puede entrar a su portal con este mismo número de WhatsApp.
  let patient = db.get('users').find((u) => u.role === 'member' && phoneKey(u.phone) === phoneKey(appointment.telefono)).value();
  if (!patient) {
    const emailTaken = appointment.email && db.get('users').find({ email: appointment.email.toLowerCase() }).value();
    patient = {
      id: `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      name: appointment.nombre,
      email: isEmail(appointment.email) && !emailTaken ? appointment.email.toLowerCase() : '',
      phone: appointment.telefono,
      password: null,
      role: 'member',
      source: 'landing-cita',
      dateJoined: appointment.createdAt,
      subscribedToOffers: false,
      coupons: [],
    };
    db.get('users').push(patient).write();
  }
  appointment.userId = patient.id;
  db.get('appointments').push(appointment).write();

  // Automatización n8n (opcional): confirmar por WhatsApp, recordatorio 24 h, instrucciones previas
  notifyN8n('appointment.created', { appointment });

  // Al visitante solo se le confirma la recepción: no se devuelven datos almacenados
  res.status(201).json({ ok: true, id: appointment.id });
});

// ── Portal de pacientes: acceso sin contraseña por WhatsApp ──
const magicLinks = new Map(); // sha256(token) -> { userId, expiresAt }
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

server.post('/auth/magic-link', rateLimit(5, 15 * 60 * 1000), (req, res) => {
  const key = phoneKey(req.body.phone);
  // Respuesta idéntica exista o no el número: no revela quién es paciente
  const response = { ok: true };
  if (key.length < 8) return res.status(400).json({ error: 'Ingresa un número de WhatsApp válido.' });

  const user = db.get('users').find((u) => u.role === 'member' && phoneKey(u.phone) === key).value();
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    magicLinks.set(hashToken(token), { userId: user.id, expiresAt: Date.now() + MAGIC_LINK_TTL_MS });
    const link = `${PORTAL_URL}/portal/verificar#${token}`;

    if (N8N_WEBHOOK_URL) {
      notifyN8n('auth.magic_link', { phone: user.phone, name: user.name, link });
    } else {
      // Sin n8n configurado (solo desarrollo) el enlace se muestra en consola y en pantalla
      console.log(`🔑 Enlace mágico para ${user.name}: ${link}`);
      response.devLink = link;
    }
  }
  res.json(response);
});

server.post('/auth/verify', rateLimit(10, 15 * 60 * 1000), (req, res) => {
  const token = typeof req.body.token === 'string' ? req.body.token : '';
  const entry = magicLinks.get(hashToken(token));
  magicLinks.delete(hashToken(token)); // un solo uso
  const user = entry && entry.expiresAt > Date.now() && db.get('users').find({ id: entry.userId }).value();
  if (!user) {
    return res.status(401).json({ error: 'El enlace expiró o ya fue usado. Pide uno nuevo.' });
  }
  res.json({ token: issueSession(user), user: withoutPassword(user) });
});

// ── Rutas para los flujos programados de n8n (servidor a servidor) ──
const requireN8n = (req, res, next) => {
  if (!N8N_SHARED_SECRET) return res.status(503).json({ error: 'Integración con n8n no configurada (N8N_SHARED_SECRET).' });
  const given = Buffer.from(req.header('X-N8N-Secret') || '');
  const expected = Buffer.from(N8N_SHARED_SECRET);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return res.status(401).json({ error: 'Secreto de n8n inválido.' });
  }
  next();
};

const DAY_MS = 24 * 60 * 60 * 1000;
// Fecha de hoy en Costa Rica (YYYY-MM-DD), sin depender de la zona horaria del servidor
const todayCR = () => new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
const daysFromToday = (isoDate) => Math.round((Date.parse(isoDate.slice(0, 10)) - Date.parse(todayCR())) / DAY_MS);
const contactOf = (userId) => {
  const user = db.get('users').find({ id: userId }).value();
  return user ? { patientId: user.id, name: user.name, phone: user.phone } : null;
};

// Citas de un día (p. ej. mañana y confirmadas) para el recordatorio de 24 h
server.get('/n8n/citas', requireN8n, (req, res) => {
  const fecha = str(req.query.fecha, 10);
  const estado = str(req.query.estado, 20);
  const items = db.get('appointments')
    .filter((a) => (!fecha || a.fecha === fecha) && (!estado || a.estado === estado))
    .map((a) => ({ id: a.id, nombre: a.nombre, telefono: a.telefono, tratamiento: a.tratamiento, fecha: a.fecha, hora: a.hora || '', estado: a.estado }))
    .value();
  res.json({ items });
});

// Pacientes en ventana de recuperación (14 días) para el seguimiento diario
server.get('/n8n/seguimiento', requireN8n, (req, res) => {
  const items = db.get('portal').value()
    .filter((p) => p.lastTreatment?.date)
    .map((p) => ({ ...contactOf(p.userId), diasDesdeTratamiento: -daysFromToday(p.lastTreatment.date) }))
    .filter((p) => p.patientId && p.diasDesdeTratamiento >= 0 && p.diasDesdeTratamiento <= 14);
  res.json({ items });
});

// Pasos del mapa de belleza con fecha ideal en los próximos N días (retoques y controles)
server.get('/n8n/retoques', requireN8n, (req, res) => {
  const dias = Math.min(Math.max(Number(req.query.dias) || 14, 1), 60);
  const items = db.get('portal').value().flatMap((p) =>
    (p.roadmap || [])
      .filter((step) => (step.status === 'next' || step.status === 'future') && daysFromToday(step.date) >= 0 && daysFromToday(step.date) <= dias)
      .map((step) => ({ ...contactOf(p.userId), stepId: step.id, tipo: step.kind, titulo: step.title, fecha: step.date }))
  ).filter((i) => i.patientId);
  res.json({ items });
});

// ── 🔒 CANDADO: todo lo demás requiere sesión válida ────────
server.use((req, res, next) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: '🔒 Acceso Denegado. Candado Local Activado.' });
  }
  req.session = session;
  next();
});

server.post('/logout', (req, res) => {
  sessions.delete(req.session.token);
  res.json({ ok: true });
});

server.get('/me', (req, res) => {
  const user = db.get('users').find({ id: req.session.userId }).value();
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json(withoutPassword(user));
});

// ── Portal de pacientes: cada ruta /me/* opera solo sobre los datos de la sesión ──
const MOODS = ['muy-bien', 'bien', 'regular', 'molestias', 'preocupacion'];
const SOS_REASONS = ['dolor', 'inflamacion', 'aspecto', 'duda'];

const patientContact = (userId) => {
  const user = db.get('users').find({ id: userId }).value();
  return user ? { id: user.id, name: user.name, phone: user.phone } : { id: userId };
};

server.get('/me/portal', (req, res) => {
  const portal = db.get('portal').find({ userId: req.session.userId }).value();
  // Sin plan todavía: el frontend muestra el estado vacío (primera valoración pendiente)
  res.json(portal || null);
});

server.put('/me/care', (req, res) => {
  const portal = db.get('portal').find({ userId: req.session.userId });
  if (!portal.value()) return res.status(404).json({ error: 'Todavía no tienes un protocolo de cuidados.' });
  const validIds = new Set((portal.value().care?.items || []).map((i) => i.id));
  const doneIds = Array.isArray(req.body.doneIds) ? req.body.doneIds.filter((id) => validIds.has(id)) : [];
  portal.assign({ careDone: doneIds }).write();
  res.json({ doneIds });
});

server.get('/me/checkins', (req, res) => {
  const list = db.get('checkins').filter({ userId: req.session.userId }).orderBy('createdAt', 'desc').take(30).value();
  res.json(list);
});

server.post('/me/checkins', rateLimit(10, 60 * 60 * 1000), (req, res) => {
  const mood = MOODS.includes(req.body.mood) ? req.body.mood : null;
  const pain = Number.isInteger(req.body.pain) && req.body.pain >= 0 && req.body.pain <= 10 ? req.body.pain : null;
  if (!mood || pain === null) return res.status(400).json({ error: 'Indica cómo te sientes y tu nivel de molestia.' });

  // Regla de seguimiento proactivo: preocupación, incomodidad con dolor medio o dolor alto
  const needsFollowUp = mood === 'preocupacion' || pain >= 7 || (mood === 'molestias' && pain >= 5);
  const checkin = {
    id: `chk_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    userId: req.session.userId,
    mood,
    pain,
    note: str(req.body.note, 400),
    needsFollowUp,
    createdAt: new Date().toISOString(),
  };
  db.get('checkins').push(checkin).write();

  if (needsFollowUp) {
    notifyN8n('checkin.alert', { patient: patientContact(req.session.userId), checkin });
  }
  res.status(201).json(checkin);
});

server.post('/me/sos', rateLimit(3, 10 * 60 * 1000), (req, res) => {
  const alert = {
    id: `sos_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    userId: req.session.userId,
    reason: SOS_REASONS.includes(req.body.reason) ? req.body.reason : 'duda',
    note: str(req.body.note, 400),
    status: 'abierta',
    createdAt: new Date().toISOString(),
  };
  db.get('sosAlerts').push(alert).write();
  notifyN8n('sos.triggered', { patient: patientContact(req.session.userId), alert });
  res.status(201).json({ ok: true, id: alert.id });
});

// Permisos por rol: la doctora administra todo; un miembro solo puede leer su propio perfil
server.use((req, res, next) => {
  // /db devuelve la base completa sin pasar por el filtro de contraseñas: bloqueado para todos
  if (req.path === '/db') return res.status(403).json({ error: 'Recurso no disponible.' });
  // Rutas /me/* no definidas arriba no deben caer en el router genérico
  if (req.path.startsWith('/me/')) return res.status(404).json({ error: 'Recurso no encontrado.' });
  if (req.session.role === 'doctor') return next();
  if (req.method === 'GET' && req.path === `/users/${req.session.userId}`) return next();
  res.status(403).json({ error: 'No tienes permiso para acceder a este recurso.' });
});

// Nunca se envían hashes de contraseña al navegador, ni siquiera a la doctora
router.render = (req, res) => {
  const data = res.locals.data;
  res.jsonp(Array.isArray(data) ? data.map(withoutPassword) : withoutPassword(data));
};

server.use(router);

server.listen(PORT, () => {
  console.log(`✅ Base de datos simulada corriendo en puerto ${PORT}`);
  console.log('🔒 Candado de Seguridad Local: ACTIVADO');
  console.log(N8N_WEBHOOK_URL ? '🧠 Cerebro maestro de n8n: CONECTADO' : '🧠 Cerebro maestro de n8n: no configurado (N8N_WEBHOOK_URL)');
});
