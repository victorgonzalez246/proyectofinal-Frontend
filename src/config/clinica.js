// ============================================================
// DATOS DE LA CLÍNICA: único lugar para editarlos
// Los usan la landing (formulario, footer, hero) y el portal de pacientes.
// ⚠️ Los valores marcados con PENDIENTE son de relleno: ver pendientes/README.md
// ============================================================

export const CLINICA = {
  nombre: 'Dra. Laura Jiménez',
  // Número real con código de país, solo dígitos (se usa en enlaces wa.me): pendientes/README.md, sección 3
  whatsapp: '50687049810',
  // El mismo número, como se muestra y como se marca
  telefonoVisible: '+506 8704-9810',
  telefonoLlamada: '+50687049810',
  email: 'contacto.victorgonzalez0@gmail.com',
  direccion: 'Escazú, San José, Costa Rica',
  horario: 'Lun–Vie: 9:00 AM – 6:00 PM',
  instagram: 'https://www.instagram.com/dralau.armonizacion',
};

// Cifras confirmadas como verídicas (pendientes/README.md, sección 3)
export const METRICAS_HERO = [
  { value: '+12 Años', label: 'Criterio Médico Avanzado' },
  { value: '99.4%', label: 'Satisfacción Natural', highlight: true },
  { value: 'No Quirúrgico', label: 'Recuperación Inmediata' },
];

// Versión del aviso de privacidad: se guarda con cada consentimiento para saber qué texto aceptó cada persona.
// Cámbiala cada vez que se modifique el texto de src/pages/PrivacyPage.jsx
export const AVISO_VERSION = '2026-10-b';
