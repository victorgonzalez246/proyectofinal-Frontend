import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

/**
 * Guardián de rutas protegidas
 * @param {string[]} allowedRoles - Roles que tienen permiso para acceder a esta ruta
 */
export default function ProtectedRoute({ allowedRoles = [] }) {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    // Si es miembro intentando entrar a zona médica, mandar a portal paciente
    if (role === 'member') {
      return <Navigate to="/mi-cuenta" replace />;
    }
    // Si es doctora intentando entrar a otra ruta
    if (role === 'doctor') {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
