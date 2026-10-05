# 🛠️ Plan de implementación (por fases)

Objetivo: el sitio terminado, con el frontend 100 % estático y **n8n como único backend**.
"Sin base de datos" significa que el frontend no habla con ninguna: los datos los guarda n8n en Google Sheets (datos), Drive (respaldos) y Calendar (agenda).

Todas las fases de código están hechas y verificadas. Lo que falta requiere tus cuentas o decisiones: [`README.md`](README.md) de esta carpeta.

---

## ✅ Fase 0: decisiones

- **D1 · Un solo acceso:** enlace mágico por WhatsApp para pacientes y doctora. No hay contraseñas.
- **D2 · Sesiones sin almacenamiento:** token firmado con HMAC (8 h pacientes, 4 h doctora). Cerrar sesión borra el token del navegador.
- **D3 · Sin club por cuenta:** las promociones se aceptan con una casilla en el formulario de cita. Hay baja por WhatsApp ("BAJA") o desde el panel.

## ✅ Fase 1: limpieza

- Fuera el registro y el login con contraseña, el club con cupones y el CRUD genérico de json-server.
- Fuera las métricas escritas a mano y el envío simulado del panel.
- Fuera las dependencias sin uso.
- **Queda manual:** mover o borrar los archivos que no son de la app (punto 1b de `pendientes/README.md`).

## ✅ Fase 2: contrato de API

- `api/nucleo.mjs` implementa todo el contrato una sola vez: lo usan `server.js` y el flujo API de n8n.
- Rutas del panel: `/admin/hoy`, citas, pacientes, ficha, plan, alertas y campañas. Para n8n se agregaron `/n8n/resumen` y `/n8n/baja`.
- El id de un recurso va en la query (`?id=`), porque n8n no publica rutas con parámetros en la URL del contrato.
- `npm run verificar` recorre el contrato completo.

## ✅ Fase 3: panel de la doctora

- Hoy, Citas, Pacientes (con el editor del plan), Alertas y Campañas, con carga diferida y el sistema visual del portal.
- Probado de punta a punta en el navegador.

## ✅ Fase 4: n8n

- **Flujo API:** un Webhook por ruta; el nodo *Núcleo API* lleva el mismo código del núcleo. Lee y escribe en Google Sheets.
- **Cerebro:** se agregaron cita confirmada y cancelada, campañas, el acceso propio de la doctora, "BAJA" en el chat, el resumen guardado en el panel, el respaldo semanal y el aviso de fallas.
- `npm run probar:n8n` prueba los dos flujos en un n8n real, con simuladores de Sheets y WhatsApp.

## ✅ Fase 5: cierre

- **Bundle principal** de 665 kB a 472 kB (gzip de 212 a 151 kB):
  - zod reemplazado por las reglas de react-hook-form;
  - axios reemplazado por `fetch`;
  - sonner con carga diferida.
- **Fuera DOMPurify:** no protegía nada (no hay `innerHTML`) y corrompía el texto: "<3" se guardaba como "&lt;3".
- **CSP estricto en producción:** sin `unsafe-inline` ni `unsafe-eval`. Verificado en el navegador con la build real.
- **Pruebas:** Vitest (hojas, núcleo, utilidades del panel, cliente HTTP) e integración continua en GitHub Actions.
- **Despliegue:** `vercel.json` y `public/_redirects`, para que las rutas del sitio no den 404 al recargar.

---

## Pendiente (no es código)

- **Prueba real** con las cuentas de Meta y Google (Gemini incluido). Las ramas con IA solo se probaron en su respaldo sin IA.
- **Límite de intentos** en el proxy delante de n8n (Cloudflare u otro).

## Después

- Fotos de evolución: carpeta privada de Drive servida por n8n, con consentimiento por foto.
- Videos de "Clínica privada": enlaces de corta duración. El panel ya acepta la URL de cada video.
