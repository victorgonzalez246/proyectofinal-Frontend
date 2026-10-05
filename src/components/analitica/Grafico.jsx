import { useId } from 'react';
import './analitica.css';

// Piezas comunes de los gráficos (panel de la doctora y portal de la paciente).
// Cada gráfico lleva título, descripción, leyenda cuando hay más de una serie y su tabla equivalente.

export function TooltipGrafico({ active, payload, label, titulo, unidad = '' }) {
  if (!active || !payload?.length) return null;
  const fila = payload[0].payload;
  return (
    <div className="an-tooltip">
      <p className="an-tooltip__titulo">{titulo ? titulo(fila) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="an-tooltip__fila">
          <span className="an-marca" style={{ background: p.color }} aria-hidden="true" />
          <span>{p.name}</span>
          <strong>{p.value ?? '—'}{p.value != null ? unidad : ''}</strong>
        </p>
      ))}
    </div>
  );
}

export function Leyenda({ series }) {
  return (
    <ul className="an-leyenda" aria-label="Leyenda">
      {series.map((s) => (
        <li key={s.id}>
          <span className="an-marca" style={{ background: s.color }} aria-hidden="true" />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

// Tabla equivalente al gráfico (lectores de pantalla y quien prefiera leer cifras)
export function TablaDatos({ columnas, filas, resumen }) {
  return (
    <details className="an-datos">
      <summary>Ver los datos en tabla</summary>
      <div className="an-tabla-wrap">
        <table className="an-tabla">
          <caption className="an-sr">{resumen}</caption>
          <thead>
            <tr>{columnas.map((c) => <th key={c.id} scope="col">{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                {columnas.map((c, j) =>
                  j === 0 ? <th key={c.id} scope="row">{f[c.id]}</th> : <td key={c.id}>{f[c.id] ?? '—'}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function Grafico({ titulo, descripcion, children, vacio, mensajeVacio, nivel: Titulo = 'h2', className = '' }) {
  const id = useId();
  return (
    <figure className={`p-panel an-grafico ${className}`} aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}>
      <figcaption>
        <Titulo className="p-title" id={`${id}-t`}>{titulo}</Titulo>
        <p className="p-small" id={`${id}-d`}>{descripcion}</p>
      </figcaption>
      {vacio ? <p className="p-empty">{mensajeVacio}</p> : children}
    </figure>
  );
}

// Cifra destacada: valor grande con etiqueta y contexto
export function Cifra({ etiqueta, valor, detalle, tono }) {
  return (
    <div className="p-panel an-cifra">
      <p className="p-small">{etiqueta}</p>
      <p className="an-cifra__valor" data-tono={tono}>{valor}</p>
      {detalle && <p className="p-small">{detalle}</p>}
    </div>
  );
}

// Barra de progreso accesible (avance del plan, cuidados, paquetes)
export function Progreso({ etiqueta, valor, max = 100, texto }) {
  const pct = max ? Math.round((valor / max) * 100) : 0;
  return (
    <div className="an-progreso">
      <div className="an-progreso__cabecera">
        <span>{etiqueta}</span>
        <strong>{texto ?? `${pct}%`}</strong>
      </div>
      <div
        className="an-progreso__pista"
        role="progressbar"
        aria-label={etiqueta}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={valor}
        aria-valuetext={texto ?? `${pct}%`}
      >
        <span style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}
