# 💻 Configurar el proyecto en otra computadora (laptop)

Guía para dejar todo funcionando desde cero en la laptop: código, claves, modo local, pruebas, publicación en Vercel y n8n Cloud.

> Las claves **nunca** van al repositorio (el repo es público). Copia el archivo `.env` a mano desde la otra PC (USB, gestor de contraseñas) o vuelve a crear las claves con esta guía.

---

## 1. Programas necesarios

| Programa | Versión | Para qué |
|---|---|---|
| [Node.js](https://nodejs.org) | **24.x** (el proyecto se probó con 24.19) | Ejecutar la app, los tests y los scripts |
| [Git](https://git-scm.com) | cualquiera reciente | Bajar y subir el código |
| [GitHub CLI](https://cli.github.com) (`gh`) | opcional | Pull requests desde la terminal |
| Google Chrome | — | Probar el sitio y entrar a n8n |

Comprueba en una terminal:

```bash
node -v    # v24.x
git --version
```

## 2. Bajar el código

Primera vez:

```bash
git clone https://github.com/victorgonzalez246/proyectofinal-Frontend.git clinica-app
cd clinica-app
npm install
```

Si la carpeta ya existe en la laptop:

```bash
cd clinica-app
git checkout main
git pull
npm install
```

La rama principal es **`main`** (tiene todo lo entregado). `cierre-proyecto` es la rama de trabajo y ya está fusionada.

## 3. Archivo `.env` (claves)

Copia la plantilla y complétala:

```bash
cp .env.example .env
```

| Variable | ¿Obligatoria? | Dónde se obtiene |
|---|---|---|
| `GEMINI_API_KEY` | **Sí** (Aura) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Empieza con `AQ.` o `AIza`. Recomendado: activar la facturación del proyecto para evitar el error "high demand". |
| `SESSION_SECRET` | Sí (simulador local) | Cualquier texto largo y aleatorio: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `N8N_SHARED_SECRET` | Sí (simulador local) | Otro texto largo y aleatorio, con el mismo comando |
| `PORTAL_URL` | Ya viene | `http://localhost:5173` |
| `ALLOWED_ORIGINS` | Ya viene | `http://localhost:5173,http://localhost:4173` |
| `VITE_API_URL` | Ya viene | `http://localhost:3001` (el simulador) |
| `N8N_WEBHOOK_URL` | No | Vacío en local: el código de acceso se muestra en pantalla |
| `ANTHROPIC_API_KEY` | No | Respaldo opcional de Aura si no hay `GEMINI_API_KEY` (la cuenta actual no tiene crédito) |

`.env.n8n` ya está en el repo (solo trae la URL pública de n8n Cloud) y no lleva claves.

## 4. Correr el proyecto en local (modo demo, sin n8n)

```bash
npm run sembrar:demo     # crea db.json con datos de demostración (sobrescribe el db.json actual)
npm run server           # terminal 1: simulador del backend en http://localhost:3001
npm run dev              # terminal 2: sitio en http://localhost:5173
```

| Entrar como | Teléfono |
|---|---|
| Doctora (panel `/admin`) | 8888 8888 |
| Paciente demo Valeria Rojas (portal `/portal`) | 8888 0001 |

El código de 6 dígitos aparece en pantalla y en la consola del simulador (porque `N8N_WEBHOOK_URL` está vacío).

**Modo contra producción** (el sitio local usa n8n Cloud real en vez del simulador):

```bash
npm run dev:n8n
```

## 5. Comprobar que todo funciona

```bash
npm test             # 201 tests
npm run lint
npm run build
npm run verificar    # contrato de la API y flujos de n8n
npm run probar:n8n   # opcional: levanta un n8n local con simuladores (necesita n8n instalado: npm i -g n8n)
```

Todo debe terminar sin errores.

## 6. Publicar el sitio en Vercel

El proyecto de Vercel es **`clinica-dra-laura`** → https://clinica-dra-laura.vercel.app. Vercel **no** está conectado a GitHub: un `git push` no publica; hay que desplegar con la CLI.

Primera vez en la laptop:

```bash
npx vercel login                                  # inicia sesión con la cuenta de Vercel
npx vercel link --yes --project clinica-dra-laura # vincula la carpeta (crea .vercel/, ignorado por git)
```

Cada vez que quieras publicar:

```bash
npx vercel deploy --prod --yes
```

Variables ya configuradas en Vercel (Production), no hace falta repetirlas: `VITE_API_URL` (URL de n8n Cloud) y `GEMINI_API_KEY`. Para verlas: `npx vercel env ls`. Si cambias la clave de Gemini: `npx vercel env rm GEMINI_API_KEY production` y luego `npx vercel env add GEMINI_API_KEY production --sensitive`.

## 7. n8n Cloud (el cerebro)

Instancia: **https://pansaloca.app.n8n.cloud** (inicia sesión en Chrome). Todo lo de n8n se configura en la web; en la laptop no hay que instalar nada para que funcione.

| Flujo | Id | Qué hace |
|---|---|---|
| Clínica · Cerebro maestro (nuevo) | `0V4Q6anzzNMb8Hqz` | WhatsApp con IA (texto, notas de voz, fotos), recordatorios, alertas |
| Clínica · API | `J6Bf13cyGRez1PXz` | Todas las rutas que usa la página (portal y panel) |

Credenciales que deben existir en n8n (ya están creadas):

| Credencial | Tipo | Notas |
|---|---|---|
| `Gemini - Aura y WhatsApp` | Google Gemini (PaLM) API | Modelos de los agentes y transcripción de notas de voz |
| `Clínica · Secreto n8n` | Header Auth | Nombre `X-N8N-Secret`; valor = campo `n8nSecret` del nodo *Configuración API* |
| `Header Auth account` | Header Auth | Token de Meta (WhatsApp Cloud API) |
| `Google Calendar account` | Google Calendar OAuth2 | *Allowed HTTP Request Domains* = `www.googleapis.com` |

Estado actual: **modo pruebas activo** (solo responde a los números de `numerosPrueba` en el nodo *Configuración*), Graph API `v26.0`, Enfermera y Recepcionista con `gemini-3.6-flash` y respaldo `gemini-3.5-flash-lite`.

⚠️ La prueba gratuita de n8n Cloud vence alrededor del **7 de octubre de 2026**. Sin un plan pagado, el chat de WhatsApp y la API de la página dejan de funcionar.

**Cambiar un flujo en Cloud** (nunca reimportar a ciegas: los flujos del repo son plantillas sin tus secretos):

1. Descarga un respaldo del flujo actual (⋯ → Download) y guárdalo en `n8n/respaldos-cloud/` (ignorado por git).
2. Sigue las guías `n8n/README.md` (sección 8) y `n8n/APLICAR-HOY.md`.
3. Para regenerar los flujos del repo: `ORIGEN_PERMITIDO="https://clinica-dra-laura.vercel.app,http://localhost:5173" npm run generar:n8n`.

## 8. Meta / WhatsApp

- El webhook de la app de Meta apunta al nodo *WhatsApp entrante* del Cerebro (Meta acepta un solo webhook por app).
- En modo prueba, cada número de prueba debe haber escrito a la clínica en las últimas 24 h para recibir respuestas.
- El token de Meta (credencial `Header Auth account`) es **permanente**: no vence.
- Pendiente para salir de modo prueba: verificación de negocio y plantilla `codigo_acceso` (ver `pendientes/README.md`).

## 9. Archivos que NO están en git (cópialos a mano si los necesitas)

| Archivo | Contenido |
|---|---|
| `.env` | Tus claves (sección 3) |
| `db.json` | Datos locales del simulador (se regeneran con `npm run sembrar:demo`) |
| `n8n/respaldos-cloud/` | Respaldos de los flujos de Cloud y archivos para importar (contienen configuración privada) |
| `.vercel/`, `.env.local` | Se crean con `npx vercel link` |

## 10. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| Aura dice "no está disponible" | Falta `GEMINI_API_KEY` en `.env` (local) o en Vercel; reinicia `npm run dev` tras editar `.env`. |
| WhatsApp avisa a la doctora que "la IA no pudo responder" | Gemini saturado (503). El agente ya pasa al modelo de respaldo; activar la facturación de Gemini lo reduce. |
| Las herramientas de WhatsApp fallan con "Secreto de n8n inválido" | La credencial `Clínica · Secreto n8n` no coincide con `n8nSecret` de *Configuración API*. |
| La Recepcionista no ve la agenda | La credencial de Google Calendar no permite `www.googleapis.com` en HTTP Request. |
| El panel no muestra datos en local | No corriste `npm run server` o falta `db.json` (`npm run sembrar:demo`). |
| `git push` no actualiza el sitio | Normal: publica con `npx vercel deploy --prod --yes`. |

Más contexto: `README.md`, `docs/ARQUITECTURA-PORTAL.md`, `pendientes/README.md` y la hoja de ruta `pendientes/hoja-de-ruta-ecosistema.md`.
