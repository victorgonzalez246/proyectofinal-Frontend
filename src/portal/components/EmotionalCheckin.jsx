import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { portalService } from '../../services/portalService.js';
import { MOODS } from '../config.js';

const PAIN_WORDS = ['Nada', 'Muy leve', 'Leve', 'Leve', 'Moderada', 'Moderada', 'Moderada', 'Fuerte', 'Fuerte', 'Muy fuerte', 'Insoportable'];

// Check-in emocional: si la respuesta preocupa, el servidor avisa a la clínica (n8n)
export default function EmotionalCheckin({ onSaved }) {
  const [mood, setMood] = useState('');
  const [pain, setPain] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const saved = await portalService.sendCheckin({ mood, pain, note });
      setResult(saved);
      onSaved?.(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setResult(null);
    setMood('');
    setPain(0);
    setNote('');
  };

  if (result) {
    return (
      <div className="p-panel" role="status">
        <span className={result.needsFollowUp ? 'p-chip p-chip--rose' : 'p-chip'}>
          <Check size={14} /> Registro guardado
        </span>
        <h2 className="p-title" style={{ marginTop: '0.9rem' }}>
          {result.needsFollowUp ? 'La doctora ya recibió tu aviso' : 'Gracias por contarnos'}
        </h2>
        <p className="p-lead">
          {result.needsFollowUp
            ? 'Te escribiremos por WhatsApp muy pronto para acompañarte. Si empeora, usa la línea de tranquilidad.'
            : 'Tu registro quedó en tu diario de evolución. Mañana te volvemos a preguntar.'}
        </p>
        <button type="button" className="p-link" style={{ marginTop: '1rem' }} onClick={reset}>
          Registrar otra vez
        </button>
      </div>
    );
  }

  return (
    <form className="p-panel" onSubmit={submit}>
      <h2 className="p-title" id="checkin-title">¿Cómo te sientes hoy?</h2>
      <p className="p-small" style={{ marginTop: '0.35rem' }}>Solo la doctora y su equipo ven tus respuestas.</p>

      <div className="p-moods" role="radiogroup" aria-labelledby="checkin-title">
        {MOODS.map(({ id, Icon, label }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mood === id}
            className="p-mood"
            onClick={() => setMood(id)}
          >
            <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {mood && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ marginTop: '1.5rem' }}>
              <label className="p-label" htmlFor="pain">
                Molestia en la zona tratada: <strong>{pain}</strong> de 10, {PAIN_WORDS[pain].toLowerCase()}
              </label>
              <input
                id="pain"
                type="range"
                min={0}
                max={10}
                step={1}
                value={pain}
                onChange={(e) => setPain(Number(e.target.value))}
                className="p-range"
              />
              <div className="p-range-scale" aria-hidden="true"><span>Nada</span><span>Insoportable</span></div>
            </div>

            <label className="p-label" htmlFor="checkin-note" style={{ marginTop: '1.25rem' }}>
              ¿Algo más que quieras contarnos? (opcional)
            </label>
            <textarea
              id="checkin-note"
              className="p-field"
              rows={2}
              maxLength={400}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            {error && <p className="p-error" role="alert" style={{ marginTop: '0.75rem' }}>{error}</p>}

            <button type="submit" className="p-btn p-btn--block" style={{ marginTop: '1.25rem' }} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar registro'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
