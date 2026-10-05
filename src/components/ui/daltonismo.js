// Modos para daltonismo: filtros de corrección (daltonización) sobre toda la página.
// El filtro va en <html>: es el único elemento donde `filter` no rompe los elementos
// position: fixed (botones flotantes, barra inferior del portal), así el diseño no se mueve.

export const MODOS_DALTONISMO = [
  { id: 'ninguno', label: 'Colores normales', hint: 'Sin ajuste de color' },
  { id: 'protanopia', label: 'Protanopia', hint: 'Dificultad con el rojo' },
  { id: 'deuteranopia', label: 'Deuteranopia', hint: 'Dificultad con el verde' },
  { id: 'tritanopia', label: 'Tritanopia', hint: 'Dificultad con el azul' },
  { id: 'acromatopsia', label: 'Acromatopsia', hint: 'Sin color: escala de grises' },
];

// Matriz de corrección = I + E·(I − S): S simula el tipo de daltonismo y E desplaza la
// información de color perdida hacia los canales que sí se distinguen (método de Fidaner).
const MATRICES = {
  protanopia: [
    [1, 0, 0],
    [-0.2549, 1.2549, 0],
    [0.3031, -0.5451, 1.242],
  ],
  deuteranopia: [
    [1, 0, 0],
    [-0.4375, 1.4375, 0],
    [0.2625, -0.5625, 1.3],
  ],
  tritanopia: [
    [1, 0, 0],
    [0.035, 1.532, -0.567],
    [0.035, -0.51, 1.475],
  ],
};

const SVG_ID = 'a11y-filtros-daltonismo';

const valoresMatriz = (m) =>
  m.map((fila) => [...fila, 0, 0].join(' ')).concat('0 0 0 1 0').join(' ');

// Inserta una sola vez las definiciones SVG de los filtros (invisibles, fuera del árbol de React)
function asegurarFiltros() {
  if (document.getElementById(SVG_ID)) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.id = SVG_ID;
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  const defs = document.createElementNS(ns, 'defs');
  for (const [id, m] of Object.entries(MATRICES)) {
    const filtro = document.createElementNS(ns, 'filter');
    filtro.id = `a11y-${id}`;
    filtro.setAttribute('color-interpolation-filters', 'linearRGB');
    const matriz = document.createElementNS(ns, 'feColorMatrix');
    matriz.setAttribute('type', 'matrix');
    matriz.setAttribute('values', valoresMatriz(m));
    filtro.appendChild(matriz);
    defs.appendChild(filtro);
  }
  svg.appendChild(defs);
  document.body.appendChild(svg);
}

export const filtroDaltonismo = (modo) => {
  if (MATRICES[modo]) return `url(#a11y-${modo})`;
  if (modo === 'acromatopsia') return 'grayscale(1) contrast(1.15)';
  return '';
};

/** Aplica (o quita, con 'ninguno') el modo de daltonismo en toda la página. */
export function aplicarDaltonismo(modo) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const filtro = filtroDaltonismo(modo);
  if (filtro && MATRICES[modo]) asegurarFiltros();
  root.style.filter = filtro;
  if (filtro) root.dataset.daltonismo = modo;
  else delete root.dataset.daltonismo;
}
