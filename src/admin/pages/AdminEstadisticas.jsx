import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { adminService } from '../../services/adminService.js';
import { useCarga } from '../useCarga.js';
import Estado from '../components/Estado.jsx';
import { Cifra, Grafico, TablaDatos, TooltipGrafico } from '../../components/analitica/Grafico.jsx';
import { EJE } from '../../components/analitica/ejes.js';

const COLORES_PIE = ['var(--an-serie-1)', 'var(--an-serie-3)', 'var(--an-serie-2)'];

const formatColones = (n) => {
  if (n >= 1_000_000) return `₡${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₡${Math.round(n / 1_000)}k`;
  return `₡${n}`;
};

export default function AdminEstadisticas() {
  const { data, loading, error, reload } = useCarga(adminService.getEstadisticas);

  const r = data?.resumen;
  const totalCitas = r ? r.completadas + r.canceladas + r.pendientes : 0;
  const tasaCompletadas = totalCitas ? Math.round((r.completadas / totalCitas) * 100) : 0;

  return (
    <>
      <header className="p-page-head">
        <h1 className="p-display">Estadísticas avanzadas</h1>
        <p className="p-lead">Resumen financiero, operativo y de demanda de la clínica.</p>
      </header>

      <Estado loading={loading} error={error} onRetry={reload}>
        {r && (
          <>
            {/* ── KPIs ── */}
            <div className="an-cifras">
              <Cifra
                etiqueta="Ingresos del mes"
                valor={formatColones(r.ingresosDelMes)}
                detalle={`₡${r.ingresosDelMes.toLocaleString('es-CR')} cobrados`}
                tono="bien"
              />
              <Cifra
                etiqueta="Pendiente de cobro del mes"
                valor={formatColones(r.pendientesMes)}
                detalle={`₡${r.pendientesMes.toLocaleString('es-CR')} por cobrar de facturas de este mes`}
                tono={r.pendientesMes > 0 ? 'alerta' : undefined}
              />
              <Cifra etiqueta="Citas de hoy" valor={r.citasHoy} detalle="Confirmadas para hoy" />
              <Cifra
                etiqueta="Pacientes nuevas"
                valor={r.pacientesNuevasMes}
                detalle={`De ${r.totalPacientes} en total`}
              />
              <Cifra
                etiqueta="Tasa de completadas"
                valor={`${tasaCompletadas}%`}
                detalle={`${r.completadas} de ${totalCitas} citas del mes`}
                tono={tasaCompletadas >= 70 ? 'bien' : undefined}
              />
              <Cifra
                etiqueta="Tratamientos activos"
                valor={r.tratamientosActivos}
                detalle="Pacientes con medicación vigente"
              />
            </div>

            {/* ── Gráficos ── */}
            <h2 className="p-title an-seccion-titulo">Análisis financiero y operativo</h2>
            <p className="p-small">Ingresos, distribución de citas y tratamientos más solicitados.</p>

            <div className="an-graficos">
              {/* Ingresos por mes */}
              <Grafico
                className="an-grafico--ancho"
                titulo="Ingresos por mes"
                descripcion="Facturas pagadas por mes en los últimos 6 meses (sin anuladas)."
                vacio={data.ingresosPorMes.every((m) => m.total === 0)}
                mensajeVacio="No hay facturas pagadas en los últimos 6 meses."
              >
                <div className="an-lienzo">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.ingresosPorMes} margin={{ top: 16, right: 8, left: -8, bottom: 0 }} barCategoryGap="30%">
                      <CartesianGrid vertical={false} stroke="var(--p-line)" />
                      <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tick={EJE} interval={0} />
                      <YAxis tickLine={false} axisLine={false} tick={EJE} width={52} tickFormatter={formatColones} />
                      <Tooltip
                        cursor={{ fill: 'var(--p-olive-soft)' }}
                        content={<TooltipGrafico titulo={(f) => f.etiqueta} />}
                        formatter={(v) => [`₡${v.toLocaleString('es-CR')}`, 'Ingresos']}
                      />
                      <Bar dataKey="total" name="Ingresos" fill="var(--p-olive)" radius={[4, 4, 0, 0]} maxBarSize={48}>
                        <LabelList dataKey="total" position="top" fill="var(--p-ink-soft)" fontSize={11} formatter={formatColones} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <TablaDatos
                  resumen="Ingresos por mes"
                  columnas={[{ id: 'etiqueta', label: 'Mes' }, { id: 'total', label: 'Ingresos (₡)' }]}
                  filas={data.ingresosPorMes}
                />
              </Grafico>

              {/* Distribución de citas (Pie) */}
              <Grafico
                titulo="Distribución de citas del mes"
                descripcion="Proporción de citas completadas, canceladas y pendientes."
                vacio={totalCitas === 0}
                mensajeVacio="Sin citas este mes."
              >
                <div className="an-lienzo an-lienzo--pie">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.distribucionCitas}
                        dataKey="valor"
                        nameKey="nombre"
                        cx="50%"
                        cy="50%"
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={3}
                        label={({ nombre, valor }) => `${nombre}: ${valor}`}
                        labelLine={false}
                      >
                        {data.distribucionCitas.map((_, i) => (
                          <Cell key={i} fill={COLORES_PIE[i]} stroke="var(--p-surface)" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <TablaDatos
                  resumen="Distribución de citas"
                  columnas={[{ id: 'nombre', label: 'Estado' }, { id: 'valor', label: 'Cantidad' }]}
                  filas={data.distribucionCitas}
                />
              </Grafico>

              {/* Top tratamientos */}
              <Grafico
                titulo="Tratamientos más solicitados"
                descripcion="Top tratamientos en los últimos 6 meses (sin canceladas)."
                vacio={data.topTratamientos.length === 0}
                mensajeVacio="No hay tratamientos registrados."
              >
                <div className="an-lienzo" style={{ height: `${Math.max(12, data.topTratamientos.length * 3.1)}rem` }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.topTratamientos} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap="28%">
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis type="category" dataKey="nombre" tickLine={false} axisLine={false} tick={{ ...EJE, fill: 'var(--p-ink-soft)' }} width={170} />
                      <Tooltip cursor={{ fill: 'var(--p-olive-soft)' }} content={<TooltipGrafico titulo={(f) => f.nombre} />} />
                      <Bar dataKey="total" name="Solicitudes" fill="var(--p-rose-ink)" radius={[0, 4, 4, 0]} maxBarSize={28}>
                        <LabelList dataKey="total" position="right" fill="var(--p-ink)" fontSize={12} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <TablaDatos
                  resumen="Tratamientos más solicitados"
                  columnas={[{ id: 'nombre', label: 'Tratamiento' }, { id: 'total', label: 'Solicitudes' }]}
                  filas={data.topTratamientos}
                />
              </Grafico>
            </div>
          </>
        )}
      </Estado>
    </>
  );
}
