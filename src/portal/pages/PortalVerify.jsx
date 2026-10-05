import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { usePreferences } from '../usePreferences.js';
import '../portal.css';

// Canjea el enlace mágico. El token viaja en el fragmento (#) para que no quede
// en logs de servidores ni en el historial: se borra de la barra de direcciones al leerlo.
export default function PortalVerify() {
  const { loginWithMagicLink } = useAuth();
  const { resolvedTheme } = usePreferences();
  const navigate = useNavigate();
  const [token] = useState(() => window.location.hash.slice(1));
  const [error, setError] = useState(token ? '' : 'Este enlace no es válido. Pide uno nuevo.');
  const started = useRef(false); // el token es de un solo uso: evita el doble efecto de StrictMode

  useEffect(() => {
    window.history.replaceState(null, '', window.location.pathname);
    if (!token || started.current) return;
    started.current = true;
    loginWithMagicLink(token)
      .then(({ user }) => navigate(user.role === 'doctor' ? '/admin' : '/portal', { replace: true }))
      .catch((err) => setError(err.message));
  }, [token, loginWithMagicLink, navigate]);

  return (
    <div className="portal p-access" data-theme={resolvedTheme}>
      <main className="p-access__panel" role="status">
        {error ? (
          <>
            <h1 className="p-display">No pudimos abrir tu portal</h1>
            <p className="p-lead">{error}</p>
            <Link to="/portal/acceso" className="p-btn" style={{ alignSelf: 'flex-start' }}>Pedir un enlace nuevo</Link>
          </>
        ) : (
          <h1 className="p-display">Abriendo tu portal…</h1>
        )}
      </main>
    </div>
  );
}
