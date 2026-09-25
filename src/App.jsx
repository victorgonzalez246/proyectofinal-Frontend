import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import LandingPage from './pages/LandingPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import MemberPortalPage from './pages/MemberPortalPage.jsx';
import DoctorDashboardPage from './pages/DoctorDashboardPage.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Rutas Públicas */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/login" element={<AuthPage />} />

        {/* Ruta Protegida: Paciente / Miembro del Club de Beneficios */}
        <Route element={<ProtectedRoute allowedRoles={['member', 'doctor']} />}>
          <Route path="/mi-cuenta" element={<MemberPortalPage />} />
        </Route>

        {/* Ruta Protegida: Exclusiva Dra. Laura Jiménez (Administración) */}
        <Route element={<ProtectedRoute allowedRoles={['doctor']} />}>
          <Route path="/admin" element={<DoctorDashboardPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
