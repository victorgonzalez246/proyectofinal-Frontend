import { Check, Ban } from 'lucide-react';
import { formatUntil } from '../lib/format.js';

// Lista de cuidados: los "hacer" se marcan, los "NO" absolutos muestran su vigencia
export default function CareList({ items, doneIds, onToggle }) {
  return (
    <ul className="p-care">
      {items.map((item) => {
        const done = doneIds.includes(item.id);
        const when = item.expired
          ? item.type === 'dont' ? 'Ya puedes retomarlo' : 'Etapa cumplida'
          : `Hasta el ${formatUntil(item.until)}`;

        const content = (
          <>
            <span className="p-care__mark" aria-hidden="true">
              {item.type === 'dont' ? <Ban size={16} /> : <Check size={16} />}
            </span>
            <span>
              <span className="p-care__text sensitive">{item.text}</span>
              <span className="p-care__when">{when}</span>
            </span>
          </>
        );

        return (
          <li
            key={item.id}
            className="p-care__item"
            data-type={item.type}
            data-done={item.type === 'do' && done}
            data-expired={item.expired}
          >
            {item.type === 'do' && onToggle ? (
              <button
                type="button"
                role="checkbox"
                aria-checked={done}
                className="p-care__toggle"
                onClick={() => onToggle(item.id)}
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}
