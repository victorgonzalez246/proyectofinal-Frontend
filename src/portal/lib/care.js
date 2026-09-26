import { toDate } from './format.js';

const HOUR_MS = 60 * 60 * 1000;

// Calcula hasta cuándo aplica cada indicación, contando desde el tratamiento
export const withWindows = (care, now = new Date()) =>
  (care?.items || []).map((item) => {
    const until = new Date(toDate(care.since).getTime() + item.hours * HOUR_MS);
    return { ...item, until, expired: until <= now };
  });
