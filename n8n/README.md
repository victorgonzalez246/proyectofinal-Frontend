# Flujos de n8n: Clínica Dra. Laura Jiménez

Automatizaciones listas para importar en n8n. Hoy se conectan con el simulador (`server.js`).
En la fase 2 se conectarán con la API definitiva (ver `docs/ARQUITECTURA-PORTAL.md`).

| Archivo | Disparador | Qué hace |
|---|---|---|
| `01-cita-recibida.json` | Webhook `clinica/cita-recibida` | Confirma a la paciente por WhatsApp (con acceso a su portal) y avisa a la clínica de la nueva solicitud. |
| `02-acceso-portal-whatsapp.json` | Webhook `clinica/acceso-portal` | Envía el enlace mágico de acceso al portal. |
| `03-alertas-clinica.json` | Webhook `clinica/alertas` | Check-in preocupante → aviso a la clínica. SOS → aviso urgente a la clínica y mensaje de contención a la paciente. |
| `04-recordatorio-cita-24h.json` | Todos los días, 8:00 | Recordatorio de las citas **confirmadas** de mañana, con instrucciones previas según el tratamiento. |
| `05-seguimiento-post-tratamiento.json` | Todos los días, 10:00 | Pregunta "¿cómo te sientes?" los días 1, 3, 7 y 14 después del tratamiento. |
| `06-proximos-pasos-mapa.json` | Lunes, 9:00 | Avisa a cada paciente de su próximo paso del mapa de belleza en los próximos 7 días y envía un resumen a la clínica. |

Todos los mensajes a pacientes evitan nombrar el tratamiento: una notificación de WhatsApp puede verse en la pantalla bloqueada.

## 1. Levantar n8n en local

El simulador corre en tu máquina, así que n8n también debe correr ahí (n8n Cloud no puede llegar a `localhost`).

```bash
docker run -it --rm -p 5678:5678 -v n8n_data:/home/node/.n8n n8nio/n8n
```

Si usas Docker, en el nodo **Configuración** de cada flujo cambia `apiUrl` a `http://host.docker.internal:3001`.

## 2. Credenciales (se crean una vez)

En n8n → *Credentials → Add credential → Header Auth*:

| Nombre sugerido | Header | Valor | Se usa en |
|---|---|---|---|
| `Clínica · Secreto n8n` | `X-N8N-Secret` | el mismo valor de `N8N_SHARED_SECRET` del `.env` | Nodos **Webhook** (flujos 01–03) y nodos que consultan la API (04–06) |
| `WhatsApp Cloud API` | `Authorization` | `Bearer <token permanente de Meta>` | Nodo **Enviar WhatsApp** de todos los flujos |

Los JSON no incluyen credenciales. Después de importar, abre cada nodo marcado en rojo y elige la credencial correspondiente.

## 3. Importar y configurar

1. *Workflows → Import from File* → elige cada archivo de `n8n/flujos/`.
2. En el nodo **Configuración** de cada flujo ajusta:
   - `whatsappPhoneNumberId`: el Phone Number ID de tu número en Meta (WhatsApp → API Setup).
   - `clinicWhatsapp`: el WhatsApp de la clínica que recibe alertas, con código de país (ej. `50688888888`).
   - `portalUrl`: la URL del frontend (`http://localhost:5173` en desarrollo).
   - `apiUrl`: la URL del simulador (`http://localhost:3001`).
   - `templateLanguage`: el idioma con que aprobaste las plantillas (`es`, `es_MX`, …).
3. Activa el flujo y copia la **Production URL** de cada Webhook al `.env` del proyecto:

```env
N8N_SHARED_SECRET=<el mismo del paso 2>
N8N_APPOINTMENT_WEBHOOK=http://localhost:5678/webhook/clinica/cita-recibida
N8N_AUTH_WEBHOOK=http://localhost:5678/webhook/clinica/acceso-portal
N8N_ALERTS_WEBHOOK=http://localhost:5678/webhook/clinica/alertas
```

4. Reinicia `npm run server`. En la consola debe aparecer `n8n · citas: ACTIVO · acceso WhatsApp: ACTIVO · alertas: ACTIVO`.

## 4. Plantillas de WhatsApp (crear y aprobar en Meta)

WhatsApp solo permite iniciar conversaciones con **plantillas aprobadas**. Créalas en *WhatsApp Manager → Plantillas de mensajes* con estos nombres exactos y variables en este orden. Los textos son sugerencias.

| Nombre | Categoría | Texto sugerido |
|---|---|---|
| `cita_recibida` | Utilidad | Hola {{1}}, recibimos tu solicitud de cita para el {{2}}. Te escribimos por aquí para confirmar la hora. Tu portal privado ya está listo: {{3}} |
| `nueva_solicitud_cita` | Utilidad | Nueva solicitud de cita: {{1}} ({{2}}) quiere {{3}} el {{4}}. |
| `acceso_portal` | Autenticación o Utilidad | Hola {{1}}, este es tu acceso a tu portal privado con la Dra. Laura: {{2}}. Vale por 15 minutos y funciona una sola vez. Si no lo pediste, ignora este mensaje. |
| `alerta_clinica` | Utilidad | Alerta ({{1}}): {{2}}, {{3}}. {{4}} |
| `sos_recibido` | Utilidad | {{1}}, la Dra. Laura ya recibió tu aviso y te escribe en minutos. Si es una emergencia médica, llama al 911. |
| `recordatorio_cita` | Utilidad | Hola {{1}}, te esperamos mañana {{2}} a las {{3}}. Antes de tu cita: {{4}} |
| `seguimiento_tratamiento` | Utilidad | Hola {{1}}, ¿cómo te sientes hoy? Cuéntanos en tu portal para acompañarte: {{2}} |
| `proximo_paso_mapa` | Utilidad | Hola {{1}}, tu próximo paso en tu mapa de belleza es el {{2}}. Míralo aquí: {{3}} |
| `resumen_semana_clinica` | Utilidad | Esta semana hay {{1}} paso(s) del mapa de belleza: {{2}} |

> Las instrucciones previas del flujo 04 (`INSTRUCCIONES` en su nodo *Preparar mensajes*) son textos de ejemplo. **La doctora debe revisarlas antes de activar el flujo.**

## 5. Notas

- **Privacidad**: los flujos no guardan en n8n los datos de ejecuciones exitosas (`saveDataSuccessExecution: none`). Solo quedan las ejecuciones con error, para poder diagnosticarlas.
- **Recordatorio de 24 h**: solo toma citas con `estado: "confirmada"`. Mientras el panel de la doctora no tenga gestión de citas, se confirman con `PATCH /appointments/:id` (sesión de doctora) enviando `{ "estado": "confirmada", "hora": "3:30 p. m." }`.
- **Regenerar**: los JSON se generan con `node n8n/generar-flujos.mjs`. Si editas un flujo dentro de n8n, expórtalo y reemplaza su archivo, o traslada el cambio al generador.
- **No probado todavía dentro de n8n**: el código de cada nodo se ejecutó con datos reales del simulador, pero la importación en una instancia de n8n y el envío real por la API de Meta quedan por verificar.
