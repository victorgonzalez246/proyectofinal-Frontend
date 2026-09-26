import { useState } from 'react';
import { Play, ShieldCheck } from 'lucide-react';
import { usePortal } from '../usePortal.js';
import Sensitive from '../components/Sensitive.jsx';
import SessionMeter from '../components/SessionMeter.jsx';
import { VIDEO_POSTERS } from '../config.js';
import { formatDate } from '../lib/format.js';

function VideoCard({ video }) {
  const [playing, setPlaying] = useState(false);
  const available = Boolean(video.url);

  return (
    <article>
      <div className="p-video__thumb">
        {playing ? (
          <video src={video.url} controls autoPlay playsInline controlsList="nodownload" />
        ) : (
          <>
            <img src={VIDEO_POSTERS[video.poster]} alt="" loading="lazy" />
            <span>{video.duration}</span>
          </>
        )}
      </div>
      <p className="p-small" style={{ marginTop: '0.75rem' }}>{video.topic}</p>
      <h3 className="p-subtitle">{video.title}</h3>
      {!playing && (
        <button
          type="button"
          className="p-link"
          style={{ marginTop: '0.4rem' }}
          disabled={!available}
          onClick={() => setPlaying(true)}
        >
          {available ? <><Play size={14} /> Ver video</> : 'Disponible muy pronto'}
        </button>
      )}
    </article>
  );
}

export default function PortalClinic() {
  const { portal, user } = usePortal();
  const coupons = (user?.coupons || []).filter((c) => c.status === 'active');
  const packages = portal?.packages || [];
  const certificates = portal?.certificates || [];
  const videos = portal?.videos || [];

  return (
    <>
      <header className="p-page-head">
        <h1 className="p-display">Mi clínica</h1>
        <p className="p-lead">Tus paquetes, los productos exactos que usamos en ti y los videos de la doctora.</p>
      </header>

      <section aria-labelledby="packages-title">
        <h2 className="p-title" id="packages-title" style={{ marginBottom: '1rem' }}>Mis paquetes</h2>
        {packages.length === 0 ? (
          <p className="p-empty">Cuando adquieras un paquete verás aquí tus sesiones disponibles.</p>
        ) : (
          <div className="p-next">
            {packages.map((p) => (
              <div key={p.id} className="p-panel">
                <Sensitive as="p" className="p-subtitle">{p.name}</Sensitive>
                <SessionMeter total={p.total} used={p.used} />
                <p className="p-small">Válido hasta el {formatDate(p.validUntil)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {coupons.length > 0 && (
        <section className="p-section" aria-labelledby="coupons-title">
          <h2 className="p-title" id="coupons-title">Beneficios del club</h2>
          <p className="p-small" style={{ margin: '0.35rem 0 1rem' }}>Muestra el código en tu próxima cita.</p>
          <div className="p-next">
            {coupons.map((c) => (
              <div key={c.code} className="p-panel p-panel--warm">
                <span className="p-chip p-chip--rose">{c.discount}</span>
                <p className="p-subtitle" style={{ marginTop: '0.75rem' }}>{c.title}</p>
                <p className="p-small">{c.description}</p>
                <p className="p-coupon">{c.code}</p>
                <p className="p-small">Válido hasta el {formatDate(c.validUntil)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="p-section" aria-labelledby="certs-title">
        <h2 className="p-title" id="certs-title">Certificado de productos</h2>
        <p className="p-small" style={{ margin: '0.35rem 0 0.75rem', maxWidth: '34rem' }}>
          Marca, lote y vencimiento de cada producto aplicado. Guárdalo: es tu garantía de originalidad.
        </p>
        {certificates.length === 0 ? (
          <p className="p-empty">Tus productos aplicados aparecerán aquí después de cada tratamiento.</p>
        ) : (
          <div className="p-panel">
            {certificates.map((c) => (
              <div key={c.id} className="p-cert">
                <Sensitive as="p" className="p-subtitle">{c.product}</Sensitive>
                <span className="p-chip"><ShieldCheck size={14} /> Lote registrado</span>
                <dl>
                  <div><dt>Marca</dt><dd>{c.brand}</dd></div>
                  <div><dt>Lote</dt><dd>{c.lot}</dd></div>
                  <div><dt>Vence</dt><dd>{c.expiry}</dd></div>
                  <div><dt>Zona</dt><dd><Sensitive>{c.zone}</Sensitive></dd></div>
                  <div><dt>Cantidad</dt><dd>{c.amount}</dd></div>
                  <div><dt>Aplicado</dt><dd>{formatDate(c.appliedOn, { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="p-section" aria-labelledby="videos-title">
        <h2 className="p-title" id="videos-title">Clínica privada</h2>
        <p className="p-small" style={{ margin: '0.35rem 0 1.25rem' }}>Videos de la Dra. Laura, solo para sus pacientes.</p>
        {videos.length === 0 ? (
          <p className="p-empty">Pronto encontrarás aquí videos pensados para tu tratamiento.</p>
        ) : (
          <div className="p-videos">
            {videos.map((v) => <VideoCard key={v.id} video={v} />)}
          </div>
        )}
      </section>
    </>
  );
}
