// Lectura en voz alta de la página (Web Speech API, voz en español).
// Un solo lector para todo el sitio: lo controlan el botón "Leer página" (LectorVoz),
// los ajustes del portal y Aura desde el chat ("lee la página", "detén la lectura").

export const VELOCIDADES = [0.8, 1, 1.2, 1.5];

const INICIAL = { estado: 'inactivo', indice: -1, total: 0, velocidad: 1 }; // estado: inactivo | leyendo | pausado
let estado = INICIAL;
const oyentes = new Set();
let bloques = [];
let actual = null; // frase en curso: sus eventos solo avanzan si sigue siendo la actual
let resaltado = null;

const emitir = (patch) => {
  estado = { ...estado, ...patch };
  oyentes.forEach((fn) => fn());
};

export const lecturaSoportada = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

export const suscribirLectura = (fn) => {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
};
export const estadoLectura = () => estado;

const ETIQUETAS = ['H1', 'H2', 'H3', 'H4', 'P', 'LI', 'TD', 'TH', 'LABEL', 'FIGCAPTION', 'DT', 'DD', 'SPAN', 'STRONG', 'EM', 'A', 'BUTTON'];

// Extrae el texto legible del contenido principal (sin lo oculto ni lo decorativo)
export function extraerTextos(contenedor) {
  if (!contenedor) return [];
  const encontrados = [];
  const walker = document.createTreeWalker(contenedor, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (node.getAttribute('aria-hidden') === 'true' || node.hidden) return NodeFilter.FILTER_REJECT;
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
      return ETIQUETAS.includes(node.tagName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });

  const vistos = new Set();
  let nodo;
  while ((nodo = walker.nextNode())) {
    // Solo el texto directo del nodo (los hijos se procesan por separado)
    const texto = Array.from(nodo.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (texto.length > 1 && !vistos.has(texto)) {
      vistos.add(texto);
      encontrados.push({ elemento: nodo, texto });
    }
  }
  return encontrados;
}

// Busca una voz en español
function obtenerVoz() {
  const voces = speechSynthesis.getVoices();
  return (
    voces.find((v) => v.lang === 'es-CR') ||
    voces.find((v) => v.lang === 'es-MX') ||
    voces.find((v) => v.lang.startsWith('es')) ||
    voces[0] ||
    null
  );
}

function resaltar(elemento) {
  resaltado?.classList.remove('lector-resaltado');
  resaltado = elemento || null;
  if (elemento) {
    elemento.classList.add('lector-resaltado');
    elemento.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }
}

// Cancela lo que se esté diciendo sin que su onend/onerror avance de bloque
function callar() {
  actual = null;
  if (lecturaSoportada()) speechSynthesis.cancel();
}

function leerBloque(idx) {
  callar();
  if (idx < 0 || idx >= bloques.length) {
    detenerLectura();
    return;
  }
  const { elemento, texto } = bloques[idx];
  resaltar(elemento);
  emitir({ estado: 'leyendo', indice: idx });

  const utt = new SpeechSynthesisUtterance(texto);
  utt.lang = 'es-CR';
  utt.rate = estado.velocidad;
  utt.pitch = 1;
  const voz = obtenerVoz();
  if (voz) utt.voice = voz;
  const avanzar = () => {
    if (actual === utt) leerBloque(idx + 1);
  };
  utt.onend = avanzar;
  utt.onerror = avanzar;
  actual = utt;
  speechSynthesis.speak(utt);
}

/**
 * Empieza a leer el contenido principal de la página.
 * @param {string} [contenedorId] id del contenido; si no existe se usa el primer <main>
 * @returns {boolean} false si el navegador no puede leer o no hay texto
 */
export function leerPagina(contenedorId) {
  if (!lecturaSoportada()) return false;
  const contenedor = (contenedorId && document.getElementById(contenedorId)) || document.querySelector('main');
  const encontrados = extraerTextos(contenedor);
  if (encontrados.length === 0) return false;
  bloques = encontrados;
  emitir({ total: encontrados.length });
  leerBloque(0);
  return true;
}

export function pausarLectura() {
  if (estado.estado !== 'leyendo') return;
  speechSynthesis.pause();
  emitir({ estado: 'pausado' });
}

export function reanudarLectura() {
  if (estado.estado !== 'pausado') return;
  speechSynthesis.resume();
  emitir({ estado: 'leyendo' });
}

export function siguienteBloque() {
  if (estado.estado === 'inactivo') return;
  if (estado.estado === 'pausado') speechSynthesis.resume();
  leerBloque(estado.indice + 1);
}

export function detenerLectura() {
  callar();
  resaltar(null);
  bloques = [];
  if (estado.estado !== 'inactivo' || estado.total) emitir({ estado: 'inactivo', indice: -1, total: 0 });
}

/** Cambia la velocidad; se aplica desde el siguiente párrafo. */
export function cambiarVelocidad(velocidad) {
  emitir({ velocidad });
}

// Si la persona cierra o recarga la pestaña, el navegador no debe seguir hablando
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => detenerLectura());
