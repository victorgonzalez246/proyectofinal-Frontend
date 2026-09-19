import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import draLauraEditorial from '../../assets/doctor/dra-laura-editorial-1.jpg'

const metrics = [
  { value: '+12 Años', label: 'Criterio Médico Avanzado' },
  { value: '99.4%', label: 'Satisfacción Natural', highlight: true },
  { value: 'No Quirúrgico', label: 'Recuperación Inmediata' },
]

export default function HeroSection() {
  return (
    <section
      id="inicio"
      style={{
        position: 'relative',
        paddingTop: '9rem',
        paddingBottom: '5rem',
        overflow: 'hidden',
      }}
    >
      {/* Background light orbs */}
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          left: '-60px',
          width: '550px',
          height: '550px',
          background: 'var(--nude-rose-10)',
          filter: 'blur(130px)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '100px',
          right: '-80px',
          width: '600px',
          height: '600px',
          background: 'var(--celadon-pearl-30)',
          filter: 'blur(140px)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />

      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '3rem',
            alignItems: 'center',
          }}
          className="hero-grid"
        >
          {/* Left Column: Copy */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
          >
            {/* Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.375rem 1rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(255,255,255,0.90)',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)',
                alignSelf: 'flex-start',
              }}
            >
              <span
                className="animate-pulse-subtle"
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--olive-maison)',
                }}
              />
              <span className="label-upper" style={{ fontSize: '0.6rem' }}>
                Armonización Facial Ética & Natural
              </span>
            </div>

            {/* Headline */}
            <h1>
              Belleza que nace del bienestar.{' '}
              <span className="text-serif-italic" style={{ display: 'block' }}>
                Armonización facial
              </span>{' '}
              desde una mirada cercana y natural.
            </h1>

            {/* Subtext */}
            <p
              style={{
                fontSize: '1.05rem',
                color: 'var(--stone-muted)',
                fontWeight: 300,
                lineHeight: 1.8,
                maxWidth: '560px',
              }}
            >
              Protocolos de armonización facial y bioestimulación tisular no quirúrgica,
              concebidos desde la escucha, el criterio profesional y el respeto por
              la naturalidad de cada rostro.
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', paddingTop: '0.5rem' }}>
              <a href="#agendar" className="btn-primary">
                <span>Agendar Valoración</span>
                <ArrowRight size={16} />
              </a>
              <a href="#casos" className="btn-secondary">
                <span>Explorar Resultados</span>
              </a>
            </div>

            {/* Metrics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '1rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid var(--border-subtle)',
                marginTop: '0.5rem',
              }}
            >
              {metrics.map((m, i) => (
                <div
                  key={i}
                  className="glass-card"
                  style={{ padding: '1.25rem' }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '1.75rem',
                      fontWeight: 500,
                      color: m.highlight ? 'var(--olive-maison)' : 'var(--charcoal)',
                      display: 'block',
                      lineHeight: 1.2,
                    }}
                  >
                    {m.value}
                  </span>
                  <span className="label-upper" style={{ fontSize: '0.55rem', marginTop: '0.25rem', display: 'block' }}>
                    {m.label}
                  </span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right Column: Doctor Photo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                position: 'relative',
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-xl)',
                maxWidth: '480px',
                width: '100%',
              }}
            >
              {/* Decorative gradient overlay at bottom */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '40%',
                  background: 'linear-gradient(to top, rgba(250,248,245,0.6), transparent)',
                  zIndex: 1,
                  pointerEvents: 'none',
                }}
              />
              <img
                src={draLauraEditorial}
                alt="Dra. Laura Jiménez — Medicina Estética"
                style={{
                  width: '100%',
                  height: 'auto',
                  objectFit: 'cover',
                  aspectRatio: '3/4',
                }}
              />
            </div>
            {/* Decorative accent circle */}
            <div
              style={{
                position: 'absolute',
                bottom: '-20px',
                right: '-20px',
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: 'var(--celadon-pearl)',
                opacity: 0.5,
                zIndex: -1,
              }}
            />
          </motion.div>
        </div>
      </div>

      {/* Responsive hero grid */}
      <style>{`
        @media (min-width: 1024px) {
          .hero-grid {
            grid-template-columns: 7fr 5fr !important;
            gap: 3.5rem !important;
          }
        }
        @media (min-width: 640px) {
          #inicio {
            padding-top: 11rem !important;
            padding-bottom: 7rem !important;
          }
        }
      `}</style>
    </section>
  )
}
