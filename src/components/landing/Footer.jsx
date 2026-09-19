import { MapPin, Phone, Clock, Camera, Mail } from 'lucide-react'
import logoWhite from '../../assets/brand/logo-main-white.png'

const contactInfo = [
  { icon: MapPin, text: 'Escazú, San José, Costa Rica' },
  { icon: Phone, text: '+506 8888-8888' },
  { icon: Mail, text: 'contacto@dralaujimenez.com' },
  { icon: Clock, text: 'Lun–Vie: 9:00 AM – 6:00 PM' },
]

const quickLinks = [
  { label: 'Filosofía', href: '#filosofia' },
  { label: 'Tratamientos', href: '#tratamientos' },
  { label: 'Resultados', href: '#casos' },
  { label: 'La Doctora', href: '#doctora' },
  { label: 'Agendar Cita', href: '#agendar' },
]

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      id="ubicacion"
      style={{
        background: 'var(--charcoal)',
        color: 'rgba(255,255,255,0.75)',
        paddingTop: '4rem',
        paddingBottom: '2rem',
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '3rem',
            paddingBottom: '3rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
          className="footer-grid"
        >
          {/* Column 1: Brand */}
          <div>
            <img
              src={logoWhite}
              alt="Dra. Laura Jiménez"
              style={{ height: '60px', width: 'auto', marginBottom: '1.25rem', objectFit: 'contain' }}
            />
            <p style={{ fontSize: '0.88rem', lineHeight: 1.75, fontWeight: 300, maxWidth: '320px', color: 'rgba(255,255,255,0.55)' }}>
              Medicina estética de precisión. Armonización facial ética, personalizada y consciente
              desde la confianza y la naturalidad.
            </p>
            {/* Social */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'var(--transition-base)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--olive-maison)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                aria-label="Instagram"
              >
                <Camera size={18} style={{ color: 'rgba(255,255,255,0.8)' }} />
              </a>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h4
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.45)',
                marginBottom: '1.25rem',
              }}
            >
              Enlaces Rápidos
            </h4>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {quickLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: 300,
                    color: 'rgba(255,255,255,0.65)',
                    transition: 'var(--transition-base)',
                  }}
                  onMouseEnter={(e) => e.target.style.color = 'var(--sage-satin)'}
                  onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.65)'}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Column 3: Contact Info */}
          <div>
            <h4
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.45)',
                marginBottom: '1.25rem',
              }}
            >
              Contacto & Ubicación
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {contactInfo.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <c.icon size={16} style={{ color: 'var(--sage-satin)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.88rem', fontWeight: 300 }}>{c.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            paddingTop: '1.5rem',
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.35)',
          }}
        >
          <span>© {currentYear} Dra. Laura Jiménez. Todos los derechos reservados.</span>
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .footer-grid {
            grid-template-columns: 2fr 1fr 1.5fr !important;
          }
        }
      `}</style>
    </footer>
  )
}
