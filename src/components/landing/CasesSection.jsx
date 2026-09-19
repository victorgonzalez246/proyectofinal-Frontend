import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'

import resultadoBotox from '../../assets/resultados/resultado-botox.jpg'
import resultadoPatasDeGallo from '../../assets/resultados/resultado-patas-de-gallo.jpg'
import resultadoLabios from '../../assets/resultados/resultado-labios.jpeg'

const cases = [
  {
    image: resultadoBotox,
    alt: 'Aplicación de toxina botulínica en zona de entrecejo — Dra. Laura Jiménez',
    tag: 'Toxina Botulínica',
    title: 'Suavizado de Líneas de Expresión',
    description:
      'Aplicación precisa de toxina botulínica en la zona del entrecejo para suavizar líneas de expresión. Un procedimiento rápido y seguro que devuelve frescura al rostro sin alterar la expresión natural.',
    stats: [
      { label: 'Procedimiento', value: '15 min' },
      { label: 'Recuperación', value: 'Inmediata' },
      { label: 'Duración', value: '4–6 meses' },
    ],
  },
  {
    image: resultadoPatasDeGallo,
    alt: 'Antes y después de tratamiento de patas de gallo — Dra. Laura Jiménez',
    tag: 'Antes & Después',
    title: 'Reducción de Patas de Gallo',
    description:
      'Resultado real de tratamiento periocular para suavizar las líneas finas alrededor de los ojos. Se logra una mirada más descansada y juvenil, conservando la naturalidad del gesto al sonreír.',
    stats: [
      { label: 'Procedimiento', value: '20 min' },
      { label: 'Resultado', value: 'Natural' },
      { label: 'Duración', value: '4–6 meses' },
    ],
  },
  {
    image: resultadoLabios,
    alt: 'Perfilado y volumen labial con ácido hialurónico — Dra. Laura Jiménez',
    tag: 'Ácido Hialurónico',
    title: 'Perfilado e Hidratación Labial',
    description:
      'Definición del contorno labial y aporte de volumen sutil con ácido hialurónico premium. Un resultado armónico que respeta las proporciones faciales y realza la belleza natural de la sonrisa.',
    stats: [
      { label: 'Procedimiento', value: '30 min' },
      { label: 'Recuperación', value: 'Inmediata' },
      { label: 'Duración', value: '8–12 meses' },
    ],
  },
]

export default function CasesSection() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [direction, setDirection] = useState(0)

  const paginate = (newDirection) => {
    setDirection(newDirection)
    setActiveIndex((prev) => {
      const next = prev + newDirection
      if (next < 0) return cases.length - 1
      if (next >= cases.length) return 0
      return next
    })
  }

  const activeCase = cases[activeIndex]

  const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir < 0 ? 300 : -300, opacity: 0 }),
  }

  return (
    <section
      id="casos"
      className="section"
      style={{ background: 'var(--champagne-linen)' }}
    >
      <div className="container">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center"
          style={{ maxWidth: '600px', margin: '0 auto 3.5rem' }}
        >
          <span className="label-upper text-taupe">Casos Clínicos</span>
          <h2 style={{ marginTop: '0.75rem' }}>
            Resultados que hablan por{' '}
            <span className="text-serif-italic">sí mismos</span>
          </h2>
          <hr className="divider divider-center" />
          <p style={{ color: 'var(--stone-muted)', fontWeight: 300, lineHeight: 1.8 }}>
            Cada caso es un testimonio de precisión médica, escucha activa y resultados naturales.
            Transformaciones sutiles que respetan la esencia de cada paciente.
          </p>
        </motion.div>

        {/* Cases Showcase */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '2rem',
            alignItems: 'center',
          }}
          className="cases-grid"
        >
          {/* Image with carousel */}
          <div
            style={{
              position: 'relative',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-xl)',
              maxWidth: '520px',
              margin: '0 auto',
              width: '100%',
              aspectRatio: '4/5',
              background: '#1a1a1a',
            }}
          >
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.img
                key={activeIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: [0.25, 0.8, 0.25, 1] }}
                src={activeCase.image}
                alt={activeCase.alt}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
              />
            </AnimatePresence>

            {/* Navigation Arrows */}
            <button
              onClick={() => paginate(-1)}
              aria-label="Caso anterior"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                zIndex: 2,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,1)'
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.85)'
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)'
              }}
            >
              <ChevronLeft size={18} color="var(--charcoal)" />
            </button>
            <button
              onClick={() => paginate(1)}
              aria-label="Caso siguiente"
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                zIndex: 2,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,1)'
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.85)'
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)'
              }}
            >
              <ChevronRight size={18} color="var(--charcoal)" />
            </button>

            {/* Dot Indicators */}
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '8px',
                zIndex: 2,
              }}
            >
              {cases.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setDirection(i > activeIndex ? 1 : -1)
                    setActiveIndex(i)
                  }}
                  aria-label={`Ver caso ${i + 1}`}
                  style={{
                    width: i === activeIndex ? '24px' : '8px',
                    height: '8px',
                    borderRadius: '999px',
                    border: 'none',
                    background: i === activeIndex ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Description Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="glass-card"
              style={{
                padding: '2.5rem',
                maxWidth: '560px',
                margin: '0 auto',
                width: '100%',
                background: 'rgba(255,255,255,0.75)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Sparkles size={14} style={{ color: 'var(--nude-rose)' }} />
                <span className="label-upper" style={{ color: 'var(--nude-rose)' }}>
                  {activeCase.tag}
                </span>
              </div>
              <h3 style={{ marginTop: '0.5rem', marginBottom: '0.75rem' }}>
                {activeCase.title}
              </h3>
              <p
                style={{
                  fontSize: '0.92rem',
                  color: 'var(--stone-muted)',
                  fontWeight: 300,
                  lineHeight: 1.75,
                  marginBottom: '1.5rem',
                }}
              >
                {activeCase.description}
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '1rem',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '1.25rem',
                }}
              >
                {activeCase.stats.map((stat, i) => (
                  <div key={i} className="text-center">
                    <span
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '1.25rem',
                        fontWeight: 500,
                        color: 'var(--olive-maison)',
                        display: 'block',
                      }}
                    >
                      {stat.value}
                    </span>
                    <span className="label-upper" style={{ fontSize: '0.5rem' }}>
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Thumbnail strip */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem',
            marginTop: '2.5rem',
          }}
        >
          {cases.map((c, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection(i > activeIndex ? 1 : -1)
                setActiveIndex(i)
              }}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: i === activeIndex ? '2px solid var(--olive-maison)' : '2px solid transparent',
                opacity: i === activeIndex ? 1 : 0.55,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                padding: 0,
                background: 'none',
              }}
              onMouseEnter={(e) => {
                if (i !== activeIndex) e.currentTarget.style.opacity = '0.85'
              }}
              onMouseLeave={(e) => {
                if (i !== activeIndex) e.currentTarget.style.opacity = '0.55'
              }}
              aria-label={`Ver caso: ${c.title}`}
            >
              <img
                src={c.image}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .cases-grid {
            grid-template-columns: 1fr 1fr !important;
            max-width: 1100px !important;
            margin: 0 auto !important;
          }
          .cases-grid > div {
            max-width: none !important;
          }
        }
      `}</style>
    </section>
  )
}
