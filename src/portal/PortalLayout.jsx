import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { House, Route, Images, ListChecks, Gem, Eye, EyeOff, Moon, Sun, Accessibility } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { portalService } from '../services/portalService.js';
import { PortalContext } from './usePortal.js';
import { usePreferences } from './usePreferences.js';
import SosButton from './components/SosButton.jsx';
import SettingsSheet from './components/SettingsSheet.jsx';
import AsistenteVirtual from '../components/asistente/AsistenteVirtual.jsx';
import { RECOVERY_WINDOW_DAYS } from './config.js';
import { daysBetween } from './lib/format.js';
// Nota: los nombres de los archivos de marca están cruzados; logo-isotipo.png es el logo blanco con transparencia
import logoColor from '../assets/brand/logo-main.png';
import logoWhite from '../assets/brand/logo-isotipo.png';
import './portal.css';

const NAV = [
  { to: '/portal', label: 'Inicio', Icon: House, end: true },
  { to: '/portal/mapa', label: 'Mi mapa', Icon: Route },
  { to: '/portal/cuidados', label: 'Cuidados', Icon: ListChecks },
  { to: '/portal/evolucion', label: 'Evolución', Icon: Images },
  { to: '/portal/clinica', label: 'Mi clínica', Icon: Gem },
];

const fetchPortalState = async () => {
  try {
    const [portal, checkins] = await Promise.all([portalService.getPortal(), portalService.getCheckins()]);
    return { portal, checkins, loading: false, error: '' };
  } catch {
    return { portal: null, checkins: [], loading: false, error: 'No pudimos cargar tu portal. Revisa tu conexión e intenta de nuevo.' };
  }
};

export default function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { prefs, update, resolvedTheme } = usePreferences();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [state, setState] = useState({ portal: null, checkins: [], loading: true, error: '' });

  const load = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    return fetchPortalState().then(setState);
  }, []);

  useEffect(() => {
    let active = true;
    fetchPortalState().then((next) => { if (active) setState(next); });
    return () => { active = false; };
  }, []);

  // El título de la pestaña nunca revela la clínica ni el tratamiento
  useEffect(() => {
    const previous = document.title;
    document.title = 'Portal privado';
    return () => { document.title = previous; };
  }, []);

  const toggleCare = useCallback(async (itemId) => {
    const current = state.portal?.careDone || [];
    const next = current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId];
    setState((prev) => ({ ...prev, portal: { ...prev.portal, careDone: next } })); // optimista
    try {
      await portalService.saveCare(next);
    } catch {
      setState((prev) => ({ ...prev, portal: { ...prev.portal, careDone: current } }));
    }
  }, [state.portal]);

  const addCheckin = useCallback((checkin) => {
    setState((prev) => ({ ...prev, checkins: [checkin, ...prev.checkins] }));
  }, []);

  const handleLogout = () => {
    setSettingsOpen(false);
    logout();
    navigate('/portal/acceso', { replace: true });
  };

  const lastTreatment = state.portal?.lastTreatment;
  const recoveryDay = lastTreatment ? daysBetween(lastTreatment.date) + 1 : null;
  const inRecovery = recoveryDay !== null && recoveryDay <= RECOVERY_WINDOW_DAYS;

  const value = useMemo(
    () => ({ user, ...state, reload: load, toggleCare, addCheckin, recoveryDay, inRecovery, prefs }),
    [user, state, load, toggleCare, addCheckin, recoveryDay, inRecovery, prefs]
  );

  return (
    <MotionConfig reducedMotion={prefs.reduceMotion ? 'always' : 'user'}>
      <div
        className="portal"
        data-theme={resolvedTheme}
        data-discreet={prefs.discreet}
        data-contrast={prefs.contrast}
        data-motion={prefs.reduceMotion ? 'reduced' : 'full'}
      >
        <a href="#portal-main" className="p-skip">Saltar al contenido</a>
        <div className="p-shell">
          <header className="p-header">
            <NavLink to="/portal" className="p-header__brand" aria-label="Inicio del portal">
              <img src={resolvedTheme === 'dark' ? logoWhite : logoColor} alt="" />
            </NavLink>
            <div className="p-header__tools">
              <button
                type="button"
                className="p-icon-btn"
                aria-pressed={prefs.discreet}
                onClick={() => update({ discreet: !prefs.discreet })}
                aria-label="Modo discreto"
                title="Desenfoca tus fotos y los nombres de tus tratamientos"
              >
                {prefs.discreet ? <EyeOff size={19} /> : <Eye size={19} />}
                <span className="p-icon-btn__label" aria-hidden="true">Modo discreto</span>
              </button>
              <button
                type="button"
                className="p-icon-btn"
                onClick={() => update({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' })}
                aria-label={resolvedTheme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              >
                {resolvedTheme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
              </button>
              <button
                type="button"
                className="p-icon-btn"
                onClick={() => setSettingsOpen(true)}
                aria-label="Apariencia y accesibilidad"
              >
                <Accessibility size={19} />
              </button>
            </div>
          </header>

          <nav className="p-nav" aria-label="Secciones del portal">
            {NAV.map(({ to, label, Icon, end }) => (
              <NavLink key={to} to={to} end={end} className="p-nav__link">
                <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
            <p className="p-sidebar-foot">
              Tus datos solo los ven la Dra. Laura y su equipo.
            </p>
          </nav>

          <main id="portal-main" className="p-main" tabIndex={-1}>
            <PortalContext.Provider value={value}>
              {state.loading ? (
                <p className="p-small" role="status">Cargando tu portal…</p>
              ) : state.error ? (
                <div className="p-empty" role="alert">
                  <p>{state.error}</p>
                  <button type="button" className="p-btn p-btn--quiet" style={{ marginTop: '1rem' }} onClick={load}>
                    Reintentar
                  </button>
                </div>
              ) : (
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Outlet />
                </motion.div>
              )}
            </PortalContext.Provider>
          </main>
        </div>

        <SosButton recent={inRecovery} />
        <AsistenteVirtual variante="portal" />

        <AnimatePresence>
          {settingsOpen && (
            <SettingsSheet
              prefs={prefs}
              update={update}
              onClose={() => setSettingsOpen(false)}
              onLogout={handleLogout}
            />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
