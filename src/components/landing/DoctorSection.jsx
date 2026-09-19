import { motion } from 'framer-motion'
import { Award, BookOpen, GraduationCap } from 'lucide-react'
import draCorporativo from '../../assets/doctor/dra-laura-corporativo.jpg'
import ilustracion2 from '../../assets/illustrations/ilustracion-2.png'

const credentials = [
  {
    icon: GraduationCap,
    title: 'Odontóloga General',
    detail: 'Ulacit',
  },
  {
    icon: BookOpen,
    title: 'Armonización Facial para Odontólogos',
    detail: 'Universidad a distancia de Madrid (UDIMA)',
  },
  {
    icon: Award,
    title: 'Diplomado en Armonización y Estética Facial',
    detail: 'FACOP (Facultad do Centro Oeste Paulista)',
  },
]

export default function DoctorSection() {
  return (
    <section id="doctora" className="section">
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '4rem',
            alignItems: 'center',
          }}
          className="doctor-grid"
        >
          {/* Photo Column */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-xl)',
                maxWidth: '420px',
                width: '100%',
                position: 'relative',
              }}
            >
              <img
                src={draCorporativo}
                alt="Dra. Laura Jiménez — Retrato Profesional"
                style={{
                  width: '100%',
                  height: 'auto',
                  objectFit: 'cover',
                  aspectRatio: '3/4',
                }}
              />
            </div>
            {/* Decorative illustration */}
            <img
              src={ilustracion2}
              alt=""
              aria-hidden="true"
              style={{
                position: 'absolute',
                bottom: '-30px',
                left: '-30px',
                width: '120px',
                opacity: 0.4,
                zIndex: -1,
                filter: 'drop-shadow(0 2px 8px rgba(112,123,99,0.1))',
              }}
            />
          </motion.div>

          {/* Content Column */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          >
            <span className="label-upper text-olive">La Doctora</span>
            <h2>
              Dra. Laura{' '}
              <span className="text-serif-italic">Jiménez</span>
            </h2>
            <hr className="divider" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', color: 'var(--stone-muted)', fontWeight: 300, lineHeight: 1.85, maxWidth: '540px' }}>
              <p>
                Para mí, la estética nunca ha sido cambiar quién sos, sino aprender a cuidarte y sentirte bien con lo que ves en el espejo.
              </p>
              <p>
                Soy Lau, odontóloga y me dedico a la armonización facial, pero mi forma de entender la estética va mucho más allá de un procedimiento.
              </p>
              <p>
                Creo en cuidar nuestra piel, nuestra salud, nuestra microbiota, nuestro cuerpo… y también en aprender a mirarnos con más amor.
              </p>
              <p>
                Así que si eso también resuena con vos, bienvenida.
              </p>
              <p>
                Creo firmemente que la belleza auténtica nace del bienestar interior, y que cada procedimiento debe ser una experiencia de cuidado consciente, donde la confianza y la comunicación son la base de resultados excepcionales.
              </p>
            </div>

            {/* Credentials */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                marginTop: '1rem',
              }}
            >
              {credentials.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--celadon-pearl)',
                    transition: 'var(--transition-base)',
                  }}
                >
                  <c.icon size={20} style={{ color: 'var(--olive-maison)', flexShrink: 0 }} />
                  <div>
                    <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '0.9rem', color: 'var(--charcoal)' }}>
                      {c.title}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--stone-muted)', fontWeight: 300 }}>
                      {c.detail}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .doctor-grid {
            grid-template-columns: 5fr 7fr !important;
          }
        }
      `}</style>
    </section>
  )
}
