import { useState, useEffect } from 'react'
import { Menu, X, Calendar } from 'lucide-react'
import logoMain from '../../assets/brand/logo-main.png'
import MobileMenu from '../ui/MobileMenu'

const navLinks = [
  { label: 'Filosofía', href: '#filosofia' },
  { label: 'Tratamientos', href: '#tratamientos' },
  { label: 'Resultados', href: '#casos' },
  { label: 'La Doctora', href: '#doctora' },
  { label: 'Contacto', href: '#agendar' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const handleLinkClick = () => setMobileOpen(false)

  return (
    <header
      id="navbar"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: '1rem 1.5rem',
        transition: 'var(--transition-base)',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          background: scrolled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.75)',
          border: '1px solid rgba(147,130,109,0.12)',
          boxShadow: scrolled ? 'var(--shadow-lg)' : 'var(--shadow-md)',
          borderRadius: 'var(--radius-full)',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'var(--transition-base)',
        }}
      >
        {/* Logo */}
        <a href="#inicio" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img
            src={logoMain}
            alt="Dra. Laura Jiménez"
            style={{
              height: '44px',
              width: 'auto',
              objectFit: 'contain',
            }}
          />
        </a>

        {/* Desktop Nav */}
        <nav
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '2.25rem',
          }}
          className="desktop-nav"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="label-upper"
              style={{
                fontSize: '0.65rem',
                color: 'var(--stone-muted)',
                transition: 'var(--transition-base)',
                letterSpacing: '0.2em',
              }}
              onMouseEnter={(e) => e.target.style.color = 'var(--olive-maison)'}
              onMouseLeave={(e) => e.target.style.color = 'var(--stone-muted)'}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA + Mobile Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <a href="#agendar" className="btn-primary" style={{ display: 'none' }} id="nav-cta-desktop">
            <Calendar size={14} />
            <span>Agendar Cita</span>
          </a>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              display: 'flex',
              padding: '0.5rem',
              color: 'var(--charcoal)',
            }}
            className="mobile-toggle"
            aria-label="Abrir menú"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Component */}
      <MobileMenu 
        isOpen={mobileOpen} 
        navLinks={navLinks} 
        onClose={handleLinkClick} 
      />

      {/* Responsive styles */}
      <style>{`
        @media (min-width: 1024px) {
          .desktop-nav { display: flex !important; }
          #nav-cta-desktop { display: inline-flex !important; }
          .mobile-toggle { display: none !important; }
        }
      `}</style>
    </header>
  )
}
