import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { usePortal } from '../usePortal.js';
import EmotionalCheckin from '../components/EmotionalCheckin.jsx';
import CareList from '../components/CareList.jsx';
import BeautyMap from '../components/BeautyMap.jsx';
import Sensitive from '../components/Sensitive.jsx';
import SessionMeter from '../components/SessionMeter.jsx';
import { withWindows } from '../lib/care.js';
import { firstName, formatDateTime, greeting, ordinalDay, relativeDays } from '../lib/format.js';

const lowerFirst = (text = '') => text.charAt(0).toLowerCase() + text.slice(1);

export default function PortalHome() {
  const { user, portal, recoveryDay, inRecovery, addCheckin } = usePortal();
  const name = firstName(user?.name);

  if (!portal) {
    return (
      <>
        <h1 className="p-display">{greeting()}, {name}</h1>
        <div className="p-empty" style={{ marginTop: '2rem' }}>
          <p className="p-subtitle">Tu mapa de belleza aparecerá después de tu primera valoración.</p>
          <p className="p-small" style={{ marginTop: '0.5rem' }}>
            Ahí la Dra. Laura diseña contigo tu plan, tus cuidados y tus próximos pasos.
          </p>
          <a className="p-btn" href="/#agendar" style={{ marginTop: '1.25rem' }}>Agendar mi valoración</a>
        </div>
      </>
    );
  }

  const activeDonts = withWindows(portal.care).filter((i) => i.type === 'dont' && !i.expired);
  const mapPreview = portal.roadmap.filter((i) => i.status === 'current' || i.status === 'next');
  const mainPackage = portal.packages?.find((p) => p.used < p.total);

  return (
    <>
      <header className="p-page-head">
        <h1 className="p-display">{greeting()}, {name}</h1>
        {inRecovery ? (
          <p className="p-hello__day">
            Hoy es tu <strong>{ordinalDay(recoveryDay)} día</strong> de recuperación tras tu{' '}
            <Sensitive>{lowerFirst(portal.lastTreatment.name)}</Sensitive>.
          </p>
        ) : (
          <p className="p-hello__day">Tu piel sigue su plan. Aquí tienes lo que viene.</p>
        )}
      </header>

      <EmotionalCheckin onSaved={addCheckin} />

      {activeDonts.length > 0 && (
        <section className="p-section" aria-labelledby="today-avoid">
          <div className="p-section__head">
            <h2 className="p-title" id="today-avoid">Hoy evita</h2>
            <Link to="/portal/cuidados" className="p-link">Todos tus cuidados</Link>
          </div>
          <CareList items={activeDonts.slice(0, 3)} doneIds={[]} />
        </section>
      )}

      <section className="p-section p-next" aria-label="Lo próximo">
        {portal.nextAppointment && (
          <div className="p-panel">
            <span className="p-chip"><CalendarDays size={14} /> Próxima cita, {relativeDays(portal.nextAppointment.date)}</span>
            <p className="p-next__date">{formatDateTime(portal.nextAppointment.date)}</p>
            <Sensitive as="p" className="p-small">
              {portal.nextAppointment.title}, {portal.nextAppointment.place}
            </Sensitive>
          </div>
        )}
        {mainPackage && (
          <div className="p-panel p-panel--warm">
            <Sensitive as="p" className="p-subtitle">{mainPackage.name}</Sensitive>
            <SessionMeter total={mainPackage.total} used={mainPackage.used} />
            <Link to="/portal/clinica" className="p-link">Ver mis paquetes</Link>
          </div>
        )}
      </section>

      {mapPreview.length > 0 && (
        <section className="p-section" aria-labelledby="map-preview">
          <div className="p-section__head">
            <h2 className="p-title" id="map-preview">Tu mapa de belleza</h2>
            <Link to="/portal/mapa" className="p-link">Ver mapa completo</Link>
          </div>
          <BeautyMap items={mapPreview} />
        </section>
      )}
    </>
  );
}
