import { motion } from 'framer-motion'
import { Heart, Shield, Sparkles } from 'lucide-react'
import ilustracion1 from '../../assets/illustrations/ilustracion-1.png'

const values = [
  {
    icon: Heart,
    title: 'Escucha Empática',
    description: 'Cada tratamiento se acompaña desde la escucha activa, respetando las expectativas y la individualidad de cada paciente.',
  },
  {
    icon: Shield,
    title: 'Criterio Profesional',
    description: 'Protocolos basados en evidencia científica y formación continua en las técnicas más avanzadas de medicina estética.',
  },
  {
    icon: Sparkles,
    title: 'Naturalidad Consciente',
    description: 'La estética se entiende como una forma de cuidado consciente, donde cada decisión se toma con calma, confianza y responsabilidad.',
  },
]

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
}

export default function PhilosophySection() {
  return (
    <section 
      id="filosofia" 
      className="section" 
      style={{ 
        background: 'var(--celadon-pearl)',
        position: 'relative',
        overflow: 'hidden',
        zIndex: 1
      }}
    >
      {/* Transición suave desde la sección anterior */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '180px',
          background: 'linear-gradient(to bottom, var(--cream-bg) 0%, rgba(219,229,223,0) 100%)',
          zIndex: 0,
          pointerEvents: 'none'
        }}
      />

      {/* Transición suave hacia la sección siguiente */}
      <div 
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '180px',
          background: 'linear-gradient(to top, var(--cream-bg) 0%, rgba(219,229,223,0) 100%)',
          zIndex: 0,
          pointerEvents: 'none'
        }}
      />
      {/* Background Watermark Image */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 0.08 }} // Opacidad muy baja para que sea marca de agua
        viewport={{ once: true }}
        transition={{ duration: 1.5 }}
        style={{
          position: 'absolute',
          top: '50%',
          right: '-5%', // La desplazamos un poco a la derecha
          transform: 'translateY(-50%)',
          height: '120%', // Que sea grande e imponente
          pointerEvents: 'none',
          zIndex: -1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <img
          src={ilustracion1}
          alt=""
          aria-hidden="true"
          style={{
            height: '100%',
            width: 'auto',
            objectFit: 'contain',
          }}
        />
      </motion.div>

      <div className="container" style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          
          {/* Header Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="text-center"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <span className="label-upper text-olive">Nuestra Filosofía</span>
            <h2 style={{ marginTop: '0.75rem' }}>
              Una identidad serena,{' '}
              <span className="text-serif-italic">humana y luminosa</span>
            </h2>
            <hr className="divider divider-center" />
            <p style={{ color: 'var(--stone-muted)', fontWeight: 300, lineHeight: 1.8 }}>
              Para la Dra. Laura Jiménez, la armonización facial es una práctica estética
              basada en la ética, la escucha y la naturalidad. Cada procedimiento se realiza
              desde la confianza y el respeto por la unicidad de cada rostro.
            </p>
          </motion.div>

          {/* Values Grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1.25rem',
              marginTop: '3.5rem',
            }}
          >
            {values.map((v, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                className="glass-card"
                style={{
                  padding: '1.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.70)',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--champagne-linen)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1.25rem'
                  }}
                >
                  <v.icon size={22} style={{ color: 'var(--olive-maison)' }} />
                </div>
                <h4 style={{ marginBottom: '0.5rem', fontSize: '1.05rem' }}>{v.title}</h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--stone-muted)', fontWeight: 300, lineHeight: 1.65 }}>
                  {v.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
