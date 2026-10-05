# Instrucciones para Claude Code

Proyecto: sitio, portal de pacientes y panel de la Dra. Laura Jiménez. Frontend estático (Vite + React) en Vercel; **n8n Cloud es el único backend** (sin Supabase ni servidor propio). `server.js` solo simula el backend en local. IA en producción: **Google Gemini** (Aura y los agentes de WhatsApp). Responde siempre en español.

## Cuando el usuario diga "deja listo todo" / "repasa que todo funcione antes de presentar"

Hazlo sin pedir confirmación para los pasos de lectura y comprobación:

1. `git checkout main && git pull` y `npm install`.
2. Si falta `.env`, créalo desde `.env.example` y pídele al usuario **solo** las claves que falten (`GEMINI_API_KEY` es la única imprescindible). Nunca muestres valores de claves ni los subas a git.
3. Corre **`npm run revisar`**: comprueba entorno, tests, lint, build, contrato, el sitio en Vercel, una respuesta real de Aura, la API de n8n Cloud y los modelos de Gemini. Debe terminar en "✓ Listo para presentar".
4. Si algo falla, diagnostícalo y corrígelo en el repo (tests en verde antes de commitear). Commits en una rama y PR a `main`.
5. Revisa n8n Cloud **solo leyendo**, desde Chrome con la sesión del usuario (`/rest/workflows/<id>` y `/rest/executions`): los dos flujos activos y publicados, y que las últimas ejecuciones no tengan errores.
   - Cerebro `0V4Q6anzzNMb8Hqz` · API `J6Bf13cyGRez1PXz` · instancia `https://pansaloca.app.n8n.cloud`.
   - No muestres en capturas ni en texto valores de nodos de configuración o credenciales.
6. Para la demo local: `npm run sembrar:demo` (sobrescribe `db.json`; respáldalo antes si tiene datos que importen).
7. Termina con un resumen corto: qué funciona, qué falló y qué tiene que hacer el usuario a mano (lista de la sección 7 de `npm run revisar`).

## Lo que Claude NO puede hacer (lo bloquea el sistema de permisos)

- **Escribir en n8n Cloud** (guardar, publicar, credenciales) ni **`vercel deploy --prod`**. No lo intentes por otra vía ni con subagentes.
- En su lugar: prepara archivos para importar en `n8n/respaldos-cloud/` (ignorado por git; parte siempre de un respaldo del estado real de Cloud para conservar configuración, ids de credenciales y webhookIds) y guía al usuario paso a paso (Ctrl+A → Supr → ⋯ → Import from File → Save → Publicar). Después verifica leyendo.
- Para publicar el sitio, pídele que escriba: `! npx vercel deploy --prod --yes`.

## Referencias

- Configuración completa en otra computadora: `CONFIGURAR-EN-LAPTOP.md`.
- Guías de n8n: `n8n/README.md` (sección 8) y `n8n/APLICAR-HOY.md`. Regenerar flujos: `ORIGEN_PERMITIDO="https://clinica-dra-laura.vercel.app,http://localhost:5173" npm run generar:n8n`.
- Pendientes y siguientes fases (Chatwoot, producción): `pendientes/README.md` y `pendientes/hoja-de-ruta-ecosistema.md`.
- Revisión clínica: `REVISION-DOCTORA.md`. La red de seguridad (911, alerta a la doctora, BAJA) va siempre antes de la IA.
- Avisos conocidos: la prueba gratuita de n8n Cloud vence alrededor del 7 de octubre de 2026 (tope de 1000 ejecuciones); el token de Meta es permanente; Meta está en modo prueba (solo números de `numerosPrueba`, que deben haber escrito en las últimas 24 h).
