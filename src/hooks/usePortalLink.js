import { useAuth } from './useAuth.js';

// Destino del acceso "Mi portal" en la landing según la sesión actual
export const usePortalLink = () => {
  const { isMember, isDoctor } = useAuth();
  if (isDoctor) return { to: '/admin', label: 'Panel médico' };
  if (isMember) return { to: '/portal', label: 'Mi portal' };
  return { to: '/portal/acceso', label: 'Mi portal' };
};
