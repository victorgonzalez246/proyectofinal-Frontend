import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { middlewareAsistente } from './api/_asistente.mjs'

// Content-Security-Policy de index.html:
// - inserta el origen real de la API (simulador local o webhooks de n8n) para que el navegador no bloquee otras URLs;
// - en la build de producción quita lo que solo necesita el servidor de desarrollo de Vite
//   (scripts inline y eval para la recarga en caliente, websocket local) y agrega restricciones.
function cspPlugin(env, command) {
  const apiOrigin = new URL(env.VITE_API_URL || 'http://localhost:3001').origin
  const reemplazar = (html, antes, despues) => {
    if (!html.includes(antes)) throw new Error(`CSP: no se encontró "${antes}" en index.html`)
    return html.replace(antes, despues)
  }
  return {
    name: 'csp',
    transformIndexHtml: (html) => {
      let out = reemplazar(html, '__API_ORIGIN__', apiOrigin)
      if (command === 'build') {
        out = reemplazar(out, "script-src 'self' 'unsafe-inline' 'unsafe-eval'", "script-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'")
        out = reemplazar(out, ' ws://localhost:*', '')
      }
      return out
    },
  }
}

// Asistente virtual: el servidor de desarrollo y el de preview atienden /api/asistente con la clave
// ANTHROPIC_API_KEY de .env (sin prefijo VITE_, así nunca entra al paquete del navegador).
// En producción lo atiende la función de Vercel api/asistente/v1/messages.js.
// apiUrl: backend contra el que se verifica la sesión de la doctora (Aura del panel)
function asistentePlugin(apiKey, apiUrl) {
  return {
    name: 'asistente',
    configureServer: (server) => { server.middlewares.use(middlewareAsistente(apiKey, apiUrl)) },
    configurePreviewServer: (server) => { server.middlewares.use(middlewareAsistente(apiKey, apiUrl)) },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  const apiTarget = env.VITE_API_URL || 'http://localhost:3001'
  return {
    plugins: [
      react(),
      tailwindcss(),
      cspPlugin(env, command),
      asistentePlugin(process.env.ANTHROPIC_API_KEY || loadEnv(mode, process.cwd(), 'ANTHROPIC_').ANTHROPIC_API_KEY, apiTarget),
    ],
    // Desarrollo: src/services/api.js usa rutas relativas y este proxy las reenvía al simulador (sin CORS).
    // Son las rutas reales del contrato (api/nucleo.mjs). /admin y /auth también son páginas de React:
    // si el navegador pide HTML (navegación o recarga), se sirve la app en lugar de reenviar.
    server: {
      proxy: Object.fromEntries(
        ['^/auth/', '^/appointments', '^/me(/|$|\\?)', '^/logout', '^/admin/', '^/n8n/'].map((ruta) => [
          ruta,
          {
            target: apiTarget,
            changeOrigin: true,
            bypass: (req) => (req.headers.accept?.includes('text/html') ? '/index.html' : undefined),
          },
        ])
      ),
    },
  }
})
