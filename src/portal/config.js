import { Laugh, Smile, Meh, Annoyed, Frown } from 'lucide-react';
import resultadoLabios from '../assets/resultados/resultado-labios.jpeg';
import resultadoBotox from '../assets/resultados/resultado-botox.jpg';
import resultadoPatas from '../assets/resultados/resultado-patas-de-gallo.jpg';
import posterScrubs from '../assets/doctor/dra-laura-scrubs.jpg';
import posterEditorial from '../assets/doctor/dra-laura-editorial-2.jpg';
import posterClinica from '../assets/doctor/dra-laura-clinica-caso.jpg';

// Teléfono directo de la clínica (placeholder, el mismo de la landing: reemplazar por el real)
export const CLINIC_PHONE = '+50688888888';
export const CLINIC_PHONE_LABEL = '+506 8888-8888';

// Días tras un tratamiento en los que la línea de tranquilidad se destaca
export const RECOVERY_WINDOW_DAYS = 14;

// Demo: las fotos del simulador apuntan a assets locales. En producción serán
// URLs firmadas de corta duración emitidas por el backend (bucket privado).
export const PHOTO_ASSETS = {
  labios: resultadoLabios,
  entrecejo: resultadoBotox,
  'patas-de-gallo': resultadoPatas,
};

export const VIDEO_POSTERS = {
  scrubs: posterScrubs,
  editorial: posterEditorial,
  clinica: posterClinica,
};

export const MOODS = [
  { id: 'muy-bien', Icon: Laugh, label: 'Muy bien' },
  { id: 'bien', Icon: Smile, label: 'Bien' },
  { id: 'regular', Icon: Meh, label: 'Regular' },
  { id: 'molestias', Icon: Annoyed, label: 'Molestias' },
  { id: 'preocupacion', Icon: Frown, label: 'Preocupación' },
];

export const ROADMAP_KINDS = {
  valoracion: 'Valoración',
  tratamiento: 'Tratamiento',
  control: 'Control',
  retoque: 'Retoque ideal',
  sugerencia: 'Sugerencia de la doctora',
};
