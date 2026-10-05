import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeOff, Pause, Play, SkipForward } from 'lucide-react';
import './lector.css';

/**
 * LectorVoz: botón flotante que lee en voz alta el contenido de la página.
 * Usa la Web Speech API (speechSynthesis) con voz en español.
 *
 * Funciona en Chrome, Edge, Safari y Firefox. En móvil Android funciona
 * junto con TalkBack o de forma independiente.
 */

const VELOCIDADES = [
  { label: '0.8×', value: 0.8 },
  { label: '1×', value: 1 },
  { label: '1.2×', value: 1.2 },
  { label: '1.5×', value: 1.5 },
];

// Extrae el texto legible del contenido principal de la página
function extraerTextos(contenedor) {
  if (!contenedor) return [];
  const bloques = [];
  const walker = document.createTreeWalker(
    contenedor,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        // Saltar elementos ocultos, decorativos o aria-hidden
        if (node.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
        if (node.hidden) return NodeFilter.FILTER_REJECT;
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
        // Solo nodos que contienen texto directo
        const tags = ['H1', 'H2', 'H3', 'H4', 'P', 'LI', 'TD', 'TH', 'LABEL', 'FIGCAPTION', 'DT', 'DD', 'SPAN', 'STRONG', 'EM', 'A', 'BUTTON'];
        if (tags.includes(node.tagName)) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      },
    },
  );

  const vistos = new Set();
  let nodo;
  while ((nodo = walker.nextNode())) {
    // Obtener solo texto directo del nodo (sin hijos ya procesados)
    const texto = Array.from(nodo.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (texto && texto.length > 1 && !vistos.has(texto)) {
      vistos.add(texto);
      bloques.push({ elemento: nodo, texto });
    }
  }
  return bloques;
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

export default function LectorVoz({ contenedorId = 'portal-main' }) {
  const [soportado] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window);
  const [estado, setEstado] = useState('inactivo'); // inactivo | leyendo | pausado
  const [indice, setIndice] = useState(-1);
  const [velocidad, setVelocidad] = useState(1);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const [total, setTotal] = useState(0);

  const bloquesRef = useRef([]);
  const utteranceRef = useRef(null);
  const panelRef = useRef(null);
  const resaltadoRef = useRef(null);
  const velocidadRef = useRef(velocidad);

  useEffect(() => {
    velocidadRef.current = velocidad;
  }, [velocidad]);

  // Resaltar el bloque que se está leyendo
  const resaltar = useCallback((elemento) => {
    if (resaltadoRef.current) {
      resaltadoRef.current.classList.remove('lector-resaltado');
    }
    if (elemento) {
      elemento.classList.add('lector-resaltado');
      elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
      resaltadoRef.current = elemento;
    }
  }, []);

  // Limpiar resaltado
  const limpiarResaltado = useCallback(() => {
    if (resaltadoRef.current) {
      resaltadoRef.current.classList.remove('lector-resaltado');
      resaltadoRef.current = null;
    }
  }, []);

  // Cancela lo que se esté diciendo sin que su onend/onerror avance de bloque
  const callar = useCallback(() => {
    utteranceRef.current = null;
    if (soportado) speechSynthesis.cancel();
  }, [soportado]);

  // Leer un bloque por índice (función nombrada: se vuelve a llamar al terminar cada bloque)
  const leerBloque = useCallback(function leer(idx) {
    const bloques = bloquesRef.current;
    callar();
    if (idx < 0 || idx >= bloques.length) {
      // Fin de lectura
      setEstado('inactivo');
      setIndice(-1);
      limpiarResaltado();
      return;
    }

    const { elemento, texto } = bloques[idx];
    setIndice(idx);
    resaltar(elemento);

    const utt = new SpeechSynthesisUtterance(texto);
    utt.lang = 'es-CR';
    utt.rate = velocidadRef.current;
    utt.pitch = 1;
    const voz = obtenerVoz();
    if (voz) utt.voice = voz;

    // Solo avanza si esta frase sigue siendo la actual (cancelar también dispara estos eventos)
    const avanzar = () => {
      if (utteranceRef.current === utt) leer(idx + 1);
    };
    utt.onend = avanzar;
    utt.onerror = avanzar;

    utteranceRef.current = utt;
    speechSynthesis.speak(utt);
  }, [callar, resaltar, limpiarResaltado]);

  // Iniciar lectura
  const iniciar = useCallback(() => {
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;

    const bloques = extraerTextos(contenedor);
    if (bloques.length === 0) return;

    bloquesRef.current = bloques;
    setTotal(bloques.length);
    setEstado('leyendo');
    leerBloque(0);
  }, [contenedorId, leerBloque]);

  // Pausar / reanudar
  const pausarReanudar = useCallback(() => {
    if (estado === 'leyendo') {
      speechSynthesis.pause();
      setEstado('pausado');
    } else if (estado === 'pausado') {
      speechSynthesis.resume();
      setEstado('leyendo');
    }
  }, [estado]);

  // Detener
  const detener = useCallback(() => {
    callar();
    setEstado('inactivo');
    setIndice(-1);
    limpiarResaltado();
    bloquesRef.current = [];
    setTotal(0);
  }, [callar, limpiarResaltado]);

  // Saltar al siguiente bloque
  const siguiente = useCallback(() => {
    if (estado === 'pausado') {
      speechSynthesis.resume();
      setEstado('leyendo');
    }
    if (estado !== 'inactivo') leerBloque(indice + 1);
  }, [estado, indice, leerBloque]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      callar();
      limpiarResaltado();
    };
  }, [callar, limpiarResaltado]);

  // Cerrar menú con clic fuera
  useEffect(() => {
    if (!menuAbierto) return;
    const cerrar = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setMenuAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [menuAbierto]);

  // Cargar voces (en algunos navegadores se cargan asíncronamente)
  useEffect(() => {
    if (!soportado) return;
    const cargar = () => speechSynthesis.getVoices();
    cargar();
    speechSynthesis.addEventListener?.('voiceschanged', cargar);
    return () => speechSynthesis.removeEventListener?.('voiceschanged', cargar);
  }, [soportado]);

  if (!soportado) return null;

  const activo = estado !== 'inactivo';
  const progreso = total > 0 ? Math.round(((indice + 1) / total) * 100) : 0;

  return (
    <div className="lector" ref={panelRef}>
      {/* Botón principal */}
      {!activo ? (
        <button
          type="button"
          className="lector-btn lector-btn--principal"
          onClick={iniciar}
          aria-label="Leer esta página en voz alta"
          title="Leer página en voz alta"
        >
          <Volume2 size={22} aria-hidden="true" />
          <span className="lector-btn__texto">Leer página</span>
        </button>
      ) : (
        <div className="lector-controles" role="toolbar" aria-label="Controles de lectura en voz alta">
          {/* Progreso */}
          <div className="lector-progreso" aria-hidden="true">
            <div className="lector-progreso__barra" style={{ width: `${progreso}%` }} />
          </div>

          <div className="lector-botones">
            {/* Pausar / Reanudar */}
            <button
              type="button"
              className="lector-btn"
              onClick={pausarReanudar}
              aria-label={estado === 'leyendo' ? 'Pausar lectura' : 'Continuar lectura'}
            >
              {estado === 'leyendo' ? <Pause size={18} /> : <Play size={18} />}
            </button>

            {/* Siguiente */}
            <button
              type="button"
              className="lector-btn"
              onClick={siguiente}
              aria-label="Saltar al siguiente párrafo"
            >
              <SkipForward size={18} />
            </button>

            {/* Velocidad */}
            <button
              type="button"
              className="lector-btn lector-btn--vel"
              onClick={() => {
                const idx = VELOCIDADES.findIndex((v) => v.value === velocidad);
                const next = VELOCIDADES[(idx + 1) % VELOCIDADES.length];
                setVelocidad(next.value);
              }}
              aria-label={`Velocidad de lectura: ${velocidad}x. Pulsa para cambiar.`}
            >
              {velocidad}×
            </button>

            {/* Detener */}
            <button
              type="button"
              className="lector-btn lector-btn--detener"
              onClick={detener}
              aria-label="Detener lectura"
            >
              <VolumeOff size={18} />
            </button>
          </div>

          {/* Indicador de bloque */}
          <p className="lector-info sr-only" role="status" aria-live="polite">
            Leyendo bloque {indice + 1} de {total}
          </p>
        </div>
      )}
    </div>
  );
}
