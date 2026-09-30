import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CalendarCheck, CalendarDays, ChartColumn, Users, BellRing, Megaphone, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { usePreferences } from '../portal/usePreferences.js';
import ControlAccesibilidad from '../components/ui/ControlAccesibilidad.jsx';
// Nota: los nombres de los archivos de marca están cruzados; logo-isotipo.png es el logo blanco con transparencia
import logoColor from '../assets/brand/logo-main.png';
import logoWhite from '../assets/brand/logo-isotipo.png';
import '../portal/portal.css';
import './admin.css';

const NAV = [
  { to: '/admin', label: 'Hoy', Icon: CalendarCheck, end: true },
  { to: '/admin/citas', label: 'Citas', Icon: CalendarDays },
  { to: '/admin/metricas', label: 'Métricas', Icon: ChartColumn },
  { to: '/admin/pacientes', label: 'Pacientes', Icon: Users },
  { to: '/admin/alertas', label: 'Alertas', Icon: BellRing },
  { to: '/admin/campanas', label: 'Campañas', Icon: Megaphone },
];

// Panel de la doctora: mismo sistema visual que el portal de pacientes (tokens, tema claro/oscuro)
export default function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { prefs, update, resolvedTheme } = usePreferences();

  useEffect(() => {
    const previous = document.title;
    document.title = 'Panel médico';
    return () => { document.title = previous; };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/portal/acceso', { replace: true });
  };

  return (
    <div
      className="portal"
      data-theme={resolvedTheme}
      data-contrast={prefs.contrast}
      data-motion={prefs.reduceMotion ? 'reduced' : 'full'}
    >
      <a href="#admin-main" className="p-skip">Saltar al contenido</a>
      <div className="p-shell">
        <header className="p-header">
          <NavLink to="/admin" className="p-header__brand" aria-label="Inicio del panel">
            <img src={resolvedTheme === 'dark' ? logoWhite : logoColor} alt="" />
          </NavLink>
          <div className="p-header__tools">
            <span className="a-badge">Panel médico</span>
            <button
              type="button"
              className="p-icon-btn"
              onClick={() => update({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' })}
              aria-label={resolvedTheme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            >
              {resolvedTheme === 'dark' ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
            </button>
            <ControlAccesibilidad prefs={prefs} update={update} variante="cabecera" />
            <button type="button" className="p-icon-btn" onClick={handleLogout} aria-label="Cerrar sesión">
              <LogOut size={19} aria-hidden="true" />
              <span className="p-icon-btn__label" aria-hidden="true">Salir</span>
            </button>
          </div>
        </header>

        <nav className="p-nav a-nav" aria-label="Secciones del panel">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="p-nav__link">
              <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
          <p className="p-sidebar-foot">La sesión del panel se cierra sola a las 4 horas.</p>
        </nav>

        <main id="admin-main" className="p-main a-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
