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
| Chat WhatsApp | La paciente escribe | Notas de voz → transcripción con Gemini; fotos → las ve el agente (Claude). Después, red de seguridad sin IA sobre el texto, la transcripción o el pie de foto (emergencias → doctora y 911), "BAJA" → deja de recibir promociones, y si no, Clasificador → **Enfermera Virtual** o **Recepcionista VIP**. Video, documento o ubicación → respuesta corta sin IA. Botones y listas cuentan como texto; reacciones, stickers y estados de entrega se ignoran |
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
| **Modelo** | Claude Opus 5.5 | Claude Opus 5.5 (el clasificador usa Claude Haiku 4.5) |

### Decisiones de seguridad

- **Las emergencias no dependen de la IA:** una regla fija las detecta antes que cualquier modelo. El SOS tampoco pasa por IA.
- **Doble red en el check-in:** si la IA falla o subestima, escala la regla fija de la API.
- **Nadie queda sin respuesta:** si un agente falla, la paciente recibe contención y la doctora un aviso.
- **Mínimo privilegio:** cada agente tiene su modelo, memoria y herramientas. El teléfono sale del mensaje entrante, nunca de la IA.
- **Minimización de datos:** al modelo no le llegan teléfonos; en el check-in y el resumen, tampoco nombres.
- **Sesiones firmadas (HMAC), sin guardarlas:** la API valida la firma, la expiración y que el usuario siga existiendo con ese rol.
- **Privacidad en n8n:** el flujo API no guarda ninguna ejecución, porque cada una carga las hojas completas. El cerebro no guarda las exitosas.

> ⚠️ **Antes de producción:** los check-ins, historiales, mensajes y fotos del chat se envían a Anthropic, y las notas de voz a Google (Gemini) para transcribirlas. Se necesita el consentimiento informado de las pacientes (Ley 8968) y revisar las condiciones de uso de datos de Anthropic, Google y Meta.

## 1. Instalar n8n

n8n **2.x**. El nodo *Núcleo API* necesita el módulo `crypto` de Node:

```bash
NODE_FUNCTION_ALLOW_BUILTIN=crypto n8n start
# Docker: docker run -e NODE_FUNCTION_ALLOW_BUILTIN=crypto -p 5678:5678 -v n8n_data:/home/node/.n8n n8nio/n8n
```

En producción, n8n debe estar publicado por **HTTPS**: lo necesitan el sitio y Meta.

## 2. Hoja de datos (Google Sheets)

Crea una hoja de cálculo privada con **8 pestañas**, con estos nombres exactos (si falta una, Google rechaza la lectura y toda la API responde error):

`users` · `appointments` · `portal` · `checkins` · `sosAlerts` · `accesos` · `facturas` · `tratamientos`

Solo `users` necesita datos al inicio: la fila de encabezados y la doctora. Las demás columnas y filas las crea la API.

| id | name | phone | role |
|---|---|---|---|
| u-doc-1 | Dra. Laura Jiménez | +506 XXXX XXXX | doctor |

Con ese número la doctora recibe su enlace para entrar al panel.

> **Edita los datos desde el panel, no en la hoja.** Google Sheets convierte lo que se escribe a mano (por ejemplo, fechas en números) y las listas se guardan como JSON en una celda.

Además, la hoja **Base clínica** (pestaña `BaseClinica`) se crea desde [`base-clinica-ejemplo.csv`](base-clinica-ejemplo.csv). La Enfermera solo responde con lo que diga esa hoja, y **la doctora debe revisarla**. Ese CSV se genera desde [`REVISION-DOCTORA.md`](../REVISION-DOCTORA.md): no lo edites a mano.

## 3. Credenciales

| Credencial (tipo en n8n) | Se usa en | Qué poner |
|---|---|---|
| **Header Auth** · `Clínica · Secreto n8n` | Cerebro: *Webhook clínica*, nodos `API: …`, `ficha_*`, `registrar_cita`. API: *Enviar al cerebro* | Nombre `X-N8N-Secret`, valor = `n8nSecret` de *Configuración API* |
| **Header Auth** · `WhatsApp Cloud API` | *Enviar WhatsApp*, *Responder por WhatsApp*, `despertar_doctora`, *Meta: datos del medio*, *Meta: descargar medio* | Nombre `Authorization`, valor `Bearer <token permanente de Meta>` (con `whatsapp_business_messaging`, que también permite descargar los medios) |
| **WhatsApp OAuth API** | *WhatsApp entrante* | Client ID y Client Secret de la app de Meta |
| **Anthropic** | Los 5 nodos `Modelo · …` | API key de Anthropic |
| **Google Gemini(PaLM) Api** · `Gemini - Aura y WhatsApp` | *Gemini · Transcribir nota de voz* | API key de Google AI Studio (la misma `GEMINI_API_KEY`). Solo se guarda en n8n, nunca en el repo. En Cloud ya existe |
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
   | `graphApiVersion` | `v26.0`. Meta retira cada versión unos 2 años después de lanzarla: revisa [su lista](https://developers.facebook.com/docs/graph-api/changelog/versions) una vez al año |

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

| Nombre | Categoría | Texto | Botón |
|---|---|---|---|
| `nueva_solicitud_cita` | Utilidad | Hola doctora, llegó una nueva solicitud de cita. La paciente {{1}}, con número {{2}}, desea agendar {{3}} para el {{4}}. Puede revisarla y confirmarla en el panel médico. | — |
| `cita_cancelada` | Utilidad | Hola {{1}}, te avisamos que tu cita del {{2}} fue cancelada. Si deseas elegir una nueva fecha, solo responde a este mensaje y con gusto te ayudamos. | — |
| `alerta_clinica` | Utilidad | Hola doctora, hay una alerta de tipo {{1}} que necesita su atención. La paciente es {{2}} y su teléfono es {{3}}. Lo que ocurrió: {{4}}. Puede ver todos los detalles en el panel médico. | — |
| `sos_recibido` | Utilidad | Hola {{1}}, la Dra. Laura ya recibió tu aviso y te escribirá en pocos minutos. Si se trata de una emergencia médica, por favor llama de inmediato al 911. | — |
| `resumen_consulta` | Utilidad | Hola doctora, este es el resumen de la consulta de hoy con {{1}} a las {{2}}. Primer punto: {{3}}. Segundo punto: {{4}}. Tercer punto: {{5}}. Encontrará más detalles en el panel médico. | — |
| `recordatorio_cita` | Utilidad | Hola {{1}}, te recordamos que te esperamos mañana {{2}} a las {{3}}. Para prepararte antes de tu cita: {{4}}. Si necesitas cambiar la hora, solo responde a este mensaje. | — |
| `resumen_semana_clinica` | Utilidad | Hola doctora, esta semana hay {{1}} pasos programados en los mapas de belleza de sus pacientes: {{2}}. Puede revisarlos con calma en el panel médico. | — |
| `promocion` | Marketing | Hola {{1}}, en la clínica de la Dra. Laura tenemos una novedad especial para ti: {{2}} Si prefieres no recibir más promociones, solo responde BAJA. | — |
| `cita_recibida_v2` | Utilidad | Hola {{1}}, gracias por escribirnos. Recibimos tu solicitud de cita para el {{2}} y muy pronto te escribiremos por este medio para confirmar la hora. Mientras tanto, ya puedes entrar a tu portal privado desde el botón de abajo. | URL fija «Ir a mi portal» → `<sitio>/portal/acceso` |
| `cita_confirmada_v2` | Utilidad | Hola {{1}}, te confirmamos que tu cita quedó agendada para el {{2}} a las {{3}}. Puedes ver los detalles en tu portal privado y con gusto te esperamos en la clínica. | URL fija «Ver mi cita» → `<sitio>/portal` |
| `seguimiento_tratamiento_v2` | Utilidad | Hola {{1}}, queremos saber cómo te sientes hoy después de tu visita. Puedes contarnos desde tu portal privado o simplemente responder a este mensaje. | URL fija «Contar cómo me siento» → `<sitio>/portal` |
| `proximo_paso_mapa_v2` | Utilidad | Hola {{1}}, te recordamos que tu próximo paso en tu mapa de belleza está previsto para el {{2}}. Puedes ver tu plan completo en tu portal cuando gustes. | URL fija «Ver mi mapa» → `<sitio>/portal/mapa` |
| `codigo_acceso` | Autenticación | Formato fijo de Meta: código de 6 dígitos, recomendación de seguridad y caducidad de 15 minutos | «Copiar código» (el cerebro envía el código como parámetro) |

Reglas de Meta que cumplen estas plantillas: lenguaje natural (frases completas alrededor de cada variable), ninguna empieza ni termina con una variable y **ningún enlace va en el cuerpo**: el portal se abre con un botón de URL fija (`<sitio>` = `portalUrl`, hoy https://clinica-dra-laura.vercel.app). El acceso usa la categoría **Autenticación** con su formato fijo: la paciente o la doctora escriben el código de 6 dígitos en `/portal/acceso`. Idioma: *Spanish* (`es`). Meta pide un valor de ejemplo por variable.

Las versiones anteriores (`cita_recibida`, `cita_confirmada`, `seguimiento_tratamiento`, `proximo_paso_mapa`, `acceso_portal`, `acceso_panel`) ya no se usan.

Los mensajes a pacientes nunca nombran el tratamiento, porque una notificación puede verse en la pantalla bloqueada. Meta cobra las plantillas de marketing aparte.

### Modo pruebas (mientras Meta revisa las plantillas)

Los textos de todas las plantillas viven en [`plantillas.mjs`](plantillas.mjs). En el nodo *Configuración* del cerebro:

| Campo | Valor |
|---|---|
| `modoPruebas` | `si` para probar sin plantillas aprobadas; `no` en producción |
| `numerosPrueba` | Números que pueden recibir mensajes en pruebas, con código de país y separados por coma (p. ej. `50685758780,50662643156`) |

Con `modoPruebas = si`, cada mensaje sale como **texto libre** con el mismo texto de su plantilla (el botón va como enlace al final) y **solo a los números de la lista**: las rutinas no escriben a pacientes que no estén en ella. Meta entrega el texto libre únicamente si ese número le escribió a la clínica en las últimas 24 h, así que antes de probar hay que enviar un "hola" desde cada teléfono al WhatsApp de la clínica. Cuando las plantillas estén aprobadas, se vuelve a `no` y todo sale con plantillas, sin cambiar nada más.

## 6. Cómo se prueba

```bash
npm run verificar     # contrato completo contra el simulador + estructura de los flujos
npm run probar:n8n    # los dos flujos en un n8n real y local (necesita n8n instalado)
```

`probar:n8n` usa una carpeta temporal (no toca tu n8n) y simuladores de Google Sheets y de la API de WhatsApp:
- **Flujo API:** recorre el contrato completo, CORS, que un error no escriba en las hojas.
- **Cerebro:** recibe los eventos reales que emitió la API y comprueba cada WhatsApp: cita recibida, acceso de paciente y doctora, SOS, check-in, confirmación, cancelación y campaña. Además, el chat ("BAJA", una emergencia, y notas de voz, fotos y video con un simulador de los medios de Meta) y el aviso a la doctora cuando Google Sheets falla.

**Queda por verificar con cuentas reales:**
- las ramas con IA (sin credenciales de Anthropic solo se prueba su respaldo sin IA);
- el envío real por la API de Meta;
- el acceso real a Google (Sheets, Calendar, Drive).

## 7. Mantenimiento

- **Recordatorio de 24 h:** toma las citas `confirmada` con hora. La doctora las confirma en el panel; las reservas de la Recepcionista ya entran confirmadas.
- **Textos clínicos** (instrucciones previas, señales de emergencia, cuándo la Enfermera avisa a la doctora y Base clínica): se editan en [`REVISION-DOCTORA.md`](../REVISION-DOCTORA.md), que la doctora revisa y aprueba. `npm run generar:n8n` lo valida y lo lleva a los nodos *Mensajes: recordatorio 24 h*, *Red de seguridad clínica*, *Agente IA 1 · Enfermera Virtual* y al CSV de la Base clínica.
- **Editar los flujos:** cambia `n8n/generar-*.mjs` o `api/`, ejecuta `npm run generar:n8n` y vuelve a importar. Si editas directo en n8n, el próximo `generar:n8n` sobrescribe esos cambios.


## 8. Aplicar en Cloud sin reimportar (oct 2026)

Reimportar el JSON pisa los secretos, `apiUrl`, `modoPruebas`, `numerosPrueba` y las credenciales. Estos cambios se aplican **a mano** en el flujo **Clínica · Cerebro maestro** de n8n Cloud. Al terminar: **Save** y **Publish**.

**A. Versión de la Graph API** (Meta retira v21.0 el 21 ene 2027; v26.0 salió el 29 jul 2026, [lista oficial](https://developers.facebook.com/docs/graph-api/changelog/versions))

1. Abre el nodo **Configuración**.
2. En `graphApiVersion` cambia `v21.0` por `v26.0`. Nada más: todos los nodos de Meta leen la versión de ahí.

**B. Credencial de Gemini** (transcribe las notas de voz)

1. En Cloud **ya existe** la credencial `Gemini - Aura y WhatsApp` (tipo *Google Gemini(PaLM) Api*): no hay que crear nada. En una instalación nueva: *Overview → Credentials → Create credential → Google Gemini(PaLM) Api*.
2. *Host*: `https://generativelanguage.googleapis.com` (el que trae). *API Key*: la `GEMINI_API_KEY` (de Google AI Studio). La key vive solo en n8n: no la escribas en el repo ni en un nodo. Los modelos Claude siguen con su credencial actual (la gestionada del AI Gateway de n8n) y *Modelo · Analista* y *Modelo · Resumen* se quedan en Claude Haiku 4.5: no los cambies.
3. El token de Meta (credencial `WhatsApp Cloud API`) ya sirve para descargar audios y fotos: Meta pide el mismo token con permiso `whatsapp_business_messaging` ([Media API](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media)). La URL de cada medio dura 5 minutos; el flujo la usa al instante.

**C. Nodos nuevos: pegarlos de una vez**

1. Abre [`flujos/parche-cloud-notas-de-voz-y-fotos.json`](flujos/parche-cloud-notas-de-voz-y-fotos.json), copia **todo** su contenido y, con el lienzo del cerebro abierto, pulsa **Ctrl+V**. Aparecen 9 nodos ya conectados entre sí: *Revisar adjunto*, *¿Nota de voz o foto?*, *Meta: datos del medio*, *Meta: descargar medio*, *Revisar descarga*, *¿Es nota de voz?*, *Gemini · Transcribir nota de voz*, *Texto de la nota de voz* y *Respuesta: formato no soportado*.
> **Las fotos no tienen un nodo propio de IA:** usan la misma descarga (*¿Nota de voz o foto?* salida *Foto* → *Meta: datos del medio* → *Meta: descargar medio* → *Revisar descarga* → *¿Es nota de voz?* salida *Foto o fallo*) y llegan como archivo a la Enfermera o la Recepcionista, que las **ven** gracias a la opción *Automatically Passthrough Binary Images* (pasos D5 y D6). Sin esa opción activada, el agente solo lee el pie de foto.
2. Credenciales de los pegados: *Meta: datos del medio* y *Meta: descargar medio* → **WhatsApp Cloud API** (¡no el Secreto n8n!). *Gemini · Transcribir nota de voz* → **Gemini - Aura y WhatsApp**.
3. Conexiones (arrastra de la salida al nodo):
   - **Router por acción**, salida *Chat WhatsApp (agentes)*: borra la flecha a *Red de seguridad clínica* y conéctala a **Revisar adjunto**.
   - **¿Nota de voz o foto?**, salida *Texto u otro* → **Red de seguridad clínica**.
   - **¿Es nota de voz?**, salida *Foto o fallo* → **Red de seguridad clínica**.
   - **Texto de la nota de voz** → **Red de seguridad clínica**.
   - **Respuesta: formato no soportado** → **Responder por WhatsApp (texto)**.

**D. Editar nodos que ya existen**

1. **Normalizar mensaje**: borra todo el código y pega:

   ```js
   // Mensajes de pacientes. Se ignoran estados de entrega (statuses), reacciones, stickers y avisos del sistema.
   // tipo: "texto" (también botones y listas, con su título), "audio" (se transcribe), "imagen" (la ve el agente)
   // o "no_texto" (video, documento, ubicación...: respuesta corta sin IA).
   // contenido: lo que dijo o escribió la paciente (la red de seguridad lo revisa); texto: lo que leen la IA y la memoria.
   const raw = $input.first().json;
   const value = raw.messages ? raw : (raw.entry?.[0]?.changes?.[0]?.value || {});
   const mensaje = (value.messages || [])[0];
   if (!mensaje) return [];
   const OTROS = ['video', 'document', 'location', 'contacts', 'unsupported'];
   const opcion = mensaje.interactive?.button_reply || mensaje.interactive?.list_reply;
   let contenido = '';
   let tipo = 'texto';
   let medio = null;
   if (mensaje.type === 'text') contenido = mensaje.text?.body || '';
   else if (mensaje.type === 'button') contenido = mensaje.button?.text || mensaje.button?.payload || '';
   else if (mensaje.type === 'interactive') contenido = opcion?.title || '';
   else if (mensaje.type === 'audio' || mensaje.type === 'voice') {
     tipo = 'audio';
     medio = mensaje[mensaje.type] || {};
   } else if (mensaje.type === 'image') {
     tipo = 'imagen';
     medio = mensaje.image || {};
     contenido = medio.caption || '';
   } else if (OTROS.includes(mensaje.type)) {
     tipo = 'no_texto';
     contenido = mensaje[mensaje.type]?.caption || '';
   } else return [];
   if (tipo === 'texto' && !String(contenido).trim()) return [];
   contenido = String(contenido).slice(0, 1400);
   const texto = tipo === 'imagen' ? '[Foto enviada' + (contenido ? ': ' + contenido : '') + ']' : contenido;
   const contacto = (value.contacts || [])[0] || {};
   return [{
     json: {
       accion: 'chat_whatsapp',
       payload: {
         from: mensaje.from, nombre: contacto.profile?.name || '', texto, contenido, messageId: mensaje.id,
         tipo, tipoOriginal: mensaje.type, mediaId: medio?.id || '',
       },
     },
   }];
   ```

2. **Red de seguridad clínica**: **deja la línea `const SENALES = [...]`** (son las señales de la doctora) y reemplaza **todo lo que viene debajo** por:

   ```js
   // Regla fija, sin IA: una emergencia nunca depende de un modelo de lenguaje.
   // Revisa lo que la paciente escribió, dijo en la nota de voz (transcrita) o puso al pie de la foto.
   const entrada = $input.first();
   const item = entrada.json;
   const texto = String(item.payload.contenido ?? item.payload.texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
   // SENALES: REVISION-DOCTORA.md, sección 2 (se inserta al generar, ya sin tildes)
   const senal = SENALES.find((s) => texto.includes(s));
   // "BAJA" (solo esa palabra) deja de enviar promociones; una emergencia siempre tiene prioridad
   const baja = !senal && /^\s*(baja|stop)\s*[.!]*\s*$/.test(texto);
   // Video, documento, ubicación... o un audio/foto que no se pudo abrir: respuesta corta sin IA
   const noSoportado = !senal && !baja && ['no_texto', 'medio_fallido'].includes(item.payload.tipo);
   const ruta = senal ? 'emergencia' : baja ? 'baja' : noSoportado ? 'no_soportado' : 'conversacion';
   // La foto (binario) sigue hasta el agente para que la vea
   return [{ json: { ...item, ruta, senal: senal || '' }, ...(entrada.binary ? { binary: entrada.binary } : {}) }];
   ```

3. Switch **¿Emergencia?** → *Add Routing Rule* (4.ª regla): valor 1 `{{ $json.ruta }}` (modo *Expression*), *String → is equal to*, valor 2 `no_soportado`; activa *Rename Output* → `Formato no soportado`. Conecta esa salida → **Respuesta: formato no soportado**.
4. **Clasificador de intención** → categoría `clinica` → *Description*: cambia el texto por

   ```
   Dudas de salud, síntomas, dolor, inflamación, cuidados posteriores, fotos de la zona tratada, emociones o miedo después de un tratamiento.
   ```

5. **Agente IA 1 · Enfermera Virtual** → *Options → System Message*: pega este párrafo justo antes de «Citas, horarios y pagos los lleva la recepción…». Luego *Add Option → Automatically Passthrough Binary Images* → activado (así la Enfermera **ve** la foto):

   ```
   Notas de voz y fotos
   Si el mensaje empieza con "[Nota de voz transcrita]", es lo que la paciente te dijo en audio (la transcripción puede tener errores pequeños). Si dice "[Foto enviada]", la paciente te mandó una foto y la puedes ver: coméntala con prudencia y calidez, sin diagnosticar, relacionándola con su tratamiento y lo que la doctora aprobó. Ante signos de alarma visibles (zonas blancas, pálidas o moradas que sugieran necrosis, ampollas, pus o signos de infección, asimetría súbita importante) usa "despertar_doctora" de inmediato y díselo con calma.
   ```

6. **Agente IA 2 · Recepcionista VIP** → *System Message*: pega este párrafo justo antes de «Cómo hablas:», y activa también *Automatically Passthrough Binary Images*:

   ```
   Notas de voz y fotos: si el mensaje empieza con "[Nota de voz transcrita]", es lo que la paciente dijo en audio. Si dice "[Foto enviada]", puedes verla, pero no evalúas fotos de la zona tratada ni diagnosticas: dile con cariño que la enfermera de la clínica la revisa y que te cuente cómo se siente. Si en la foto ves signos de alarma (zonas blancas, pálidas o moradas, ampollas, pus, asimetría súbita importante), pídele que describa lo que siente para que la enfermera avise a la doctora de inmediato y, si empeora, que llame al 911.
   ```

**E. Probar** (con `modoPruebas = si` y tu número en `numerosPrueba`)

- Nota de voz «hola, ¿puedo hacer ejercicio mañana?» → responde la IA; en la ejecución, *Texto de la nota de voz* muestra `[Nota de voz transcrita] …`.
- Nota de voz diciendo una señal de emergencia → alerta a la doctora y 911, sin pasar por la IA.
- Foto con pie de foto → la Enfermera comenta la foto. Un video o un documento → «puedo leer texto, escuchar notas de voz y ver fotos…».
- Desde un número que **no** está en `numerosPrueba`: un audio o una foto no se descargan ni se responden.

**Límites de tamaño.** WhatsApp limita los audios a 16 MB y las fotos a 5 MB (lo mismo que acepta Claude por imagen); *Revisar descarga* rechaza lo que pase de ahí con una respuesta amable. En n8n Cloud el límite real es la memoria de la instancia: 320 MiB en Trial/Starter, 640 MiB en Pro-1 y 1280 MiB en Pro-2 (ver *Cloud data management* en la documentación de n8n). Un audio o una foto de WhatsApp caben de sobra, pero no conviene procesar muchos a la vez en Starter. El agente admite hasta 50 MB por imagen.

**Privacidad.** El nodo nativo de Gemini sube el audio a la *Files API* de Google, que lo borra sola a las 48 h. Las fotos van a Anthropic junto con el mensaje. Ninguna de las dos se guarda en n8n: las ejecuciones exitosas del cerebro no se conservan.
