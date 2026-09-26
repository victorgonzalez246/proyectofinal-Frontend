const LOCALE = 'es-CR';
const DAY_MS = 24 * 60 * 60 * 1000;

// Las fechas sin hora (YYYY-MM-DD) se interpretan en hora local, no UTC
export const toDate = (value) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);

export const formatDate = (value, options = { day: 'numeric', month: 'long', year: 'numeric' }) =>
  new Intl.DateTimeFormat(LOCALE, options).format(toDate(value));

export const formatDateTime = (value) =>
  new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).format(toDate(value));

export const formatUntil = (value) =>
  new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(toDate(value));

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Días de calendario entre dos fechas (hoy vs. fecha del tratamiento)
export const daysBetween = (from, to = new Date()) =>
  Math.round((startOfDay(toDate(to)) - startOfDay(toDate(from))) / DAY_MS);

export const relativeDays = (value) => {
  const days = daysBetween(new Date(), value);
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  if (days > 1) return `en ${days} días`;
  return `hace ${-days} días`;
};

export const greeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

const ORDINALS = ['primer', 'segundo', 'tercer', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo', 'noveno', 'décimo'];
export const ordinalDay = (n) => ORDINALS[n - 1] || `día ${n} de`;

export const firstName = (name = '') => name.trim().split(/\s+/)[0] || '';
