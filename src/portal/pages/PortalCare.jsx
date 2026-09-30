import { usePortal } from '../usePortal.js';
import CareList from '../components/CareList.jsx';
import Sensitive from '../components/Sensitive.jsx';
import { withWindows } from '../lib/care.js';
import ClimaPiel from '../../components/clima/ClimaPiel.jsx';

// Activos primero; lo que ya venció baja al final de la lista
const byExpiry = (a, b) => Number(a.expired) - Number(b.expired);

export default function PortalCare() {
  const { portal, toggleCare } = usePortal();

  if (!portal?.care) {
    return (
      <>
        <h1 className="p-display">Tus cuidados</h1>
        <p className="p-empty" style={{ marginTop: '2rem' }}>
          Después de cada tratamiento aquí verás qué hacer y qué evitar, hora por hora.
        </p>
        <section className="p-section">
          <ClimaPiel titulo="El clima de hoy y tu piel" nivelTitulo="h2" />
        </section>
      </>
    );
  }

  const items = withWindows(portal.care);
  const donts = items.filter((i) => i.type === 'dont').sort(byExpiry);
  const dos = items.filter((i) => i.type === 'do').sort(byExpiry);
  const doneIds = portal.careDone || [];

  return (
    <>
      <header className="p-page-head">
        <h1 className="p-display">Tus cuidados</h1>
        <Sensitive as="p" className="p-lead">{portal.care.title}</Sensitive>
      </header>

      <section className="p-panel" aria-labelledby="care-dont">
        <h2 className="p-title" id="care-dont">Lo que no debes hacer</h2>
        <p className="p-small" style={{ marginBottom: '0.5rem' }}>Cada indicación desaparece sola cuando ya no aplica.</p>
        <CareList items={donts} doneIds={[]} />
      </section>

      <section className="p-section p-panel" aria-labelledby="care-do">
        <h2 className="p-title" id="care-do">Lo que te ayuda a sanar</h2>
        <p className="p-small" style={{ marginBottom: '0.5rem' }}>
          Márcalo cuando lo hagas: {doneIds.filter((id) => dos.some((d) => d.id === id)).length} de {dos.length} marcados.
        </p>
        <CareList items={dos} doneIds={doneIds} onToggle={toggleCare} />
      </section>

      <section className="p-section">
        <ClimaPiel titulo="El clima de hoy y tu piel" nivelTitulo="h2" />
      </section>
    </>
  );
}
