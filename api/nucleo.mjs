// ============================================================
// NÚCLEO DE LA API DE LA CLÍNICA
// La misma lógica corre en dos lugares:
//   · server.js (simulador de desarrollo y `npm run verificar`), con las tablas en db.json
//   · n8n (nodo "Núcleo API" del flujo n8n/flujos/api-clinica.json), con las tablas en Google Sheets
// Por eso este archivo no importa nada: n8n/generar-api.mjs lo copia tal cual dentro del nodo.
//
// Tablas: arreglos de objetos con `id`. El núcleo recibe todas, modifica las que necesita
// y devuelve qué filas cambiaron para que cada adaptador las guarde.
// ============================================================

export const TABLAS = ['users', 'appointments', 'portal', 'checkins', 'sosAlerts', 'accesos', 'facturas', 'tratamientos'];

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutos, un solo uso
const SESION_TTL_MS = { member: 8 * 60 * 60 * 1000, doctor: 4 * 60 * 60 * 1000 };
const DAY_MS = 24 * 60 * 60 * 1000;
const RECUPERACION_DIAS = 14;

const MOODS = ['muy-bien', 'bien', 'regular', 'molestias', 'preocupacion'];
const SOS_REASONS = ['dolor', 'inflamacion', 'aspecto', 'duda'];
// Alertas que el cerebro de n8n registra desde el chat de WhatsApp (además del aviso a la doctora)
export const TIPOS_ALERTA_WHATSAPP = ['emergencia', 'enfermera', 'ia_sin_respuesta'];
const ESTADOS_CITA = ['pendiente', 'confirmada', 'cancelada'];
const TIPOS_PASO = ['valoracion', 'tratamiento', 'control', 'retoque', 'sugerencia'];
const ESTADOS_PASO = ['done', 'current', 'next', 'future'];
const POSTERS = ['scrubs', 'editorial', 'clinica'];
const MAX_ITEMS = 50;

// ── Facturas ──
export const METODOS_PAGO = ['sinpe', 'efectivo', 'tarjeta', 'transferencia'];
export const ESTADOS_FACTURA = ['pagada', 'pendiente', 'anulada'];
export const TARIFAS_IVA = [0, 1, 2, 4, 13]; // tarifas de IVA vigentes en Costa Rica (%)
const MAX_ITEMS_FACTURA = 20;
const redondear = (n) => Math.round(n * 100) / 100;

// Totales de una factura: el servidor los calcula siempre (no se confía en los del navegador)
export function totalesFactura(items = [], descuento = 0, impuesto = 0) {
  const subtotal = redondear(items.reduce((s, i) => s + i.cantidad * i.precio, 0));
  const desc = redondear(Math.min(Math.max(Number(descuento) || 0, 0), subtotal));
  const tasa = TARIFAS_IVA.includes(Number(impuesto)) ? Number(impuesto) : 0;
  const impuestoMonto = redondear(((subtotal - desc) * tasa) / 100);
  return { subtotal, descuento: desc, impuesto: tasa, impuestoMonto, total: redondear(subtotal - desc + impuestoMonto) };
}

// ── Utilidades ─────────────────────────────────────────────
const str = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const phoneKey = (phone) => String(phone || '').replace(/\D/g, '').slice(-8); // últimos 8 dígitos (CR)
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const esFecha = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const esHora = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const esEntero = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const primerNombre = (name) => String(name || '').split(/\s+/)[0];
const porFecha = (campo, desc = false) => (a, b) => (String(a[campo]).localeCompare(String(b[campo]))) * (desc ? -1 : 1);

class ErrorApi extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const falla = (status, message) => { throw new ErrorApi(status, message); };

// ── API ────────────────────────────────────────────────────
/**
 * @param {object} opciones
 * @param {string} opciones.secretoSesion  firma HMAC de las sesiones
 * @param {string} opciones.secretoN8n     secreto que n8n envía en X-N8N-Secret
 * @param {string} opciones.portalUrl      URL pública del frontend (enlace mágico)
 * @param {boolean} opciones.modoDesarrollo devuelve el enlace mágico en la respuesta (sin WhatsApp)
 * @param {object} opciones.cripto         { hmac(clave, texto), sha256(texto), aleatorio(bytes), igual(a, b) } → hex / boolean
 * @param {() => number} [opciones.ahora]
 */
export function crearApi({ secretoSesion, secretoN8n, portalUrl, modoDesarrollo = false, cripto, ahora = () => Date.now() }) {
  if (!secretoSesion) throw new Error('Falta el secreto de sesión');

  // Fecha de hoy en Costa Rica (YYYY-MM-DD), sin depender de la zona horaria del servidor
  const hoyCR = () => new Date(ahora() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const diasDesdeHoy = (isoDate) => Math.round((Date.parse(String(isoDate).slice(0, 10)) - Date.parse(hoyCR())) / DAY_MS);
  const nuevoId = (prefijo) => `${prefijo}_${ahora()}_${cripto.aleatorio(3)}`;

  // ── Sesiones sin almacenamiento: userId.rol.expiración.firma ──
  const firmarSesion = (user) => {
    const datos = `${user.id}.${user.role}.${ahora() + SESION_TTL_MS[user.role]}`;
    return `${datos}.${cripto.hmac(secretoSesion, datos)}`;
  };

  const leerSesion = (headers, db) => {
    const header = headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const partes = token.split('.');
    if (partes.length !== 4) return null;
    const [userId, role, exp, firma] = partes;
    if (!cripto.igual(firma, cripto.hmac(secretoSesion, `${userId}.${role}.${exp}`))) return null;
    if (!(Number(exp) > ahora())) return null;
    // El usuario debe seguir existiendo con el mismo rol
    const user = db.users.find((u) => u.id === userId && u.role === role);
    return user ? { userId, role, user } : null;
  };

  const usuarioPublico = ({ id, name, email, phone, role }) => ({ id, name, email: email || '', phone: phone || '', role });

  function manejar(peticion, db) {
    for (const tabla of TABLAS) db[tabla] = Array.isArray(db[tabla]) ? db[tabla] : [];
    const cambios = {};
    const eventos = [];
    const guardar = (tabla, fila) => {
      const lista = db[tabla];
      const i = lista.findIndex((f) => f.id === fila.id);
      if (i >= 0) lista[i] = fila;
      else lista.push(fila);
      (cambios[tabla] ||= new Set()).add(fila.id);
      return fila;
    };
    const emitir = (event, payload) => eventos.push({ event, sentAt: new Date(ahora()).toISOString(), ...payload });

    const metodo = String(peticion.metodo || 'GET').toUpperCase();
    const [ruta, queryString = ''] = String(peticion.ruta || '/').split('?');
    const query = { ...parsearQuery(queryString), ...(peticion.query || {}) };
    // Las rutas de un solo recurso llevan el id en la query (?id=): n8n no publica rutas con parámetros en la URL del contrato
    const idConsulta = str(query.id, 80);
    const body = peticion.body && typeof peticion.body === 'object' ? peticion.body : {};
    const headers = Object.fromEntries(Object.entries(peticion.headers || {}).map(([k, v]) => [k.toLowerCase(), String(v)]));

    // ── Consultas compartidas ──
    const usuario = (id) => db.users.find((u) => u.id === id);
    const contacto = (userId) => {
      const u = usuario(userId);
      return u ? { id: u.id, name: u.name, phone: u.phone } : { id: userId };
    };
    const planDe = (userId) => db.portal.find((p) => p.userId === userId);
    const pacientePorTelefono = (telefono) =>
      db.users.find((u) => u.role === 'member' && phoneKey(u.phone) === phoneKey(telefono));
    const checkinsDe = (userId, n) =>
      db.checkins.filter((c) => c.userId === userId).sort(porFecha('createdAt', true)).slice(0, n);

    // Quien agenda queda registrada como paciente (sin contraseña) y entra a su portal con este número
    const buscarOCrearPaciente = ({ nombre, telefono, email = '' }, source) => {
      const existente = pacientePorTelefono(telefono);
      if (existente) return existente;
      const correo = str(email, 120).toLowerCase();
      const correoUsado = correo && db.users.some((u) => u.email === correo);
      return guardar('users', {
        id: nuevoId('usr'),
        name: nombre,
        email: isEmail(correo) && !correoUsado ? correo : '',
        phone: telefono,
        role: 'member',
        source,
        dateJoined: new Date(ahora()).toISOString(),
      });
    };

    // Alertas: SOS del portal, alertas del chat de WhatsApp (pueden no tener paciente registrada)
    // y check-ins que la regla fija marcó para seguimiento
    const pacienteDeAlerta = (a) => {
      const c = a.userId ? contacto(a.userId) : {};
      return { ...c, name: c.name || a.nombre || 'Paciente de WhatsApp', phone: c.phone || a.telefono || '' };
    };
    const alertas = () => [
      ...db.sosAlerts.map((a) => (a.origen === 'whatsapp'
        ? {
          id: a.id, tipo: 'whatsapp', origen: 'whatsapp', subtipo: a.tipoAlerta || '', paciente: pacienteDeAlerta(a),
          motivo: a.reason || '', nota: a.note || '', estado: a.status || 'abierta', respuesta: a.respuesta || '', createdAt: a.createdAt,
        }
        : {
          id: a.id, tipo: 'sos', paciente: contacto(a.userId), motivo: a.reason, nota: a.note || '',
          estado: a.status || 'abierta', respuesta: a.respuesta || '', createdAt: a.createdAt,
        })),
      ...db.checkins.filter((c) => c.needsFollowUp).map((c) => ({
        id: c.id, tipo: 'checkin', paciente: contacto(c.userId), motivo: `Ánimo: ${c.mood} · molestia ${c.pain}/10`, nota: c.note || '',
        estado: c.estado || 'abierta', respuesta: c.respuesta || '', createdAt: c.createdAt,
      })),
    ].sort(porFecha('createdAt', true));

    // ── Rutas ──
    const rutas = [
      // Públicas
      ['POST', '/appointments', 'publico', () => {
        if (body.consentimiento !== true) {
          falla(400, 'Necesitamos tu aceptación del aviso de privacidad para registrar la cita.');
        }
        const creado = new Date(ahora()).toISOString();
        const cita = {
          id: nuevoId('apt'),
          nombre: str(body.nombre, 80),
          telefono: str(body.telefono, 20),
          email: str(body.email, 120),
          tratamiento: str(body.tratamiento, 80),
          fecha: str(body.fecha, 10),
          mensaje: str(body.mensaje, 500),
          estado: 'pendiente', // El estado lo decide el servidor, no el cliente
          consentimiento: { version: str(body.avisoVersion, 40) || 'sin-version', fecha: creado },
          createdAt: creado,
        };
        if (cita.nombre.length < 3 || phoneKey(cita.telefono).length < 8 || !cita.tratamiento || !esFecha(cita.fecha)) {
          falla(400, 'Datos de la cita inválidos.');
        }
        const paciente = buscarOCrearPaciente(cita, 'landing-cita');
        // Promociones: solo con aceptación explícita y versionada (la casilla no viene marcada)
        if (body.promociones === true) {
          guardar('users', { ...paciente, promociones: { acepta: true, version: cita.consentimiento.version, fecha: creado } });
        }
        cita.userId = paciente.id;
        guardar('appointments', cita);
        emitir('appointment.created', { appointment: cita });
        // Al visitante solo se le confirma la recepción: no se devuelven datos almacenados
        return [201, { ok: true, id: cita.id }];
      }],

      ['POST', '/auth/magic-link', 'publico', () => {
        const key = phoneKey(body.phone);
        if (key.length < 8) falla(400, 'Ingresa un número de WhatsApp válido.');
        // Respuesta idéntica exista o no el número: no revela quién es paciente
        const respuesta = { ok: true };
        const user = db.users.find((u) => phoneKey(u.phone) === key);
        if (user) {
          const token = cripto.aleatorio(32);
          // Código de 6 dígitos: viaja por WhatsApp en la plantilla de Autenticación de Meta.
          // El enlace (token) sigue sirviendo en desarrollo. De ambos solo se guarda el hash.
          const codigo = String(parseInt(cripto.aleatorio(4), 16) % 1000000).padStart(6, '0');
          guardar('accesos', {
            id: nuevoId('acc'), hash: cripto.sha256(token), codigo: cripto.sha256(`${user.id}:${codigo}`), intentos: 0,
            userId: user.id, expira: ahora() + MAGIC_LINK_TTL_MS, usado: false,
          });
          const link = `${portalUrl}/portal/verificar#${token}`;
          if (modoDesarrollo) Object.assign(respuesta, { devLink: link, devCodigo: codigo });
          else emitir('auth.magic_link', { phone: user.phone, name: user.name, role: user.role, link, codigo });
        }
        return [200, respuesta];
      }],

      // Canjea el enlace ({ token }) o el código de WhatsApp ({ phone, code }) por una sesión
      ['POST', '/auth/verify', 'publico', () => {
        const token = typeof body.token === 'string' ? body.token : '';
        if (token) {
          const acceso = db.accesos.find((a) => a.hash === cripto.sha256(token));
          const user = acceso && !acceso.usado && acceso.expira > ahora() && usuario(acceso.userId);
          if (acceso && !acceso.usado) guardar('accesos', { ...acceso, usado: true }); // un solo uso, aunque haya expirado
          if (!user) falla(401, 'El enlace expiró o ya fue usado. Pide uno nuevo.');
          return [200, { token: firmarSesion(user), user: usuarioPublico(user) }];
        }
        const codigo = str(body.code, 6);
        const candidato = /^\d{6}$/.test(codigo) && db.users.find((u) => phoneKey(u.phone) === phoneKey(body.phone));
        const vigentes = candidato
          ? db.accesos.filter((a) => a.userId === candidato.id && a.codigo && !a.usado && a.expira > ahora())
          : [];
        const acceso = vigentes.find((a) => cripto.igual(a.codigo, cripto.sha256(`${candidato.id}:${codigo}`)));
        if (acceso) {
          guardar('accesos', { ...acceso, usado: true });
          return [200, { token: firmarSesion(candidato), user: usuarioPublico(candidato) }];
        }
        // Fuerza bruta: cada código vigente se invalida al quinto intento fallido
        for (const a of vigentes) {
          const intentos = (Number(a.intentos) || 0) + 1;
          guardar('accesos', { ...a, intentos, ...(intentos >= 5 ? { usado: true } : {}) });
        }
        return falla(401, 'El código no es válido o ya venció. Pide uno nuevo.');
      }],

      // n8n (servidor a servidor, con X-N8N-Secret)
      ['GET', '/n8n/citas', 'n8n', () => {
        const fecha = str(query.fecha, 10);
        const estado = str(query.estado, 20);
        const items = db.appointments
          .filter((a) => (!fecha || a.fecha === fecha) && (!estado || a.estado === estado))
          .map((a) => ({ id: a.id, nombre: a.nombre, telefono: a.telefono, tratamiento: a.tratamiento, fecha: a.fecha, hora: a.hora || '', estado: a.estado }));
        return [200, { items }];
      }],

      // Pacientes en ventana de recuperación para el seguimiento diario
      ['GET', '/n8n/seguimiento', 'n8n', () => {
        const items = db.portal
          .filter((p) => p.lastTreatment?.date)
          .map((p) => {
            const c = contacto(p.userId);
            return { patientId: c.name ? c.id : undefined, name: c.name, phone: c.phone, diasDesdeTratamiento: -diasDesdeHoy(p.lastTreatment.date) };
          })
          .filter((p) => p.patientId && p.diasDesdeTratamiento >= 0 && p.diasDesdeTratamiento <= RECUPERACION_DIAS);
        return [200, { items }];
      }],

      // Pasos del mapa de belleza con fecha ideal en los próximos N días (retoques y controles)
      ['GET', '/n8n/retoques', 'n8n', () => {
        const dias = Math.min(Math.max(Number(query.dias) || 14, 1), 60);
        const items = db.portal.flatMap((p) => {
          const c = contacto(p.userId);
          if (!c.name) return [];
          return (p.roadmap || [])
            .filter((s) => (s.status === 'next' || s.status === 'future') && diasDesdeHoy(s.date) >= 0 && diasDesdeHoy(s.date) <= dias)
            .map((s) => ({ patientId: c.id, name: c.name, phone: c.phone, stepId: s.id, tipo: s.kind, titulo: s.title, fecha: s.date }));
        });
        return [200, { items }];
      }],

      // Ficha según quién pregunta: la Enfermera ve lo clínico, la Recepcionista solo lo administrativo.
      // Ninguna recibe teléfono, correo ni apellidos.
      ['GET', '/n8n/paciente', 'n8n', () => {
        const user = pacientePorTelefono(str(query.telefono, 20));
        if (!user) return [200, { encontrada: false }];
        const plan = planDe(user.id) || {};
        const nombre = primerNombre(user.name);
        if (query.perfil === 'clinico') {
          const desde = plan.care?.since ? Date.parse(plan.care.since) : null;
          return [200, {
            encontrada: true,
            nombre,
            ultimoTratamiento: plan.lastTreatment ? { nombre: plan.lastTreatment.name, fecha: String(plan.lastTreatment.date).slice(0, 10) } : null,
            diaDeRecuperacion: plan.lastTreatment ? -diasDesdeHoy(plan.lastTreatment.date) + 1 : null,
            cuidadosVigentes: desde
              ? (plan.care.items || []).filter((i) => desde + i.hours * 3600000 > ahora()).map((i) => (i.type === 'dont' ? 'NO: ' : 'Hacer: ') + i.text)
              : [],
            ultimosCheckins: checkinsDe(user.id, 3).map((c) => ({ fecha: c.createdAt.slice(0, 10), animo: c.mood, molestia: c.pain, nota: c.note })),
          }];
        }
        const proximaCita = db.appointments
          .filter((a) => a.userId === user.id && a.estado !== 'cancelada' && diasDesdeHoy(a.fecha) >= 0)
          .sort(porFecha('fecha'))
          .map((a) => ({ fecha: a.fecha, hora: a.hora || '', estado: a.estado, tratamiento: a.tratamiento }))[0] || null;
        return [200, {
          encontrada: true,
          nombre,
          proximaCita,
          paquetes: (plan.packages || []).map((p) => ({ nombre: p.name, sesionesUsadas: p.used, sesionesTotales: p.total })),
        }];
      }],

      // La Recepcionista VIP registra la cita que reservó en la agenda (queda confirmada)
      ['POST', '/n8n/citas', 'n8n', () => {
        const cita = {
          id: nuevoId('apt'),
          nombre: str(body.nombre, 80),
          telefono: str(body.telefono, 20),
          email: '',
          tratamiento: str(body.tratamiento, 80) || 'Valoración General',
          fecha: str(body.fecha, 10),
          hora: str(body.hora, 20),
          mensaje: str(body.nota, 300),
          estado: 'confirmada',
          origen: 'recepcionista-ia',
          createdAt: new Date(ahora()).toISOString(),
        };
        if (cita.nombre.length < 2 || phoneKey(cita.telefono).length < 8 || !esFecha(cita.fecha) || !cita.hora) {
          falla(400, 'Faltan datos: nombre, teléfono, fecha (AAAA-MM-DD) y hora.');
        }
        cita.userId = buscarOCrearPaciente(cita, 'recepcionista-ia').id;
        guardar('appointments', cita);
        return [201, { ok: true, id: cita.id, fecha: cita.fecha, hora: cita.hora }];
      }],

      // Citas confirmadas del día con el historial necesario para el resumen ejecutivo
      ['GET', '/n8n/preparacion', 'n8n', () => {
        const fecha = str(query.fecha, 10) || hoyCR();
        const items = db.appointments.filter((a) => a.fecha === fecha && a.estado === 'confirmada').map((cita) => {
          const user = usuario(cita.userId) || pacientePorTelefono(cita.telefono);
          const plan = (user && planDe(user.id)) || {};
          return {
            citaId: cita.id,
            paciente: cita.nombre,
            hora: cita.hora || '',
            motivo: cita.tratamiento,
            mensajeDeLaPaciente: cita.mensaje || '',
            tratamientosPrevios: (plan.roadmap || []).filter((s) => s.status === 'done' || s.status === 'current').map((s) => `${s.date}: ${s.title}`),
            proximosPasosDelPlan: (plan.roadmap || []).filter((s) => s.status === 'next' || s.status === 'future').slice(0, 2).map((s) => `${s.date}: ${s.title}`),
            productosAplicados: (plan.certificates || []).map((c) => `${c.appliedOn}: ${c.product} (${c.zone}, ${c.amount})`),
            ultimosCheckins: user
              ? checkinsDe(user.id, 3).map((c) => `${c.createdAt.slice(0, 10)}: ánimo ${c.mood}, molestia ${c.pain}/10${c.note ? `, "${c.note}"` : ''}`)
              : [],
          };
        });
        return [200, { fecha, items }];
      }],

      // El resumen de 3 puntos que prepara la Recepcionista queda también en el panel de la doctora
      ['POST', '/n8n/resumen', 'n8n', () => {
        const cita = db.appointments.find((a) => a.id === str(body.citaId, 80));
        const puntos = Array.isArray(body.puntos) ? body.puntos.map((p) => str(p, 300)).filter(Boolean).slice(0, 3) : [];
        if (!cita || puntos.length === 0) falla(400, 'Indica la cita y los puntos del resumen.');
        guardar('appointments', { ...cita, resumen: { puntos, fecha: new Date(ahora()).toISOString() } });
        return [200, { ok: true }];
      }],

      // Emergencia del chat, alerta de la Enfermera IA (despertar_doctora) o mensaje que la IA no pudo responder:
      // la doctora ya recibió el WhatsApp; esto la deja en el panel (Alertas y Hoy) para atenderla y marcarla.
      // No emite eventos: el aviso ya salió del cerebro.
      ['POST', '/n8n/alerta', 'n8n', () => {
        const telefono = str(body.telefono, 20);
        const tipo = TIPOS_ALERTA_WHATSAPP.includes(body.tipo) ? body.tipo : '';
        const motivo = str(body.motivo, 300);
        if (phoneKey(telefono).length < 8 || !tipo || !motivo) {
          falla(400, 'Indica el teléfono, el tipo de alerta (emergencia, enfermera o ia_sin_respuesta) y el motivo.');
        }
        const paciente = pacientePorTelefono(telefono);
        const alerta = guardar('sosAlerts', {
          id: nuevoId('wa'),
          ...(paciente ? { userId: paciente.id } : {}),
          nombre: str(body.nombre, 80) || paciente?.name || '',
          telefono: paciente?.phone || telefono,
          origen: 'whatsapp',
          tipoAlerta: tipo,
          reason: motivo,
          note: str(body.nota, 1000),
          status: 'abierta',
          createdAt: new Date(ahora()).toISOString(),
        });
        return [201, { ok: true, id: alerta.id, pacienteRegistrada: Boolean(paciente) }];
      }],

      // La paciente respondió "BAJA" por WhatsApp: deja de recibir promociones
      ['POST', '/n8n/baja', 'n8n', () => {
        const user = pacientePorTelefono(str(body.telefono, 20));
        if (user?.promociones?.acepta) guardar('users', { ...user, promociones: { ...user.promociones, acepta: false, baja: new Date(ahora()).toISOString() } });
        return [200, { ok: true }]; // misma respuesta aunque el número no exista
      }],

      // Sesión (paciente o doctora)
      ['POST', '/logout', 'sesion', () => [200, { ok: true }]], // sin estado: el navegador borra el token
      ['GET', '/me', 'sesion', (s) => [200, usuarioPublico(s.user)]],

      // Portal de pacientes: cada ruta /me/* opera solo sobre los datos de la sesión
      ['GET', '/me/portal', 'paciente', (s) => {
        const plan = planDe(s.userId);
        // Sin plan todavía: el frontend muestra el estado vacío (primera valoración pendiente)
        return [200, plan || null];
      }],

      ['PUT', '/me/care', 'paciente', (s) => {
        const plan = planDe(s.userId);
        if (!plan) falla(404, 'Todavía no tienes un protocolo de cuidados.');
        const validos = new Set((plan.care?.items || []).map((i) => i.id));
        const doneIds = Array.isArray(body.doneIds) ? body.doneIds.filter((id) => validos.has(id)) : [];
        guardar('portal', { ...plan, careDone: doneIds });
        return [200, { doneIds }];
      }],

      ['GET', '/me/checkins', 'paciente', (s) => [200, checkinsDe(s.userId, 30)]],

      ['POST', '/me/checkins', 'paciente', (s) => {
        const mood = MOODS.includes(body.mood) ? body.mood : null;
        const pain = esEntero(body.pain, 0, 10) ? body.pain : null;
        if (!mood || pain === null) falla(400, 'Indica cómo te sientes y tu nivel de molestia.');
        // Regla de seguimiento proactivo: preocupación, incomodidad con dolor medio o dolor alto
        const needsFollowUp = mood === 'preocupacion' || pain >= 7 || (mood === 'molestias' && pain >= 5);
        const checkin = guardar('checkins', {
          id: nuevoId('chk'),
          userId: s.userId,
          mood,
          pain,
          note: str(body.note, 400),
          needsFollowUp,
          ...(needsFollowUp ? { estado: 'abierta' } : {}),
          createdAt: new Date(ahora()).toISOString(),
        });
        // Todos los check-in pasan por la Enfermera Virtual (analista emocional) en n8n.
        // needsFollowUp es la regla fija: si la IA falla, n8n igual escala con ella.
        const plan = planDe(s.userId);
        const recoveryDay = plan?.lastTreatment?.date ? -diasDesdeHoy(plan.lastTreatment.date) : null;
        emitir('checkin.created', { patient: contacto(s.userId), checkin, recoveryDay });
        return [201, checkin];
      }],

      ['POST', '/me/sos', 'paciente', (s) => {
        const alert = guardar('sosAlerts', {
          id: nuevoId('sos'),
          userId: s.userId,
          reason: SOS_REASONS.includes(body.reason) ? body.reason : 'duda',
          note: str(body.note, 400),
          status: 'abierta',
          createdAt: new Date(ahora()).toISOString(),
        });
        emitir('sos.triggered', { patient: contacto(s.userId), alert });
        return [201, { ok: true, id: alert.id }];
      }],

      // Panel de la doctora
      ['GET', '/admin/hoy', 'doctora', () => {
        const fecha = hoyCR();
        const abiertas = alertas().filter((a) => a.estado === 'abierta');
        return [200, {
          fecha,
          citas: db.appointments
            .filter((a) => a.fecha === fecha && a.estado === 'confirmada')
            .sort(porFecha('hora'))
            .map((a) => ({ id: a.id, nombre: a.nombre, hora: a.hora || '', tratamiento: a.tratamiento, userId: a.userId, resumen: a.resumen || null })),
          solicitudesPendientes: db.appointments.filter((a) => a.estado === 'pendiente').length,
          alertasAbiertas: abiertas.length,
          alertas: abiertas.slice(0, 5),
        }];
      }],

      ['GET', '/admin/citas', 'doctora', () => {
        const estado = str(query.estado, 20);
        const items = db.appointments
          .filter((a) => !estado || a.estado === estado)
          .sort(porFecha('fecha', true));
        return [200, items];
      }],

      ['PATCH', '/admin/citas', 'doctora', () => {
        const cita = db.appointments.find((a) => a.id === idConsulta);
        if (!cita) falla(404, 'Cita no encontrada.');
        const estado = body.estado === undefined ? cita.estado : body.estado;
        const fecha = body.fecha === undefined ? cita.fecha : str(body.fecha, 10);
        const hora = body.hora === undefined ? cita.hora || '' : str(body.hora, 5);
        if (!ESTADOS_CITA.includes(estado)) falla(400, 'Estado de cita inválido.');
        if (!esFecha(fecha)) falla(400, 'La fecha debe tener el formato AAAA-MM-DD.');
        if (estado === 'confirmada' && !esHora(hora)) falla(400, 'Para confirmar la cita indica la hora (HH:MM).');
        const actualizada = guardar('appointments', { ...cita, estado, fecha, hora, actualizadaEn: new Date(ahora()).toISOString() });

        // Solo se avisa a la paciente cuando cambia algo que le importa
        const detalle = { patient: contacto(cita.userId), cita: { id: cita.id, fecha, hora, tratamiento: cita.tratamiento } };
        const cambioHorario = fecha !== cita.fecha || hora !== (cita.hora || '');
        if (estado === 'confirmada' && (cita.estado !== 'confirmada' || cambioHorario)) {
          emitir('appointment.confirmed', { ...detalle, reprogramada: cita.estado === 'confirmada' });
        } else if (estado === 'cancelada' && cita.estado !== 'cancelada') {
          emitir('appointment.cancelled', detalle);
        }
        return [200, actualizada];
      }],

      ['GET', '/admin/pacientes', 'doctora', () => {
        const items = db.users
          .filter((u) => u.role === 'member')
          .sort(porFecha('dateJoined', true))
          .map((u) => ({
            id: u.id, name: u.name, email: u.email || '', phone: u.phone, source: u.source, dateJoined: u.dateJoined,
            promociones: Boolean(u.promociones?.acepta),
            tienePlan: Boolean(planDe(u.id)),
          }));
        return [200, items];
      }],

      ['GET', '/admin/pacientes/ficha', 'doctora', () => {
        const user = usuario(idConsulta);
        if (!user || user.role !== 'member') falla(404, 'Paciente no encontrada.');
        return [200, {
          paciente: { ...usuarioPublico(user), source: user.source, dateJoined: user.dateJoined, promociones: Boolean(user.promociones?.acepta) },
          plan: planDe(user.id) || null,
          citas: db.appointments.filter((a) => a.userId === user.id).sort(porFecha('fecha', true)),
          checkins: checkinsDe(user.id, 10),
        }];
      }],

      // La doctora solo puede retirar el consentimiento de promociones, nunca darlo en nombre de la paciente
      ['PATCH', '/admin/pacientes', 'doctora', () => {
        const user = usuario(idConsulta);
        if (!user || user.role !== 'member') falla(404, 'Paciente no encontrada.');
        if (body.promociones !== false) falla(400, 'Solo se puede retirar el consentimiento de promociones.');
        if (user.promociones?.acepta) guardar('users', { ...user, promociones: { ...user.promociones, acepta: false, baja: new Date(ahora()).toISOString() } });
        return [200, { ok: true }];
      }],

      ['PUT', '/admin/pacientes/plan', 'doctora', () => {
        const user = usuario(idConsulta);
        if (!user || user.role !== 'member') falla(404, 'Paciente no encontrada.');
        const anterior = planDe(user.id);
        const plan = limpiarPlan(body, nuevoId);
        const careIds = new Set((plan.care?.items || []).map((i) => i.id));
        const guardado = guardar('portal', {
          ...plan,
          id: anterior?.id || `portal-${user.id}`,
          userId: user.id,
          photos: anterior?.photos || [],
          // Los cuidados marcados sobreviven solo si el protocolo los sigue incluyendo
          careDone: (anterior?.careDone || []).filter((id) => careIds.has(id)),
          updatedAt: new Date(ahora()).toISOString(),
        });
        return [200, guardado];
      }],

      ['GET', '/admin/alertas', 'doctora', () => {
        const estado = str(query.estado, 20);
        return [200, alertas().filter((a) => !estado || a.estado === estado)];
      }],

      ['PATCH', '/admin/alertas', 'doctora', () => {
        if (!['abierta', 'atendida'].includes(body.estado)) falla(400, 'Estado de alerta inválido.');
        const respuesta = str(body.respuesta, 400);
        const sos = db.sosAlerts.find((a) => a.id === idConsulta);
        const checkin = !sos && db.checkins.find((c) => c.id === idConsulta && c.needsFollowUp);
        if (sos) guardar('sosAlerts', { ...sos, status: body.estado, respuesta });
        else if (checkin) guardar('checkins', { ...checkin, estado: body.estado, respuesta });
        else falla(404, 'Alerta no encontrada.');
        return [200, alertas().find((a) => a.id === idConsulta)];
      }],

      ['POST', '/admin/campanas', 'doctora', () => {
        const mensaje = str(body.mensaje, 300);
        if (mensaje.length < 10) falla(400, 'Escribe el mensaje de la promoción (mínimo 10 caracteres).');
        const destinatarios = db.users
          .filter((u) => u.role === 'member' && u.promociones?.acepta && phoneKey(u.phone).length === 8)
          .map((u) => ({ name: primerNombre(u.name), phone: u.phone }));
        if (destinatarios.length === 0) falla(400, 'Ninguna paciente aceptó recibir promociones todavía.');
        emitir('campaign.sent', { mensaje, destinatarios });
        return [200, { enviados: destinatarios.length }];
      }],

      // ── Facturas: la doctora registra cada cobro (SINPE Móvil, efectivo, tarjeta o transferencia) ──
      ['GET', '/admin/facturas', 'doctora', () => [200, [...db.facturas].sort(porFecha('creadaEn', true))]],

      ['POST', '/admin/facturas', 'doctora', () => {
        const idPaciente = str(body.idPaciente, 80);
        const paciente = idPaciente ? usuario(idPaciente) : null;
        if (idPaciente && (!paciente || paciente.role !== 'member')) falla(404, 'Paciente no encontrada.');
        const c = body.cliente && typeof body.cliente === 'object' ? body.cliente : {};
        const cliente = {
          nombre: str(c.nombre, 120) || paciente?.name || '',
          identificacion: str(c.identificacion, 30),
          telefono: str(c.telefono, 20) || paciente?.phone || '',
          email: str(c.email, 120) || paciente?.email || '',
        };
        if (cliente.nombre.length < 3) falla(400, 'Indica el nombre del cliente.');
        const items = (Array.isArray(body.items) ? body.items : []).slice(0, MAX_ITEMS_FACTURA).map((i) => ({
          descripcion: str(i?.descripcion, 160),
          cantidad: Number(i?.cantidad),
          precio: redondear(Number(i?.precio)),
        }));
        const itemInvalido = (i) => !i.descripcion || !Number.isInteger(i.cantidad) || i.cantidad < 1 || i.cantidad > 99
          || !Number.isFinite(i.precio) || i.precio < 0 || i.precio > 50000000;
        if (items.length === 0 || items.some(itemInvalido)) {
          falla(400, 'Agrega al menos un servicio con descripción, cantidad (1 a 99) y precio válido.');
        }
        if (!METODOS_PAGO.includes(body.metodoPago)) falla(400, 'Indica el método de pago.');
        const estado = body.estado === 'pendiente' ? 'pendiente' : 'pagada';
        const referencia = str(body.referencia, 60);
        if (body.metodoPago === 'sinpe' && estado === 'pagada' && !referencia) falla(400, 'Indica el número de comprobante del SINPE Móvil.');
        const fecha = str(body.fecha, 10) || hoyCR();
        if (!esFecha(fecha)) falla(400, 'La fecha debe tener el formato AAAA-MM-DD.');
        const totales = totalesFactura(items, body.descuento, body.impuesto);
        if (totales.total <= 0) falla(400, 'El total de la factura debe ser mayor a cero.');
        // Consecutivo: FAC-0001, FAC-0002… (las anuladas conservan su número)
        const ultimo = db.facturas.reduce((m, f) => Math.max(m, Number(String(f.numero || '').replace(/\D/g, '')) || 0), 0);
        const creada = new Date(ahora()).toISOString();
        const factura = guardar('facturas', {
          id: nuevoId('fac'),
          numero: `FAC-${String(ultimo + 1).padStart(4, '0')}`,
          fecha,
          idPaciente: paciente?.id || '',
          cliente,
          items,
          ...totales,
          metodoPago: body.metodoPago,
          referencia,
          estado,
          notas: str(body.notas, 400),
          creadaEn: creada,
          ...(estado === 'pagada' ? { pagadaEn: creada } : {}),
        });
        return [201, factura];
      }],

      // Cobrar una pendiente, corregir el método o anular (nunca se borra: el consecutivo no puede tener huecos)
      ['PATCH', '/admin/facturas', 'doctora', () => {
        const factura = db.facturas.find((f) => f.id === idConsulta);
        if (!factura) falla(404, 'Factura no encontrada.');
        if (factura.estado === 'anulada') falla(400, 'La factura está anulada y ya no se puede modificar.');
        const estado = body.estado === undefined ? factura.estado : body.estado;
        if (!ESTADOS_FACTURA.includes(estado)) falla(400, 'Estado de factura inválido.');
        const metodoPago = body.metodoPago === undefined ? factura.metodoPago : body.metodoPago;
        if (!METODOS_PAGO.includes(metodoPago)) falla(400, 'Método de pago inválido.');
        const referencia = body.referencia === undefined ? factura.referencia : str(body.referencia, 60);
        if (estado === 'pagada' && metodoPago === 'sinpe' && !referencia) falla(400, 'Indica el número de comprobante del SINPE Móvil.');
        const cuando = new Date(ahora()).toISOString();
        const actualizada = guardar('facturas', {
          ...factura,
          estado,
          metodoPago,
          referencia,
          ...(estado === 'pagada' && factura.estado !== 'pagada' ? { pagadaEn: cuando } : {}),
          ...(estado === 'anulada' ? { anuladaEn: cuando, motivoAnulacion: str(body.motivo, 200) } : {}),
          actualizadaEn: cuando,
        });
        return [200, actualizada];
      }],

      ['GET', '/me/facturas', 'paciente', (s) => [200, db.facturas
        .filter((f) => f.idPaciente === s.userId && f.estado !== 'anulada')
        .sort(porFecha('creadaEn', true))]],

      // ── Tratamientos activos ──
      ['GET', '/admin/tratamientos', 'doctora', () => {
        return [200, db.tratamientos.sort(porFecha('fechaInicio', true))];
      }],

      ['POST', '/admin/tratamientos', 'doctora', () => {
        const idPaciente = str(body.idPaciente, 80);
        const user = usuario(idPaciente);
        if (!user || user.role !== 'member') falla(404, 'Paciente no encontrada.');
        const medicamento = str(body.medicamento, 120);
        const dosis = str(body.dosis, 80);
        const frecuencia = str(body.frecuencia, 80);
        const fechaInicio = str(body.fechaInicio, 10);
        const fechaFin = str(body.fechaFin, 10);
        const notas = str(body.notas, 400);
        if (!medicamento || !dosis || !frecuencia || !esFecha(fechaInicio) || !esFecha(fechaFin)) {
          falla(400, 'Completa todos los campos: medicamento, dosis, frecuencia, fecha inicio y fin.');
        }
        if (fechaFin < fechaInicio) falla(400, 'La fecha de fin no puede ser anterior a la de inicio.');
        const tratamiento = guardar('tratamientos', {
          id: nuevoId('trat'),
          idPaciente,
          nombrePaciente: user.name,
          medicamento,
          dosis,
          frecuencia,
          fechaInicio,
          fechaFin,
          notas,
          creadoEn: new Date(ahora()).toISOString(),
        });
        return [201, tratamiento];
      }],

      ['GET', '/me/tratamientos', 'paciente', (s) => {
        const items = db.tratamientos
          .filter((t) => t.idPaciente === s.userId)
          .sort(porFecha('fechaInicio', true));
        return [200, items];
      }],

      // ── Estadísticas avanzadas (panel de la doctora) ──
      ['GET', '/admin/estadisticas', 'doctora', () => {
        const hoy = hoyCR();
        const mesActual = hoy.slice(0, 7);
        const haceSeisMeses = new Date(Date.parse(hoy) - 180 * DAY_MS).toISOString().slice(0, 7);

        // Ingresos: facturas pagadas y pendientes del mes (las anuladas no cuentan)
        const sumar = (lista) => redondear(lista.reduce((s, f) => s + (Number(f.total) || 0), 0));
        const facturasMes = db.facturas.filter((f) => f.fecha?.slice(0, 7) === mesActual);
        const ingresosDelMes = sumar(facturasMes.filter((f) => f.estado === 'pagada'));
        const pendientesMes = sumar(facturasMes.filter((f) => f.estado === 'pendiente'));

        // Ingresos por mes (últimos 6 meses)
        // Ingresos por mes de calendario (últimos 6 meses)
        const ingresosPorMes = [];
        const [anio, mesNum] = hoy.split('-').map(Number);
        for (let i = 5; i >= 0; i--) {
          const d = new Date(Date.UTC(anio, mesNum - 1 - i, 15));
          const mes = d.toISOString().slice(0, 7);
          const etiqueta = new Intl.DateTimeFormat('es-CR', { month: 'short', timeZone: 'UTC' }).format(d);
          ingresosPorMes.push({ etiqueta, mes, total: sumar(db.facturas.filter((f) => f.fecha?.slice(0, 7) === mes && f.estado === 'pagada')) });
        }

        // Citas del mes
        const citasMes = db.appointments.filter((a) => a.fecha?.slice(0, 7) === mesActual);
        const citasHoy = db.appointments.filter((a) => a.fecha === hoy && a.estado === 'confirmada').length;
        const completadas = citasMes.filter((a) => a.estado === 'confirmada').length;
        const canceladas = citasMes.filter((a) => a.estado === 'cancelada').length;
        const pendientes = citasMes.filter((a) => a.estado === 'pendiente').length;

        // Pacientes nuevas este mes
        const pacientesNuevasMes = db.users.filter((u) => u.role === 'member' && u.dateJoined?.slice(0, 7) === mesActual).length;
        const totalPacientes = db.users.filter((u) => u.role === 'member').length;

        // Tratamientos activos
        const tratamientosActivos = db.tratamientos.filter((t) => t.fechaInicio <= hoy && t.fechaFin >= hoy).length;

        // Top tratamientos solicitados
        const conteo = {};
        db.appointments.filter((a) => a.estado !== 'cancelada' && a.fecha?.slice(0, 7) >= haceSeisMeses).forEach((a) => {
          const nombre = a.tratamiento || 'Sin especificar';
          conteo[nombre] = (conteo[nombre] || 0) + 1;
        });
        const topTratamientos = Object.entries(conteo)
          .map(([nombre, total]) => ({ nombre, total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 8);

        return [200, {
          resumen: {
            ingresosDelMes,
            pendientesMes,
            citasHoy,
            pacientesNuevasMes,
            totalPacientes,
            tratamientosActivos,
            completadas,
            canceladas,
            pendientes,
          },
          ingresosPorMes,
          distribucionCitas: [
            { nombre: 'Completadas', valor: completadas },
            { nombre: 'Canceladas', valor: canceladas },
            { nombre: 'Pendientes', valor: pendientes },
          ],
          topTratamientos,
        }];
      }],
    ];


    const responder = (status, cuerpo) => ({
      status,
      body: cuerpo,
      eventos,
      cambios: Object.fromEntries(Object.entries(cambios).map(([t, ids]) => [t, [...ids]])),
    });

    try {
      for (const [m, patron, acceso, handler] of rutas) {
        if (patron !== ruta.replace(/\/+$/, '') || m !== metodo) continue;

        let sesion = null;
        if (acceso === 'n8n') {
          if (!secretoN8n) falla(503, 'Integración con n8n no configurada.');
          if (!cripto.igual(headers['x-n8n-secret'] || '', secretoN8n)) falla(401, 'Secreto de n8n inválido.');
        } else if (acceso !== 'publico') {
          sesion = leerSesion(headers, db);
          if (!sesion) falla(401, '🔒 Acceso denegado: inicia sesión de nuevo.');
          if (acceso === 'paciente' && sesion.role !== 'member') falla(403, 'No tienes permiso para acceder a este recurso.');
          if (acceso === 'doctora' && sesion.role !== 'doctor') falla(403, 'No tienes permiso para acceder a este recurso.');
        }
        const [status, cuerpo] = handler(sesion);
        return responder(status, cuerpo);
      }
      // Rutas privadas desconocidas: primero se exige sesión, para no revelar qué existe
      if (!ruta.startsWith('/n8n/') && !leerSesion(headers, db)) falla(401, '🔒 Acceso denegado: inicia sesión de nuevo.');
      falla(404, 'Recurso no encontrado.');
    } catch (err) {
      if (!(err instanceof ErrorApi)) throw err;
      // Un error no guarda cambios parciales, salvo el uso de un enlace mágico
      for (const tabla of Object.keys(cambios)) if (tabla !== 'accesos') delete cambios[tabla];
      eventos.length = 0;
      return responder(err.status, { error: err.message });
    }
  }

  return { manejar };
}

// "a=1&b=dos" → { a: '1', b: 'dos' }. (Los nodos Code de n8n no tienen URLSearchParams.)
function parsearQuery(texto) {
  const decodificar = (s) => {
    try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch { return s; }
  };
  return Object.fromEntries(texto.split('&').filter(Boolean).map((par) => {
    const i = par.indexOf('=');
    return i < 0 ? [decodificar(par), ''] : [decodificar(par.slice(0, i)), decodificar(par.slice(i + 1))];
  }));
}

// ── Validación del plan de una paciente (lo que edita la doctora) ──
function limpiarPlan(body, nuevoId) {
  const lista = (valor, nombre) => {
    if (valor === undefined || valor === null) return [];
    if (!Array.isArray(valor) || valor.length > MAX_ITEMS) falla(400, `La sección "${nombre}" no es válida.`);
    return valor;
  };
  const exigir = (condicion, nombre) => { if (!condicion) falla(400, `Revisa la sección "${nombre}": hay datos incompletos o inválidos.`); };
  const idDe = (item, prefijo) => str(item.id, 40) || nuevoId(prefijo);
  const fechaHora = (valor) => {
    const v = str(valor, 40);
    return v && !Number.isNaN(Date.parse(v)) ? v : '';
  };

  const plan = {};

  if (body.lastTreatment) {
    const t = { name: str(body.lastTreatment.name, 120), date: fechaHora(body.lastTreatment.date) };
    exigir(t.name && t.date, 'Último tratamiento');
    plan.lastTreatment = t;
  } else plan.lastTreatment = null;

  if (body.nextAppointment) {
    const n = { date: fechaHora(body.nextAppointment.date), title: str(body.nextAppointment.title, 120), place: str(body.nextAppointment.place, 120) };
    exigir(n.date && n.title, 'Próxima cita');
    plan.nextAppointment = n;
  } else plan.nextAppointment = null;

  plan.roadmap = lista(body.roadmap, 'Mapa de belleza').map((s) => {
    const paso = { id: idDe(s, 'r'), date: str(s.date, 10), title: str(s.title, 120), kind: s.kind, status: s.status, note: str(s.note, 500) };
    exigir(esFecha(paso.date) && paso.title && TIPOS_PASO.includes(paso.kind) && ESTADOS_PASO.includes(paso.status), 'Mapa de belleza');
    return paso;
  }).sort(porFecha('date'));

  if (body.care && (body.care.title || lista(body.care.items, 'Cuidados').length)) {
    const care = {
      title: str(body.care.title, 120),
      since: fechaHora(body.care.since),
      items: lista(body.care.items, 'Cuidados').map((i) => {
        const item = { id: idDe(i, 'c'), type: i.type, text: str(i.text, 200), hours: Number(i.hours) };
        exigir(['do', 'dont'].includes(item.type) && item.text && esEntero(item.hours, 1, 720), 'Cuidados');
        return item;
      }),
    };
    exigir(care.title && care.since, 'Cuidados');
    plan.care = care;
  } else plan.care = null;

  plan.packages = lista(body.packages, 'Paquetes').map((p) => {
    const paquete = { id: idDe(p, 'p'), name: str(p.name, 120), total: Number(p.total), used: Number(p.used), validUntil: str(p.validUntil, 10) };
    exigir(paquete.name && esEntero(paquete.total, 1, 50) && esEntero(paquete.used, 0, paquete.total) && esFecha(paquete.validUntil), 'Paquetes');
    return paquete;
  });

  plan.certificates = lista(body.certificates, 'Productos aplicados').map((c) => {
    const producto = {
      id: idDe(c, 'l'), product: str(c.product, 120), brand: str(c.brand, 80), lot: str(c.lot, 40),
      expiry: str(c.expiry, 7), appliedOn: str(c.appliedOn, 10), zone: str(c.zone, 80), amount: str(c.amount, 20),
    };
    exigir(producto.product && producto.brand && producto.lot && /^\d{4}-\d{2}$/.test(producto.expiry) && esFecha(producto.appliedOn), 'Productos aplicados');
    return producto;
  });

  plan.videos = lista(body.videos, 'Videos').map((v) => {
    const video = {
      id: idDe(v, 'v'), title: str(v.title, 120), duration: str(v.duration, 10), topic: str(v.topic, 40),
      poster: POSTERS.includes(v.poster) ? v.poster : POSTERS[0], url: str(v.url, 500) || null,
    };
    exigir(video.title && (!video.url || video.url.startsWith('https://')), 'Videos');
    return video;
  });

  return plan;
}
