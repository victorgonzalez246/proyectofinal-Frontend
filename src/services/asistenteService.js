// Asistente virtual con @anthropic-ai/sdk.
// El SDK apunta al proxy del mismo origen (/api/asistente), que agrega la clave y fija modelo,
// prompt de sistema y límites (api/_asistente.mjs). El navegador nunca ve la clave de Anthropic.
// El SDK se descarga solo cuando la persona envía su primera pregunta.

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

const mensajeDeError = (Anthropic, err) => {
  if (err instanceof Anthropic.APIUserAbortError) return '';
  if (err instanceof Anthropic.RateLimitError) return err.error?.error?.message || 'Hiciste muchas preguntas seguidas. Espera unos minutos.';
  if (err instanceof Anthropic.BadRequestError) return 'No pudimos procesar la conversación. Empieza una nueva e intenta otra vez.';
  if (err instanceof Anthropic.APIConnectionError) return 'Sin conexión con el asistente. Revisa tu internet e intenta de nuevo.';
  if (err instanceof Anthropic.APIError && err.status === 503) return 'El asistente no está disponible en este momento. Escríbenos por WhatsApp.';
  return 'El asistente tuvo un problema. Intenta de nuevo o escríbenos por WhatsApp.';
};

/**
 * Envía la conversación y va entregando el texto a medida que llega.
 * @param {{ role: 'user' | 'assistant', content: string }[]} mensajes  empieza y termina en 'user'
 * @param {(texto: string) => void} alRecibir  recibe cada fragmento de texto
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ aviso: string }>} aviso: nota si la respuesta quedó incompleta o fue declinada
 */
export async function preguntarAlAsistente(mensajes, alRecibir, signal) {
  const { Anthropic, client } = await cargarSdk();
  try {
    const stream = client.messages.stream(
      { model: MODELO, max_tokens: MAX_TOKENS, messages: mensajes },
      { signal }
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
    const texto = mensajeDeError(Anthropic, err);
    if (!texto) return { aviso: '' }; // cancelada por la persona
    throw new Error(texto, { cause: err });
  }
}
