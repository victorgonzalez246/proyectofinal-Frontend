import { LogOut } from 'lucide-react';
import Sheet from './Sheet.jsx';

const THEMES = [
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Oscuro' },
  { id: 'system', label: 'Automático' },
];

const TEXT_SIZES = [
  { value: 1, label: 'A', hint: 'Normal' },
  { value: 1.15, label: 'A+', hint: 'Grande' },
  { value: 1.3, label: 'A++', hint: 'Muy grande' },
];

function Switch({ id, checked, onChange }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      className="p-switch"
      onClick={() => onChange(!checked)}
    />
  );
}

// Apariencia y accesibilidad: tema, tamaño de texto, contraste y movimiento
export default function SettingsSheet({ prefs, update, onClose, onLogout }) {
  return (
    <Sheet labelledBy="settings-title" onClose={onClose}>
      <h2 id="settings-title" className="p-title">Apariencia y accesibilidad</h2>

      <div className="p-setting" style={{ marginTop: '1rem' }}>
        <p className="p-label" id="theme-label">Tema</p>
        <div className="p-seg" role="group" aria-labelledby="theme-label">
          {THEMES.map((t) => (
            <button key={t.id} type="button" aria-pressed={prefs.theme === t.id} onClick={() => update({ theme: t.id })}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-setting">
        <p className="p-label" id="text-label">Tamaño del texto</p>
        <div className="p-seg" role="group" aria-labelledby="text-label">
          {TEXT_SIZES.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={prefs.textScale === s.value}
              aria-label={s.hint}
              onClick={() => update({ textScale: s.value })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-setting">
        <div className="p-setting__row">
          <label className="p-subtitle" htmlFor="contrast-switch">Alto contraste</label>
          <Switch
            id="contrast-switch"
            checked={prefs.contrast === 'high'}
            onChange={(on) => update({ contrast: on ? 'high' : 'normal' })}
          />
        </div>
        <p className="p-small">Textos más oscuros y enlaces subrayados.</p>
      </div>

      <div className="p-setting">
        <div className="p-setting__row">
          <label className="p-subtitle" htmlFor="motion-switch">Reducir animaciones</label>
          <Switch id="motion-switch" checked={prefs.reduceMotion} onChange={(on) => update({ reduceMotion: on })} />
        </div>
        <p className="p-small">Detiene los movimientos decorativos.</p>
      </div>

      <div className="p-setting">
        <div className="p-setting__row">
          <label className="p-subtitle" htmlFor="discreet-switch">Modo discreto</label>
          <Switch id="discreet-switch" checked={prefs.discreet} onChange={(on) => update({ discreet: on })} />
        </div>
        <p className="p-small">Desenfoca tus fotos y los nombres de tus tratamientos.</p>
      </div>

      <button type="button" className="p-btn p-btn--quiet p-btn--block" style={{ marginTop: '1.5rem' }} onClick={onLogout}>
        <LogOut size={18} /> Cerrar sesión
      </button>
    </Sheet>
  );
}
