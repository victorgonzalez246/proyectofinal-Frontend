import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

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

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  return {
    plugins: [
      react(),
      tailwindcss(),
      cspPlugin(env, command),
    ],
  }
})
