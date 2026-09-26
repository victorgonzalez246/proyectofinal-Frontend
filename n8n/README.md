# 🧠 Cerebro maestro de n8n: Clínica Dra. Laura Jiménez

Toda la automatización de la clínica vive en **un solo flujo**:
[`flujos/cerebro-maestro-clinica.json`](flujos/cerebro-maestro-clinica.json). Se importa una vez y se configura en un solo nodo.

## Arquitectura

```
ENTRADAS                         NÚCLEO                         RAMAS                                          SALIDAS
───────────────────────────────  ─────────────────────────────  ─────────────────────────────────────────────  ─────────────────
Webhook clínica (sitio) ──┐                                     ┌─ Chat WhatsApp ─► Red de seguridad (sin IA)
  cita · acceso ·         │                                     │                   ├─ emergencia ─► alerta + "llama al 911" ─────► WhatsApp
  check-in · SOS          │                                     │                   └─ conversación ─► Clasificador (Haiku)
WhatsApp entrante ────────┤                                     │                        ├─ clínica ─► 🤖 Agente IA 1 · Enfermera Virtual ──► WhatsApp (texto)
  (chat de pacientes)     ├─► Configuración ─► Router ─────────┤                        └─ administrativa ─► 🤖 Agente IA 2 · Recepcionista VIP
CRON 7:00  preparar ──────┤     (única)       por acción        ├─ Check-in ─► Enfermera · analista emocional ─► decidir (IA + regla) ─► alerta
CRON 8:00  recordatorios ─┤                                     ├─ SOS (sin IA) ─► alerta inmediata + contención ─────────────────────► WhatsApp
CRON 10:00 seguimiento ───┤                                     ├─ Cita recibida / Acceso al portal ─────────────────────────────────► (plantillas)
Lunes 9:00 próximos pasos ┤                                     ├─ Preparar consultas ─► Recepcionista · resumen de 3 puntos ─► doctora
Probar ahora (manual) ────┘                                     └─ Recordatorio 24 h / Seguimiento / Próximos pasos
```

### Los dos agentes

| | 🤖 Agente IA 1 · Enfermera Virtual | 🤖 Agente IA 2 · Recepcionista VIP |
|---|---|---|
| **Perfil** | Clínico y contención | Administrativo |
| **Tareas** | Triaje 24/7 por WhatsApp. Analista emocional de cada check-in del portal. | Agenda autónoma por WhatsApp. Resumen ejecutivo de 3 puntos para la doctora antes de cada consulta (7:00). |
| **Herramientas** | `ficha_paciente` (perfil clínico), `base_clinica` (Google Sheets), `despertar_doctora` (alerta por WhatsApp) | `ficha_recepcion` (sin datos clínicos), `disponibilidad_agenda` y `bloquear_agenda` (Google Calendar), `registrar_cita` |
| **No puede** | Reservar citas ni ver la agenda | Ver historiales clínicos ni responder temas de salud |
| **Modelo** | Claude Sonnet 5 | Claude Sonnet 5 (el clasificador usa Claude Haiku 4.5) |

### Decisiones de seguridad

- **Las emergencias no dependen de la IA.** Una regla fija detecta señales como "no puedo respirar" o "piel morada", avisa a la doctora y responde con el 911 antes de que intervenga cualquier modelo. El SOS del portal tampoco pasa por IA.
- **Doble red en el check-in.** La analista emocional detecta miedo o ansiedad aunque la paciente marque "bien". Si la IA falla, igual se escala con la regla fija del servidor.
- **Nadie queda sin respuesta.** Si un agente falla, la paciente recibe un mensaje de contención y la doctora un aviso de "mensaje sin responder".
- **Mínimo privilegio.** Cada agente tiene su propio modelo, memoria y herramientas. El teléfono de la paciente sale del mensaje entrante y nunca de la IA, así que un agente no puede consultar la ficha de otra persona.
- **Minimización de datos.** Al modelo no le llegan teléfonos. En el check-in y en el resumen tampoco le llegan nombres.
- **Privacidad en n8n.** No se guardan los datos de las ejecuciones exitosas.

> ⚠️ **Antes de producción:** los check-ins, los historiales y los mensajes de las pacientes se envían a Anthropic para que los procesen los agentes. Se necesita el consentimiento informado de las pacientes, conforme a la Ley 8968 de Protección de Datos de Costa Rica, y revisar las condiciones de uso de datos de Anthropic.

## 1. Levantar n8n en local

```bash
n8n start            # o: docker run -it --rm -p 5678:5678 -v n8n_data:/home/node/.n8n n8nio/n8n
```

Si usas Docker, en el nodo **Configuración** cambia `apiUrl` a `http://host.docker.internal:3001`.
El chat por WhatsApp necesita que Meta alcance tu n8n por HTTPS. En local usa un túnel (por ejemplo `n8n start --tunnel`).

## 2. Credenciales

| Credencial (tipo en n8n) | Se usa en | Qué poner |
|---|---|---|
| **Header Auth** · `Clínica · Secreto n8n` | Webhook clínica, nodos `API: …`, `ficha_paciente`, `ficha_recepcion`, `registrar_cita` | Nombre `X-N8N-Secret`, valor igual a `N8N_SHARED_SECRET` del `.env` |
| **Header Auth** · `WhatsApp Cloud API` | `Enviar WhatsApp (plantilla)`, `Responder por WhatsApp (texto)`, `despertar_doctora` | Nombre `Authorization`, valor `Bearer <token permanente de Meta>` |
| **WhatsApp OAuth API** | `WhatsApp entrante` | Client ID y Client Secret de tu app de Meta |
| **Anthropic** | Los 5 nodos `Modelo · …` | Tu API key de Anthropic |
| **Google Sheets OAuth2** | `base_clinica` | Cuenta con acceso a la hoja de la base clínica |
| **Google Calendar OAuth2** | `disponibilidad_agenda`, `bloquear_agenda` | Cuenta de la agenda de la doctora |

> Un agente **no arranca si alguna de sus herramientas no tiene credencial**. Por ejemplo, sin Google Sheets la Enfermera no responde y se activa la respuesta de respaldo.

## 3. Importar y configurar

1. *Workflows → Import from File* → `n8n/flujos/cerebro-maestro-clinica.json`.
2. Asigna las credenciales en los nodos marcados en rojo.
3. Edita el nodo **Configuración** (es el único lugar con datos de la clínica):

| Campo | Ejemplo |
|---|---|
| `whatsappPhoneNumberId` | Phone Number ID de Meta (WhatsApp → API Setup) |
| `clinicWhatsapp` | `50688888888`: WhatsApp de la doctora, que recibe las alertas y los resúmenes |
| `portalUrl` | `http://localhost:5173` |
| `apiUrl` | `http://localhost:3001` |
| `googleCalendarId` | `primary` o el ID de la agenda de la clínica |
| `baseClinicaSheetId` | El ID de la hoja de Google (el tramo largo de su URL) |
| `baseClinicaRango` | `BaseClinica!A:D` |
| `templateLanguage` | `es` (o el idioma con que aprobaste las plantillas) |

4. **Base clínica:** crea una hoja de Google con una pestaña `BaseClinica` e importa [`base-clinica-ejemplo.csv`](base-clinica-ejemplo.csv). **Las respuestas son ejemplos: la doctora debe revisarlas y completarlas.** La Enfermera solo responde con lo que está en esa hoja.
5. Activa el flujo, copia la *Production URL* del nodo **Webhook clínica** y ponla en el `.env` del proyecto:

```env
N8N_SHARED_SECRET=<el mismo del paso 2>
N8N_WEBHOOK_URL=http://localhost:5678/webhook/clinica/eventos
```

6. Reinicia `npm run server`. Debe aparecer `🧠 Cerebro maestro de n8n: CONECTADO`.
7. En tu app de Meta, apunta el webhook de WhatsApp a la URL que muestra el nodo **WhatsApp entrante**.

## 4. Plantillas de WhatsApp (aprobar en Meta)

Las respuestas de los agentes en el chat son texto libre, permitido porque la paciente escribió primero (ventana de 24 h). Todo lo que inicia la clínica usa plantillas aprobadas:

| Nombre | Texto sugerido |
|---|---|
| `cita_recibida` | Hola {{1}}, recibimos tu solicitud de cita para el {{2}}. Te escribimos por aquí para confirmar la hora. Tu portal privado ya está listo: {{3}} |
| `nueva_solicitud_cita` | Nueva solicitud de cita: {{1}} ({{2}}) quiere {{3}} el {{4}}. |
| `acceso_portal` | Hola {{1}}, este es tu acceso a tu portal privado con la Dra. Laura: {{2}}. Vale por 15 minutos y funciona una sola vez. |
| `alerta_clinica` | Alerta ({{1}}): {{2}}, {{3}}. {{4}} |
| `sos_recibido` | {{1}}, la Dra. Laura ya recibió tu aviso y te escribe en minutos. Si es una emergencia médica, llama al 911. |
| `resumen_consulta` | Consulta de hoy: {{1}} a las {{2}}. 1) {{3}} 2) {{4}} 3) {{5}} |
| `recordatorio_cita` | Hola {{1}}, te esperamos mañana {{2}} a las {{3}}. Antes de tu cita: {{4}} |
| `seguimiento_tratamiento` | Hola {{1}}, ¿cómo te sientes hoy? Cuéntanos en tu portal: {{2}} |
| `proximo_paso_mapa` | Hola {{1}}, tu próximo paso en tu mapa de belleza es el {{2}}. Míralo aquí: {{3}} |
| `resumen_semana_clinica` | Esta semana hay {{1}} paso(s) del mapa de belleza: {{2}} |

Los mensajes a pacientes nunca nombran el tratamiento: una notificación puede verse en la pantalla bloqueada.

## 5. Cómo se probó

Se importó y ejecutó en **n8n 2.38.7** contra el simulador (`server.js`), con WhatsApp y Anthropic reemplazados por receptores locales:

- **Webhook:** 403 sin secreto; cita, acceso, SOS y evento desconocido enrutados correctamente.
- **Rutinas:** recordatorio, seguimiento, próximos pasos y preparación de consultas.
- **Chat:** la red de seguridad deriva la emergencia a la doctora y al 911 sin IA. El clasificador envía lo clínico a la Enfermera y lo administrativo a la Recepcionista.
- **Herramientas:** las 7 se ejecutaron. La Recepcionista reservó en Calendar y registró la cita. La Enfermera despertó a la doctora.
- **Fallos de IA:** respaldo en el check-in, el resumen y el chat.
- **Privacidad:** lo que llega al modelo no contiene teléfonos. En el check-in y en el resumen tampoco nombres.

**Pendiente de verificar con cuentas reales:** la calidad de las respuestas de Claude con los prompts, el envío por la API de Meta y el acceso a Google.

## 6. Mantenimiento

- **Recordatorio de 24 h:** toma las citas con `estado: "confirmada"`. Las reservas de la Recepcionista ya entran confirmadas.
- **Instrucciones previas:** están en el nodo *Mensajes: recordatorio 24 h* y son textos de ejemplo que la doctora debe validar.
- **Editar el flujo:** puedes editar directamente en n8n y exportar. Opcionalmente, `node n8n/generar-cerebro.mjs` regenera el JSON desde código.
