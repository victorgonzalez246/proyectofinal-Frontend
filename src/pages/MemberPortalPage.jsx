import React from 'react';
import { useAuth } from '../hooks/useAuth.js';

export default function MemberPortalPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <h1 className="font-headline-lg text-on-surface mb-4">Portal de Paciente</h1>
      <p className="font-body-md text-on-surface-variant text-center max-w-md">
        Bienvenida, {user?.name?.split(' ')[0] || 'Elena'}.<br/>
        El dashboard está en proceso de reconstrucción desde cero.
      </p>
    </div>
  );
}
