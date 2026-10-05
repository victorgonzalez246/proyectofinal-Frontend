// Costa Rica no tiene horario de verano: las fechas con hora se guardan con -06:00
const OFFSET_CR = '-06:00';

// "2026-09-24T15:00:00-06:00" → "2026-09-24T15:00" (valor de <input type="datetime-local">)
export const toLocalInput = (iso) => {
  if (!iso) return '';
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  return match ? `${match[1]}T${match[2]}` : '';
};

// "2026-09-24T15:00" → "2026-09-24T15:00:00-06:00"
export const fromLocalInput = (value) => (value ? `${value}:00${OFFSET_CR}` : '');

export const ESTADOS_CITA = {
  pendiente: { label: 'Pendiente', chip: 'p-chip p-chip--rose' },
  confirmada: { label: 'Confirmada', chip: 'p-chip' },
  cancelada: { label: 'Cancelada', chip: 'p-chip p-chip--muted' },
};

export const ORIGENES = {
  'landing-cita': 'Cita desde la web',
  'recepcionista-ia': 'Recepcionista por WhatsApp',
};

// Alertas del panel: SOS del portal, check-ins marcados y alertas que llegan del chat de WhatsApp
// (emergencia detectada sin IA, aviso de la Enfermera IA o mensaje que la IA no pudo responder)
export const SUBTIPOS_WHATSAPP = {
  emergencia: 'Emergencia',
  enfermera: 'Enfermera IA',
  ia_sin_respuesta: 'Sin respuesta de la IA',
};

// Distintivo de cada alerta: { etiqueta, chip, detalle } (detalle: tipo de alerta de WhatsApp)
export const distintivoAlerta = (alerta = {}) => {
  if (alerta.tipo === 'sos') return { etiqueta: 'SOS', chip: 'p-chip p-chip--alert', detalle: '' };
  if (alerta.tipo === 'whatsapp') {
    return {
      etiqueta: 'WhatsApp',
      chip: alerta.subtipo === 'emergencia' ? 'p-chip p-chip--alert' : 'p-chip p-chip--rose',
      detalle: SUBTIPOS_WHATSAPP[alerta.subtipo] || '',
    };
  }
  return { etiqueta: 'Check-in', chip: 'p-chip p-chip--rose', detalle: '' };
};

// Enlace de WhatsApp a partir de un teléfono de Costa Rica (8 dígitos, con o sin +506)
export const whatsappLink = (phone = '') => {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.length === 8 ? `506${digits}` : digits}`;
};
