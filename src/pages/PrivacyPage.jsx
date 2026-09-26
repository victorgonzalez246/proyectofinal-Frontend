import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { CLINICA, AVISO_VERSION } from '../config/clinica.js'

const secciones = [
  {
    titulo: 'Quién es responsable de tus datos',
    texto: `${CLINICA.nombre}, con consultorio en ${CLINICA.direccion}, es responsable de la base de datos de pacientes. Puedes escribirnos a ${CLINICA.email} o al ${CLINICA.telefonoVisible}.`,
  },
  {
    titulo: 'Qué datos recogemos',
    texto: 'Nombre, teléfono y correo; el tratamiento que te interesa y la fecha que prefieres; y, si eres paciente, tu plan de tratamiento, tus cuidados, fotos de evolución, los productos aplicados y lo que registras en tu portal (cómo te sientes, nivel de molestia y notas). Algunos de estos datos son datos de salud y los tratamos como información sensible.',
  },
  {
    titulo: 'Para qué los usamos',
    texto: 'Para agendar y recordarte tus citas, darte acceso a tu portal privado, acompañarte después de cada tratamiento, avisar a la doctora si algo requiere atención y preparar tu consulta. No vendemos tus datos ni los usamos para publicidad de terceros.',
  },
  {
    titulo: 'Con quién los compartimos',
    texto: 'Solo con los proveedores que necesitamos para darte el servicio: WhatsApp (Meta) para enviarte mensajes, Google para la agenda y los documentos de la clínica, n8n para automatizar los avisos y Anthropic (Claude) para la enfermera y la recepcionista virtuales. A estos asistentes de inteligencia artificial les enviamos la mínima información necesaria, nunca tu teléfono, y la doctora supervisa su trabajo.',
  },
  {
    titulo: 'Cuánto tiempo los guardamos',
    texto: 'Mientras seas paciente y durante el tiempo que exija la normativa sanitaria para expedientes clínicos. Las solicitudes de cita que no se concretan se eliminan cuando dejan de ser necesarias.',
  },
  {
    titulo: 'Tus derechos',
    texto: `Puedes pedir en cualquier momento acceder a tus datos, corregirlos, eliminarlos u oponerte a su uso, así como retirar tu consentimiento, escribiendo a ${CLINICA.email}. Te respondemos dentro de los plazos de la Ley 8968 de Protección de la Persona frente al Tratamiento de sus Datos Personales.`,
  },
  {
    titulo: 'Cómo los protegemos',
    texto: 'Acceso al portal sin contraseñas mediante enlaces de un solo uso, conexiones cifradas, acceso restringido a la doctora y su equipo, y un modo discreto en el portal para que nadie vea tus fotos o tratamientos si abres la app en público.',
  },
]

export default function PrivacyPage() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <main className="section" style={{ background: 'var(--cream-bg)', minHeight: '100vh' }}>
      <div className="container" style={{ maxWidth: '760px' }}>
        <Link to="/" className="label-upper" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={14} /> Volver al sitio
        </Link>

        <h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 3.2rem)', marginTop: '2rem' }}>Aviso de privacidad</h1>
        <p style={{ color: 'var(--stone-muted)', marginTop: '1rem', fontWeight: 300 }}>
          Cómo cuidamos tu información personal y de salud.
        </p>

        {/* PENDIENTE: borrador que debe revisar una persona asesora legal antes de publicar */}
        <p
          role="note"
          style={{
            marginTop: '1.5rem',
            padding: '0.9rem 1.1rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--nude-rose-10)',
            border: '1px dashed var(--nude-rose)',
            fontSize: '0.88rem',
          }}
        >
          Borrador pendiente de revisión legal. Versión {AVISO_VERSION}.
        </p>

        {secciones.map((s) => (
          <section key={s.titulo} style={{ marginTop: '2.25rem' }}>
            <h2 style={{ fontSize: '1.6rem' }}>{s.titulo}</h2>
            <p style={{ marginTop: '0.6rem', color: 'var(--charcoal-soft)', fontWeight: 300, lineHeight: 1.85 }}>{s.texto}</p>
          </section>
        ))}
      </div>
    </main>
  )
}
