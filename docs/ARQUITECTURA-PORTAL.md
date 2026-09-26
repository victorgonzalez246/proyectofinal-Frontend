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

**Simulador de desarrollo:** mientras n8n no tenga los datos reales, `server.js` (json-server) imita exactamente las rutas que expondrá n8n. No forma parte del producto: al pasar a producción se reemplaza `VITE_API_URL` por la URL de los webhooks de n8n, y el CSP de `index.html` se ajusta solo.

## 2. Arquitectura

```
┌──────────────────────── Navegador (React, 100 % frontend) ────────────────────────┐
│  Landing · formulario de cita            Portal /portal · token en sessionStorage  │
└───────────────────────────────┬────────────────────────────────────────────────────┘
                                │ HTTPS · fetch/axios (mismo contrato en ambas fases)
            Hoy (desarrollo)    ▼                       Producción
            server.js (simulador) ─ eventos ─►   n8n · Webhooks del portal
                                │                        │
                                └────────── X-N8N-Secret ┘
                                                         ▼
┌──────────────────────────────── 🧠 n8n · cerebro maestro ─────────────────────────────────┐
│ Entradas: Webhook clínica · WhatsApp entrante · CRON 7:00 / 8:00 / 10:00 / lunes 9:00    │
│      └─► Configuración ─► Router por acción                                              │
│            ├─ Chat WhatsApp ─► Red de seguridad (sin IA) ─► emergencia: alerta + 911     │
│            │                    └─► Clasificador ─┬─► 🤖 Agente 1 · Enfermera Virtual    │
│            │                                      └─► 🤖 Agente 2 · Recepcionista VIP    │
│            ├─ Check-in ─► Enfermera (analista emocional) + regla fija ─► alerta roja    │
│            ├─ SOS (sin IA) ─► alerta inmediata + contención                              │
│            ├─ Cita · Acceso al portal · Recordatorio 24 h · Seguimiento · Próximos pasos│
│            └─ Preparar consultas (7:00) ─► Recepcionista: resumen de 3 puntos ─► doctora │
└───────┬─────────────────────┬──────────────────────┬───────────────────────┬─────────────┘
        ▼                     ▼                      ▼                       ▼
  Google Sheets         Google Calendar        Claude (Anthropic)     WhatsApp Cloud API
  base clínica, datos   agenda de la doctora   solo datos mínimos     paciente · doctora
```

El flujo importable está en [`n8n/flujos/cerebro-maestro-clinica.json`](../n8n/flujos/cerebro-maestro-clinica.json), con su guía en [`n8n/README.md`](../n8n/README.md).

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

## 4. Contrato de la API (lo que hoy simula `server.js`)

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /auth/magic-link` `{phone}` | Público | Genera un token de un solo uso (15 min) y lo envía por WhatsApp. Responde lo mismo exista o no el número. |
| `POST /auth/verify` `{token}` | Público | Canjea el token por una sesión (8 h). |
| `GET /me/portal` | Paciente | Plan, mapa de belleza, cuidados, paquetes, lotes, fotos y videos. |
| `PUT /me/care` `{doneIds}` | Paciente | Guarda los cuidados marcados. |
| `GET/POST /me/checkins` | Paciente | Diario emocional. Cada registro se envía al cerebro como `checkin.created`. |
| `POST /me/sos` `{reason, note}` | Paciente | Línea de tranquilidad: `sos.triggered`. |
| `POST /appointments` | Público | Solicitud de cita desde la landing: `appointment.created`. Registra a la persona como paciente. |
| `GET /n8n/citas`, `/n8n/seguimiento`, `/n8n/retoques` | n8n (secreto) | Datos para las rutinas programadas. |
| `GET /n8n/paciente?perfil=clinico\|recepcion` | n8n (secreto) | Fichas mínimas por perfil para cada agente. |
| `POST /n8n/citas` | n8n (secreto) | Registro de las citas que reserva la Recepcionista. |
| `GET /n8n/preparacion` | n8n (secreto) | Consultas del día con el historial necesario para el resumen. |

En producción, cada ruta pública es un Webhook de n8n y las rutas `/n8n/*` se convierten en lecturas y escrituras de Google Sheets dentro del mismo cerebro.

## 5. Seguridad y privacidad

- **Acceso sin contraseña:** el token viaja en el fragmento `#` (no llega a los logs), se guarda solo su hash, es de un solo uso y expira a los 15 minutos. Las respuestas no revelan si un número es paciente.
- **Aislamiento:** toda ruta `/me/*` opera solo sobre la sesión. En producción, n8n valida el token de sesión en cada webhook antes de leer la hoja.
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

Entra a `/portal/acceso` con el número demo **8888 0001** (Valeria Rojas). Sin n8n configurado, el simulador muestra el enlace mágico en pantalla y en la consola.
