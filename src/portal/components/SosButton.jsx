import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { HeartHandshake, Phone, Check } from 'lucide-react';
import Sheet from './Sheet.jsx';
import { portalService } from '../../services/portalService.js';
import { CLINIC_PHONE, CLINIC_PHONE_LABEL } from '../config.js';

const REASONS = [
  { id: 'dolor', label: 'Tengo dolor fuerte' },
  { id: 'inflamacion', label: 'La inflamación aumentó' },
  { id: 'aspecto', label: 'Algo no se ve como esperaba' },
  { id: 'duda', label: 'Tengo una duda urgente' },
];

// Línea de tranquilidad: avisa a la clínica (n8n → WhatsApp) para asistencia inmediata
export default function SosButton({ recent }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent
  const [error, setError] = useState('');

  const close = () => {
    setOpen(false);
    // Tras enviar, la próxima apertura empieza de cero
    if (status === 'sent') {
      setStatus('idle');
      setReason('');
      setNote('');
    }
  };

  const send = async () => {
    setError('');
    setStatus('sending');
    try {
      await portalService.sendSos({ reason, note });
      setStatus('sent');
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  return (
    <>
      <button type="button" className="p-sos" data-recent={recent} onClick={() => setOpen(true)}>
        <HeartHandshake size={20} />
        Línea de tranquilidad
      </button>

      <AnimatePresence>
        {open && (
          <Sheet labelledBy="sos-title" onClose={close}>
            {status === 'sent' ? (
              <div role="status">
                <span className="p-chip"><Check size={14} /> Aviso enviado</span>
                <h2 id="sos-title" className="p-title" style={{ marginTop: '1rem' }}>
                  La clínica ya sabe que nos necesitas
                </h2>
                <p className="p-lead">
                  Te escribimos por WhatsApp en los próximos minutos. Mantén tu teléfono cerca.
                </p>
                <a className="p-btn p-btn--quiet p-btn--block" href={`tel:${CLINIC_PHONE}`} style={{ marginTop: '1.5rem' }}>
                  <Phone size={18} /> Llamar ahora al {CLINIC_PHONE_LABEL}
                </a>
                <p className="p-note" style={{ marginTop: '1rem' }}>
                  Si tienes dificultad para respirar, hinchazón en la garganta o dolor en el pecho, llama al 911.
                </p>
              </div>
            ) : (
              <>
                <h2 id="sos-title" className="p-title">¿Qué está pasando?</h2>
                <p className="p-lead">Elige lo que más se parece. La doctora recibe tu aviso al instante.</p>

                <div className="p-options" role="radiogroup" aria-labelledby="sos-title">
                  {REASONS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={reason === r.id}
                      className="p-option"
                      onClick={() => setReason(r.id)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                <label className="p-label" htmlFor="sos-note">Cuéntanos más (opcional)</label>
                <textarea
                  id="sos-note"
                  className="p-field"
                  rows={2}
                  maxLength={400}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />

                {error && <p className="p-error" role="alert" style={{ marginTop: '0.75rem' }}>{error}</p>}

                <button
                  type="button"
                  className="p-btn p-btn--alert p-btn--block"
                  style={{ marginTop: '1.25rem' }}
                  disabled={!reason || status === 'sending'}
                  onClick={send}
                >
                  {status === 'sending' ? 'Avisando…' : 'Avisar a la clínica'}
                </button>
                <p className="p-note" style={{ marginTop: '1rem' }}>
                  Si es una emergencia médica, llama al 911.
                </p>
              </>
            )}
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}
