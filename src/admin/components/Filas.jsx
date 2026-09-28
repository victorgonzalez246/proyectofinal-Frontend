import { Plus } from 'lucide-react';

// Campo de formulario según su tipo (texto, fecha, número, lista…)
export function Campo({ id, campo, value, onChange }) {
  const comun = { id, className: 'p-field', value: value ?? '', required: campo.required };
  let control;
  if (campo.type === 'select') {
    control = (
      <select {...comun} onChange={(e) => onChange(e.target.value)}>
        {campo.options.map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
      </select>
    );
  } else if (campo.type === 'textarea') {
    control = <textarea {...comun} rows={2} maxLength={campo.max} onChange={(e) => onChange(e.target.value)} />;
  } else {
    control = (
      <input
        {...comun}
        type={campo.type || 'text'}
        min={campo.min}
        max={campo.type === 'number' ? campo.maxValue : undefined}
        maxLength={campo.type === 'number' ? undefined : campo.max}
        placeholder={campo.placeholder}
        onChange={(e) => onChange(campo.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
      />
    );
  }
  return (
    <div style={campo.wide ? { gridColumn: '1 / -1' } : undefined}>
      <label className="p-label" htmlFor={id}>{campo.label}</label>
      {control}
    </div>
  );
}

// Lista de filas repetibles (pasos del mapa, cuidados, paquetes, productos, videos)
export default function Filas({ id, titulo, ayuda, items, campos, nuevo, onChange, etiqueta }) {
  const cambiar = (i, key, valor) => onChange(items.map((item, j) => (j === i ? { ...item, [key]: valor } : item)));
  const quitar = (i) => onChange(items.filter((_, j) => j !== i));

  return (
    <fieldset className="a-fieldset">
      <legend>{titulo}</legend>
      {ayuda && <p className="p-small">{ayuda}</p>}
      {items.length === 0 && <p className="p-small">Sin elementos todavía.</p>}
      {items.map((item, i) => (
        <div key={item._key} className="a-row">
          <div className="a-grid">
            {campos.map((campo) => (
              <Campo
                key={campo.key}
                id={`${id}-${item._key}-${campo.key}`}
                campo={campo}
                value={item[campo.key]}
                onChange={(valor) => cambiar(i, campo.key, valor)}
              />
            ))}
          </div>
          <div className="a-row__foot">
            <button type="button" className="a-remove" onClick={() => quitar(i)}>Quitar {etiqueta}</button>
          </div>
        </div>
      ))}
      <button type="button" className="p-btn p-btn--quiet a-add" onClick={() => onChange([...items, { ...nuevo(), _key: crypto.randomUUID() }])}>
        <Plus size={16} /> Agregar {etiqueta}
      </button>
    </fieldset>
  );
}
