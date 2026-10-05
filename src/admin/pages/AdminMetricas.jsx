import { useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { adminService } from '../../services/adminService.js';
import { useCarga } from '../useCarga.js';
import Estado from '../components/Estado.jsx';
import { analiticaOperativa, calcularMetricas, ESTADOS_SERIE } from '../metricas.js';
import { curvaPromedio } from '../../lib/analitica.js';
import { ESTADOS_CITA } from '../lib.js';
import { Cifra, Grafico, Leyenda, Progreso, TablaDatos, TooltipGrafico } from '../../components/analitica/Grafico.jsx';
import { EJE } from '../../components/analitica/ejes.js';

// En producción cada petición a n8n lee toda la hoja de Google (con cuota de lecturas por minuto):
// se piden pocas fichas y de a pocas a la vez
const MAX_FICHAS = 12;
const EN_PARALELO = 3;

const enTandas = async (items, tarea) => {
  const resultados = [];
  for (let i = 0; i < items.length; i += EN_PARALELO) {
    resultados.push(...(await Promise.allSettled(items.slice(i, i + EN_PARALELO).map(tarea))));
  }
  return resultados;
};

// Citas, pacientes y alertas; y la ficha de cada paciente con plan para la curva de recuperación promedio.
// Todo sale de rutas que ya existen en la API (no requiere cambios en n8n).
const cargarDatos = async () => {
  const [citas, pacientes, alertas] = await Promise.all([
    adminService.getCitas(),
    adminService.getPacientes(),
    adminService.getAlertas(),
  ]);
  const conPlan = pacientes.filter((p) => p.tienePlan).slice(0, MAX_FICHAS);
  const fichas = await enTandas(conPlan, (p) => adminService.getPaciente(p.id));
  const recuperaciones = fichas
    .filter((f) => f.status === 'fulfilled' && f.value.plan?.lastTreatment?.date)
    .map((f) => ({ checkins: f.value.checkins, fechaTratamiento: f.value.plan.lastTreatment.date }));
  return { citas, pacientes, alertas, recuperaciones };
};

const RANGOS = [
  { meses: 3, label: '3 meses' },
  { meses: 6, label: '6 meses' },
  { meses: 12, label: '12 meses' },
];

// Colores categóricos validados para daltonismo y contraste en claro y oscuro (analitica.css)
const COLOR_ESTADO = { confirmada: 'var(--an-serie-1)', pendiente: 'var(--an-serie-2)', cancelada: 'var(--an-serie-3)' };
const SERIES_CANAL = [
  { id: 'web', label: 'Formulario web', color: 'var(--an-serie-1)' },
  { id: 'ia', label: 'Recepcionista IA (WhatsApp)', color: 'var(--an-serie-3)' },
];

function BarrasSimples({ datos, clave, etiqueta, nombre, color = 'var(--p-olive)', vertical = false, anchoEtiqueta = 170 }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      {vertical ? (
        <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap="28%">
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey={etiqueta} tickLine={false} axisLine={false} tick={{ ...EJE, fill: 'var(--p-ink-soft)' }} width={anchoEtiqueta} />
          <Tooltip cursor={{ fill: 'var(--p-olive-soft)' }} content={<TooltipGrafico titulo={(f) => f[etiqueta]} />} />
          <Bar dataKey={clave} name={nombre} fill={color} radius={[0, 4, 4, 0]} maxBarSize={28}>
            <LabelList dataKey={clave} position="right" fill="var(--p-ink)" fontSize={12} />
          </Bar>
        </BarChart>
      ) : (
        <BarChart data={datos} margin={{ top: 16, right: 8, left: -12, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--p-line)" />
          <XAxis dataKey={etiqueta} tickLine={false} axisLine={false} tick={EJE} interval={0} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={EJE} width={40} />
          <Tooltip cursor={{ fill: 'var(--p-olive-soft)' }} content={<TooltipGrafico titulo={(f) => f[etiqueta]} />} />
          <Bar dataKey={clave} name={nombre} fill={color} radius={[4, 4, 0, 0]} maxBarSize={44} />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}

export default function AdminMetricas() {
  const { data, loading, error, reload } = useCarga(cargarDatos);
  const [meses, setMeses] = useState(6);

  const m = useMemo(() => (data ? calcularMetricas(data.citas, data.pacientes, { meses }) : null), [data, meses]);
  const op = useMemo(() => (data ? analiticaOperativa(data.citas, data.pacientes, data.alertas, { meses }) : null), [data, meses]);
  const recuperacion = useMemo(() => (data ? curvaPromedio(data.recuperaciones) : []), [data]);

  const seriesEstado = ESTADOS_SERIE.map((id) => ({ id, label: `${ESTADOS_CITA[id].label}s`, color: COLOR_ESTADO[id] }));
  const periodo = RANGOS.find((r) => r.meses === meses).label;
  const conDatosRecuperacion = recuperacion.filter((t) => t.molestia !== null);
  const primerTramo = conDatosRecuperacion[0];
  const ultimoTramo = conDatosRecuperacion.at(-1);
  const mejoraPromedio = primerTramo?.molestia
    ? Math.round(((primerTramo.molestia - ultimoTramo.molestia) / primerTramo.molestia) * 100)
    : null;

  return (
    <>
      <header className="p-page-head">
        <h1 className="p-display">Métricas de la clínica</h1>
        <p className="p-lead">Agenda, evolución de las pacientes y seguimiento de los últimos {periodo}.</p>
      </header>

      <div className="a-toolbar">
        <div className="p-seg" role="group" aria-label="Periodo de las métricas">
          {RANGOS.map((r) => (
            <button key={r.meses} type="button" aria-pressed={meses === r.meses} onClick={() => setMeses(r.meses)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <Estado loading={loading} error={error} onRetry={reload}>
        {m && op && (
          <>
            {/* ── Resumen ── */}
            <div className="an-cifras">
              <Cifra etiqueta="Solicitudes de cita" valor={m.kpis.total} detalle={`${m.kpis.porConfirmar} por confirmar hoy`} />
              <Cifra etiqueta="Confirmadas" valor={`${m.kpis.tasaConfirmacion}%`} detalle={`${m.kpis.confirmadas} de ${m.kpis.total} solicitudes`} tono="bien" />
              <Cifra etiqueta="Agendadas por la Recepcionista IA" valor={`${m.kpis.porcentajeIA}%`} detalle="Por WhatsApp, sin intervención" />
              <Cifra etiqueta="Pacientes nuevas" valor={m.kpis.pacientesNuevas} detalle="Registradas en el periodo" />
              <Cifra etiqueta="Pacientes que regresan" valor={`${op.fidelizacion.tasaRetorno}%`} detalle={`${op.fidelizacion.recurrentes} de ${op.fidelizacion.atendidas} con 2 o más citas`} />
              <Cifra etiqueta="Anticipación media" valor={`${op.anticipacionMedia} días`} detalle="Entre la solicitud y la cita" />
              <Cifra
                etiqueta="Mejora promedio de la molestia"
                valor={mejoraPromedio !== null ? `${mejoraPromedio}%` : '—'}
                detalle={primerTramo ? `${primerTramo.molestia} → ${ultimoTramo.molestia} de 10 en la recuperación` : 'Sin check-ins suficientes'}
                tono={mejoraPromedio >= 50 ? 'bien' : undefined}
              />
              <Cifra
                etiqueta="Alertas atendidas"
                valor={`${op.alertas.tasaAtencion}%`}
                detalle={`${op.alertas.abiertas} abiertas de ${op.alertas.total}`}
                tono={op.alertas.tasaAtencion < 50 ? 'alerta' : 'bien'}
              />
            </div>

            {/* ── Agenda y demanda ── */}
            <h2 className="p-title an-seccion-titulo">Agenda y demanda</h2>
            <p className="p-small">Cuándo y por qué canal llegan las citas.</p>
            <div className="an-graficos">
              <Grafico
                className="an-grafico--ancho"
                titulo="Citas por mes"
                descripcion="Solicitudes según la fecha de la cita, por estado. El último mes muestra lo ya agendado."
                vacio={m.porMes.every((f) => f.total === 0)}
                mensajeVacio="Todavía no hay citas en este periodo."
              >
                <Leyenda series={seriesEstado} />
                <div className="an-lienzo">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={m.porMes} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap="30%">
                      <CartesianGrid vertical={false} stroke="var(--p-line)" />
                      <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tick={EJE} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={EJE} width={40} />
                      <Tooltip
                        cursor={{ fill: 'var(--p-olive-soft)' }}
                        content={<TooltipGrafico titulo={(f) => `${f.completa} · ${f.total} en total`} />}
                      />
                      {seriesEstado.map((s, i) => (
                        <Bar
                          key={s.id}
                          dataKey={s.id}
                          name={s.label}
                          stackId="estado"
                          fill={s.color}
                          stroke="var(--p-surface)"
                          strokeWidth={2}
                          radius={i === seriesEstado.length - 1 ? [4, 4, 0, 0] : 0}
                          maxBarSize={48}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <TablaDatos
                  resumen="Citas por mes y estado"
                  columnas={[{ id: 'completa', label: 'Mes' }, ...seriesEstado, { id: 'total', label: 'Total' }]}
                  filas={m.porMes}
                />
              </Grafico>

              <Grafico
                titulo="Canal de reserva"
                descripcion="Citas por mes según entraron: formulario web o Recepcionista IA por WhatsApp."
                vacio={m.kpis.total === 0}
                mensajeVacio="Sin citas en este periodo."
              >
                <Leyenda series={SERIES_CANAL} />
                <div className="an-lienzo">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={op.canalPorMes} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap="30%">
                      <CartesianGrid vertical={false} stroke="var(--p-line)" />
                      <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tick={EJE} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={EJE} width={40} />
                      <Tooltip cursor={{ fill: 'var(--p-olive-soft)' }} content={<TooltipGrafico titulo={(f) => f.completa} />} />
                      {SERIES_CANAL.map((s, i) => (
                        <Bar
                          key={s.id}
                          dataKey={s.id}
                          name={s.label}
                          stackId="canal"
                          fill={s.color}
                          stroke="var(--p-surface)"
                          strokeWidth={2}
                          radius={i === SERIES_CANAL.length - 1 ? [4, 4, 0, 0] : 0}
                          maxBarSize={40}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <TablaDatos
                  resumen="Citas por mes y canal"
                  columnas={[{ id: 'completa', label: 'Mes' }, ...SERIES_CANAL]}
                  filas={op.canalPorMes}
                />
              </Grafico>

              <Grafico
                titulo="Tratamientos más solicitados"
                descripcion="Solicitudes activas (sin canceladas) por tratamiento."
                vacio={m.tratamientos.length === 0}
                mensajeVacio="Sin solicitudes de tratamientos en este periodo."
              >
                <div className="an-lienzo" style={{ height: `${Math.max(12, m.tratamientos.length * 3.1)}rem` }}>
                  <BarrasSimples datos={m.tratamientos} clave="total" etiqueta="nombre" nombre="Solicitudes" vertical />
                </div>
                <TablaDatos
                  resumen="Solicitudes por tratamiento"
                  columnas={[{ id: 'nombre', label: 'Tratamiento' }, { id: 'total', label: 'Solicitudes' }]}
                  filas={m.tratamientos}
                />
              </Grafico>

              <Grafico
                titulo="Demanda por día de la semana"
                descripcion="Citas activas según el día en que se atienden."
                vacio={m.kpis.total === 0}
                mensajeVacio="Sin citas en este periodo."
              >
                <p className="an-lectura">El día con más demanda es el <strong>{op.diaMasSolicitado.nombre}</strong>.</p>
                <div className="an-lienzo an-lienzo--bajo">
                  <BarrasSimples datos={op.porDiaSemana} clave="total" etiqueta="dia" nombre="Citas" />
                </div>
                <TablaDatos resumen="Citas por día de la semana" columnas={[{ id: 'dia', label: 'Día' }, { id: 'total', label: 'Citas' }]} filas={op.porDiaSemana} />
              </Grafico>

              <Grafico
                titulo="Anticipación con que reservan"
                descripcion="Días entre la solicitud y la fecha de la cita."
                vacio={m.kpis.total === 0}
                mensajeVacio="Sin citas en este periodo."
              >
                <div className="an-lienzo an-lienzo--bajo">
                  <BarrasSimples datos={op.anticipacion} clave="total" etiqueta="tramo" nombre="Citas" color="var(--p-rose-ink)" />
                </div>
                <div className="an-progresos">
                  {op.franjas.map((f) => (
                    <Progreso
                      key={f.franja}
                      etiqueta={f.franja}
                      valor={f.total}
                      max={op.franjas.reduce((s, x) => s + x.total, 0) || 1}
                      texto={`${f.total} citas`}
                    />
                  ))}
                </div>
                <TablaDatos resumen="Citas por anticipación de reserva" columnas={[{ id: 'tramo', label: 'Anticipación' }, { id: 'total', label: 'Citas' }]} filas={op.anticipacion} />
              </Grafico>
            </div>

            {/* ── Evolución clínica ── */}
            <h2 className="p-title an-seccion-titulo">Evolución de las pacientes</h2>
            <p className="p-small">Cómo mejoran después de cada tratamiento, según sus check-ins en el portal.</p>
            <div className="an-graficos">
              <Grafico
                className="an-grafico--ancho"
                titulo="Curva de recuperación promedio"
                descripcion={`Molestia promedio (0 a 10) por tramo de días desde el tratamiento. ${data.recuperaciones.length} pacientes con plan activo. Más bajo es mejor.`}
                vacio={conDatosRecuperacion.length === 0}
                mensajeVacio="Todavía no hay check-ins de pacientes con tratamiento registrado."
              >
                {mejoraPromedio !== null && (
                  <p className="an-lectura">
                    La molestia baja en promedio de <strong>{primerTramo.molestia}</strong> a <strong>{ultimoTramo.molestia}</strong> de 10
                    (<strong>{mejoraPromedio}% menos</strong>) entre el {primerTramo.etiqueta.toLowerCase()} y los {ultimoTramo.etiqueta.toLowerCase()}.
                  </p>
                )}
                <div className="an-lienzo">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={recuperacion} margin={{ top: 8, right: 24, left: -12, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--p-line)" />
                      <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tick={EJE} />
                      <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tickLine={false} axisLine={false} tick={EJE} width={40} />
                      <Tooltip
                        cursor={{ stroke: 'var(--p-line-strong)', strokeWidth: 1 }}
                        content={<TooltipGrafico titulo={(f) => `${f.etiqueta} · ${f.registros} registros`} unidad="/10" />}
                      />
                      <Line
                        type="monotone"
                        dataKey="molestia"
                        name="Molestia promedio"
                        stroke="var(--p-rose-ink)"
                        strokeWidth={2}
                        connectNulls
                        dot={{ r: 4, fill: 'var(--p-rose-ink)', stroke: 'var(--p-surface)', strokeWidth: 2 }}
                        activeDot={{ r: 6, stroke: 'var(--p-surface)', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <TablaDatos
                  resumen="Molestia y bienestar promedio por tramo de recuperación"
                  columnas={[
                    { id: 'etiqueta', label: 'Tramo' },
                    { id: 'molestia', label: 'Molestia (0-10)' },
                    { id: 'bienestar', label: 'Bienestar (1-5)' },
                    { id: 'registros', label: 'Registros' },
                  ]}
                  filas={recuperacion}
                />
              </Grafico>

              <Grafico
                titulo="Motivos de las alertas"
                descripcion="SOS del portal y check-ins marcados para seguimiento."
                vacio={op.alertas.total === 0}
                mensajeVacio="No hay alertas registradas."
              >
                <div className="an-lienzo an-lienzo--bajo">
                  <BarrasSimples datos={op.alertas.porMotivo} clave="total" etiqueta="motivo" nombre="Alertas" color="var(--p-alert)" vertical anchoEtiqueta={160} />
                </div>
                <Progreso etiqueta="Alertas atendidas" valor={op.alertas.atendidas} max={op.alertas.total || 1} texto={`${op.alertas.atendidas} de ${op.alertas.total}`} />
                <TablaDatos resumen="Alertas por motivo" columnas={[{ id: 'motivo', label: 'Motivo' }, { id: 'total', label: 'Alertas' }]} filas={op.alertas.porMotivo} />
              </Grafico>

              <Grafico
                titulo="Pacientes nuevas por mes"
                descripcion="Personas registradas por primera vez (web o WhatsApp)."
                vacio={m.kpis.pacientesNuevas === 0}
                mensajeVacio="No se registraron pacientes nuevas en este periodo."
              >
                <div className="an-lienzo an-lienzo--bajo">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={m.pacientesPorMes} margin={{ top: 8, right: 24, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="an-relleno-pacientes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--p-olive)" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="var(--p-olive)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="var(--p-line)" />
                      <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tick={EJE} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={EJE} width={40} />
                      <Tooltip cursor={{ stroke: 'var(--p-line-strong)', strokeWidth: 1 }} content={<TooltipGrafico titulo={(f) => f.completa} />} />
                      <Area
                        type="monotone"
                        dataKey="nuevas"
                        name="Pacientes nuevas"
                        stroke="var(--p-olive)"
                        strokeWidth={2}
                        fill="url(#an-relleno-pacientes)"
                        dot={{ r: 4, fill: 'var(--p-olive)', stroke: 'var(--p-surface)', strokeWidth: 2 }}
                        activeDot={{ r: 6, stroke: 'var(--p-surface)', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="an-progresos">
                  <Progreso etiqueta="Pacientes con plan en el portal" valor={op.pacientes.conPlan} max={op.pacientes.total || 1} texto={`${op.pacientes.conPlan} de ${op.pacientes.total}`} />
                  <Progreso etiqueta="Aceptan promociones por WhatsApp" valor={op.pacientes.conPromociones} max={op.pacientes.total || 1} texto={`${op.pacientes.porcentajePromociones}%`} />
                </div>
                <TablaDatos
                  resumen="Pacientes nuevas por mes"
                  columnas={[{ id: 'completa', label: 'Mes' }, { id: 'nuevas', label: 'Pacientes nuevas' }]}
                  filas={m.pacientesPorMes}
                />
              </Grafico>
            </div>
          </>
        )}
      </Estado>
    </>
  );
}
