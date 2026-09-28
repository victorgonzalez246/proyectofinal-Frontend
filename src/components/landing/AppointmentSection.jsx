import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Calendar, Send, CheckCircle, UserRound } from 'lucide-react'
import api from '../../services/api.js'
import { CLINICA, AVISO_VERSION } from '../../config/clinica.js'

// Reglas de validación de react-hook-form (las mismas que aplica la API)
const REGLAS = {
  nombre: {
    validate: (v) => v.trim().length >= 3 || 'El nombre debe tener al menos 3 caracteres',
    maxLength: { value: 80, message: 'El nombre es demasiado largo' },
  },
  telefono: {
    validate: (v) => v.replace(/\D/g, '').length >= 8 || 'Ingresa un número de teléfono válido',
    maxLength: { value: 20, message: 'Ingresa un número de teléfono válido' },
  },
  email: {
    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Ingresa un correo electrónico válido' },
  },
  tratamiento: { required: 'Selecciona un tratamiento' },
  fecha: {
    required: 'Selecciona una fecha deseada',
    validate: (v) => v >= todayISO() || 'Selecciona una fecha a partir de hoy',
  },
  mensaje: { maxLength: { value: 500, message: 'El mensaje puede tener hasta 500 caracteres' } },
  consentimiento: { validate: (v) => v === true || 'Necesitamos tu aceptación para registrar la cita' },
}

// Fecha local de hoy en formato YYYY-MM-DD (el mismo que usa <input type="date">)
function todayISO() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
}

// Avisos con carga diferida: sonner no forma parte de la carga inicial de la landing
const avisar = (tipo, titulo, opciones) => import('sonner').then(({ toast }) => toast[tipo](titulo, opciones))

const treatmentOptions = [
  'Armonización Facial',
  'Bioestimuladores de Colágeno',
  'Rejuvenecimiento de Mirada',
  'Labios de Alta Definición',
  'Skinbooster & Mesoterapia',
  'Rinomodelación Sin Cirugía',
  'Valoración General',
]


export default function AppointmentSection() {
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      nombre: '',
      telefono: '',
      email: '',
      tratamiento: '',
      fecha: '',
      mensaje: '',
      consentimiento: false,
      promociones: false,
    },
  })

  const onSubmit = async (data) => {
    try {
      // Solicitud tal como la valida la API (el estado y la fecha de registro los decide ella)
      const solicitud = {
        nombre: data.nombre.trim(),
        telefono: data.telefono.trim(),
        email: (data.email || '').trim(),
        tratamiento: data.tratamiento,
        fecha: data.fecha,
        mensaje: (data.mensaje || '').trim(),
        consentimiento: true,
        avisoVersion: AVISO_VERSION,
        // Aceptación explícita y separada de la cita (la casilla no viene marcada)
        promociones: data.promociones === true,
      }

      // El estado y la fecha de registro los decide la API
      await api.post('/appointments', solicitud)

      // Build WhatsApp message
      const whatsappMsg = encodeURIComponent(
        `✨ *Nueva Solicitud de Cita — Dra. Laura Jiménez*\n\n` +
        `👤 *Nombre:* ${solicitud.nombre}\n` +
        `📱 *Teléfono:* ${solicitud.telefono}\n` +
        `${solicitud.email ? `📧 *Email:* ${solicitud.email}\n` : ''}` +
        `💆 *Tratamiento:* ${solicitud.tratamiento}\n` +
        `📅 *Fecha deseada:* ${solicitud.fecha}\n` +
        `${solicitud.mensaje ? `💬 *Mensaje:* ${solicitud.mensaje}\n` : ''}` +
        `\n_Solicitud enviada desde la web de la clínica._`
      )

      // Open WhatsApp
      // Directo a api.whatsapp.com: la redirección de wa.me convierte los emojis del texto en "�"
      window.open(`https://api.whatsapp.com/send?phone=${CLINICA.whatsapp}&text=${whatsappMsg}`, '_blank')

      avisar('success', '¡Solicitud enviada con éxito!', {
        description: 'Te redirigimos a WhatsApp para confirmar tu cita.',
      })

      setSubmitted(true)
      reset()

      // Vuelve al formulario después de 20 segundos (tiempo para ver el acceso al portal)
      setTimeout(() => setSubmitted(false), 20000)
    } catch (error) {
      console.error('Error al agendar cita:', error)
      avisar('error', 'Error al enviar la solicitud', {
        description:
          error.response?.data?.error ||
          'No pudimos registrar tu solicitud. Intenta de nuevo o escríbenos por WhatsApp.',
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
              <p style={{ color: 'var(--stone-muted)', fontWeight: 300, maxWidth: '400px', fontSize: '0.9rem' }}>
                Tu portal privado ya está listo: ahí verás tu plan, tus cuidados y tus próximas citas.
                Entra con este mismo número de WhatsApp.
              </p>
              <Link to="/portal/acceso" className="btn-secondary">
                <UserRound size={14} />
                <span>Entrar a mi portal</span>
              </Link>
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
                    {...register('nombre', REGLAS.nombre)}
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
                    {...register('telefono', REGLAS.telefono)}
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
                    {...register('email', REGLAS.email)}
                  />
                  {errors.email && <p className="form-error">{errors.email.message}</p>}
                </div>

                {/* Tratamiento */}
                <div>
                  <label className="form-label" htmlFor="tratamiento">Tratamiento de interés *</label>
                  <select
                    id="tratamiento"
                    className="form-select"
                    {...register('tratamiento', REGLAS.tratamiento)}
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
                    min={todayISO()}
                    className="form-input"
                    {...register('fecha', REGLAS.fecha)}
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
                    {...register('mensaje', REGLAS.mensaje)}
                  />
                  {errors.mensaje && <p className="form-error">{errors.mensaje.message}</p>}
                </div>
              </div>

              {/* Consentimiento (Ley 8968): obligatorio para registrar datos de salud */}
              <div style={{ marginTop: '1.5rem' }}>
                <label
                  htmlFor="consentimiento"
                  style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--stone-muted)', fontWeight: 300, lineHeight: 1.6 }}
                >
                  <input
                    id="consentimiento"
                    type="checkbox"
                    style={{ marginTop: '0.3rem', width: '1rem', height: '1rem', accentColor: 'var(--olive-maison)', flexShrink: 0 }}
                    {...register('consentimiento', REGLAS.consentimiento)}
                  />
                  <span>
                    Acepto el <Link to="/privacidad" style={{ textDecoration: 'underline', color: 'var(--charcoal)' }}>aviso de privacidad</Link> y
                    que la clínica use mis datos para gestionar mi cita y contactarme por WhatsApp.
                  </span>
                </label>
                {errors.consentimiento && <p className="form-error">{errors.consentimiento.message}</p>}
              </div>

              {/* Promociones: opcional e independiente de la cita */}
              <div style={{ marginTop: '0.75rem' }}>
                <label
                  htmlFor="promociones"
                  style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--stone-muted)', fontWeight: 300, lineHeight: 1.6 }}
                >
                  <input
                    id="promociones"
                    type="checkbox"
                    style={{ marginTop: '0.3rem', width: '1rem', height: '1rem', accentColor: 'var(--olive-maison)', flexShrink: 0 }}
                    {...register('promociones')}
                  />
                  <span>(Opcional) Quiero recibir promociones de la clínica por WhatsApp. Puedo pedir que me den de baja cuando quiera.</span>
                </label>
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
