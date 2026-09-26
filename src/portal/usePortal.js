import { createContext, useContext } from 'react';

export const PortalContext = createContext(null);

export const usePortal = () => {
  const context = useContext(PortalContext);
  if (!context) throw new Error('usePortal debe usarse dentro de PortalLayout');
  return context;
};
