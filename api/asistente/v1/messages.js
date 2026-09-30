// Función de Vercel: POST /api/asistente/v1/messages (el SDK de Anthropic del navegador llama aquí)
// La clave vive en la variable de entorno ANTHROPIC_API_KEY del proyecto en Vercel.
import { dentroDelLimite, demasiadasSolicitudes, responderAsistente } from '../../_asistente.mjs';

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim();
  if (!dentroDelLimite(ip)) return demasiadasSolicitudes();
  let body = null;
  try { body = await request.json(); } catch { /* cuerpo inválido: lo rechaza responderAsistente */ }
  return responderAsistente(body, process.env.ANTHROPIC_API_KEY);
}
