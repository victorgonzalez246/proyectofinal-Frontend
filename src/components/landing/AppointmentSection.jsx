import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Calendar, Send, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { sanitizeInput } from '../../utils/security.js'
import api from '../../services/api.js'

const appointmentSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(80),
  telefono: z.string().min(8, 'Ingresa un número de teléfono válido').max(20),
  email: z.string().email('Ingresa un correo electrónico válido').optional().or(z.literal('')),
  tratamiento: z.string().min(1, 'Selecciona un tratamiento'),
  fecha: z.string().min(1, 'Selecciona una fecha deseada'),
  mensaje: z.string().max(500).optional().or(z.literal('')),
})

const treatmentOptions = [
  'Armonización Facial',
  'Bioestimuladores de Colágeno',
  'Rejuvenecimiento de Mirada',
  'Labios de Alta Definición',
  'Skinbooster & Mesoterapia',
  'Rinomodelación Sin Cirugía',
  'Valoración General',
]

const WHATSAPP_NUMBER = '50688888888' // Placeholder - editable

export default function AppointmentSection() {
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      nombre: '',
      telefono: '',
      email: '',
      tratamiento: '',
      fecha: '',
      mensaje: '',
    },
  })

  const onSubmit = async (data) => {
    try {
      // Sanitize all text inputs
      const sanitized = {
        nombre: sanitizeInput(data.nombre),
        telefono: sanitizeInput(data.telefono),
        email: sanitizeInput(data.email || ''),
        tratamiento: data.tratamiento,
        fecha: data.fecha,
        mensaje: sanitizeInput(data.mensaje || ''),
        estado: 'pendiente',
        createdAt: new Date().toISOString(),
      }

      // Save to db.json via the secure API
      await api.post('/appointments', sanitized)

      // Build WhatsApp message
      const whatsappMsg = encodeURIComponent(
        `✨ *Nueva Solicitud de Cita — Dra. Laura Jiménez*\n\n` +
        `👤 *Nombre:* ${sanitized.nombre}\n` +
        `📱 *Teléfono:* ${sanitized.telefono}\n` +
        `${sanitized.email ? `📧 *Email:* ${sanitized.email}\n` : ''}` +
        `💆 *Tratamiento:* ${sanitized.tratamiento}\n` +
        `📅 *Fecha deseada:* ${sanitized.fecha}\n` +
        `${sanitized.mensaje ? `💬 *Mensaje:* ${sanitized.mensaje}\n` : ''}` +
        `\n_Solicitud enviada desde la web de la clínica._`
      )

      // Open WhatsApp
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`, '_blank')

      toast.success('¡Solicitud enviada con éxito!', {
        description: 'Te redirigimos a WhatsApp para confirmar tu cita.',
      })

      setSubmitted(true)
      reset()

      // Reset success state after 8 seconds
      setTimeout(() => setSubmitted(false), 8000)
    } catch (error) {
      console.error('Error al agendar cita:', error)
      toast.error('Error al enviar la solicitud', {
        description: 'Verifica que el servidor esté activo (npm run server) e intenta de nuevo.',
      })
    }
  }

  return (
    <section
      id="agendar"
      className="section"
      style={{
        background: 'linear-gradient(180deg, var(--cream-bg) 0%, var(--celadon-pearl) 100%)',
        position: 'relative',
      }}
    >
      {/* Decorative orb */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          right: '-100px',
          width: '400px',
          height: '400px',
          background: 'var(--nude-rose-10)',
          filter: 'blur(120px)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }}
      />

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center"
          style={{ maxWidth: '560px', margin: '0 auto 3rem' }}
        >
          <span className="label-upper text-olive">Agenda Tu Cita</span>
          <h2 style={{ marginTop: '0.75rem' }}>
            Tu camino hacia la{' '}
            <span className="text-serif-italic">armonía natural</span>
          </h2>
          <hr className="divider divider-center" />
          <p style={{ color: 'var(--stone-muted)', fontWeight: 300, lineHeight: 1.8 }}>
            Completa el formulario y te contactaremos para confirmar tu valoración personalizada
            con la Dra. Laura Jiménez.
          </p>
        </motion.div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card"
          style={{
            maxWidth: '720px',
            margin: '0 auto',
            padding: '2.5rem',
            background: 'rgba(255,255,255,0.80)',
          }}
        >
          {submitted ? (
            <div
              className="text-center animate-fade-in-up"
              style={{
                padding: '3rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <CheckCircle size={56} style={{ color: 'var(--olive-maison)' }} />
              <h3>¡Solicitud Enviada!</h3>
              <p style={{ color: 'var(--stone-muted)', fontWeight: 300, maxWidth: '400px' }}>
                Tu solicitud fue registrada exitosamente. Revisa WhatsApp para confirmar
                tu cita directamente con nuestro equipo.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: '1.25rem',
                }}
                className="form-grid"
              >
                {/* Nombre */}
                <div>
                  <label className="form-label" htmlFor="nombre">Nombre completo *</label>
                  <input
                    id="nombre"
                    type="text"
                    className="form-input"
                    placeholder="Ej. María López Rodríguez"
                    {...register('nombre')}
                  />
                  {errors.nombre && <p className="form-error">{errors.nombre.message}</p>}
                </div>

                {/* Teléfono */}
                <div>
                  <label className="form-label" htmlFor="telefono">Teléfono / WhatsApp *</label>
                  <input
                    id="telefono"
                    type="tel"
                    className="form-input"
                    placeholder="Ej. +506 8888-8888"
                    {...register('telefono')}
                  />
                  {errors.telefono && <p className="form-error">{errors.telefono.message}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="form-label" htmlFor="email">Correo electrónico</label>
                  <input
                    id="email"
                    type="email"
                    className="form-input"
                    placeholder="correo@ejemplo.com (opcional)"
                    {...register('email')}
                  />
                  {errors.email && <p className="form-error">{errors.email.message}</p>}
                </div>

                {/* Tratamiento */}
                <div>
                  <label className="form-label" htmlFor="tratamiento">Tratamiento de interés *</label>
                  <select
                    id="tratamiento"
                    className="form-select"
                    {...register('tratamiento')}
                  >
                    <option value="">Selecciona un tratamiento</option>
                    {treatmentOptions.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {errors.tratamiento && <p className="form-error">{errors.tratamiento.message}</p>}
                </div>

                {/* Fecha */}
                <div>
                  <label className="form-label" htmlFor="fecha">Fecha deseada *</label>
                  <input
                    id="fecha"
                    type="date"
                    className="form-input"
                    {...register('fecha')}
                  />
                  {errors.fecha && <p className="form-error">{errors.fecha.message}</p>}
                </div>

                {/* Mensaje */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" htmlFor="mensaje">Mensaje adicional</label>
                  <textarea
                    id="mensaje"
                    className="form-input"
                    rows={3}
                    placeholder="Cuéntanos si tienes alguna pregunta o preferencia especial (opcional)"
                    style={{ resize: 'vertical', minHeight: '80px' }}
                    {...register('mensaje')}
                  />
                  {errors.mensaje && <p className="form-error">{errors.mensaje.message}</p>}
                </div>
              </div>

              {/* Submit */}
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting}
                  style={{
                    padding: '1rem 2.5rem',
                    fontSize: '0.75rem',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? (
                    <span>Enviando...</span>
                  ) : (
                    <>
                      <Calendar size={16} />
                      <span>Solicitar Cita por WhatsApp</span>
                      <Send size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>

      <style>{`
        @media (min-width: 640px) {
          .form-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}
