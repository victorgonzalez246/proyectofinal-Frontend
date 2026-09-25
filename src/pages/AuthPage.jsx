import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react';
import logoMain from '../assets/brand/logo-main.png';
import draLauraEditorial from '../assets/doctor/dra-laura-editorial-1.jpg'; 

const Spacer = ({ h }) => <div style={{ height: h, width: '100%', flexShrink: 0 }} aria-hidden="true" />;

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();

  const initialTab = location.state?.tab || 'login';
  const [tab, setTab] = useState(initialTab); 
  
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [welcomeModal, setWelcomeModal] = useState(null); 

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      setErrorMsg('Por favor completa todos los campos requeridos.');
      return;
    }
    try {
      setLoading(true);
      const res = await register({
        name: regName,
        email: regEmail,
        password: regPassword,
        subscribeOffers: true
      });
      setWelcomeModal({ user: res.user, coupons: res.welcomeCoupons });
    } catch (err) {
      setErrorMsg(err.message || 'Ocurrió un error al registrarte.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setErrorMsg('Ingresa tu correo y contraseña.');
      return;
    }
    try {
      setLoading(true);
      const { user } = await login({ email: loginEmail, password: loginPassword });
      if (user.role === 'doctor') {
        navigate('/admin');
      } else {
        navigate('/mi-cuenta');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const fillDoctorCredentials = () => {
    setTab('login');
    setLoginEmail('doctora@laurajimenez.com');
    setLoginPassword('Admin123!');
    setErrorMsg('');
  };

  // Clases base sin paddings de Tailwind para evitar que el plugin los sobreescriba erróneamente
  const inputBaseClass = "w-full bg-transparent border-0 border-b border-[var(--border-subtle)] focus:border-[var(--charcoal)] focus:ring-0 focus:outline-none text-[15px] tracking-wide text-[var(--charcoal)] transition-colors";
  const labelBaseClass = "block text-[11px] uppercase tracking-[0.25em] font-semibold text-[var(--stone-muted)]";

  return (
    <div className="min-h-screen flex bg-[var(--cream-bg)] text-[var(--charcoal)] font-sans selection:bg-[var(--nude-rose-20)]">
      
      {/* PANEL IZQUIERDO: Fotografía Editorial */}
      <div className="hidden lg:block lg:w-1/2 relative bg-[var(--champagne-linen)] overflow-hidden">
        <motion.img 
          initial={{ scale: 1.05, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.95 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          src={draLauraEditorial} 
          alt="Dra. Laura Jiménez"
          className="absolute inset-0 w-full h-full object-cover object-[center_top]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--cream-bg)] via-[var(--cream-bg)]/20 to-transparent opacity-80" />
        
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="absolute bottom-16 left-16 max-w-md"
        >
          <div className="w-12 h-[1px] bg-[var(--olive-maison)] mb-6" />
          <h2 className="text-4xl font-serif text-[var(--charcoal)] mb-3 leading-tight">
            Bienestar que resalta tu <span className="text-serif-italic">belleza natural.</span>
          </h2>
          <p className="text-[var(--stone-muted)] font-light leading-relaxed tracking-wide">
            Accede a tu cuenta para gestionar tus citas, revisar tu seguimiento clínico y aprovechar los beneficios exclusivos de nuestra comunidad.
          </p>
        </motion.div>
      </div>

      {/* PANEL DERECHO: Formulario */}
      <div className="w-full lg:w-1/2 flex flex-col relative min-h-screen">
        
        <header className="p-6 md:p-10 flex items-center justify-between absolute top-0 left-0 w-full z-10">
          <Link to="/">
            <img src={logoMain} alt="Logo" style={{ height: '36px', width: 'auto', objectFit: 'contain' }} />
          </Link>
          <Link 
            to="/" 
            className="text-[11px] uppercase tracking-widest font-medium text-[var(--stone-muted)] hover:text-[var(--charcoal)] transition-colors"
          >
            Volver al Inicio
          </Link>
        </header>

        <div className="flex-1 flex items-center justify-center p-6 md:p-12 mt-16 lg:mt-0">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="w-full max-w-[380px] flex flex-col items-center" 
          >
            
            {/* Tabs */}
            <div className="flex justify-center gap-10 border-b border-[var(--border-subtle)] w-full">
              <button
                type="button"
                onClick={() => { setTab('login'); setErrorMsg(''); }}
                className={`pb-4 text-[13px] uppercase tracking-[0.15em] font-medium transition-colors relative focus:outline-none ${
                  tab === 'login' ? 'text-[var(--charcoal)]' : 'text-[var(--stone-muted)] hover:text-[var(--charcoal)]'
                }`}
              >
                Iniciar Sesión
                <div className={`absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--olive-maison)] transition-opacity duration-300 ${tab === 'login' ? 'opacity-100' : 'opacity-0'}`} />
              </button>
              
              <button
                type="button"
                onClick={() => { setTab('register'); setErrorMsg(''); }}
                className={`pb-4 text-[13px] uppercase tracking-[0.15em] font-medium transition-colors relative focus:outline-none ${
                  tab === 'register' ? 'text-[var(--charcoal)]' : 'text-[var(--stone-muted)] hover:text-[var(--charcoal)]'
                }`}
              >
                Crear Cuenta
                <div className={`absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--olive-maison)] transition-opacity duration-300 ${tab === 'register' ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            </div>

            <Spacer h="40px" />

            <AnimatePresence>
              {errorMsg && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-8 w-full p-4 bg-red-50 text-red-700 text-sm flex items-center gap-3 overflow-hidden rounded-md"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  {errorMsg}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="w-full">
              <AnimatePresence mode="wait">
                
                {/* VISTA LOGIN */}
                {tab === 'login' && (
                  <motion.form 
                    key="login"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    onSubmit={handleLoginSubmit} 
                    className="w-full"
                  >
                    <div>
                      <label className={labelBaseClass}>Correo Electrónico</label>
                      <Spacer h="4px" />
                      <div className="relative">
                        <Mail className="w-5 h-5 text-[var(--stone-light)] absolute left-0 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
                        <input
                          type="email"
                          required
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className={inputBaseClass}
                          style={{ paddingBottom: '8px', paddingTop: '8px', paddingLeft: '32px' }}
                        />
                      </div>
                    </div>

                    <Spacer h="16px" />

                    <div>
                      <label className={labelBaseClass}>Contraseña</label>
                      <Spacer h="4px" />
                      <div className="relative">
                        <Lock className="w-5 h-5 text-[var(--stone-light)] absolute left-0 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
                        <input
                          type={showLoginPassword ? 'text' : 'password'}
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className={inputBaseClass}
                          style={{ paddingBottom: '8px', paddingTop: '8px', paddingLeft: '32px', paddingRight: '40px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-[var(--stone-muted)] hover:text-[var(--charcoal)]"
                        >
                          {showLoginPassword ? <EyeOff className="w-5 h-5" strokeWidth={1.5} /> : <Eye className="w-5 h-5" strokeWidth={1.5} />}
                        </button>
                      </div>
                    </div>

                    <Spacer h="24px" />

                    <button type="submit" disabled={loading} className="btn-primary w-full tracking-[0.2em] uppercase text-[13px] py-4 rounded-full">
                      {loading ? 'Iniciando...' : 'Acceder'}
                    </button>
                  </motion.form>
                )}

                {/* VISTA REGISTRO */}
                {tab === 'register' && (
                  <motion.form 
                    key="register"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    onSubmit={handleRegisterSubmit} 
                    className="w-full"
                  >
                    <div>
                      <label className={labelBaseClass}>Nombre Completo</label>
                      <Spacer h="4px" />
                      <div className="relative">
                        <User className="w-5 h-5 text-[var(--stone-light)] absolute left-0 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
                        <input
                          type="text"
                          required
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          className={inputBaseClass}
                          style={{ paddingBottom: '8px', paddingTop: '8px', paddingLeft: '32px' }}
                        />
                      </div>
                    </div>

                    <Spacer h="16px" />

                    <div>
                      <label className={labelBaseClass}>Correo Electrónico</label>
                      <Spacer h="4px" />
                      <div className="relative">
                        <Mail className="w-5 h-5 text-[var(--stone-light)] absolute left-0 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
                        <input
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          className={inputBaseClass}
                          style={{ paddingBottom: '8px', paddingTop: '8px', paddingLeft: '32px' }}
                        />
                      </div>
                    </div>

                    <Spacer h="16px" />

                    <div>
                      <label className={labelBaseClass}>Contraseña</label>
                      <Spacer h="4px" />
                      <div className="relative">
                        <Lock className="w-5 h-5 text-[var(--stone-light)] absolute left-0 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          required
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className={inputBaseClass}
                          style={{ paddingBottom: '8px', paddingTop: '8px', paddingLeft: '32px', paddingRight: '40px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-[var(--stone-muted)] hover:text-[var(--charcoal)]"
                        >
                          {showRegPassword ? <EyeOff className="w-5 h-5" strokeWidth={1.5} /> : <Eye className="w-5 h-5" strokeWidth={1.5} />}
                        </button>
                      </div>
                    </div>

                    <Spacer h="24px" />

                    <button type="submit" disabled={loading} className="btn-primary w-full tracking-[0.2em] uppercase text-[13px] py-4 rounded-full">
                      {loading ? 'Procesando...' : 'Registrarme'}
                    </button>
                  </motion.form>
                )}

              </AnimatePresence>
            </div>

            <Spacer h="48px" />

            <div className="text-center w-full">
              <button
                type="button"
                onClick={fillDoctorCredentials}
                className="text-[11px] uppercase tracking-[0.25em] font-medium text-[var(--stone-muted)] hover:text-[var(--charcoal)] transition-colors inline-flex items-center justify-center gap-2"
              >
                ¿Eres parte del equipo? <span className="underline underline-offset-4 decoration-[var(--border-subtle)] hover:decoration-[var(--charcoal)] transition-colors">Acceso Médico</span>
                <ArrowRight size={12} strokeWidth={1.5} />
              </button>
            </div>

          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {welcomeModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-sm w-full p-10 shadow-2xl text-center"
            >
              <div className="w-14 h-14 rounded-full bg-[var(--champagne-linen)] flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl">✨</span>
              </div>
              <h3 className="text-3xl font-serif text-[var(--charcoal)] mb-3">
                ¡Bienvenida(o)!
              </h3>
              <p className="text-sm text-[var(--stone-muted)] mb-10 leading-relaxed tracking-wide">
                Tu cuenta ha sido creada. Hemos enviado los detalles a <strong className="text-[var(--charcoal)]">{welcomeModal.user.email}</strong>.
              </p>
              <button onClick={() => navigate('/mi-cuenta')} className="btn-primary w-full tracking-widest uppercase text-xs py-4 rounded-full">
                Entrar a mi Panel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
