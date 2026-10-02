import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, X, SendHorizontal, Square, RotateCcw, MessageCircle } from 'lucide-react';
import { preguntarAlAsistente } from '../../services/asistenteService.js';
import { CLINICA } from '../../config/clinica.js';
import './asistente.css';

// Textos por perfil: pacientes (landing y portal) y la doctora (panel, con los datos del panel como contexto)
const TEXTOS = {
  paciente: {
    bienvenida:
      'Hola, soy **Aura**, la asistente virtual de la clínica. Puedo contarte sobre nuestros tratamientos, los cuidados antes y después, y guiarte para agendar tu valoración. ¿En qué te ayudo?',
    sugerencias: [
      '¿Qué tratamiento me ayuda con las ojeras?',
      '¿Cómo es la primera valoración?',
      'Cuidados después del ácido hialurónico',
      '¿Cómo agendo una cita?',
    ],
    lanzador: '¿Dudas? Pregúntale a Aura',
    subtitulo: 'Orientación general con IA · no reemplaza la valoración médica',
    placeholder: 'Escribe tu pregunta…',
  },
  doctora: {
    bienvenida:
      'Hola, doctora. Soy **Aura** y veo los datos de su panel: consultas, citas, pacientes, alertas, facturas y estadísticas. Pregúnteme lo que necesite; si nombra a una paciente, reviso su ficha, su plan y sus productos.',
    sugerencias: [
      '¿Qué tengo pendiente hoy?',
      '¿Qué alertas siguen abiertas?',
      '¿Qué productos vencen en los próximos 60 días?',
      'Resumen de facturación de este mes',
    ],
    lanzador: 'Aura · Asistente IA',
    subtitulo: 'Lee los datos del panel · solo consulta, no hace cambios',
    placeholder: 'Pregúntele a Aura sobre su panel…',
  },
};

// Formato mínimo y seguro (sin innerHTML): **negritas**, listas con "- " y párrafos
function Negritas({ texto }) {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**') && parte.length > 4
      ? <strong key={i}>{parte.slice(2, -2)}</strong>
      : <Fragment key={i}>{parte}</Fragment>
  );
}

function TextoFormateado({ texto }) {
  const bloques = [];
  for (const linea of texto.split('\n')) {
    const item = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(linea);
    const ultimo = bloques.at(-1);
    if (item) {
      if (ultimo?.tipo === 'lista') ultimo.items.push(item[1]);
      else bloques.push({ tipo: 'lista', items: [item[1]] });
    } else if (linea.trim()) {
      bloques.push({ tipo: 'parrafo', texto: linea.replace(/^#+\s*/, '') });
    }
  }
  return bloques.map((b, i) =>
    b.tipo === 'lista' ? (
      <ul key={i}>{b.items.map((t, j) => <li key={j}><Negritas texto={t} /></li>)}</ul>
    ) : (
      <p key={i}><Negritas texto={b.texto} /></p>
    )
  );
}

/**
 * Asistente virtual flotante: pacientes (landing y portal) y doctora (panel).
 * @param {{ variante?: 'landing' | 'portal' | 'admin', obtenerContexto?: (pregunta: string, anteriores: string[]) => Promise<string> }} props
 *   variante: en el portal se ubica sobre la Línea de tranquilidad; 'admin' usa el perfil de la doctora
 *   obtenerContexto: solo en el panel; arma la foto de los datos que Aura lee en cada pregunta
 */
export default function AsistenteVirtual({ variante = 'landing', obtenerContexto }) {
  const perfil = variante === 'admin' ? 'doctora' : 'paciente';
  const textos = TEXTOS[perfil];
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([]); // { role, content } de la conversación real
  const [borrador, setBorrador] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const abortRef = useRef(null);
  const lanzadorRef = useRef(null);
  const campoRef = useRef(null);
  const finRef = useRef(null);
  const tituloId = useId();
  const panelId = useId();
  const campoId = useId();

  const cerrar = () => {
    setAbierto(false);
    lanzadorRef.current?.focus();
  };

  // Al abrir, el foco va al campo de texto; Escape cierra el panel
  useEffect(() => {
    if (!abierto) return undefined;
    campoRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setAbierto(false);
        lanzadorRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [abierto]);

  // Mantiene visible el último mensaje mientras llega la respuesta
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' });
  }, [mensajes, error]);

  // Cancela una respuesta en curso si el componente se desmonta
  useEffect(() => () => abortRef.current?.abort(), []);

  const enviar = async (texto) => {
    const pregunta = texto.trim();
    if (!pregunta || enviando) return;
    setError('');
    setAviso('');
    setBorrador('');
    const historial = [...mensajes, { role: 'user', content: pregunta }];
    setMensajes([...historial, { role: 'assistant', content: '' }]);
    setEnviando(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const agregar = (fragmento) =>
      setMensajes((prev) => {
        const ultimo = prev.at(-1);
        if (ultimo?.role !== 'assistant') return prev; // la conversación se reinició
        return [...prev.slice(0, -1), { ...ultimo, content: ultimo.content + fragmento }];
      });

    try {
      const contexto = obtenerContexto
        ? await obtenerContexto(pregunta, mensajes.filter((m) => m.role === 'user').map((m) => m.content))
        : '';
      const { aviso: nota } = await preguntarAlAsistente(historial, agregar, controller.signal, { perfil, contexto });
      setAviso(nota);
    } catch (err) {
      setError(err.message);
      setBorrador(pregunta); // la pregunta vuelve al campo para reintentar
    } finally {
      // Una respuesta vacía (error o cancelación) no queda en el historial: la próxima pregunta
      // debe seguir alternando paciente → asistente
      setMensajes((prev) => {
        if (prev.at(-1)?.content.trim()) return prev;
        return prev.slice(0, -2);
      });
      setEnviando(false);
      abortRef.current = null;
      campoRef.current?.focus();
    }
  };

  const reiniciar = () => {
    abortRef.current?.abort();
    setMensajes([]);
    setError('');
    setAviso('');
    campoRef.current?.focus();
  };

  const onSubmit = (e) => {
    e.preventDefault();
    enviar(borrador);
  };

  // Enter envía; Shift+Enter hace salto de línea
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar(borrador);
    }
  };

  const esperandoPrimerTexto = enviando && !mensajes.at(-1)?.content;

  return (
    <div className={`asis asis--${variante}`}>
      <button
        ref={lanzadorRef}
        type="button"
        className="asis-lanzador"
        aria-expanded={abierto}
        aria-controls={panelId}
        aria-label={abierto ? 'Cerrar asistente virtual' : 'Abrir asistente virtual'}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
      >
        {abierto ? <X size={22} aria-hidden="true" /> : <Sparkles size={22} aria-hidden="true" />}
        <span className="asis-lanzador__texto" aria-hidden="true">{abierto ? 'Cerrar' : textos.lanzador}</span>
      </button>

      <section
        id={panelId}
        className="asis-panel"
        role="dialog"
        aria-modal="false"
        aria-labelledby={tituloId}
        hidden={!abierto}
      >
        <header className="asis-cabecera">
          <span className="asis-avatar" aria-hidden="true"><Sparkles size={18} /></span>
          <div>
            <h2 id={tituloId} className="asis-titulo">Aura · Asistente virtual</h2>
            <p className="asis-subtitulo">{textos.subtitulo}</p>
          </div>
          <div className="asis-cabecera__acciones">
            {mensajes.length > 0 && (
              <button type="button" className="asis-icono" onClick={reiniciar} aria-label="Empezar una conversación nueva">
                <RotateCcw size={17} aria-hidden="true" />
              </button>
            )}
            <button type="button" className="asis-icono" onClick={cerrar} aria-label="Cerrar asistente virtual">
              <X size={19} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="asis-mensajes" role="log" aria-live="polite" aria-relevant="additions text" aria-busy={enviando}>
          <div className="asis-msg asis-msg--asistente">
            <TextoFormateado texto={textos.bienvenida} />
          </div>

          {mensajes.length === 0 && (
            <ul className="asis-sugerencias" aria-label="Preguntas sugeridas">
              {textos.sugerencias.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => enviar(s)} disabled={enviando}>{s}</button>
                </li>
              ))}
            </ul>
          )}

          {mensajes.map((m, i) =>
            m.content ? (
              <div key={i} className={`asis-msg asis-msg--${m.role === 'user' ? 'paciente' : 'asistente'}`}>
                <span className="asis-sr">{m.role === 'user' ? 'Tú dijiste:' : 'Aura respondió:'}</span>
                {m.role === 'user' ? <p>{m.content}</p> : <TextoFormateado texto={m.content} />}
              </div>
            ) : null
          )}

          {esperandoPrimerTexto && (
            <div className="asis-msg asis-msg--asistente asis-escribiendo" role="status">
              <span className="asis-sr">Aura está escribiendo…</span>
              <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
            </div>
          )}

          {aviso && <p className="asis-nota" role="status">{aviso}</p>}

          {error && (
            <div className="asis-error" role="alert">
              <p>{error}</p>
              {perfil === 'paciente' && (
                <a href={`https://wa.me/${CLINICA.whatsapp}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={15} aria-hidden="true" /> Escribir por WhatsApp
                </a>
              )}
            </div>
          )}
          <div ref={finRef} />
        </div>

        <form className="asis-form" onSubmit={onSubmit}>
          <label htmlFor={campoId} className="asis-sr">Escribe tu pregunta</label>
          <textarea
            id={campoId}
            ref={campoRef}
            rows={1}
            maxLength={perfil === 'doctora' ? 6000 : 1500}
            placeholder={textos.placeholder}
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {enviando ? (
            <button type="button" className="asis-enviar" onClick={() => abortRef.current?.abort()} aria-label="Detener la respuesta">
              <Square size={16} aria-hidden="true" />
            </button>
          ) : (
            <button type="submit" className="asis-enviar" disabled={!borrador.trim()} aria-label="Enviar pregunta">
              <SendHorizontal size={18} aria-hidden="true" />
            </button>
          )}
        </form>
        {perfil === 'doctora' ? (
          <p className="asis-legal">Aura puede equivocarse: verifique en el panel antes de decidir. Los datos se envían al proveedor de IA para responder.</p>
        ) : (
          <p className="asis-legal">
            No compartas datos personales ni de salud en este chat. {variante === 'landing' && <>Consulta el <Link to="/privacidad">aviso de privacidad</Link>.</>}
            {' '}Emergencias: 911.
          </p>
        )}
      </section>
    </div>
  );
}
