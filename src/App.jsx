import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import LandingPage from './pages/LandingPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import DoctorDashboardPage from './pages/DoctorDashboardPage.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';

// Portal de pacientes: se carga bajo demanda para no pesar en la landing
const PortalAccess = lazy(() => import('./portal/pages/PortalAccess.jsx'));
const PortalVerify = lazy(() => import('./portal/pages/PortalVerify.jsx'));
const PortalLayout = lazy(() => import('./portal/PortalLayout.jsx'));
const PortalHome = lazy(() => import('./portal/pages/PortalHome.jsx'));
const PortalMap = lazy(() => import('./portal/pages/PortalMap.jsx'));
const PortalCare = lazy(() => import('./portal/pages/PortalCare.jsx'));
const PortalEvolution = lazy(() => import('./portal/pages/PortalEvolution.jsx'));
const PortalClinic = lazy(() => import('./portal/pages/PortalClinic.jsx'));

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={null}>
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/portal/acceso" element={<PortalAccess />} />
          <Route path="/portal/verificar" element={<PortalVerify />} />

          {/* Ruta Protegida: Portal privado de pacientes */}
          <Route element={<ProtectedRoute allowedRoles={['member']} redirectTo="/portal/acceso" />}>
            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<PortalHome />} />
              <Route path="mapa" element={<PortalMap />} />
              <Route path="cuidados" element={<PortalCare />} />
              <Route path="evolucion" element={<PortalEvolution />} />
              <Route path="clinica" element={<PortalClinic />} />
            </Route>
          </Route>
          <Route path="/mi-cuenta" element={<Navigate to="/portal" replace />} />

          {/* Ruta Protegida: Exclusiva Dra. Laura Jiménez (Administración) */}
          <Route element={<ProtectedRoute allowedRoles={['doctor']} />}>
            <Route path="/admin" element={<DoctorDashboardPage />} />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
