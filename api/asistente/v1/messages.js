// Función de Vercel: POST /api/asistente/v1/messages (el SDK de Anthropic del navegador llama aquí)
// Las claves viven en las variables de entorno del proyecto en Vercel: GEMINI_API_KEY (prioridad)
// o ANTHROPIC_API_KEY. VITE_API_URL sirve para verificar la sesión de la doctora.
import { dentroDelLimite, demasiadasSolicitudes, ENCABEZADO_PERFIL, ENCABEZADO_SESION, MENSAJES_ASISTENTE, responderAsistente } from '../../_asistente.mjs';

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim();
  if (!dentroDelLimite(ip)) return demasiadasSolicitudes();
  let body = null;
  try { body = await request.json(); } catch { /* cuerpo inválido: lo rechaza responderAsistente */ }
  const perfil = request.headers.get(ENCABEZADO_PERFIL);
  try {
    return await responderAsistente(body, process.env.ANTHROPIC_API_KEY, fetch, {
      perfil,
      token: request.headers.get(ENCABEZADO_SESION),
      apiUrl: process.env.VITE_API_URL,
      geminiApiKey: process.env.GEMINI_API_KEY,
    });
  } catch (err) {
    // Sin red hacia el proveedor u otro fallo inesperado: la causa queda en el registro, la paciente ve un mensaje amable
    console.error('[asistente]', err?.message || err);
    const message = MENSAJES_ASISTENTE.noDisponible[perfil === 'doctora' ? 'doctora' : 'paciente'];
    return new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message } }), {
      status: 503,
      headers: { 'content-type': 'application/json', 'x-should-retry': 'false' },
    });
  }
}
