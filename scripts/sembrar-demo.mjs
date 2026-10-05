// Datos de demostración para presentar el proyecto: npm run sembrar:demo
// Escribe db.json (o DB_FILE) con pacientes, citas de los últimos 12 meses y próximas semanas,
// solicitudes con preguntas, check-ins y alertas. Parte de db.example.json (doctora y paciente demo con plan).
// Las fechas se calculan desde hoy, así el panel siempre tiene citas del día.
// Todos los datos son ficticios: teléfonos +506 8888 0XXX y correos @example.com.
import fs from 'node:fs';

const DB_FILE = process.env.DB_FILE || 'db.json';
const base = JSON.parse(fs.readFileSync('db.example.json', 'utf8'));

// Generador pseudoaleatorio con semilla: los mismos datos en cada ejecución
let semilla = 20260929;
const azar = () => {
  semilla = (semilla * 1664525 + 1013904223) % 4294967296;
  return semilla / 4294967296;
};
const elegir = (lista) => lista[Math.floor(azar() * lista.length)];
const entre = (min, max) => min + Math.floor(azar() * (max - min + 1));

// Fechas en hora de Costa Rica (UTC-6, sin horario de verano)
const DIA = 24 * 60 * 60 * 1000;
const ahoraCR = new Date(Date.now() - 6 * 60 * 60 * 1000);
const hoy = ahoraCR.toISOString().slice(0, 10);
const fechaMas = (dias) => new Date(Date.parse(`${hoy}T12:00:00Z`) + dias * DIA).toISOString().slice(0, 10);
const isoMas = (dias, hora = '10:00') => `${fechaMas(dias)}T${hora}:00-06:00`;
const esDomingo = (fecha) => new Date(`${fecha}T12:00:00Z`).getUTCDay() === 0;

const NOMBRES = [
  'Mariana Solís Vargas', 'Daniela Castro Mora', 'Gabriela Jiménez Rojas', 'Sofía Araya Quesada', 'Andrea Chaves Brenes',
  'Natalia Vargas Céspedes', 'Carolina Alfaro Soto', 'Paula Rodríguez Ulate', 'Fernanda Mora Calderón', 'Lucía Hernández Pérez',
  'Isabel Monge Salazar', 'Camila Zúñiga Rojas', 'Mónica Villalobos Mena', 'Laura Sibaja Chacón',
  'Ana Lucía Fallas Porras', 'Priscilla Cordero León', 'Tatiana Esquivel Umaña', 'Melissa Porras Vindas', 'Karla Aguilar Montero',
  'Rebeca Durán Sanabria', 'María José Solano Ruiz', 'Stephanie Blanco Murillo', 'Alejandra Madrigal Coto',
  'Esteban Rojas Cordero', 'Diego Mena Picado',
];

const TRATAMIENTOS = [
  ['Armonización Facial', 14],
  ['Bioestimuladores de Colágeno', 12],
  ['Labios de Alta Definición', 16],
  ['Rejuvenecimiento de Mirada', 18],
  ['Skinbooster & Mesoterapia', 10],
  ['Rinomodelación Sin Cirugía', 5],
  ['Valoración General', 11],
];
const tratamientoAlAzar = () => {
  const total = TRATAMIENTOS.reduce((s, [, peso]) => s + peso, 0);
  let r = azar() * total;
  for (const [nombre, peso] of TRATAMIENTOS) {
    r -= peso;
    if (r <= 0) return nombre;
  }
  return TRATAMIENTOS[0][0];
};

const PREGUNTAS = [
  '¿El tratamiento duele? Me pongo un poco nerviosa con las agujas.',
  'Tengo un evento en tres semanas, ¿me da tiempo de ver el resultado?',
  'Quisiera algo muy natural, que no se note que me hice algo.',
  '¿Cuánto dura el efecto? Es mi primera vez.',
  '¿Puedo hacer ejercicio al día siguiente?',
  'Me interesa un plan para las ojeras y la firmeza de la piel.',
  'Estoy tomando anticonceptivos, ¿hay algún problema?',
  '¿Tienen opciones de paquete si hago varias sesiones?',
  'Vi los resultados en Instagram y me encantaron.',
  '',
  '',
];

const HORAS = ['09:00', '09:30', '10:30', '11:00', '13:30', '14:00', '15:00', '15:30', '16:30', '17:00'];

// ── Pacientes ──
const doctora = base.users.find((u) => u.role === 'doctor');
const valeria = base.users.find((u) => u.id === 'pac-demo-1');
const pacientes = NOMBRES.map((name, i) => {
  const source = azar() < 0.45 ? 'recepcionista-ia' : 'landing-cita';
  const usuario = name.split(' ')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const paciente = {
    id: `pac-demo-${i + 2}`,
    name,
    email: source === 'landing-cita' ? `${usuario}.demo${i + 2}@example.com` : '',
    phone: `+506 8888 ${String(i + 2).padStart(4, '0')}`,
    role: 'member',
    source,
    // Altas repartidas en los últimos 12 meses, más recientes con más frecuencia
    dateJoined: `${fechaMas(-Math.floor(Math.pow(azar(), 1.4) * 360) - 1)}T15:00:00.000Z`,
    demo: true,
  };
  if (azar() < 0.55) paciente.promociones = { acepta: true, version: '2026-10', fecha: paciente.dateJoined };
  return paciente;
});
const todas = [{ ...valeria, source: 'landing-cita', promociones: { acepta: true, version: '2026-10', fecha: valeria.dateJoined } }, ...pacientes];

// ── Citas ──
let n = 0;
const citas = [];
const nuevaCita = (paciente, fecha, { estado, hora, tratamiento, mensaje, origen } = {}) => {
  n += 1;
  // La Recepcionista IA registra citas ya confirmadas; las solicitudes por confirmar llegan por la web
  const via = estado === 'pendiente' ? 'landing-cita' : origen || paciente.source;
  const creada = new Date(Math.min(Date.parse(`${fecha}T12:00:00Z`) - entre(2, 15) * DIA, Date.now() - DIA)).toISOString();
  const cita = {
    id: `apt_demo_${String(n).padStart(3, '0')}`,
    nombre: paciente.name,
    telefono: paciente.phone,
    email: paciente.email,
    tratamiento: tratamiento || tratamientoAlAzar(),
    fecha,
    mensaje: mensaje ?? elegir(PREGUNTAS),
    estado,
    createdAt: creada,
    userId: paciente.id,
  };
  if (hora) cita.hora = hora;
  if (via === 'recepcionista-ia') cita.origen = 'recepcionista-ia';
  else cita.consentimiento = { version: '2026-10', fecha: creada };
  citas.push(cita);
  return cita;
};

// Historial: más volumen en los meses recientes (la clínica está creciendo)
for (let dias = -330; dias <= -1; dias += 1) {
  const fecha = fechaMas(dias);
  if (esDomingo(fecha)) continue;
  const probabilidad = 0.12 + (0.2 * (330 + dias)) / 330;
  if (azar() > probabilidad) continue;
  const candidatas = todas.filter((p) => p.dateJoined.slice(0, 10) <= fecha);
  if (candidatas.length === 0) continue;
  const estado = azar() < 0.86 ? 'confirmada' : 'cancelada';
  nuevaCita(elegir(candidatas), fecha, { estado, hora: estado === 'confirmada' ? elegir(HORAS) : undefined });
}

// Historial de Valeria, alineado con su mapa de belleza
nuevaCita(todas[0], '2026-06-12', { estado: 'confirmada', hora: '10:00', tratamiento: 'Valoración General', mensaje: 'Quisiera mejorar la firmeza sin cambiar mi expresión.' });
nuevaCita(todas[0], '2026-07-03', { estado: 'confirmada', hora: '15:00', tratamiento: 'Bioestimuladores de Colágeno', mensaje: '' });
nuevaCita(todas[0], '2026-08-07', { estado: 'confirmada', hora: '15:00', tratamiento: 'Bioestimuladores de Colágeno', mensaje: '' });
nuevaCita(todas[0], '2026-09-24', { estado: 'confirmada', hora: '15:00', tratamiento: 'Labios de Alta Definición', mensaje: '¿Cuánto tarda en bajar la inflamación?' });

// Hoy: consultas confirmadas; la Recepcionista IA ya dejó el resumen de 3 puntos en algunas
const RESUMENES = [
  ['Primera valoración: busca un resultado muy natural y teme a las agujas.', 'Sin tratamientos previos ni alergias reportadas.', 'Sugerencia: explicar anestesia tópica y mostrar casos similares.'],
  ['Control de su segunda sesión de bioestimulador; refiere buena evolución.', 'Check-ins sin molestias en los últimos 7 días.', 'Tiene un evento en 3 semanas: confirmar si conviene adelantar la siguiente sesión.'],
  ['Consulta por ojeras y líneas finas en la mirada.', 'Pregunta por paquetes de varias sesiones.', 'Dejar claro el tiempo de efecto (3-4 meses) y cuidados post.'],
];
[['09:30', 0], ['11:00', 1], ['14:00', 2], ['16:30', -1]].forEach(([hora, r], i) => {
  const cita = nuevaCita(pacientes[i + 3], hoy, { estado: 'confirmada', hora, origen: i % 2 ? 'recepcionista-ia' : 'landing-cita' });
  if (r >= 0) cita.resumen = { puntos: RESUMENES[r], fecha: `${hoy}T13:00:00.000Z` };
});

// Próximas semanas: solicitudes nuevas por confirmar (con preguntas) y citas ya agendadas
for (let dias = 1; dias <= 24; dias += 1) {
  const fecha = fechaMas(dias);
  if (esDomingo(fecha) || azar() > 0.55) continue;
  const confirmada = azar() < 0.5;
  nuevaCita(elegir(pacientes), fecha, {
    estado: confirmada ? 'confirmada' : 'pendiente',
    hora: confirmada ? elegir(HORAS) : undefined,
    mensaje: confirmada ? '' : elegir(PREGUNTAS.filter(Boolean)),
  });
}
nuevaCita(todas[0], '2026-10-08', { estado: 'confirmada', hora: '15:30', tratamiento: 'Labios de Alta Definición', mensaje: 'Control de labios' });
// Solicitudes recién llegadas desde la web (aparecen primero en "por confirmar")
['Tengo boda en noviembre, ¿me recomiendan empezar ya?', '¿Hacen valoración los sábados?', 'Me gustaría corregir el dorso de la nariz sin cirugía.'].forEach((mensaje, i) =>
  nuevaCita(pacientes[20 + i], fechaMas(3 + i * 2), { estado: 'pendiente', mensaje, origen: 'landing-cita', tratamiento: i === 2 ? 'Rinomodelación Sin Cirugía' : undefined })
);

// ── Check-ins del portal y alertas ──
const checkins = [];
const checkin = (userId, dias, mood, pain, note = '', extra = {}) => {
  const needsFollowUp = mood === 'preocupacion' || pain >= 7 || (mood === 'molestias' && pain >= 5);
  checkins.push({
    id: `chk_demo_${String(checkins.length + 1).padStart(3, '0')}`,
    userId, mood, pain, note, needsFollowUp,
    // Las de días anteriores ya las atendió la doctora; quedan abiertas las de hoy y ayer
    ...(needsFollowUp && dias >= -1 ? { estado: 'abierta' } : {}),
    ...(needsFollowUp && dias < -1 ? { estado: 'atendida', respuesta: 'La doctora le escribió por WhatsApp y le indicó cómo continuar.' } : {}),
    ...extra,
    createdAt: new Date(Date.parse(isoMas(dias, dias === 0 ? '07:45' : '19:00'))).toISOString(),
  });
};
const diasDesde = (fecha) => Math.round((Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${String(fecha).slice(0, 10)}T12:00:00Z`)) / DIA);

// Recuperación de Valeria tras su perfilado labial (fecha fija del plan de ejemplo)
const tratamientoValeria = base.portal[0].lastTreatment.date;
[
  [1, 'molestias', 6, 'Siento los labios hinchados y tirantes.', { estado: 'atendida', respuesta: 'Es normal los primeros días. Sigue con frío local y avísanos si aumenta.' }],
  [2, 'molestias', 5, 'Siento los labios un poco hinchados y tirantes.', { estado: 'atendida', respuesta: 'La inflamación va según lo esperado. Te revisamos en el control.' }],
  [3, 'regular', 3, 'Ya bajó un poco la inflamación.'],
  [4, 'bien', 2],
  [5, 'muy-bien', 1, '¡Me encanta cómo se ven!'],
  [7, 'muy-bien', 1],
  [10, 'muy-bien', 0, 'Ya casi no siento nada.'],
  [13, 'muy-bien', 0],
].forEach(([dia, mood, pain, note = '', extra = {}]) => {
  const hace = diasDesde(tratamientoValeria) - (dia - 1);
  if (hace >= 1) checkin('pac-demo-1', -hace, mood, pain, note, extra);
});

// Más pacientes con plan en el portal: copia del plan de ejemplo con otro tratamiento y otras fechas
const PLANES = [
  { paciente: 3, tratamiento: 'Toxina botulínica en tercio superior', opcion: 'Rejuvenecimiento de Mirada', cuidados: 'Cuidados tras tu toxina botulínica', hace: 2, inicial: 4 },
  { paciente: 5, tratamiento: 'Bioestimulador de colágeno, sesión 2', opcion: 'Bioestimuladores de Colágeno', cuidados: 'Cuidados tras tu bioestimulador', hace: 4, inicial: 6, complicada: true },
  { paciente: 7, tratamiento: 'Armonización facial de tercio medio', opcion: 'Armonización Facial', cuidados: 'Cuidados tras tu armonización', hace: 8, inicial: 7 },
  { paciente: 9, tratamiento: 'Skinbooster de hidratación profunda', opcion: 'Skinbooster & Mesoterapia', cuidados: 'Cuidados tras tu skinbooster', hace: 11, inicial: 3 },
  { paciente: 12, tratamiento: 'Perfilado labial con ácido hialurónico', opcion: 'Labios de Alta Definición', cuidados: 'Cuidados tras tu perfilado labial', hace: 13, inicial: 6 },
  { paciente: 16, tratamiento: 'Rinomodelación sin cirugía', opcion: 'Rinomodelación Sin Cirugía', cuidados: 'Cuidados tras tu rinomodelación', hace: 20, inicial: 5 },
];
const desplazar = (fecha, dias) => {
  if (!fecha) return fecha;
  const texto = String(fecha);
  const nueva = new Date(Date.parse(`${texto.slice(0, 10)}T12:00:00Z`) + dias * DIA).toISOString().slice(0, 10);
  return nueva + texto.slice(10);
};
const planesExtra = PLANES.map((p) => {
  const paciente = pacientes[p.paciente];
  if (esDomingo(fechaMas(-p.hace))) p.hace += 1; // la clínica no atiende domingos
  const fechaTratamiento = fechaMas(-p.hace);
  const delta = diasDesde(tratamientoValeria) - p.hace; // mueve todo el plan de ejemplo a la fecha nueva
  nuevaCita(paciente, fechaTratamiento, { estado: 'confirmada', hora: '15:00', tratamiento: p.opcion, mensaje: '' });
  const plan = structuredClone(base.portal[0]);
  plan.id = `portal-${paciente.id}`;
  plan.userId = paciente.id;
  delete plan.demo;
  plan.lastTreatment = { name: p.tratamiento, date: `${fechaTratamiento}T15:00:00-06:00` };
  plan.nextAppointment = { ...plan.nextAppointment, date: desplazar(plan.nextAppointment.date, delta), title: 'Control del tratamiento' };
  plan.roadmap = plan.roadmap.map((s) => {
    const paso = { ...s, date: desplazar(s.date, delta) };
    if (s.status === 'current') paso.title = p.tratamiento;
    if (s.status === 'next') paso.title = 'Control del tratamiento';
    return paso;
  });
  plan.care = { ...plan.care, title: p.cuidados, since: `${fechaTratamiento}T15:00:00-06:00` };
  const recomendados = plan.care.items.filter((i) => i.type === 'do').map((i) => i.id);
  plan.careDone = recomendados.filter(() => azar() < 0.7);
  plan.packages = plan.packages.map((pk) => ({ ...pk, used: Math.min(pk.total, entre(0, pk.total)) }));
  plan.certificates = plan.certificates.map((c) => ({ ...c, appliedOn: desplazar(c.appliedOn, delta) }));
  plan.photos = plan.photos.map((f) => ({ ...f, date: desplazar(f.date, delta), asset: null, title: p.tratamiento }));

  // Check-ins: la molestia baja con los días, con variación; una paciente tiene un repunte
  for (const dia of [1, 2, 3, 5, 7, 10, 13]) {
    if (dia > p.hace) break;
    let pain = Math.max(0, Math.round(p.inicial * Math.pow(1 - dia / 15, 1.4) + (azar() - 0.5) * 1.6));
    if (p.complicada && dia === 3) pain = Math.min(10, p.inicial + 1);
    const mood = pain >= 7 ? 'preocupacion' : pain >= 5 ? 'molestias' : pain >= 3 ? 'regular' : pain >= 1 ? 'bien' : 'muy-bien';
    const note = p.complicada && dia === 3 ? 'Me salió un moretón en la zona y no sé si es normal.' : dia === 1 ? 'Primer día, algo de sensibilidad.' : '';
    checkin(paciente.id, -(p.hace - dia + 1), mood, pain, note);
  }
  return plan;
});

// Otras pacientes sin plan en el portal
checkin(pacientes[5].id, 0, 'preocupacion', 6, 'El moretón sigue igual, ¿debo preocuparme?');
checkin(pacientes[8].id, 0, 'molestias', 7, 'Me duele al sonreír desde ayer.');
checkin(pacientes[11].id, -6, 'bien', 2, '', {});
checkin(pacientes[11].id, -3, 'muy-bien', 0, 'Todo perfecto, gracias.');
checkin(pacientes[2].id, -9, 'preocupacion', 4, 'Noto un lado un poco más lleno que el otro.', { estado: 'atendida', respuesta: 'Lo revisamos en su control del día 14: la asimetría se resolvió al bajar la inflamación.' });

const sosAlerts = [
  { id: 'sos_demo_001', userId: pacientes[14].id, reason: 'inflamacion', note: 'La inflamación del labio superior aumentó desde anoche.', status: 'abierta', createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
  { id: 'sos_demo_002', userId: pacientes[6].id, reason: 'duda', note: '¿Puedo tomar ibuprofeno después del tratamiento?', status: 'atendida', respuesta: 'Se le indicó acetaminofén y se confirmó por WhatsApp.', createdAt: new Date(Date.now() - 5 * DIA).toISOString() },
];

// ── Facturas de demostración: una por cada cita ya atendida (precios de ejemplo en colones) ──
const PRECIOS = {
  'Armonización Facial': 350000,
  'Bioestimuladores de Colágeno': 280000,
  'Rejuvenecimiento de Mirada': 160000,
  'Labios de Alta Definición': 185000,
  'Skinbooster & Mesoterapia': 95000,
  'Rinomodelación Sin Cirugía': 250000,
  'Valoración General': 35000,
};
const METODOS = [['sinpe', 55], ['efectivo', 25], ['tarjeta', 15], ['transferencia', 5]];
const metodoAlAzar = () => {
  let r = azar() * 100;
  for (const [m, peso] of METODOS) { r -= peso; if (r <= 0) return m; }
  return 'sinpe';
};
const atendidas = citas
  .filter((c) => c.estado === 'confirmada' && c.fecha < hoy && PRECIOS[c.tratamiento])
  .sort((a, b) => a.fecha.localeCompare(b.fecha));
const facturas = atendidas.map((c, i) => {
  const paciente = todas.find((t) => t.id === c.userId);
  const precio = PRECIOS[c.tratamiento];
  const items = [{ descripcion: c.tratamiento, cantidad: 1, precio }];
  if (azar() < 0.25) items.push({ descripcion: 'Control post-tratamiento', cantidad: 1, precio: 0 });
  const descuento = azar() < 0.15 ? Math.round(precio * 0.1) : 0;
  const metodoPago = metodoAlAzar();
  // Las de los últimos días pueden seguir pendientes de pago
  const estado = diasDesde(c.fecha) <= 14 && azar() < 0.5 ? 'pendiente' : 'pagada';
  const subtotal = items.reduce((t, it) => t + it.cantidad * it.precio, 0);
  const creadaEn = `${c.fecha}T${c.hora || '15:00'}:00-06:00`;
  return {
    id: `fac_demo_${String(i + 1).padStart(3, '0')}`,
    numero: `FAC-${String(i + 1).padStart(4, '0')}`,
    fecha: c.fecha,
    idPaciente: c.userId,
    cliente: { nombre: paciente?.name || c.nombre, identificacion: '', telefono: paciente?.phone || '', email: paciente?.email || '' },
    items,
    subtotal,
    descuento,
    impuesto: 0,
    impuestoMonto: 0,
    total: subtotal - descuento,
    metodoPago,
    referencia: metodoPago === 'sinpe' && estado === 'pagada' ? `${c.fecha.replace(/-/g, '')}${String(entre(10000, 99999))}` : '',
    estado,
    notas: '',
    creadaEn: new Date(creadaEn).toISOString(),
    ...(estado === 'pagada' ? { pagadaEn: new Date(creadaEn).toISOString() } : {}),
  };
});
// Una anulada, para mostrar cómo se ve (conserva su número)
if (facturas.length > 10) {
  const f = facturas[facturas.length - 10];
  Object.assign(f, { estado: 'anulada', anuladaEn: f.creadaEn, motivoAnulacion: 'Monto registrado por error; se emitió una nueva factura.', referencia: f.referencia });
  delete f.pagadaEn;
}

// ── Tratamientos de demostración (cuidados de venta libre; la doctora registra los reales desde la ficha) ──
const tratamientos = [
  [valeria, 'Compresas frías', '10 minutos, envueltas en un paño', 'Cada 2 horas el primer día', -5, -3, 'Nunca directamente sobre la piel.'],
  [valeria, 'Bálsamo labial reparador con pantenol', 'Capa fina', '3 veces al día', -5, 9, 'No uses labiales de larga duración mientras lo apliques.'],
  [valeria, 'Protector solar mineral SPF 50+', 'Capa generosa en el rostro', 'Cada 3 horas durante el día', -5, 25, 'Vuelve a aplicarlo después de sudar o lavarte la cara.'],
  [valeria, 'Sérum de ácido hialurónico', '2 a 3 gotas', 'Cada noche', 10, 70, 'Sobre la piel limpia, antes de la crema hidratante.'],
  [pacientes[5], 'Gel de árnica tópico', 'Capa fina sobre el moretón', '2 veces al día', -3, 7, 'Si el moretón crece o duele más, escríbenos.'],
].filter(([p]) => p).map(([p, medicamento, dosis, frecuencia, desde, hasta, notas], i) => ({
  id: `trat_demo_${String(i + 1).padStart(3, '0')}`,
  idPaciente: p.id,
  nombrePaciente: p.name,
  medicamento,
  dosis,
  frecuencia,
  fechaInicio: fechaMas(desde),
  fechaFin: fechaMas(hasta),
  notas,
  creadoEn: new Date(`${fechaMas(Math.min(desde, 0))}T15:00:00-06:00`).toISOString(),
}));

const db = {
  users: [doctora, ...todas],
  appointments: citas.sort((a, b) => b.fecha.localeCompare(a.fecha)),
  portal: [...base.portal, ...planesExtra],
  checkins,
  sosAlerts,
  accesos: [],
  facturas,
  tratamientos,
};

fs.writeFileSync(DB_FILE, `${JSON.stringify(db, null, 2)}\n`);
const cuenta = (estado) => citas.filter((c) => c.estado === estado).length;
console.log(`✓ ${DB_FILE}: ${todas.length} pacientes, ${citas.length} citas (${cuenta('confirmada')} confirmadas, ${cuenta('pendiente')} por confirmar, ${cuenta('cancelada')} canceladas), ${checkins.length} check-ins, ${sosAlerts.length} alertas SOS y ${facturas.length} facturas (${facturas.filter((f) => f.estado === 'pendiente').length} pendientes) y ${tratamientos.length} tratamientos.`);
console.log(`  Hoy (${hoy}): ${citas.filter((c) => c.fecha === hoy).length} consultas confirmadas.`);
console.log('  Doctora: 8888 8888 · Paciente con portal completo: 8888 0001 (Valeria Rojas)');
