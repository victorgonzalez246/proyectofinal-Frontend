import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Calendar, UserRound } from 'lucide-react'

const MotionLink = motion.create(Link)

export default function MobileMenu({ isOpen, navLinks, portal, onClose }) {
  // Variantes para el contenedor (fondo)
  const overlayVariants = {
    closed: {
      opacity: 0,
      backdropFilter: 'blur(0px)',
      transition: { duration: 0.3, delay: 0.2 }
    },
    open: {
      opacity: 1,
      backdropFilter: 'blur(16px)',
      transition: { duration: 0.4 }
    }
  }

  // Variantes para los enlaces (efecto cascada)
  const containerVariants = {
    closed: {
      transition: { staggerChildren: 0.05, staggerDirection: -1 }
    },
    open: {
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
  }

  const linkVariants = {
    closed: { opacity: 0, y: 20 },
    open: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.nav
          id="menu-movil"
          aria-label="Menú móvil"
          initial="closed"
          animate="open"
          exit="closed"
          variants={overlayVariants}
          style={{
            position: 'fixed',
            inset: 0,
            top: '72px', // Deja espacio para el navbar
            zIndex: 40,
            background: 'var(--champagne-linen-50)', // Fondo semi-transparente
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            paddingBottom: '10vh'
          }}
        >
          <motion.div
            variants={containerVariants}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.75rem'
            }}
          >
            {navLinks.map((link) => (
              <motion.a
                key={link.href}
                variants={linkVariants}
                href={link.href}
                onClick={onClose}
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '2rem',
                  fontWeight: 400,
                  color: 'var(--charcoal)',
                  textDecoration: 'none',
                  position: 'relative',
                }}
              >
                {link.label}
              </motion.a>
            ))}

            <motion.a
              variants={linkVariants}
              href="#agendar"
              className="btn-primary"
              onClick={onClose}
              style={{ marginTop: '1.5rem', transform: 'scale(1.1)' }}
            >
              <Calendar size={18} aria-hidden="true" />
              <span>Agendar Cita</span>
            </motion.a>

            {portal && (
              <MotionLink
                variants={linkVariants}
                to={portal.to}
                onClick={onClose}
                className="btn-secondary"
              >
                <UserRound size={16} aria-hidden="true" />
                <span>{portal.label}</span>
              </MotionLink>
            )}
          </motion.div>
        </motion.nav>
      )}
    </AnimatePresence>
  )
}
