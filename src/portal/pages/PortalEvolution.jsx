import { Camera } from 'lucide-react';
import { usePortal } from '../usePortal.js';
import Sensitive from '../components/Sensitive.jsx';
import { MOODS, PHOTO_ASSETS } from '../config.js';
import { formatDate, relativeDays } from '../lib/format.js';
import EvolucionPaciente from '../../components/analitica/EvolucionPaciente.jsx';

const moodById = Object.fromEntries(MOODS.map((m) => [m.id, m]));

export default function PortalEvolution() {
  const { portal, checkins } = usePortal();
  const photos = portal?.photos || [];

  return (
    <>
      <header className="p-page-head">
        <h1 className="p-display">Tu evolución</h1>
        <p className="p-lead">
          Cómo avanza tu recuperación, tus fotos de control y cómo te has sentido. Las fotos son privadas: solo tú y la doctora pueden verlas.
        </p>
      </header>

      <section aria-labelledby="cifras-title">
        <h2 className="p-title" id="cifras-title" style={{ marginBottom: '1rem' }}>Tu recuperación en cifras</h2>
        <EvolucionPaciente plan={portal} checkins={checkins} vista="paciente" />
      </section>

      <section className="p-section" aria-labelledby="photos-title">
        <h2 className="p-title" id="photos-title" style={{ marginBottom: '1rem' }}>Progreso fotográfico</h2>
        {photos.length === 0 ? (
          <p className="p-empty">Tomamos tus primeras fotos en tu valoración. Aparecerán aquí.</p>
        ) : (
          <div className="p-photos">
            {photos.map((photo) => (
              <figure key={photo.id} className="p-photo">
                <div className="p-photo__frame">
                  {photo.asset && PHOTO_ASSETS[photo.asset] ? (
                    <Sensitive
                      as="img"
                      media
                      src={PHOTO_ASSETS[photo.asset]}
                      alt={`${photo.title}, ${photo.stage}`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="p-photo__pending">
                      <Camera size={22} aria-hidden="true" />
                      <span>Foto de control {relativeDays(photo.date)}</span>
                    </div>
                  )}
                </div>
                <figcaption>
                  <Sensitive as="p" className="p-subtitle">{photo.title}</Sensitive>
                  <p className="p-small">{photo.stage}, {formatDate(photo.date)}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      <section className="p-section" aria-labelledby="diary-title">
        <h2 className="p-title" id="diary-title" style={{ marginBottom: '0.5rem' }}>Diario de cómo te sientes</h2>
        {checkins.length === 0 ? (
          <p className="p-empty">Cuando respondas “¿Cómo te sientes hoy?” en Inicio, tus registros aparecerán aquí.</p>
        ) : (
          <ul className="p-diary">
            {checkins.map((c) => {
              const mood = moodById[c.mood];
              const Icon = mood?.Icon;
              return (
                <li key={c.id}>
                  {Icon && <Icon size={22} strokeWidth={1.5} aria-hidden="true" />}
                  <div>
                    <p className="p-subtitle">{mood?.label}</p>
                    <p className="p-small">Molestia en la zona: {c.pain} de 10</p>
                    {c.note && <Sensitive as="p" className="p-small">{c.note}</Sensitive>}
                  </div>
                  <span className="p-small" style={{ textAlign: 'right' }}>
                    {formatDate(c.createdAt, { day: 'numeric', month: 'short' })}
                    {c.needsFollowUp && <><br /><span className="p-chip p-chip--rose">Seguimiento</span></>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
