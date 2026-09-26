// ============================================================
// DATOS DE LA CLÍNICA: único lugar para editarlos
// Los usan la landing (formulario, footer, hero) y el portal de pacientes.
// ⚠️ Los valores marcados con PENDIENTE son de relleno: ver pendientes/README.md
// ============================================================

export const CLINICA = {
  nombre: 'Dra. Laura Jiménez',
  // PENDIENTE: número real con código de país, solo dígitos (se usa en enlaces wa.me)
  whatsapp: '50688888888',
  // PENDIENTE: el mismo número, como se muestra y como se marca
  telefonoVisible: '+506 8888-8888',
  telefonoLlamada: '+50688888888',
  // PENDIENTE: confirmar que el correo exista
  email: 'contacto@dralaujimenez.com',
  direccion: 'Escazú, San José, Costa Rica',
  horario: 'Lun–Vie: 9:00 AM – 6:00 PM',
  instagram: 'https://www.instagram.com/dralau.armonizacion',
};

// PENDIENTE: la doctora debe confirmar que estas cifras son reales y verificables
export const METRICAS_HERO = [
  { value: '+12 Años', label: 'Criterio Médico Avanzado' },
  { value: '99.4%', label: 'Satisfacción Natural', highlight: true },
  { value: 'No Quirúrgico', label: 'Recuperación Inmediata' },
];

// Versión del aviso de privacidad: se guarda con cada consentimiento para saber qué texto aceptó cada persona.
// Cámbiala cada vez que se modifique el texto de src/pages/PrivacyPage.jsx
export const AVISO_VERSION = '2026-09-borrador';
