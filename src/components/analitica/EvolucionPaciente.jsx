import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Cifra, Grafico, Progreso, TablaDatos, TooltipGrafico } from './Grafico.jsx';
import { EJE } from './ejes.js';
import {
  adherenciaCuidados, curvaRecuperacion, distribucionAnimo, progresoPlan, resumenRecuperacion, usoPaquetes,
} from '../../lib/analitica.js';
import { MOODS } from '../../portal/config.js';

const ETIQUETA_ANIMO = Object.fromEntries(MOODS.map((m) => [m.id, m.label]));

const TENDENCIA = {
  mejora: { texto: 'va mejorando', tono: 'bien' },
  estable: { texto: 'se mantiene estable', tono: undefined },
  empeora: { texto: 'aumentó: conviene revisarla', tono: 'alerta' },
};

/**
 * Evolución del tratamiento de una paciente: cifras, curva de molestia, ánimo y avance del plan.
 * @param {{ plan: object | null, checkins: object[], vista: 'paciente' | 'doctora' }} props
 *   vista cambia el tono de los textos (tú / la paciente)
 */
export default function EvolucionPaciente({ plan, checkins = [], vista = 'paciente' }) {
  const fechaTratamiento = plan?.lastTreatment?.date;
  const curva = curvaRecuperacion(checkins, fechaTratamiento);
  const resumen = resumenRecuperacion(checkins, fechaTratamiento);
  const cuidados = adherenciaCuidados(plan?.care, plan?.careDone);
  const avance = progresoPlan(plan?.roadmap);
  const paquetes = usoPaquetes(plan?.packages);
  const animo = distribucionAnimo(checkins).map((a) => ({ ...a, etiqueta: ETIQUETA_ANIMO[a.id] }));
  const tu = vista === 'paciente';
  const nivel = 'h3';

  return (
    <div className="an-evolucion">
      <div className="an-cifras">
        <Cifra
          etiqueta="Molestia en la zona"
          valor={resumen ? `${resumen.molestiaInicial} → ${resumen.molestiaActual}` : '—'}
          detalle={resumen ? `De 10. ${tu ? 'Tu molestia' : 'La molestia'} ${TENDENCIA[resumen.tendencia].texto}.` : 'Sin check-ins desde el tratamiento.'}
          tono={resumen ? TENDENCIA[resumen.tendencia].tono : undefined}
        />
        <Cifra
          etiqueta="Mejora de la molestia"
          valor={resumen ? `${resumen.mejora}%` : '—'}
          detalle={resumen ? `Desde el día ${curva[0].dia} hasta el día ${curva.at(-1).dia}` : undefined}
          tono={resumen?.mejora >= 50 ? 'bien' : undefined}
        />
        <Cifra
          etiqueta="Bienestar promedio"
          valor={resumen ? `${resumen.bienestarPromedio}/5` : '—'}
          detalle={resumen ? `${resumen.diasRegistrados} ${resumen.diasRegistrados === 1 ? 'día registrado' : 'días registrados'}` : undefined}
        />
        <Cifra
          etiqueta="Cuidados cumplidos"
          valor={cuidados ? `${cuidados.porcentaje}%` : '—'}
          detalle={cuidados ? `${cuidados.hechos} de ${cuidados.total} recomendaciones` : 'Sin protocolo de cuidados'}
          tono={cuidados?.porcentaje >= 75 ? 'bien' : undefined}
        />
      </div>

      <div className="an-graficos">
        <Grafico
          nivel={nivel}
          className="an-grafico--ancho"
          titulo="Curva de recuperación"
          descripcion={`Molestia en la zona (0 a 10) por día desde ${!tu && plan?.lastTreatment?.name ? `«${plan.lastTreatment.name}»` : 'el último tratamiento'}. Más bajo es mejor.`}
          vacio={curva.length === 0}
          mensajeVacio={tu
            ? 'Responde “¿Cómo te sientes hoy?” en Inicio y aquí verás cómo mejora tu recuperación día a día.'
            : 'La paciente todavía no registra check-ins desde su último tratamiento.'}
        >
          {resumen && (
            <p className="an-lectura">
              {tu ? 'Tu molestia' : 'La molestia'} pasó de <strong>{resumen.molestiaInicial}</strong> a <strong>{resumen.molestiaActual}</strong> de 10
              {resumen.mejora > 0 && <> (<strong>{resumen.mejora}% menos</strong>)</>}.
            </p>
          )}
          <div className="an-lienzo">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curva} margin={{ top: 8, right: 24, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--p-line)" />
                <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={EJE} tickFormatter={(d) => `Día ${d}`} />
                <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tickLine={false} axisLine={false} tick={EJE} width={40} />
                <ReferenceLine y={7} stroke="var(--p-alert)" strokeDasharray="4 4" label={{ value: 'Avisar a la clínica', position: 'insideTopRight', fill: 'var(--p-alert)', fontSize: 11 }} />
                <Tooltip
                  cursor={{ stroke: 'var(--p-line-strong)', strokeWidth: 1 }}
                  content={<TooltipGrafico titulo={(f) => `Día ${f.dia} de recuperación`} unidad="/10" />}
                />
                <Line
                  type="monotone"
                  dataKey="molestia"
                  name="Molestia"
                  stroke="var(--p-rose-ink)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'var(--p-rose-ink)', stroke: 'var(--p-surface)', strokeWidth: 2 }}
                  activeDot={{ r: 6, stroke: 'var(--p-surface)', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <TablaDatos
            resumen="Molestia y bienestar por día de recuperación"
            columnas={[{ id: 'dia', label: 'Día' }, { id: 'molestia', label: 'Molestia (0-10)' }, { id: 'bienestar', label: 'Bienestar (1-5)' }]}
            filas={curva}
          />
        </Grafico>

        <Grafico
          nivel={nivel}
          titulo="Cómo se ha sentido"
          descripcion={tu ? 'Cuántas veces registraste cada estado de ánimo.' : 'Estados de ánimo registrados en sus check-ins.'}
          vacio={checkins.length === 0}
          mensajeVacio="Sin registros todavía."
        >
          <div className="an-lienzo an-lienzo--bajo">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={animo} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="var(--p-line)" />
                <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tick={EJE} interval={0} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={EJE} width={40} />
                <Tooltip cursor={{ fill: 'var(--p-olive-soft)' }} content={<TooltipGrafico titulo={(f) => f.etiqueta} />} />
                <Bar dataKey="total" name="Registros" fill="var(--p-olive)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <TablaDatos
            resumen="Registros por estado de ánimo"
            columnas={[{ id: 'etiqueta', label: 'Ánimo' }, { id: 'total', label: 'Registros' }]}
            filas={animo}
          />
        </Grafico>

        <section className="p-panel an-grafico" aria-label={tu ? 'Avance de tu plan' : 'Avance del plan'}>
          <h3 className="p-title">{tu ? 'Tu plan en cifras' : 'Avance del plan'}</h3>
          <div className="an-progresos">
            {avance && (
              <Progreso
                etiqueta="Mapa de belleza"
                valor={avance.porcentaje}
                texto={`${avance.completados} de ${avance.total} pasos`}
              />
            )}
            {cuidados && (
              <Progreso etiqueta="Cuidados de esta recuperación" valor={cuidados.hechos} max={cuidados.total} texto={`${cuidados.hechos} de ${cuidados.total}`} />
            )}
            {paquetes && (
              <Progreso etiqueta="Sesiones de paquetes usadas" valor={paquetes.usadas} max={paquetes.total} texto={`${paquetes.usadas} de ${paquetes.total}`} />
            )}
            {!avance && !cuidados && !paquetes && <p className="p-small">Todavía no hay un plan.</p>}
          </div>
          {avance?.siguiente && (
            <p className="an-lectura">
              Próximo paso: <strong>{avance.siguiente.title}</strong>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
