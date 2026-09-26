// Cupones de bienvenida otorgados automáticamente al registrarse en el Club.
// Módulo sin dependencias: lo importan tanto el frontend como server.js (simulador).
export const WELCOME_COUPONS = [
  {
    code: 'BIENVENIDA15',
    title: '15% OFF en tu Primer Tratamiento',
    discount: '15%',
    description: 'Válido en cualquier tratamiento facial o valoración integral.',
    validUntil: '2026-12-31',
    category: 'Facial & Armonización',
    status: 'active'
  },
  {
    code: 'VIPSKIN2026',
    title: 'Hydrafacial Glow de Cortesía con Sesión Láser',
    discount: '100% en Hydrafacial complementario',
    description: 'Beneficio exclusivo para miembros suscritos al club de beneficios.',
    validUntil: '2026-10-31',
    category: 'Promoción Club VIP',
    status: 'active'
  }
];
