import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import LandingPage from './pages/LandingPage.jsx';
import PrivacyPage from './pages/PrivacyPage.jsx';
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
const PortalFacturas = lazy(() => import('./portal/pages/PortalFacturas.jsx'));
const PortalTratamientos = lazy(() => import('./portal/pages/PortalTratamientos.jsx'));

// Panel de la doctora: también bajo demanda
const AdminLayout = lazy(() => import('./admin/AdminLayout.jsx'));
const AdminHoy = lazy(() => import('./admin/pages/AdminHoy.jsx'));
const AdminCitas = lazy(() => import('./admin/pages/AdminCitas.jsx'));
const AdminMetricas = lazy(() => import('./admin/pages/AdminMetricas.jsx'));
const AdminPacientes = lazy(() => import('./admin/pages/AdminPacientes.jsx'));
const AdminPaciente = lazy(() => import('./admin/pages/AdminPaciente.jsx'));
const AdminAlertas = lazy(() => import('./admin/pages/AdminAlertas.jsx'));
const AdminCampanas = lazy(() => import('./admin/pages/AdminCampanas.jsx'));
const AdminEstadisticas = lazy(() => import('./admin/pages/AdminEstadisticas.jsx'));
const AdminFacturas = lazy(() => import('./admin/pages/AdminFacturas.jsx'));

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={null}>
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/privacidad" element={<PrivacyPage />} />
          {/* Acceso único (pacientes y doctora): enlace mágico por WhatsApp */}
          <Route path="/portal/acceso" element={<PortalAccess />} />
          <Route path="/portal/verificar" element={<PortalVerify />} />
          <Route path="/auth" element={<Navigate to="/portal/acceso" replace />} />
          <Route path="/login" element={<Navigate to="/portal/acceso" replace />} />

          {/* Ruta Protegida: Portal privado de pacientes */}
          <Route element={<ProtectedRoute allowedRoles={['member']} />}>
            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<PortalHome />} />
              <Route path="mapa" element={<PortalMap />} />
              <Route path="cuidados" element={<PortalCare />} />
              <Route path="evolucion" element={<PortalEvolution />} />
              <Route path="clinica" element={<PortalClinic />} />
              <Route path="facturas" element={<PortalFacturas />} />
              <Route path="pagos" element={<Navigate to="/portal/facturas" replace />} />
              <Route path="tratamientos" element={<PortalTratamientos />} />
            </Route>
          </Route>
          <Route path="/mi-cuenta" element={<Navigate to="/portal" replace />} />

          {/* Ruta Protegida: Exclusiva Dra. Laura Jiménez (Administración) */}
          <Route element={<ProtectedRoute allowedRoles={['doctor']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminHoy />} />
              <Route path="citas" element={<AdminCitas />} />
              <Route path="metricas" element={<AdminMetricas />} />
              <Route path="pacientes" element={<AdminPacientes />} />
              <Route path="pacientes/:id" element={<AdminPaciente />} />
              <Route path="alertas" element={<AdminAlertas />} />
              <Route path="campanas" element={<AdminCampanas />} />
              <Route path="estadisticas" element={<AdminEstadisticas />} />
              <Route path="facturas" element={<AdminFacturas />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
