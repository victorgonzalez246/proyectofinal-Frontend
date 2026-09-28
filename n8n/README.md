# 🧠 n8n: el backend de la Clínica Dra. Laura Jiménez

En producción no hay servidor propio: **n8n es todo el backend**. Son dos flujos:

| Flujo | Archivo | Qué hace |
|---|---|---|
| **Clínica · API** | [`flujos/api-clinica.json`](flujos/api-clinica.json) | Atiende al sitio: un Webhook por ruta del contrato. Guarda los datos en Google Sheets. |
| **Clínica · Cerebro maestro** | [`flujos/cerebro-maestro-clinica.json`](flujos/cerebro-maestro-clinica.json) | Automatizaciones: WhatsApp, los dos agentes de IA, rutinas diarias, respaldo y aviso de fallas. |

Los dos JSON se generan desde código. **No los edites a mano:**

```bash
npm run generar:n8n                                  # regenera ambos
ORIGEN_PERMITIDO=https://tu-sitio.com npm run generar:n8n   # CORS del sitio publicado
```

## Arquitectura

```
Sitio (React, estático) ──HTTPS──► Flujo API ── Webhook por ruta ─► Leer hojas ─► Núcleo API ─► Escribir hojas ─► Responder
                                        │                                             (api/nucleo.mjs)
                                        └── eventos (X-N8N-Secret) ──► Flujo Cerebro
                                                                          │
   WhatsApp entrante ─────────────────────────────────────────────────────┤
   CRON 7:00 · 8:00 · 10:00 · lunes 9:00 · domingo 23:00 ────────────────┤
   Falla en cualquier flujo ─────────────────────────────────────────────┘
                                                              ▼
                                       Configuración ─► Router por acción ─► ramas ─► WhatsApp Cloud API
```

**Núcleo API.** El nodo *Núcleo API* lleva dentro el código de [`api/nucleo.mjs`](../api/nucleo.mjs) y [`api/hojas.mjs`](../api/hojas.mjs) tal cual:
- `server.js` usa esa misma lógica en desarrollo, así que `npm run verificar` prueba exactamente lo que corre en n8n;
- si cambias el núcleo, `npm run verificar` falla hasta que regeneres los flujos.

### Ramas del cerebro

| Acción | Origen | Qué envía |
|---|---|---|
| Chat WhatsApp | La paciente escribe | Red de seguridad sin IA (emergencias → doctora y 911), "BAJA" → deja de recibir promociones, y si no, Clasificador → **Enfermera Virtual** o **Recepcionista VIP** |
| Check-in | Portal | Analista emocional (IA) + regla fija de respaldo → alerta a la doctora |
| SOS | Portal | Alerta inmediata a la doctora + contención a la paciente (sin IA) |
| Cita recibida | Landing | Aviso a la paciente (con enlace a su portal) y a la doctora |
| Cita confirmada / cancelada | Panel de la doctora | Aviso a la paciente con fecha y hora (sin nombrar el tratamiento) |
| Acceso | Pantalla de acceso | Enlace mágico: `acceso_portal` a pacientes, `acceso_panel` a la doctora |
| Campaña | Panel de la doctora | `promocion` solo a quienes la aceptaron |
| Preparar consultas (7:00) | CRON | Resumen de 3 puntos (IA) por WhatsApp y en la vista *Hoy* del panel |
| Recordatorio 24 h (8:00) | CRON | Citas confirmadas de mañana, con instrucciones previas |
| Seguimiento (10:00) | CRON | Días 1, 3, 7 y 14 después del tratamiento |
| Próximos pasos (lunes 9:00) | CRON | Pasos del mapa de belleza de la semana |
| Respaldo (domingo 23:00) | CRON | Copia de la hoja de datos en una carpeta privada de Drive |
| Falla del sistema | Cualquier flujo que falle | Aviso a la doctora por WhatsApp |

### Los dos agentes

| | 🤖 Agente IA 1 · Enfermera Virtual | 🤖 Agente IA 2 · Recepcionista VIP |
|---|---|---|
| **Tareas** | Triaje 24/7 por WhatsApp y análisis emocional de cada check-in | Agenda por WhatsApp y resumen de 3 puntos antes de cada consulta |
| **Herramientas** | `ficha_paciente` (perfil clínico), `base_clinica`, `despertar_doctora` | `ficha_recepcion` (sin datos clínicos), `disponibilidad_agenda`, `bloquear_agenda`, `registrar_cita` |
| **No puede** | Reservar citas ni ver la agenda | Ver historiales clínicos ni responder temas de salud |
| **Modelo** | Claude Sonnet 5 | Claude Sonnet 5 (el clasificador usa Claude Haiku 4.5) |

### Decisiones de seguridad

- **Las emergencias no dependen de la IA:** una regla fija las detecta antes que cualquier modelo. El SOS tampoco pasa por IA.
- **Doble red en el check-in:** si la IA falla o subestima, escala la regla fija de la API.
- **Nadie queda sin respuesta:** si un agente falla, la paciente recibe contención y la doctora un aviso.
- **Mínimo privilegio:** cada agente tiene su modelo, memoria y herramientas. El teléfono sale del mensaje entrante, nunca de la IA.
- **Minimización de datos:** al modelo no le llegan teléfonos; en el check-in y el resumen, tampoco nombres.
- **Sesiones firmadas (HMAC), sin guardarlas:** la API valida la firma, la expiración y que el usuario siga existiendo con ese rol.
- **Privacidad en n8n:** el flujo API no guarda ninguna ejecución, porque cada una carga las hojas completas. El cerebro no guarda las exitosas.

> ⚠️ **Antes de producción:** los check-ins, historiales y mensajes se envían a Anthropic. Se necesita el consentimiento informado de las pacientes (Ley 8968) y revisar las condiciones de uso de datos de Anthropic, Google y Meta.

## 1. Instalar n8n

n8n **2.x**. El nodo *Núcleo API* necesita el módulo `crypto` de Node:

```bash
NODE_FUNCTION_ALLOW_BUILTIN=crypto n8n start
# Docker: docker run -e NODE_FUNCTION_ALLOW_BUILTIN=crypto -p 5678:5678 -v n8n_data:/home/node/.n8n n8nio/n8n
```

En producción, n8n debe estar publicado por **HTTPS**: lo necesitan el sitio y Meta.

## 2. Hoja de datos (Google Sheets)

Crea una hoja de cálculo privada con **6 pestañas**, con estos nombres exactos:

`users` · `appointments` · `portal` · `checkins` · `sosAlerts` · `accesos`

Solo `users` necesita datos al inicio: la fila de encabezados y la doctora. Las demás columnas y filas las crea la API.

| id | name | phone | role |
|---|---|---|---|
| u-doc-1 | Dra. Laura Jiménez | +506 XXXX XXXX | doctor |

Con ese número la doctora recibe su enlace para entrar al panel.

> **Edita los datos desde el panel, no en la hoja.** Google Sheets convierte lo que se escribe a mano (por ejemplo, fechas en números) y las listas se guardan como JSON en una celda.

Además, la hoja **Base clínica** (pestaña `BaseClinica`) se crea desde [`base-clinica-ejemplo.csv`](base-clinica-ejemplo.csv). La Enfermera solo responde con lo que diga esa hoja, y **la doctora debe revisarla**.

## 3. Credenciales

| Credencial (tipo en n8n) | Se usa en | Qué poner |
|---|---|---|
| **Header Auth** · `Clínica · Secreto n8n` | Cerebro: *Webhook clínica*, nodos `API: …`, `ficha_*`, `registrar_cita`. API: *Enviar al cerebro* | Nombre `X-N8N-Secret`, valor = `n8nSecret` de *Configuración API* |
| **Header Auth** · `WhatsApp Cloud API` | *Enviar WhatsApp*, *Responder por WhatsApp*, `despertar_doctora` | Nombre `Authorization`, valor `Bearer <token permanente de Meta>` |
| **WhatsApp OAuth API** | *WhatsApp entrante* | Client ID y Client Secret de la app de Meta |
| **Anthropic** | Los 5 nodos `Modelo · …` | API key de Anthropic |
| **Google Sheets OAuth2** | API: *Leer hojas*, *Escribir hojas*. Cerebro: `base_clinica` | Cuenta con acceso a las dos hojas |
| **Google Calendar OAuth2** | `disponibilidad_agenda`, `bloquear_agenda` | Cuenta de la agenda de la doctora |
| **Google Drive OAuth2** | *Respaldar hoja de datos* | Cuenta con acceso a la hoja de datos y a la carpeta de respaldos |

> Un agente **no arranca si una de sus herramientas no tiene credencial**: entonces se activa la respuesta de respaldo.

## 4. Importar y configurar

1. *Workflows → Import from File*: importa los **dos** JSON.
2. Asigna las credenciales en los nodos marcados en rojo.
3. **Flujo API → nodo *Configuración API*** (único lugar con datos de la instalación):

   | Campo | Valor |
   |---|---|
   | `sheetsApi` | `https://sheets.googleapis.com/v4` (no cambiar) |
   | `sheetId` | ID de la hoja de datos (el tramo largo de su URL) |
   | `portalUrl` | URL pública del sitio, p. ej. `https://clinica.com` |
   | `cerebroWebhookUrl` | *Production URL* del nodo *Webhook clínica* del cerebro |
   | `sessionSecret` | Secreto largo y aleatorio: firma las sesiones |
   | `n8nSecret` | Otro secreto distinto: el mismo de la credencial `Clínica · Secreto n8n` |

   Para generar cada secreto: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   Si cambias `sessionSecret`, todas las sesiones abiertas se cierran.

4. **Flujo Cerebro → nodo *Configuración***:

   | Campo | Ejemplo |
   |---|---|
   | `whatsappPhoneNumberId` | Phone Number ID de Meta (WhatsApp → API Setup) |
   | `clinicWhatsapp` | `50688888888`: WhatsApp de la doctora (alertas y resúmenes) |
   | `portalUrl` | La misma URL del sitio |
   | `apiUrl` | Base de los webhooks del flujo API: `https://tu-n8n.com/webhook` |
   | `googleCalendarId` | `primary` o el ID de la agenda |
   | `baseClinicaSheetId` / `baseClinicaRango` | ID de la hoja *Base clínica* / `BaseClinica!A:D` |
   | `datosSheetId` | El mismo `sheetId` de la hoja de datos |
   | `respaldoCarpetaId` | ID de la carpeta privada de Drive para los respaldos |
   | `templateLanguage` | `es` (o el idioma con que aprobaste las plantillas) |

5. En **los dos flujos**: *Settings → Error workflow → Clínica · Cerebro maestro*. Sin esto, las fallas no le llegan a la doctora.
6. Publica los dos flujos. En Meta, apunta el webhook de WhatsApp a la URL del nodo *WhatsApp entrante*.
7. En el sitio, `VITE_API_URL` = `https://tu-n8n.com/webhook` y vuelve a compilar (`npm run build`).
8. Genera el flujo API con el dominio real del sitio: `ORIGEN_PERMITIDO=https://clinica.com npm run generar:n8n` (CORS) y vuelve a importarlo.

### Límite de intentos

n8n no limita las peticiones por IP. El simulador sí lo hace (`server.js`). En producción, pon reglas de *rate limiting* en el proxy o CDN delante de n8n (por ejemplo, Cloudflare) para las rutas públicas:
- `/webhook/auth/magic-link`: 5 cada 15 min;
- `/webhook/auth/verify`: 10 cada 15 min;
- `/webhook/appointments`: 5 cada 10 min.

### Concurrencia

Cada petición lee las hojas, calcula y escribe solo las filas que cambió. Si dos peticiones **crean** filas en la misma pestaña en el mismo segundo, la segunda puede escribir sobre la primera. Para el volumen de una clínica es muy improbable. Si crece, limita el flujo API a una ejecución a la vez (modo *queue* con concurrencia 1) o migra el almacén.

## 5. Plantillas de WhatsApp (aprobar en Meta)

Las respuestas del chat son texto libre, permitido porque la paciente escribió primero (ventana de 24 h). Todo lo que inicia la clínica usa plantillas aprobadas:

| Nombre | Categoría | Texto sugerido |
|---|---|---|
| `cita_recibida` | Utilidad | Hola {{1}}, recibimos tu solicitud de cita para el {{2}}. Te escribimos por aquí para confirmar la hora. Tu portal privado ya está listo: {{3}} |
| `nueva_solicitud_cita` | Utilidad | Nueva solicitud de cita: {{1}} ({{2}}) quiere {{3}} el {{4}}. |
| `cita_confirmada` | Utilidad | Hola {{1}}, tu cita quedó confirmada para el {{2}} a las {{3}}. Te esperamos. Tu portal: {{4}} |
| `cita_cancelada` | Utilidad | Hola {{1}}, tu cita del {{2}} fue cancelada. Si quieres reprogramarla, responde a este mensaje. |
| `acceso_portal` | Autenticación | Hola {{1}}, este es tu acceso a tu portal privado con la Dra. Laura: {{2}}. Vale por 15 minutos y funciona una sola vez. |
| `acceso_panel` | Autenticación | Tu acceso al panel médico: {{1}}. Vale por 15 minutos y funciona una sola vez. Si no lo pediste, ignora este mensaje. |
| `alerta_clinica` | Utilidad | Alerta ({{1}}): {{2}}, {{3}}. {{4}} |
| `sos_recibido` | Utilidad | {{1}}, la Dra. Laura ya recibió tu aviso y te escribe en minutos. Si es una emergencia médica, llama al 911. |
| `resumen_consulta` | Utilidad | Consulta de hoy: {{1}} a las {{2}}. 1) {{3}} 2) {{4}} 3) {{5}} |
| `recordatorio_cita` | Utilidad | Hola {{1}}, te esperamos mañana {{2}} a las {{3}}. Antes de tu cita: {{4}} |
| `seguimiento_tratamiento` | Utilidad | Hola {{1}}, ¿cómo te sientes hoy? Cuéntanos en tu portal: {{2}} |
| `proximo_paso_mapa` | Utilidad | Hola {{1}}, tu próximo paso en tu mapa de belleza es el {{2}}. Míralo aquí: {{3}} |
| `resumen_semana_clinica` | Utilidad | Esta semana hay {{1}} paso(s) del mapa de belleza: {{2}} |
| `promocion` | Marketing | Hola {{1}}, {{2}} Si no quieres recibir más promociones, responde BAJA. |

Los mensajes a pacientes nunca nombran el tratamiento, porque una notificación puede verse en la pantalla bloqueada. Meta cobra las plantillas de marketing aparte.

## 6. Cómo se prueba

```bash
npm run verificar     # contrato completo contra el simulador + estructura de los flujos
npm run probar:n8n    # los dos flujos en un n8n real y local (necesita n8n instalado)
```

`probar:n8n` usa una carpeta temporal (no toca tu n8n) y simuladores de Google Sheets y de la API de WhatsApp:
- **Flujo API:** recorre el contrato completo, CORS, que un error no escriba en las hojas.
- **Cerebro:** recibe los eventos reales que emitió la API y comprueba cada WhatsApp: cita recibida, acceso de paciente y doctora, SOS, check-in, confirmación, cancelación y campaña. Además, el chat ("BAJA" y una emergencia) y el aviso a la doctora cuando Google Sheets falla.

**Queda por verificar con cuentas reales:**
- las ramas con IA (sin credenciales de Anthropic solo se prueba su respaldo sin IA);
- el envío real por la API de Meta;
- el acceso real a Google (Sheets, Calendar, Drive).

## 7. Mantenimiento

- **Recordatorio de 24 h:** toma las citas `confirmada` con hora. La doctora las confirma en el panel; las reservas de la Recepcionista ya entran confirmadas.
- **Instrucciones previas:** en el nodo *Mensajes: recordatorio 24 h* del cerebro. Son textos de ejemplo que la doctora debe validar.
- **Editar los flujos:** cambia `n8n/generar-*.mjs` o `api/`, ejecuta `npm run generar:n8n` y vuelve a importar. Si editas directo en n8n, el próximo `generar:n8n` sobrescribe esos cambios.
