// Métricas del panel a partir de las citas y pacientes reales (mismos datos de /admin/citas y /admin/pacientes)

export const ESTADOS_SERIE = ['confirmada', 'pendiente', 'cancelada'];
const MAX_TRATAMIENTOS = 6;

const claveMes = (fecha) => String(fecha || '').slice(0, 7); // "2026-09-24" → "2026-09"

// Últimos `n` meses terminando en el mes de `hoy`, del más antiguo al más reciente
export function ultimosMeses(n, hoy = new Date()) {
  const meses = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const etiqueta = new Intl.DateTimeFormat('es-CR', { month: 'short' }).format(d).replace('.', '');
    const completa = new Intl.DateTimeFormat('es-CR', { month: 'long', year: 'numeric' }).format(d);
    meses.push({ clave, etiqueta, completa });
  }
  return meses;
}

export function calcularMetricas(citas = [], pacientes = [], { meses = 6, hoy = new Date() } = {}) {
  const rango = ultimosMeses(meses, hoy);
  const claves = new Set(rango.map((m) => m.clave));
  const enRango = citas.filter((c) => claves.has(claveMes(c.fecha)));

  // El gráfico suma el mes siguiente: ahí están las citas agendadas y las solicitudes por confirmar
  const proximo = ultimosMeses(1, new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1))[0];
  const porMes = [...rango, { ...proximo, etiqueta: `${proximo.etiqueta} (próx.)`, completa: `${proximo.completa} (agendadas)` }].map((m) => {
    const delMes = citas.filter((c) => claveMes(c.fecha) === m.clave);
    const fila = { ...m, total: delMes.length };
    for (const estado of ESTADOS_SERIE) fila[estado] = delMes.filter((c) => c.estado === estado).length;
    return fila;
  });

  // Tratamientos más solicitados (sin contar las canceladas); el resto se agrupa en "Otros"
  const conteo = new Map();
  for (const c of enRango) {
    if (c.estado === 'cancelada') continue;
    const nombre = (c.tratamiento || 'Sin especificar').trim();
    conteo.set(nombre, (conteo.get(nombre) || 0) + 1);
  }
  const ordenados = [...conteo].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
  const tratamientos = ordenados.slice(0, MAX_TRATAMIENTOS);
  const resto = ordenados.slice(MAX_TRATAMIENTOS).reduce((s, t) => s + t.total, 0);
  if (resto) tratamientos.push({ nombre: 'Otros', total: resto });

  const pacientesPorMes = rango.map((m) => ({
    ...m,
    nuevas: pacientes.filter((p) => claveMes(p.dateJoined) === m.clave).length,
  }));

  const total = enRango.length;
  const confirmadas = enRango.filter((c) => c.estado === 'confirmada').length;
  const pendientes = enRango.filter((c) => c.estado === 'pendiente').length;
  const canceladas = enRango.filter((c) => c.estado === 'cancelada').length;
  const porIA = enRango.filter((c) => c.origen === 'recepcionista-ia').length;
  const porcentaje = (parte) => (total ? Math.round((parte / total) * 100) : 0);

  return {
    rango,
    porMes,
    tratamientos,
    pacientesPorMes,
    kpis: {
      total,
      confirmadas,
      pendientes,
      canceladas,
      tasaConfirmacion: porcentaje(confirmadas),
      porcentajeIA: porcentaje(porIA),
      pacientesNuevas: pacientesPorMes.reduce((s, m) => s + m.nuevas, 0),
      // Estado actual, no del periodo: las solicitudes pendientes suelen ser para fechas futuras
      porConfirmar: citas.filter((c) => c.estado === 'pendiente').length,
    },
  };
}

// ── Analítica operativa: demanda, canales, fidelización y alertas ──

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_COMPLETOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIA_MS = 24 * 60 * 60 * 1000;
export const TRAMOS_ANTICIPACION = [
  { desde: 0, hasta: 3, etiqueta: '0-3 días' },
  { desde: 4, hasta: 7, etiqueta: '4-7 días' },
  { desde: 8, hasta: 14, etiqueta: '8-14 días' },
  { desde: 15, hasta: Infinity, etiqueta: '15+ días' },
];
const MOTIVOS_ALERTA = { dolor: 'Dolor fuerte', inflamacion: 'Inflamación', aspecto: 'Aspecto', duda: 'Duda urgente' };

export function analiticaOperativa(citas = [], pacientes = [], alertas = [], { meses = 6, hoy = new Date() } = {}) {
  const rango = ultimosMeses(meses, hoy);
  const claves = new Set(rango.map((m) => m.clave));
  const enRango = citas.filter((c) => claves.has(claveMes(c.fecha)));
  const activas = enRango.filter((c) => c.estado !== 'cancelada');

  // Demanda por día de la semana: lunes a sábado, y el domingo solo si hubo citas ese día
  const diaDe = (c) => new Date(`${c.fecha}T12:00:00`).getDay();
  const dias = activas.some((c) => diaDe(c) === 0) ? [1, 2, 3, 4, 5, 6, 0] : [1, 2, 3, 4, 5, 6];
  const porDiaSemana = dias.map((d) => ({
    dia: DIAS_SEMANA[d],
    nombre: DIAS_COMPLETOS[d],
    total: activas.filter((c) => diaDe(c) === d).length,
  }));

  // Franja horaria de las citas confirmadas con hora
  const conHora = enRango.filter((c) => c.estado === 'confirmada' && /^\d{2}:\d{2}/.test(c.hora || ''));
  const franjas = [
    { franja: 'Mañana (antes de 12:00)', total: conHora.filter((c) => c.hora < '12:00').length },
    { franja: 'Tarde (desde 12:00)', total: conHora.filter((c) => c.hora >= '12:00').length },
  ];

  // Anticipación con que se reserva: días entre la solicitud y la fecha de la cita
  const anticipaciones = enRango
    .filter((c) => c.createdAt)
    .map((c) => Math.max(0, Math.round((Date.parse(`${c.fecha}T12:00:00`) - Date.parse(c.createdAt)) / DIA_MS)));
  const anticipacion = TRAMOS_ANTICIPACION.map((t) => ({
    tramo: t.etiqueta,
    total: anticipaciones.filter((d) => d >= t.desde && d <= t.hasta).length,
  }));
  const anticipacionMedia = anticipaciones.length
    ? Math.round(anticipaciones.reduce((s, d) => s + d, 0) / anticipaciones.length)
    : 0;

  // Canal de reserva por mes: formulario web o Recepcionista IA por WhatsApp
  const canalPorMes = rango.map((m) => {
    const delMes = enRango.filter((c) => claveMes(c.fecha) === m.clave);
    const ia = delMes.filter((c) => c.origen === 'recepcionista-ia').length;
    return { ...m, web: delMes.length - ia, ia };
  });

  // Fidelización: pacientes que volvieron (2 o más citas confirmadas en total)
  const confirmadasPorPaciente = new Map();
  for (const c of citas) {
    if (c.estado !== 'confirmada' || !c.userId) continue;
    confirmadasPorPaciente.set(c.userId, (confirmadasPorPaciente.get(c.userId) || 0) + 1);
  }
  const atendidas = confirmadasPorPaciente.size;
  const recurrentes = [...confirmadasPorPaciente.values()].filter((n) => n >= 2).length;

  // Consentimientos y planes
  const conPlan = pacientes.filter((p) => p.tienePlan).length;
  const conPromociones = pacientes.filter((p) => p.promociones).length;
  const pct = (parte, total) => (total ? Math.round((parte / total) * 100) : 0);

  // Alertas: cuántas se atendieron y por qué llegan
  const atendidasAlertas = alertas.filter((a) => a.estado === 'atendida').length;
  const motivos = new Map();
  for (const a of alertas) {
    const motivo = a.tipo === 'sos' ? MOTIVOS_ALERTA[a.motivo] || 'Otro' : 'Check-in con molestias';
    motivos.set(motivo, (motivos.get(motivo) || 0) + 1);
  }

  return {
    porDiaSemana,
    diaMasSolicitado: porDiaSemana.reduce((max, d) => (d.total > max.total ? d : max), porDiaSemana[0]),
    franjas,
    anticipacion,
    anticipacionMedia,
    canalPorMes,
    fidelizacion: { atendidas, recurrentes, tasaRetorno: pct(recurrentes, atendidas) },
    pacientes: {
      total: pacientes.length,
      conPlan,
      porcentajePlan: pct(conPlan, pacientes.length),
      conPromociones,
      porcentajePromociones: pct(conPromociones, pacientes.length),
    },
    alertas: {
      total: alertas.length,
      abiertas: alertas.length - atendidasAlertas,
      atendidas: atendidasAlertas,
      tasaAtencion: pct(atendidasAlertas, alertas.length),
      porMotivo: [...motivos].map(([motivo, total]) => ({ motivo, total })).sort((a, b) => b.total - a.total),
    },
  };
}
