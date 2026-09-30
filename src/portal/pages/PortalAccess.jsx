import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { authService } from '../../services/authService.js';
import { usePreferences } from '../usePreferences.js';
import logoMain from '../../assets/brand/logo-main.png';
import logoMainWhite from '../../assets/brand/logo-isotipo.png'; // logo blanco con transparencia
import draLaura from '../../assets/doctor/dra-laura-editorial-2.jpg';
import '../portal.css';

// Acceso sin contraseña (pacientes y doctora): se recibe por WhatsApp un código de 6 dígitos de un solo uso
// (plantilla de Autenticación de Meta). En desarrollo, el simulador además muestra el código y un enlace directo.
export default function PortalAccess() {
  const { isMember, isDoctor, loginWithCode } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [devCode, setDevCode] = useState('');
  const { resolvedTheme } = usePreferences();
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent
  const [devLink, setDevLink] = useState('');
  const [error, setError] = useState('');

  if (isMember) return <Navigate to="/portal" replace />;
  if (isDoctor) return <Navigate to="/admin" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (phone.replace(/\D/g, '').length < 8) {
      setError('Escribe los 8 dígitos de tu número de WhatsApp.');
      return;
    }
    setStatus('sending');
    try {
      const data = await authService.requestMagicLink(`+506 ${phone}`);
      setDevLink(data.devLink || '');
      setDevCode(data.devCodigo || '');
      setStatus('sent');
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setCodeError('');
    if (!/^\d{6}$/.test(code)) {
      setCodeError('Escribe los 6 dígitos del código que te llegó por WhatsApp.');
      return;
    }
    setVerifying(true);
    try {
      const { user } = await loginWithCode(`+506 ${phone}`, code);
      navigate(user.role === 'doctor' ? '/admin' : '/portal', { replace: true });
    } catch (err) {
      setCodeError(err.message);
      setVerifying(false);
    }
  };

  const reset = () => {
    setStatus('idle');
    setDevLink('');
    setDevCode('');
    setCode('');
    setCodeError('');
  };

  return (
    <div className="portal p-access" data-theme={resolvedTheme}>
      <figure className="p-access__art">
        <img src={draLaura} alt="Dra. Laura Jiménez" />
        <figcaption>“Cuidarte no termina cuando sales de la clínica.”</figcaption>
      </figure>

      <main className="p-access__panel">
        <Link to="/" aria-label="Volver al sitio de la clínica" style={{ alignSelf: 'flex-start' }}>
          <img src={resolvedTheme === 'dark' ? logoMainWhite : logoMain} alt="Dra. Laura Jiménez" style={{ height: '3rem', width: 'auto' }} />
        </Link>

        {status === 'sent' ? (
          <form onSubmit={verify} noValidate>
            <h1 className="p-display">Revisa tu WhatsApp</h1>
            <p className="p-lead" role="status">
              Si tu número está registrado en la clínica, te llega un código de 6 dígitos. Vale por 15 minutos y
              funciona una sola vez.
            </p>

            <label className="p-label" htmlFor="code" style={{ marginTop: '2rem' }}>Código de acceso</label>
            <input
              id="code"
              className="p-field p-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={7}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              aria-describedby={codeError ? 'code-error' : 'code-hint'}
              aria-invalid={Boolean(codeError)}
              autoFocus
            />
            <p id="code-hint" className="p-note" style={{ marginTop: '0.5rem' }}>Enviado al +506 {phone}.</p>
            {codeError && <p id="code-error" className="p-error" role="alert" style={{ marginTop: '0.5rem' }}>{codeError}</p>}

            <button type="submit" className="p-btn p-btn--block" style={{ marginTop: '1.25rem' }} disabled={verifying}>
              {verifying ? 'Verificando…' : 'Entrar'}
            </button>

            {(devCode || devLink) && (
              <div className="p-dev" style={{ marginTop: '1.5rem' }}>
                <p style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Modo desarrollo: n8n no está conectado.</p>
                {devCode && <p>Tu código es <strong>{devCode}</strong>.</p>}
                {devLink && <a href={devLink} className="p-link">O abre el enlace de acceso</a>}
              </div>
            )}
            <button type="button" className="p-link" style={{ marginTop: '1.5rem' }} onClick={reset}>
              Usar otro número o pedir otro código
            </button>
          </form>
        ) : (
          <form onSubmit={submit} noValidate>
            <h1 className="p-display">Tu espacio privado con la Dra. Laura</h1>
            <p className="p-lead">Sin contraseñas: te enviamos un código de acceso a tu WhatsApp.</p>

            <label className="p-label" htmlFor="phone" style={{ marginTop: '2rem' }}>Número de WhatsApp</label>
            <div className="p-phone">
              <span className="p-phone__prefix" aria-hidden="true">+506</span>
              <input
                id="phone"
                className="p-field"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="8888 8888"
                maxLength={12}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-describedby={error ? 'phone-error' : undefined}
                aria-invalid={Boolean(error)}
              />
            </div>
            {error && <p id="phone-error" className="p-error" role="alert" style={{ marginTop: '0.5rem' }}>{error}</p>}

            <button type="submit" className="p-btn p-btn--block" style={{ marginTop: '1.25rem' }} disabled={status === 'sending'}>
              <MessageCircle size={18} />
              {status === 'sending' ? 'Enviando…' : 'Enviar código por WhatsApp'}
            </button>

            <p className="p-note" style={{ marginTop: '1.5rem' }}>
              Al entrar aceptas el <Link to="/privacidad" className="p-link">aviso de privacidad</Link>.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
