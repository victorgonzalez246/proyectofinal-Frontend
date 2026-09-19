import { motion } from 'framer-motion'
import { Droplets, Sun, Eye, Smile, Syringe, Gem } from 'lucide-react'
import perfil01 from '../../assets/illustrations/perfil-01.png'

const treatments = [
  {
    icon: Smile,
    title: 'Armonización Facial',
    subtitle: 'Perfilamiento & Equilibrio',
    description: 'Técnicas de volumetría y contorno para lograr proporciones armónicas que resalten la belleza natural de cada rostro.',
    color: 'var(--nude-rose)',
    bgColor: 'rgba(219, 178, 153, 0.12)',
  },
  {
    icon: Gem,
    title: 'Bioestimuladores de Colágeno',
    subtitle: 'Hidratación & Firmeza Profunda',
    description: 'Protocolos de bioestimulación que activan la regeneración natural del colágeno para una piel más firme y luminosa.',
    color: 'var(--olive-maison)',
    bgColor: 'rgba(112, 123, 99, 0.12)',
  },
  {
    icon: Eye,
    title: 'Rejuvenecimiento de Mirada',
    subtitle: 'Neuromoduladores de Precisión',
    description: 'Aplicación milimétrica de toxina botulínica para suavizar líneas de expresión preservando la naturalidad gestual.',
    color: 'var(--taupe-atelier)',
    bgColor: 'rgba(147, 130, 109, 0.12)',
  },
  {
    icon: Syringe,
    title: 'Labios de Alta Definición',
    subtitle: 'Ácido Hialurónico Premium',
    description: 'Hidratación y perfilado labial con ácido hialurónico de última generación para resultados sutiles y duraderos.',
    color: 'var(--nude-rose)',
    bgColor: 'rgba(219, 178, 153, 0.12)',
  },
  {
    icon: Droplets,
    title: 'Skinbooster & Mesoterapia',
    subtitle: 'Luminosidad & Calidad de Piel',
    description: 'Cocktails vitamínicos y ácido hialurónico micronizado para una hidratación profunda y un glow natural visible.',
    color: 'var(--sage-satin)',
    bgColor: 'rgba(181, 185, 159, 0.12)',
  },
  {
    icon: Sun,
    title: 'Rinomodelación Sin Cirugía',
    subtitle: 'Corrección & Definición Nasal',
    description: 'Remodelación del perfil nasal mediante rellenos estratégicos, sin tiempos de recuperación ni procedimiento quirúrgico.',
    color: 'var(--olive-maison)',
    bgColor: 'rgba(112, 123, 99, 0.12)',
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
}

export default function TreatmentsSection() {
  return (
    <section id="tratamientos" className="section">
      <div className="container">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center"
          style={{ maxWidth: '640px', margin: '0 auto 3.5rem' }}
        >
          <span className="label-upper text-olive">Tratamientos de Precisión</span>
          <h2 style={{ marginTop: '0.75rem' }}>
            Protocolos concebidos bajo los más{' '}
            <span className="text-serif-italic">elevados estándares</span>
          </h2>
          <hr className="divider divider-center" />
          <p style={{ color: 'var(--stone-muted)', fontWeight: 300, lineHeight: 1.8 }}>
            Cada procedimiento es personalizado, mínimamente invasivo y enfocado en potenciar
            tu belleza natural con resultados visibles y recuperación inmediata.
          </p>
        </motion.div>

        {/* Decorative profile illustration */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <img
            src={perfil01}
            alt="Perfil de armonización facial"
            style={{
              width: '100%',
              maxWidth: '280px',
              opacity: 0.6,
              filter: 'drop-shadow(0 2px 12px rgba(112,123,99,0.08))',
            }}
          />
        </div>

        {/* Treatment Cards Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {treatments.map((t, i) => (
            <motion.div
              key={i}
              variants={cardVariants}
              className="glass-card"
              style={{
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                cursor: 'default',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div
                  style={{
                    flexShrink: 0,
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-md)',
                    background: t.bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <t.icon size={22} style={{ color: t.color }} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.05rem', lineHeight: 1.3 }}>{t.title}</h4>
                  <span
                    className="label-upper"
                    style={{ fontSize: '0.55rem', color: t.color, marginTop: '0.15rem', display: 'block' }}
                  >
                    {t.subtitle}
                  </span>
                </div>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--stone-muted)', fontWeight: 300, lineHeight: 1.7 }}>
                {t.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
