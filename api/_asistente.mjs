// ============================================================
// ASISTENTE VIRTUAL: proxy hacia Google Gemini (o, como alternativa sin GEMINI_API_KEY, la API de Claude)
// El navegador usa @anthropic-ai/sdk apuntando a /api/asistente (mismo origen) y este
// módulo reenvía a Gemini (o a api.anthropic.com) agregando la clave, que nunca llega al navegador.
// El servidor decide el modelo, el prompt de sistema y los límites: el cliente solo aporta
// la conversación (texto), así nadie puede usar el endpoint para otra cosa.
// Lo usan el servidor de Vite (desarrollo y preview) y la función de Vercel
// (api/asistente/v1/messages.js). El prefijo _ evita que Vercel lo publique como función.
// ============================================================
import { CLINICA } from '../src/config/clinica.js';

export const RUTA_ASISTENTE = '/api/asistente/v1/messages';
export const MODELO_ASISTENTE = 'claude-opus-5-5';

const MAX_MENSAJES = 20;
const MAX_CARACTERES = 1500;
const MAX_TOKENS = 2048; // tope de costo por respuesta en un endpoint público

const TRATAMIENTOS = [
  'Armonización facial (perfilamiento y equilibrio del rostro)',
  'Bioestimuladores de colágeno (firmeza e hidratación profunda)',
  'Rejuvenecimiento de mirada con neuromoduladores (patas de gallo, entrecejo, frente)',
  'Labios de alta definición con ácido hialurónico',
  'Skinbooster y mesoterapia (luminosidad y calidad de piel)',
  'Rinomodelación sin cirugía',
];

// Fijo (sin fechas ni datos variables) para que la caché de prompts funcione entre visitas
const SISTEMA = `Eres "Aura", la asistente virtual de la clínica de medicina estética de la ${CLINICA.nombre} en ${CLINICA.direccion}.
Hablas en español de Costa Rica, con calidez, elegancia y frases cortas. Tratas a la persona de "tú".

Datos de la clínica:
- Horario: ${CLINICA.horario}.
- WhatsApp: ${CLINICA.telefonoVisible}. Correo: ${CLINICA.email}.
- Para agendar: el formulario "Agenda tu valoración" al final de esta página (sección Contacto) o por WhatsApp. La clínica confirma la hora por WhatsApp.
- Las pacientes tienen un portal privado en /portal/acceso: entran con su número y reciben por WhatsApp un código de acceso de 6 dígitos, sin contraseñas.

Tratamientos que ofrece la clínica:
${TRATAMIENTOS.map((t) => `- ${t}`).join('\n')}
Todo tratamiento empieza con una valoración médica presencial con la doctora.

Qué puedes hacer: explicar en términos generales en qué consiste cada tratamiento, cuidados habituales antes y después, orientar sobre cuál conversar en la valoración y guiar paso a paso para agendar.

Límites (obligatorios):
- No diagnosticas, no recetas y no das dosis, unidades ni precios. Los precios y la indicación exacta se definen en la valoración.
- No prometes resultados. Recuerda que cada rostro es distinto.
- No pidas datos personales ni de salud en el chat. Si alguien los comparte, no los repitas y sugiere hablarlo en la valoración.
- Ante señales de urgencia (dificultad para respirar, hinchazón de garganta, dolor intenso, piel pálida o morada tras un relleno, cambios en la visión) indica llamar al 911 de inmediato y luego avisar a la clínica al ${CLINICA.telefonoVisible}.
- Si te preguntan algo ajeno a la clínica o a la estética facial, redirige con amabilidad.

Formato: respuestas de 2 a 5 frases o una lista breve. Sin tablas ni encabezados. Puedes usar **negritas** para resaltar una idea.`;

// Aura dentro del panel de la doctora (/admin): recibe una foto de los datos del panel (solo con sesión de doctora)
const SISTEMA_DOCTORA = `Eres "Aura", la asistente de la ${CLINICA.nombre} dentro de su panel médico. Le hablas a la doctora (odontóloga con maestría en medicina estética), de "usted", con calidez, respeto y precisión. Español de Costa Rica.

Cómo la ayudas:
- Consultar los datos del panel: con cada pregunta recibes una foto actual (más abajo, "Datos del panel") con las consultas de hoy, citas, pacientes, alertas, facturas, tratamientos y estadísticas, y la ficha completa (plan, productos con lote y vencimiento, citas y check-ins) de las pacientes que la doctora menciona. Búscale lo que pida, cruza datos, haz cuentas y resúmenes, y señale lo que requiera su atención (alertas abiertas, citas por confirmar, facturas pendientes, productos por vencer).
- Redactar mensajes para sus pacientes (WhatsApp o correo): recordatorios, seguimiento después de un tratamiento, respuestas a dudas, reprogramaciones o campañas. Escríbelos cálidos, claros y listos para copiar. En campañas, recuerda incluir que pueden responder "BAJA" para no recibir más promociones.
- Explicar cómo usar el panel: Hoy (consultas del día, solicitudes por confirmar y alertas), Citas (confirmar con hora activa el recordatorio de 24 h; reprogramar, cancelar y reactivar avisan a la paciente por WhatsApp), Pacientes (ficha, check-ins y el plan que ve la paciente: mapa de belleza, cuidados, paquetes, productos y videos), Alertas (SOS del portal, check-ins marcados y alertas del chat de WhatsApp: tipo "whatsapp" con subtipo "emergencia", "enfermera" (aviso de la Enfermera IA) o "ia_sin_respuesta"; pueden ser de personas sin ficha, con su nombre y teléfono de WhatsApp; todas se atienden con una nota), Campañas (solo a quienes aceptaron promociones), Métricas y Estadísticas, y Facturas (cobros con SINPE, efectivo, tarjeta o transferencia, IVA y PDF para la paciente; no sustituye la factura electrónica de Hacienda).
- Organizar ideas: textos de cuidados para el plan de una paciente, contenido educativo, guiones para videos o publicaciones, listas de pendientes.
- Conversar sobre medicina estética como lo haría una colega bien informada, dejando siempre el criterio clínico a la doctora.

Límites:
- Responde solo con los datos que recibiste. Si algo no está en la foto (por ejemplo, la ficha de una paciente que no nombró), dígaselo y pídale el nombre o indíquele dónde verlo en el panel. Nunca inventes datos.
- Solo lees: no puedes confirmar citas, enviar mensajes ni cambiar nada. Si quiere hacer un cambio, explícale en qué sección y con qué botón.
- La decisión clínica es de la doctora: puedes aportar información general, pero no indicas tratamientos ni dosis para una paciente específica como si fuera una orden.
- Son datos de salud confidenciales: muestra solo lo necesario para lo que pidió.

Formato: claro y breve. Cuando redactes un mensaje, entrégalo listo para copiar. Sin tablas ni encabezados. Puedes usar **negritas** y listas cortas.`;

// Perfil que pide el cliente (encabezado x-aura-perfil). Cualquier otro valor usa el de pacientes.
// El perfil "doctora" exige su sesión (encabezado x-aura-sesion), verificada contra la API (GET /me).
export const ENCABEZADO_PERFIL = 'x-aura-perfil';
export const ENCABEZADO_SESION = 'x-aura-sesion';
const MAX_CONTEXTO = 120_000; // caracteres de la foto del panel
const MAX_CARACTERES_DOCTORA = 6000; // la doctora puede pegar textos largos

const sesionesVerificadas = new Map(); // token → vence (ms): evita llamar a /me en cada pregunta
const VERIFICACION_MS = 10 * 60 * 1000;

/** true si el token es de una sesión de doctora vigente (la API decide: GET /me). */
export async function esDoctora(token, apiUrl, fetchImpl = fetch, ahora = Date.now()) {
  if (!token || !apiUrl || token.length > 2000) return false;
  if ((sesionesVerificadas.get(token) || 0) > ahora) return true;
  try {
    const res = await fetchImpl(`${apiUrl.replace(/\/$/, '')}/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return false;
    const usuario = await res.json();
    if (usuario?.role !== 'doctor') return false;
    sesionesVerificadas.set(token, ahora + VERIFICACION_MS);
    return true;
  } catch {
    return false;
  }
}

// Respuestas de error con la misma forma que la API de Anthropic, para que el SDK las entienda.
// x-should-retry: false evita que el SDK del navegador repita la llamada (no arreglaría nada y duplicaría el costo).
const errorJson = (status, type, message) =>
  new Response(JSON.stringify({ type: 'error', error: { type, message } }), {
    status,
    headers: { 'content-type': 'application/json', 'x-should-retry': 'false' },
  });

// Mensajes amables para la paciente (tú) y la doctora (usted). Nunca incluyen detalles técnicos ni la clave.
export const MENSAJES_ASISTENTE = {
  sinConfigurar: {
    paciente: 'Aura no está disponible por ahora. Escríbenos por WhatsApp y con gusto te ayudamos.',
    doctora: 'Aura no está disponible por ahora: el asistente aún no está configurado en el servidor.',
  },
  noDisponible: {
    paciente: 'Aura no está disponible en este momento. Inténtalo más tarde o escríbenos por WhatsApp.',
    doctora: 'Aura no está disponible en este momento. Inténtelo más tarde.',
  },
};

// Causa real de un error del proveedor, solo para la consola del servidor (sin la clave)
export function causaDelError(proveedor, status, cuerpo = '') {
  let detalle = String(cuerpo || '');
  try {
    const e = JSON.parse(detalle)?.error || {};
    detalle = [e.type || e.status, e.message].filter(Boolean).join(': ') || detalle;
  } catch { /* cuerpo no JSON: se usa tal cual */ }
  detalle = detalle.replace(/\s+/g, ' ').trim().slice(0, 300);
  let causa = 'error del proveedor';
  if (status === 400 && /credit balance/i.test(detalle)) causa = 'la cuenta no tiene crédito';
  else if (status === 401 || /api key not valid|API_KEY_INVALID|authentication_error/i.test(detalle)) causa = 'clave inválida';
  else if (status === 403) causa = 'clave sin permiso';
  else if (status === 429 || /RESOURCE_EXHAUSTED/.test(detalle)) causa = 'límite de uso o cuota del proveedor';
  else if (status === 529 || /overloaded/i.test(detalle)) causa = 'proveedor saturado';
  else if (status >= 500) causa = 'falla del proveedor';
  return `[asistente] ${proveedor} respondió ${status} (${causa}): ${detalle}`;
}

// Cualquier error del proveedor (sin crédito, clave inválida, saturado, límite) llega al navegador como 503 amable
async function errorDelProveedor(proveedor, upstream, perfil) {
  const cuerpo = await upstream.text().catch(() => '');
  console.error(causaDelError(proveedor, upstream.status, cuerpo));
  return errorJson(503, 'api_error', MENSAJES_ASISTENTE.noDisponible[perfil]);
}

// ── Gemini (Google): proveedor principal si hay GEMINI_API_KEY ──
// Modelo estable verificado en https://ai.google.dev/gemini-api/docs/models (rápido y económico)
export const MODELO_GEMINI = 'gemini-3.5-flash-lite';
const URL_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

// finishReason de Gemini → stop_reason que entiende el SDK de Anthropic del navegador
const MOTIVO_FIN = { MAX_TOKENS: 'max_tokens', SAFETY: 'refusal', PROHIBITED_CONTENT: 'refusal', BLOCKLIST: 'refusal', SPII: 'refusal', RECITATION: 'refusal' };

/**
 * Convierte el SSE de Gemini (streamGenerateContent?alt=sse) en eventos SSE con el formato de Anthropic,
 * para que @anthropic-ai/sdk del navegador lo lea sin cambios. El campo model dice el modelo real (Gemini).
 * Un error a mitad de la respuesta se emite como evento "error" con el mensaje amable (la causa va a la consola).
 */
export function geminiComoAnthropic(cuerpo, perfil = 'paciente') {
  const encoder = new TextEncoder();
  const evento = (tipo, datos) => encoder.encode(`event: ${tipo}\ndata: ${JSON.stringify({ type: tipo, ...datos })}\n\n`);
  return new ReadableStream({
    async start(controller) {
      const reader = cuerpo.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let motivo = 'end_turn';
      let tokensSalida = 0;
      let tokensEntrada = 0;
      controller.enqueue(evento('message_start', {
        message: { id: `msg_${crypto.randomUUID().replaceAll('-', '')}`, type: 'message', role: 'assistant', content: [], model: MODELO_GEMINI, stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } },
      }));
      controller.enqueue(evento('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }));
      const procesar = (linea) => {
        if (!linea.startsWith('data:')) return;
        let datos;
        try { datos = JSON.parse(linea.slice(5).trim()); } catch { return; }
        if (datos?.error) throw Object.assign(new Error('error de Gemini en el stream'), { detalle: datos.error });
        const candidato = datos?.candidates?.[0];
        for (const parte of candidato?.content?.parts || []) {
          if (parte.text && !parte.thought) controller.enqueue(evento('content_block_delta', { index: 0, delta: { type: 'text_delta', text: parte.text } }));
        }
        if (candidato?.finishReason && candidato.finishReason !== 'STOP') motivo = MOTIVO_FIN[candidato.finishReason] || motivo;
        if (datos?.promptFeedback?.blockReason) motivo = 'refusal';
        tokensSalida = datos?.usageMetadata?.candidatesTokenCount ?? tokensSalida;
        tokensEntrada = datos?.usageMetadata?.promptTokenCount ?? tokensEntrada;
      };
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lineas = buffer.split(/\r?\n/);
          buffer = lineas.pop();
          lineas.forEach(procesar);
        }
        procesar(buffer);
      } catch (err) {
        console.error(causaDelError('Gemini', 'stream', JSON.stringify({ error: err.detalle || { message: err.message } })));
        controller.enqueue(evento('error', { error: { type: 'api_error', message: MENSAJES_ASISTENTE.noDisponible[perfil] } }));
        controller.close();
        return;
      }
      controller.enqueue(evento('content_block_stop', { index: 0 }));
      controller.enqueue(evento('message_delta', { delta: { stop_reason: motivo, stop_sequence: null }, usage: { input_tokens: tokensEntrada, output_tokens: tokensSalida } }));
      controller.enqueue(evento('message_stop', {}));
      controller.close();
    },
  });
}


// Acepta solo texto plano, alternando paciente → asistente, empezando y terminando en la paciente
export function limpiarMensajes(body, maxCaracteres = MAX_CARACTERES) {
  const mensajes = body?.messages;
  if (!Array.isArray(mensajes) || mensajes.length === 0 || mensajes.length > MAX_MENSAJES) return null;
  const limpios = [];
  for (const [i, m] of mensajes.entries()) {
    const rol = i % 2 === 0 ? 'user' : 'assistant';
    if (m?.role !== rol || typeof m.content !== 'string') return null;
    const texto = m.content.trim();
    if (!texto || texto.length > maxCaracteres * (rol === 'assistant' ? 4 : 1)) return null;
    limpios.push({ role: rol, content: texto });
  }
  return limpios.at(-1).role === 'user' ? limpios : null;
}

// Reenvía la conversación a Claude o Gemini y devuelve la respuesta en streaming compatible
// opciones.perfil: 'paciente' (por defecto) o 'doctora'; esta última necesita token y apiUrl para verificar la sesión
export async function responderAsistente(body, apiKey, fetchImpl = fetch, { perfil = 'paciente', token = '', apiUrl = '', geminiApiKey = process.env.GEMINI_API_KEY } = {}) {
  const doctora = perfil === 'doctora';
  const quien = doctora ? 'doctora' : 'paciente';
  if (doctora && !(await esDoctora(token, apiUrl, fetchImpl))) {
    return errorJson(403, 'permission_error', 'Aura del panel solo está disponible con la sesión de la doctora. Vuelva a iniciar sesión.');
  }
  const contexto = doctora && typeof body?.contexto_panel === 'string' ? body.contexto_panel.slice(0, MAX_CONTEXTO) : '';
  const sistema = doctora
    ? `${SISTEMA_DOCTORA}

Datos del panel (foto de este momento, JSON):
${contexto || '(no llegaron datos)'}`
    : SISTEMA;
  const cleanKey = apiKey ? apiKey.trim() : '';
  // Gemini tiene prioridad: GEMINI_API_KEY (o una clave de Google pasada como apiKey, por compatibilidad)
  const geminiKey = (geminiApiKey || '').trim()
    || (cleanKey.startsWith('AIzaSy') || cleanKey.startsWith('AQ.') ? cleanKey : '');
  const anthropicKey = geminiKey ? '' : cleanKey;

  if (!geminiKey && !anthropicKey) {
    console.error('[asistente] sin clave: falta GEMINI_API_KEY o ANTHROPIC_API_KEY en el servidor');
    return errorJson(503, 'api_error', MENSAJES_ASISTENTE.sinConfigurar[quien]);
  }
  const messages = limpiarMensajes(body, doctora ? MAX_CARACTERES_DOCTORA : MAX_CARACTERES);
  if (!messages) return errorJson(400, 'invalid_request_error', 'Conversación inválida.');

  if (geminiKey) {
    const upstream = await fetchImpl(`${URL_GEMINI}/${MODELO_GEMINI}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      // La clave va en el encabezado (no en la URL, que puede quedar en registros)
      headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sistema }] },
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.7 },
      }),
    });
    if (!upstream.ok) return errorDelProveedor('Gemini', upstream, quien);
    return new Response(geminiComoAnthropic(upstream.body, quien), {
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store' },
    });
  }

  const upstream = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      // Si el modelo declina por sus salvaguardas, la API reintenta con otro modelo en la misma llamada
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    body: JSON.stringify({
      model: MODELO_ASISTENTE,
      max_tokens: MAX_TOKENS,
      stream: true,
      system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }],
      output_config: { effort: 'low' }, // chat de preguntas frecuentes: respuestas rápidas
      fallbacks: 'default',
      messages,
    }),
  });

  if (!upstream.ok) return errorDelProveedor('Anthropic', upstream, quien);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'text/event-stream',
      'cache-control': 'no-store',
    },
  });
}

// Límite simple por IP (en memoria): frena abusos en desarrollo y en cada instancia serverless
const VENTANA_MS = 10 * 60 * 1000;
const MAX_POR_VENTANA = 30;
const uso = new Map();

export function dentroDelLimite(ip = 'anon', ahora = Date.now()) {
  const registro = uso.get(ip);
  if (!registro || ahora - registro.inicio > VENTANA_MS) {
    uso.set(ip, { inicio: ahora, n: 1 });
    return true;
  }
  registro.n += 1;
  return registro.n <= MAX_POR_VENTANA;
}

export const demasiadasSolicitudes = () =>
  errorJson(429, 'rate_limit_error', 'Hiciste muchas preguntas seguidas. Espera unos minutos e intenta de nuevo.');

// Adaptador para servidores Node (middleware de Vite): http.IncomingMessage → Response → http.ServerResponse
export function middlewareAsistente(apiKey, apiUrl = '', geminiApiKey = process.env.GEMINI_API_KEY) {
  return async (req, res, next) => {
    if (req.url.split('?')[0] !== RUTA_ASISTENTE) return next();
    const enviar = async (response) => {
      res.statusCode = response.status;
      response.headers.forEach((valor, clave) => res.setHeader(clave, valor));
      if (!response.body) return res.end();
      for await (const trozo of response.body) res.write(trozo);
      res.end();
    };
    try {
      if (req.method !== 'POST') return enviar(errorJson(405, 'invalid_request_error', 'Método no permitido.'));
      if (!dentroDelLimite(req.socket.remoteAddress)) return enviar(demasiadasSolicitudes());
      let raw = '';
      for await (const trozo of req) {
        raw += trozo;
        if (raw.length > 400_000) return enviar(errorJson(413, 'invalid_request_error', 'Conversación demasiado larga.'));
      }
      let body = null;
      try { body = JSON.parse(raw); } catch { /* cuerpo inválido: lo rechaza limpiarMensajes */ }
      await enviar(await responderAsistente(body, apiKey, fetch, {
        perfil: req.headers[ENCABEZADO_PERFIL],
        token: req.headers[ENCABEZADO_SESION],
        apiUrl,
        geminiApiKey,
      }));
    } catch (err) {
      console.error('[asistente]', err);
      const quien = req.headers[ENCABEZADO_PERFIL] === 'doctora' ? 'doctora' : 'paciente';
      if (!res.headersSent) await enviar(errorJson(503, 'api_error', MENSAJES_ASISTENTE.noDisponible[quien]));
      else res.end();
    }
  };
}
