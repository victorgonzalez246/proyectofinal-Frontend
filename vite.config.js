import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// Inserta en el Content-Security-Policy de index.html el origen real de la API
// (simulador local hoy, webhooks de n8n mañana) para que el navegador no bloquee otras URLs.
function cspApiOrigin(env) {
  const apiOrigin = new URL(env.VITE_API_URL || 'http://localhost:3001').origin
  return {
    name: 'csp-api-origin',
    transformIndexHtml: (html) => html.replace('__API_ORIGIN__', apiOrigin),
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  return {
    plugins: [
      react(),
      tailwindcss(),
      cspApiOrigin(env),
    ],
  }
})
