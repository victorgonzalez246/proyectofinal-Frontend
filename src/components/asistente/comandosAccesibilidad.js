// Órdenes de accesibilidad que Aura cumple en el navegador, sin llamar a la IA:
// así funcionan aunque el proveedor no esté disponible y nunca salen datos del dispositivo.
// Las reglas son estrictas a propósito: "tengo manchas rojas" no debe cambiar los colores.

const normalizar = (t) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const TIPOS = [
  { modo: 'protanopia', patron: /\bprotan(opia|omalia|ope)?\b|\b(no (distingo|veo) (bien )?el rojo)\b/ },
  { modo: 'deuteranopia', patron: /\bdeuteran(opia|omalia|ope)?\b|\b(no (distingo|veo) (bien )?el verde)\b/ },
  { modo: 'tritanopia', patron: /\btritan(opia|omalia|ope)?\b|\b(no (distingo|veo) (bien )?el azul)\b/ },
  { modo: 'acromatopsia', patron: /\bacromat(opsia|a)\b|\b(modo|pon|ponla|ponlo|activa|ver|verla|verlo|quiero) (la pagina |todo )?(en )?(blanco y negro|escala de grises)\b/ },
];

const NOMBRES = {
  protanopia: 'protanopia (dificultad con el rojo)',
  deuteranopia: 'deuteranopia (dificultad con el verde)',
  tritanopia: 'tritanopia (dificultad con el azul y el amarillo)',
  acromatopsia: 'acromatopsia (escala de grises con más contraste)',
};

const QUITAR = /\b(quita|quitar|desactiva|desactivar|apaga|apagar|elimina|sin|vuelve|volver|regresa|restablece)\b/;
const LEER = /\b(lee|leer|leeme|leelo|leela|lectura|leas)\b/;
const OBJETO_LECTURA = /\b(pagina|pantalla|contenido|esto|todo|en voz alta|voz alta|la seccion)\b/;

/**
 * Interpreta un mensaje del chat como orden de accesibilidad.
 * @param {string} texto
 * @returns {null | { tipo: 'daltonismo', modo: string } | { tipo: 'lectura', accion: 'leer' | 'detener' | 'pausar' | 'reanudar' }
 *   | { tipo: 'contraste', activo: boolean } | { tipo: 'texto', escala: number } | { tipo: 'ayuda-daltonismo' }}
 */
export function interpretarComando(texto) {
  const t = normalizar(texto || '');
  if (!t || t.length > 140) return null; // las órdenes son frases cortas; lo largo es una consulta

  // Lectura en voz alta
  if (/\b(deten|detener|detenla|para|parar|basta|stop|termina)\b (de |la |el )?(lectura|leer|leyendo)\b/.test(t) || /\b(lectura|leyendo)\b.*\b(deten|detener|para|parar|stop)\b/.test(t) || /\b(deja de leer|silencio|callate|calla)\b/.test(t)) {
    return { tipo: 'lectura', accion: 'detener' };
  }
  if (/\b(pausa|pausar|pausala)\b/.test(t) && (LEER.test(t) || t.split(' ').length <= 3)) return { tipo: 'lectura', accion: 'pausar' };
  if (/\b(continua|continuar|sigue|seguir|reanuda|reanudar)\b/.test(t) && LEER.test(t)) return { tipo: 'lectura', accion: 'reanudar' };
  if (LEER.test(t) && OBJETO_LECTURA.test(t)) return { tipo: 'lectura', accion: 'leer' };

  // Daltonismo
  const tipo = TIPOS.find((x) => x.patron.test(t));
  const hablaDeDaltonismo = /\bdalton(ismo|ica|ico|icos|icas)\b/.test(t) || /\b(filtro|modo|ajuste) de colou?r(es)?\b/.test(t);
  if (hablaDeDaltonismo && QUITAR.test(t) && !tipo) return { tipo: 'daltonismo', modo: 'ninguno' };
  if (/\bcolores normales\b/.test(t)) return { tipo: 'daltonismo', modo: 'ninguno' };
  if (tipo) return { tipo: 'daltonismo', modo: tipo.modo };
  if (/\bdalton(ismo|ica|ico)\b/.test(t)) return { tipo: 'ayuda-daltonismo' };

  // Contraste y tamaño de texto
  if ((/\b(alto|modo) contraste\b/.test(t) || /\b(sube|aumenta) el contraste\b/.test(t)) && !QUITAR.test(t)) {
    return { tipo: 'contraste', activo: true };
  }
  if (/\b(alto|modo|el) contraste\b/.test(t) && QUITAR.test(t)) return { tipo: 'contraste', activo: false };
  if (/\b(pon|ponme|haz|hazme|agranda|aumenta|sube|quiero|necesito|cambia|vuelve|regresa)\b.*\b(letra|texto|letras)\b/.test(t) || /^(letra|texto|letras) (mas |muy )?(grande|normal)\b/.test(t)) {
    if (/\b(normal|pequena|mas pequena|reduce|achica)\b/.test(t)) return { tipo: 'texto', escala: 1 };
    if (/\b(muy grande|enorme|mucho mas grande)\b/.test(t)) return { tipo: 'texto', escala: 1.3 };
    if (/\b(grande|mas grande|agranda|aumenta|sube)\b/.test(t)) return { tipo: 'texto', escala: 1.15 };
  }
  return null;
}

/** Texto con que Aura confirma la orden (o explica por qué no pudo). */
export function respuestaComando(cmd, { lecturaOk = true } = {}) {
  switch (cmd.tipo) {
    case 'daltonismo':
      return cmd.modo === 'ninguno'
        ? 'Listo, volví a los **colores normales**.'
        : `Listo, activé el modo para **${NOMBRES[cmd.modo]}**. Si quieres otro, dime «protanopia», «deuteranopia», «tritanopia» o «acromatopsia»; para quitarlo, «colores normales».`;
    case 'ayuda-daltonismo':
      return 'Puedo ajustar los colores de la página. Dime cuál prefieres:\n- **Protanopia**: dificultad con el rojo\n- **Deuteranopia**: dificultad con el verde\n- **Tritanopia**: dificultad con el azul y el amarillo\n- **Acromatopsia**: escala de grises\nTambién está en el botón de accesibilidad.';
    case 'lectura':
      if (cmd.accion === 'leer') {
        return lecturaOk
          ? 'Empiezo a **leer la página** en voz alta. Dime «pausa» o «detén la lectura» cuando quieras. Si usas TalkBack, no lo necesitas: él ya te lee la página.'
          : 'Este navegador no puede leer en voz alta. Prueba con Chrome, Edge o Safari, o activa TalkBack (Android) o VoiceOver (iPhone).';
      }
      if (cmd.accion === 'detener') return 'Listo, **detuve la lectura**.';
      if (cmd.accion === 'pausar') return 'Pausé la lectura. Dime «continúa la lectura» para seguir.';
      return 'Sigo leyendo.';
    case 'contraste':
      return cmd.activo ? 'Listo, activé el **alto contraste**.' : 'Listo, quité el alto contraste.';
    case 'texto':
      return cmd.escala === 1 ? 'Listo, el texto volvió a su **tamaño normal**.' : `Listo, el texto ahora es **${cmd.escala > 1.2 ? 'muy grande' : 'más grande'}**.`;
    default:
      return '';
  }
}
