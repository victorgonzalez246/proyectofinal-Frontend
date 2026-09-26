import { Fragment } from 'react';
import Sensitive from './Sensitive.jsx';
import { ROADMAP_KINDS } from '../config.js';
import { formatDate, relativeDays, toDate } from '../lib/format.js';

const STATUS_CHIP = {
  current: { label: 'Estás aquí', className: 'p-chip p-chip--rose' },
  next: { label: 'Próximo paso', className: 'p-chip' },
};

// Mapa de belleza: línea de tiempo vertical del plan diseñado por la doctora.
// El tallo es sólido en lo ya vivido y punteado en lo que viene.
export default function BeautyMap({ items }) {
  return (
    <ol className="bmap" aria-label="Mapa de belleza">
      {items.map((item, index) => {
        const date = toDate(item.date);
        const year = date.getFullYear();
        const previous = items[index - 1];
        const showYear = !previous || toDate(previous.date).getFullYear() !== year;
        // El tramo de tallo antes del año sigue el estado del paso anterior
        const yearRailStatus = previous?.status;
        const chip = STATUS_CHIP[item.status];
        const isFuture = item.status === 'next' || item.status === 'future';
        const railStyle = { '--i': index };

        return (
          <Fragment key={item.id}>
            {showYear && (
              <li
                className="bmap__year bmap__item"
                data-status={yearRailStatus === 'current' ? 'next' : yearRailStatus || 'done'}
                data-first={index === 0}
                aria-hidden="true"
              >
                <span className="bmap__when" />
                <span className="bmap__rail" style={railStyle} />
                <span>{year}</span>
              </li>
            )}
            <li className="bmap__item" data-status={item.status} data-kind={item.kind}>
              <div className="bmap__when">
                <time dateTime={item.date}>
                  <span className="bmap__day">{date.getDate()}</span>
                  <span className="bmap__month">{formatDate(date, { month: 'short' })}</span>
                </time>
              </div>
              <div className="bmap__rail" style={railStyle} aria-hidden="true">
                <span className="bmap__node" />
              </div>
              <div className="bmap__body">
                <div className={item.status === 'current' ? 'bmap__card' : undefined}>
                  <div className="bmap__meta">
                    {chip && <span className={chip.className}>{chip.label}</span>}
                    <span className="p-small">
                      {ROADMAP_KINDS[item.kind] || 'Paso'}
                      {isFuture && `, ${relativeDays(item.date)}`}
                    </span>
                  </div>
                  <Sensitive as="h3" className="bmap__title">{item.title}</Sensitive>
                  {item.note && <Sensitive as="p" className="bmap__note">{item.note}</Sensitive>}
                </div>
              </div>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
