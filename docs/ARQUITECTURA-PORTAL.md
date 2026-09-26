# Portal de Pacientes: stack y arquitectura

## 1. Stack propuesto

| Capa | Elección | Por qué |
|---|---|---|
| Frontend | **React 19 + Vite + React Router** (ya en uso) | Mismo proyecto que la landing, carga diferida del portal (`lazy`), build estático desplegable en Vercel o Netlify. |
| Animación | **framer-motion** | Transiciones de hojas, check-in y mapa; respeta "reducir movimiento". |
| Orquestador / backend | **n8n** | Toda la lógica vive en workflows: acceso por WhatsApp, alertas, confirmaciones y recordatorios. La clínica puede ajustar reglas sin tocar código. |
| Base de datos (fase 2) | **Supabase** (Postgres + Storage + RLS) | Datos relacionales (pacientes, tratamientos, lotes, paquetes). Row Level Security garantiza que cada paciente solo lea sus filas. Storage privado con URLs firmadas para fotos médicas. n8n trae nodos nativos de Supabase y Postgres. Es open source y se puede autoalojar si la clínica lo exige. |
| Mensajería | **WhatsApp Cloud API (Meta)** vía n8n | Plantillas aprobadas para enlace mágico, confirmaciones y recordatorios. |

**Por qué no Firebase:** el modelo de datos es relacional (paciente → plan → pasos → productos/lotes). Firestore obliga a desnormalizar y sus reglas son más difíciles de auditar que RLS en SQL.

## 2. Arquitectura

```
                ┌──────────────────────────── Navegador (React) ────────────────────────────┐
                │ Landing ─ formulario de cita          Portal /portal (lazy)                │
                │                                       · token de sesión en sessionStorage  │
                └──────────────┬──────────────────────────────────┬─────────────────────────┘
                               │ HTTPS (mismo contrato en ambas fases)
             Fase 1 (hoy)      ▼                                  ▼
             server.js ── simulador local (json-server + db.json, no versionado)
             Fase 2            ▼
             n8n Webhooks ──► Supabase (Postgres + RLS, Storage privado)
                  │
                  └──► WhatsApp Cloud API ──► Paciente / Clínica
```

El frontend nunca habla con WhatsApp ni con la base de datos directamente: todo pasa por el contrato de abajo. Para pasar de fase 1 a fase 2 basta con cambiar `VITE_API_URL`; el CSP de `index.html` se ajusta solo (plugin en `vite.config.js`).

### Contrato de la API

| Método y ruta | Quién | Qué hace | Workflow n8n (fase 2) |
|---|---|---|---|
| `POST /auth/magic-link` `{phone}` | Público | Genera un token de un solo uso (15 min) y lo envía por WhatsApp. Responde lo mismo exista o no el número. | Buscar paciente → guardar `sha256(token)` → enviar plantilla de WhatsApp con `https://portal/portal/verificar#<token>` |
| `POST /auth/verify` `{token}` | Público | Canjea el token por una sesión (8 h). | Validar hash y vigencia → marcar usado → firmar JWT con el secreto de Supabase (`role: authenticated`, `sub: patient_id`) |
| `GET /me/portal` | Paciente | Plan, mapa de belleza, cuidados, paquetes, lotes, fotos y videos. | Consulta con RLS. Fotos como URLs firmadas de 60 s. |
| `PUT /me/care` `{doneIds}` | Paciente | Guarda los cuidados marcados. | Update con RLS |
| `GET/POST /me/checkins` | Paciente | Diario emocional. Si hay preocupación, dolor ≥ 7 o molestias con dolor ≥ 5 → `checkin.alert`. | Insert → IF alerta → WhatsApp a la clínica con nombre, teléfono y respuesta |
| `POST /me/sos` `{reason, note}` | Paciente | Línea de tranquilidad → `sos.triggered`. | WhatsApp prioritario a la doctora + mensaje de contención a la paciente |
| `POST /appointments` | Público | Solicitud de cita desde la landing → `appointment.created`. | Confirmación inmediata por WhatsApp → Wait hasta 24 h antes → recordatorio + instrucciones previas según tratamiento |

### Workflows de n8n (automatización operativa)

Los flujos ya están listos para importar en `n8n/flujos/` (guía en `n8n/README.md`). Las rutas `/n8n/*` del simulador (`citas`, `seguimiento`, `retoques`) alimentan los flujos programados y se protegen con `X-N8N-Secret`.

1. **Acceso por WhatsApp**: Webhook → Supabase (buscar por teléfono) → Crypto (hash) → Supabase (insert `magic_links`) → WhatsApp (plantilla `acceso_portal`).
2. **Cita agendada**: Webhook `appointment.created` → WhatsApp confirmación → Google Calendar → Wait (fecha − 24 h) → WhatsApp recordatorio + instrucciones previas.
3. **Post-tratamiento** (cron diario): pacientes en ventana de recuperación → WhatsApp "¿cómo te sientes?" con enlace al check-in.
4. **Alertas**: Webhook `checkin.alert` / `sos.triggered` → WhatsApp a la clínica → registro en Supabase → si nadie responde en 15 min, escalar por llamada o SMS.
5. **Retoques** (cron semanal): pasos del mapa con fecha ideal en los próximos 14 días → WhatsApp con propuesta de cita.

## 3. Seguridad y privacidad

- **Acceso sin contraseña**: el token viaja en el fragmento `#` (no llega a los logs del servidor), se guarda solo su hash, es de un solo uso y expira a los 15 minutos. Las respuestas no revelan si un número es paciente.
- **Aislamiento**: toda ruta `/me/*` opera solo sobre la sesión. Ya se prueba así en el simulador y en fase 2 lo aplica RLS en la base de datos.
- **Fotos médicas**: bucket privado; el navegador solo recibe URLs firmadas de vida corta.
- **Discreción**: modo discreto (desenfoca fotos, tratamientos, notas y productos) que se recuerda en el dispositivo, y título de pestaña genérico ("Portal privado").
- **Frontend**: CSP restringido, sanitización con DOMPurify, límites de intentos en endpoints públicos, sin contraseñas ni hashes en el bundle.
- **Pendiente en fase 2**: consentimiento informado para uso de fotos, bitácora de accesos y política de retención conforme a la Ley 8968 de Protección de Datos de Costa Rica.

## 4. Probarlo hoy (fase 1)

```bash
npm run server   # simulador en :3001
npm run dev      # frontend en :5173
```

Entra a `/portal/acceso` con el número demo **8888 0001** (Valeria Rojas). Sin n8n configurado, el simulador muestra el enlace mágico en pantalla y en la consola.
