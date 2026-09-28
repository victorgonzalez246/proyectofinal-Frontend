# Portal de Pacientes: stack y arquitectura

## 1. Stack

Según los requisitos, el frontend es **100 % puro** y **n8n es el único backend**.

| Capa | Elección | Por qué |
|---|---|---|
| Frontend | **React 19 + Vite + React Router** (ya en uso) | Mismo proyecto que la landing. Carga diferida del portal. Build estático para Vercel o Netlify. No tiene SDKs de bases de datos: solo `fetch`/`axios` a webhooks. |
| Animación | **framer-motion** | Transiciones del mapa, el check-in y las hojas. Respeta "reducir movimiento". |
| Backend y orquestador | **n8n**: un único flujo, el *cerebro maestro* | Recibe todos los eventos en un webhook, los enruta con un Switch y ejecuta las rutinas programadas. La clínica ajusta reglas sin tocar código. |
| Inteligencia | **Claude (Anthropic)** dentro de n8n: Sonnet 5 para los agentes y Haiku 4.5 para clasificar | Dos agentes con responsabilidades separadas (ver sección 3). |
| Datos | **Google Sheets** gestionado por n8n (Airtable es una alternativa equivalente) | La doctora puede leer y editar la base clínica, el plan de cada paciente y los paquetes sin herramientas técnicas. |
| Agenda | **Google Calendar** | La agenda real de la doctora: la Recepcionista consulta la disponibilidad y reserva ahí. |
| Mensajería | **WhatsApp Cloud API (Meta)** | Plantillas aprobadas para lo que inicia la clínica, y texto libre para responder en el chat. |

**Simulador de desarrollo:** mientras n8n no tenga los datos reales, `server.js` atiende las mismas rutas con la misma lógica que n8n (`api/nucleo.mjs`). No forma parte del producto: al pasar a producción se reemplaza `VITE_API_URL` por la URL de los webhooks de n8n, y el CSP de `index.html` se ajusta solo.

## 2. Arquitectura

```
┌──────────────────────── Navegador (React, 100 % frontend, estático) ─────────────────────────┐
│  Landing · cita        Portal /portal (paciente)        Panel /admin (doctora)               │
│                        token firmado en sessionStorage                                        │
└──────────────────────────────────────┬───────────────────────────────────────────────────────┘
                                       │ HTTPS · axios · mismo contrato en ambas fases
          Desarrollo                   ▼                          Producción
   server.js + db.json  ◄── api/nucleo.mjs (misma lógica) ──►  n8n · flujo API ── Google Sheets
          │                                                         │   (un Webhook por ruta)
          └──────────── eventos con X-N8N-Secret ───────────────────┤
                                                                    ▼
┌───────────────────────────────── 🧠 n8n · flujo Cerebro maestro ─────────────────────────────┐
│ Entradas: eventos de la API · WhatsApp entrante · CRON 7:00/8:00/10:00/lunes 9:00/dom 23:00  │
│           · Falla en cualquier flujo                                                         │
│      └─► Configuración ─► Router por acción                                                  │
│            ├─ Chat ─► Red de seguridad (sin IA): emergencia → doctora + 911 · "BAJA"         │
│            │          └─► Clasificador ─┬─► 🤖 Agente 1 · Enfermera Virtual                  │
│            │                            └─► 🤖 Agente 2 · Recepcionista VIP                  │
│            ├─ Check-in ─► analista emocional (IA) + regla fija ─► alerta                     │
│            ├─ SOS (sin IA) ─► alerta inmediata + contención                                  │
│            ├─ Cita recibida · confirmada · cancelada · acceso (paciente/doctora) · campaña  │
│            ├─ Resumen de 3 puntos (7:00) ─► WhatsApp de la doctora y vista "Hoy" del panel   │
│            ├─ Recordatorio 24 h · seguimiento · próximos pasos                               │
│            └─ Respaldo semanal de la hoja · aviso de fallas a la doctora                     │
└───────┬─────────────────────┬──────────────────────┬──────────────────────┬──────────────────┘
        ▼                     ▼                      ▼                      ▼
  Google Sheets/Drive   Google Calendar        Claude (Anthropic)     WhatsApp Cloud API
  datos, base clínica   agenda de la doctora   solo datos mínimos     paciente · doctora
```

Los flujos importables están en [`n8n/flujos/`](../n8n/flujos/), con su guía en [`n8n/README.md`](../n8n/README.md).

## 3. Módulo de IA: arquitectura multi-agente

| | 🤖 Agente IA 1 · Enfermera Virtual | 🤖 Agente IA 2 · Recepcionista VIP |
|---|---|---|
| Perfil | Clínico y contención | Administrativo |
| Triaje / agenda | Responde dudas post-tratamiento solo con la base clínica aprobada por la doctora. Ante el menor riesgo, usa `despertar_doctora`. | Chatea para encontrar horarios libres (`disponibilidad_agenda`), reserva (`bloquear_agenda`) y registra la cita (`registrar_cita`). |
| Segunda función | **Analista emocional:** lee cada check-in del portal y clasifica rojo, amarillo o verde. | **Preparación de consultas:** cada día a las 7:00 envía a la doctora un resumen ejecutivo de 3 puntos por consulta. |
| Ve | Ficha clínica mínima (tratamiento, día de recuperación, cuidados, últimos check-ins) | Ficha administrativa (próxima cita, paquetes): nada clínico |

**Por qué separar los perfiles mejora la seguridad:** cada agente tiene su propio modelo, memoria y herramientas. Un error o una manipulación del chat en un agente no le da acceso a las capacidades del otro. El teléfono con el que se consulta una ficha sale del mensaje entrante y nunca de la IA.

**Capas que no dependen de la IA:**
1. Una red de seguridad fija detecta emergencias en el chat antes que cualquier modelo.
2. El SOS del portal alerta de inmediato.
3. La regla fija del check-in escala aunque la IA falle.
4. Si un agente no responde, la paciente recibe un mensaje de contención y la doctora un aviso.

## 4. Contrato de la API

La lógica del contrato está en un solo archivo, [`api/nucleo.mjs`](../api/nucleo.mjs), sin dependencias:
- **Desarrollo:** `server.js` lo atiende con las tablas en `db.json`.
- **Producción:** el flujo de n8n `API de la clínica` copia ese mismo código en su nodo *Núcleo API*, con las tablas en Google Sheets.

`npm run verificar` recorre el contrato completo contra el simulador, y `npm run probar:n8n` lo hace contra el flujo de n8n.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /appointments` | Público | Solicitud de cita desde la landing. Registra a la persona como paciente y, si marcó la casilla, su consentimiento de promociones. Evento: `appointment.created`. |
| `POST /auth/magic-link` `{phone}` | Público | Enlace de un solo uso (15 min) por WhatsApp, para pacientes y doctora. Responde lo mismo exista o no el número. Evento: `auth.magic_link` (incluye `role`). |
| `POST /auth/verify` `{token}` | Público | Canjea el enlace por una sesión firmada (8 h paciente, 4 h doctora). No hay contraseñas. |
| `GET /me` · `POST /logout` | Sesión | Perfil propio. Cerrar sesión borra el token del navegador (las sesiones no se guardan). |
| `GET /me/portal` | Paciente | Plan, mapa de belleza, cuidados, paquetes, productos, fotos y videos. |
| `PUT /me/care` `{doneIds}` | Paciente | Guarda los cuidados marcados. |
| `GET/POST /me/checkins` | Paciente | Diario emocional. Evento: `checkin.created`. |
| `POST /me/sos` `{reason, note}` | Paciente | Línea de tranquilidad. Evento: `sos.triggered`. |
| `GET /admin/hoy` | Doctora | Consultas confirmadas de hoy (con el resumen de 3 puntos), solicitudes pendientes y alertas abiertas. |
| `GET /admin/citas?estado=` | Doctora | Citas por estado. |
| `PATCH /admin/citas?id=` `{estado, fecha, hora}` | Doctora | Confirmar (exige hora), reprogramar o cancelar. Eventos: `appointment.confirmed` / `appointment.cancelled`. |
| `GET /admin/pacientes` · `GET /admin/pacientes/ficha?id=` | Doctora | Directorio y ficha (plan, citas y check-ins). |
| `PATCH /admin/pacientes?id=` `{promociones: false}` | Doctora | Retira el consentimiento de promociones. La doctora nunca puede darlo en nombre de la paciente. |
| `PUT /admin/pacientes/plan?id=` | Doctora | Guarda el plan completo; rechaza datos inválidos. |
| `GET /admin/alertas?estado=` · `PATCH /admin/alertas?id=` | Doctora | Bandeja de SOS y check-ins marcados; marcar como atendida con una nota. |
| `POST /admin/campanas` `{mensaje}` | Doctora | Promoción solo a quienes aceptaron recibirla. Evento: `campaign.sent`. |
| `GET /n8n/citas`, `/n8n/seguimiento`, `/n8n/retoques` | n8n (secreto) | Datos para las rutinas programadas. |
| `GET /n8n/paciente?perfil=clinico|recepcion` | n8n (secreto) | Fichas mínimas por perfil para cada agente. |
| `POST /n8n/citas` | n8n (secreto) | Registro de las citas que reserva la Recepcionista (quedan confirmadas). |
| `GET /n8n/preparacion` · `POST /n8n/resumen` | n8n (secreto) | Consultas del día para el resumen ejecutivo y registro del resumen en el panel. |
| `POST /n8n/baja` `{telefono}` | n8n (secreto) | La paciente respondió "BAJA" por WhatsApp: deja de recibir promociones. |

Cualquier otra ruta responde con error y sin datos: no hay acceso genérico a las tablas.

Las rutas de un solo recurso llevan el id en la query (`?id=`) y no en la ruta: n8n publica los Webhooks con parámetros de ruta anteponiendo su propio id, y la URL dejaría de ser la del contrato.

## 5. Seguridad y privacidad

- **Acceso sin contraseña:** el token viaja en el fragmento `#` (no llega a los logs), se guarda solo su hash, es de un solo uso y expira a los 15 minutos. Las respuestas no revelan si un número es paciente.
- **Sesiones sin almacenamiento:** el token es `userId.rol.expiración.firma` (HMAC-SHA256). Se valida en cada petición, junto con que el usuario siga existiendo con ese rol. Cerrar sesión solo borra el token del navegador, por eso la expiración es corta.
- **Aislamiento:** toda ruta `/me/*` opera solo sobre la sesión, y las `/admin/*` exigen el rol de doctora.
- **Fotos médicas:** en una carpeta privada de Google Drive. n8n las entrega solo a la paciente con sesión válida, nunca como enlaces públicos.
- **Discreción:** modo discreto (desenfoca fotos, tratamientos, notas y productos) y título de pestaña genérico ("Portal privado"). Los WhatsApp a pacientes no nombran tratamientos.
- **IA:** minimización de datos (sin teléfonos; sin nombres en el check-in ni en el resumen) y sin guardar ejecuciones exitosas en n8n.
- **Frontend:** CSP restringido, sanitización con DOMPurify, límites de intentos en endpoints públicos, sin contraseñas ni hashes en el bundle.
- **Pendiente antes de producción:**
  - Consentimiento informado para el uso de fotos y para el procesamiento con IA.
  - Bitácora de accesos y política de retención, conforme a la Ley 8968 de Protección de Datos de Costa Rica.
  - Revisar los términos de tratamiento de datos de Google y Anthropic.
  - Considerar las limitaciones de Google Sheets como almacén clínico: no tiene control de acceso por fila, así que ese control lo aplica n8n.

## 6. Probarlo hoy

```bash
npm run server   # simulador en :3001
npm run dev      # frontend en :5173
```

Entra a `/portal/acceso` con el número demo **8888 0001** (Valeria Rojas), o con **8888 8888** para el panel de la doctora. Sin n8n configurado, el simulador muestra el enlace mágico en pantalla y en la consola.
