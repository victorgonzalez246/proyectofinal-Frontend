// Asistente virtual con @anthropic-ai/sdk.
// El SDK apunta al proxy del mismo origen (/api/asistente), que agrega la clave y fija modelo,
// prompt de sistema y límites (api/_asistente.mjs). El navegador nunca ve la clave de Anthropic.
// El SDK se descarga solo cuando la persona envía su primera pregunta.
import { TOKEN_KEY } from './session.js';

// Debe coincidir con MODELO_ASISTENTE de api/_asistente.mjs (el proxy lo impone de todos modos)
const MODELO = 'claude-opus-5-5';
const MAX_TOKENS = 2048;

let sdk = null;
const cargarSdk = async () => {
  if (!sdk) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({
      apiKey: 'proxy', // la clave real la agrega el servidor
      baseURL: `${window.location.origin}/api/asistente`,
      dangerouslyAllowBrowser: true, // seguro aquí: el navegador no tiene clave que filtrar
      maxRetries: 1,
    });
    sdk = { Anthropic, client };
  }
  return sdk;
};

// El proxy (api/_asistente.mjs) traduce los errores del proveedor (sin crédito, clave inválida, saturado,
// cuota agotada) a un 503 o a un evento "error" con un mensaje amable; aquí se muestra ese mensaje.
// Nunca se muestra el texto técnico del proveedor.
export const mensajeDeError = (Anthropic, err, doctora = false) => {
  const delServidor = err?.error?.error?.message;
  const noDisponible = doctora
    ? 'Aura no está disponible en este momento. Inténtelo más tarde.'
    : 'Aura no está disponible en este momento. Inténtalo más tarde o escríbenos por WhatsApp.';
  if (err instanceof Anthropic.APIUserAbortError) return '';
  // 429 del proxy: límite de preguntas propio de la app (por IP)
  if (err instanceof Anthropic.RateLimitError) return delServidor || 'Hiciste muchas preguntas seguidas. Espera unos minutos.';
  if (err instanceof Anthropic.BadRequestError) return 'No pudimos procesar la conversación. Empieza una nueva e intenta otra vez.';
  if (err instanceof Anthropic.APIConnectionError) return 'Sin conexión con el asistente. Revisa tu internet e intenta de nuevo.';
  if (err instanceof Anthropic.PermissionDeniedError) return delServidor || 'Vuelva a iniciar sesión para usar Aura.';
  // 503 (sin clave o proveedor no disponible) y errores a mitad de la respuesta: mensaje amable del proxy
  if (err instanceof Anthropic.APIError && (err.status === 503 || err.status === undefined)) return delServidor || noDisponible;
  return noDisponible;
};

/**
 * Envía la conversación y va entregando el texto a medida que llega.
 * @param {{ role: 'user' | 'assistant', content: string }[]} mensajes  empieza y termina en 'user'
 * @param {(texto: string) => void} alRecibir  recibe cada fragmento de texto
 * @param {AbortSignal} [signal]
 * @param {{ perfil?: 'paciente' | 'doctora', contexto?: string }} [opciones]  la doctora envía su sesión y la foto del panel
 * @returns {Promise<{ aviso: string }>} aviso: nota si la respuesta quedó incompleta o fue declinada
 */
export async function preguntarAlAsistente(mensajes, alRecibir, signal, { perfil = 'paciente', contexto = '' } = {}) {
  const { Anthropic, client } = await cargarSdk();
  const doctora = perfil === 'doctora';
  try {
    const stream = client.messages.stream(
      // contexto_panel no es un campo de la API de Anthropic: lo lee y lo quita el proxy (api/_asistente.mjs)
      { model: MODELO, max_tokens: MAX_TOKENS, messages: mensajes, ...(doctora ? { contexto_panel: contexto } : {}) },
      {
        signal,
        headers: doctora
          ? { 'x-aura-perfil': 'doctora', 'x-aura-sesion': sessionStorage.getItem(TOKEN_KEY) || '' }
          : undefined,
      }
    );
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        alRecibir(event.delta.text);
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      return { aviso: 'No puedo ayudarte con esa consulta. Para temas médicos, escríbenos por WhatsApp.' };
    }
    if (final.stop_reason === 'max_tokens') return { aviso: 'La respuesta quedó incompleta. Pídeme que continúe.' };
    return { aviso: '' };
  } catch (err) {
    const texto = mensajeDeError(Anthropic, err, doctora);
    if (!texto) return { aviso: '' }; // cancelada por la persona
    throw new Error(texto, { cause: err });
  }
}
