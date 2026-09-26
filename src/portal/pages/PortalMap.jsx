import { usePortal } from '../usePortal.js';
import BeautyMap from '../components/BeautyMap.jsx';
import { formatDate } from '../lib/format.js';

export default function PortalMap() {
  const { portal } = usePortal();
  const roadmap = portal?.roadmap || [];

  if (roadmap.length === 0) {
    return (
      <>
        <h1 className="p-display">Tu mapa de belleza</h1>
        <p className="p-empty" style={{ marginTop: '2rem' }}>
          La Dra. Laura diseña tu mapa en tu primera valoración. Aparecerá aquí en cuanto esté listo.
        </p>
      </>
    );
  }

  const done = roadmap.filter((i) => i.status === 'done' || i.status === 'current').length;
  const first = roadmap[0].date;
  const last = roadmap[roadmap.length - 1].date;

  return (
    <>
      <header className="p-page-head">
        <h1 className="p-display">Tu mapa de belleza</h1>
        <p className="p-lead">
          El plan que la Dra. Laura diseñó contigo, de {formatDate(first, { month: 'long', year: 'numeric' })} a{' '}
          {formatDate(last, { month: 'long', year: 'numeric' })}. Llevas {done} de {roadmap.length} pasos.
        </p>
        <div className="bmap-legend" aria-hidden="true">
          <span><i style={{ background: 'var(--p-olive)' }} />Realizado</span>
          <span><i style={{ background: 'var(--p-rose)' }} />Estás aquí</span>
          <span><i style={{ border: '2px solid var(--p-muted)' }} />Planificado</span>
          <span><i style={{ border: '2px dashed var(--p-muted)' }} />Sugerencia</span>
        </div>
      </header>

      <BeautyMap items={roadmap} />

      <p className="p-small" style={{ marginTop: '0.5rem', maxWidth: '34rem' }}>
        Las fechas futuras son las ideales para tu piel. Las confirmamos contigo por WhatsApp antes de cada cita.
      </p>
    </>
  );
}
