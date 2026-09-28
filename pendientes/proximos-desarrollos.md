# 🛠️ Plan de implementación (por fases)

Objetivo: dejar el sitio terminado, con el frontend 100 % estático y **n8n como único backend**.
"Sin base de datos" significa que el frontend no habla con ninguna: los datos los guarda n8n en Google Sheets (datos), Drive (fotos) y Calendar (agenda).
`server.js` es solo el simulador de desarrollo y de `npm run verificar`.

Orden: 0 → 1 → 2 → 3 → 4 → 5. Las fases 2 y 3 van juntas, sección por sección.

---

## ✅ Fase 0: decisiones (confirmadas)

- **D1 · Un solo acceso:** enlace mágico por WhatsApp para pacientes y doctora. No hay contraseñas.
- **D2 · Sesiones sin almacenamiento:** en producción, n8n emite un token firmado con HMAC (`userId`, `role`, `exp`). El costo es que cerrar sesión solo borra el token del navegador, así que la expiración es corta: 8 h para pacientes y 4 h para la doctora. El simulador sigue usando sesiones en archivo.
- **D3 · Sin club por cuenta:** se quita el registro con contraseña y los cupones de bienvenida. La aceptación de promociones pasa a ser una casilla del formulario de cita, con consentimiento guardado (Fase 3). Los cupones se envían por plantilla de WhatsApp.

## ✅ Fase 1: limpieza (hecha en código)

- Se quitaron `/register` y `/login` del simulador, junto con `bcryptjs`, los cupones de bienvenida y los campos `password`, `coupons` y `subscribedToOffers` de los datos.
- La doctora entra por enlace mágico (número de prueba **8888 8888**). Al verificar el enlace, cada rol va a su destino.
- `/auth` y `/login` redirigen a `/portal/acceso`. Se quitaron los enlaces al club del footer, el menú móvil, el acceso y el portal.
- El simulador ya no expone el CRUD genérico de json-server: solo rutas explícitas. El panel lee `GET /admin/pacientes`.
- El panel ya no muestra métricas escritas a mano ni el botón de promoción simulado.
- Dependencias sin uso eliminadas: `@anthropic-ai/sdk`, `jspdf`, `html2canvas`, `recharts`, `@tanstack/react-table`, `date-fns`, `pdf-parse` y `bcryptjs`.
- `README.md` reescrito. `npm run verificar` cubre el acceso de la doctora y el bloqueo del CRUD genérico (24 pruebas).
- **Queda manual:** mover o borrar los archivos que no son de la app (ver `pendientes/README.md`, punto 1b).

---

## Fase 2: contrato de API final

Se mantienen `/auth/*`, `/me/*`, `/appointments` y `/n8n/*`. Se agregan estas rutas, primero en `server.js` con pruebas en `verificar` y después con la misma forma en n8n:

| Ruta | Qué hace | Evento a n8n |
|---|---|---|
| `GET /admin/hoy` | Citas del día, alertas abiertas y resúmenes de 3 puntos | – |
| `GET /admin/citas?estado=` | Solicitudes y confirmadas | – |
| `PATCH /admin/citas/:id` `{estado, fecha, hora}` | Confirmar, reprogramar o cancelar | `appointment.confirmed` / `appointment.cancelled` |
| `GET /admin/pacientes/:id` | Ficha de la paciente | – |
| `PUT /admin/pacientes/:id/plan` | Mapa de belleza, último tratamiento y cuidados, paquetes y productos (marca, lote, vencimiento) | `plan.updated` |
| `GET /admin/alertas` · `PATCH /admin/alertas/:id` | SOS y check-ins marcados, con estado abierta o atendida | – |
| `POST /admin/campanas` | Promoción solo a quienes dieron consentimiento | `campaign.sent` |

`GET /admin/pacientes` ya existe.

## Fase 3: dashboard de la doctora

Rutas `/admin/*` cargadas bajo demanda, reutilizando `src/portal/portal.css` (tema claro y oscuro):

1. **Hoy:** consultas del día con el resumen de la Recepcionista y el contador de alertas abiertas.
2. **Citas:** confirmar (con hora), reprogramar o cancelar. El recordatorio de 24 h depende de `estado: "confirmada"` y `hora`.
3. **Pacientes:** directorio (ya existe) y editor del plan de cada paciente.
4. **Alertas:** bandeja de SOS y check-ins en rojo, con "atendida" y una nota.
5. **Campañas:** casilla de promociones en el formulario de cita, con consentimiento versionado, y envío real vía n8n.

**Terminado por sección:** funciona contra el simulador, tiene su prueba en `verificar` y muestra estados de carga, vacío y error.

## Fase 4: n8n

- **Validar sesión:** un subflujo que verifica la firma HMAC y el rol, y se ejecuta primero en cada webhook `/me/*` y `/admin/*`.
- **Webhooks:** una rama por ruta del contrato, que lee y escribe en Sheets. Pestañas: `Pacientes`, `Planes`, `Citas`, `Checkins`, `Alertas`, `Accesos` (hash del enlace, expiración, usado) y `Consentimientos`.
- **Plantillas nuevas en Meta:** `cita_confirmada`, `cita_cancelada`, `promocion` y un acceso para la doctora. Hoy `auth.magic_link` usa `acceso_portal`, cuyo texto está pensado para pacientes; el evento ya incluye `role` para elegir la plantilla.
- **Error Workflow:** cualquier fallo del cerebro avisa a la doctora por WhatsApp.
- **Respaldo semanal** de la hoja en Drive.
- **Rate limiting:** delante de los webhooks públicos, con un proxy (por ejemplo, reglas de Cloudflare), porque n8n no lo trae de fábrica.
- **Configuración:** CORS en las respuestas de los webhooks y `VITE_API_URL` apuntando a n8n (el CSP se ajusta solo).

## Fase 5: cierre

- Lint en 0 advertencias y bundle principal por debajo de 500 kB (panel en carga diferida y framer-motion fuera de la carga inicial).
- Tests unitarios con Vitest para `src/portal/lib` y `src/services`.
- CI en GitHub Actions: `lint`, `build` y `verificar`.
- Despliegue del frontend en Vercel o Netlify y de n8n con HTTPS.
- Prueba de punta a punta con las cuentas reales (WhatsApp, Google, Anthropic).
- **Después:** fotos de evolución (Drive privado, con consentimiento por foto) y videos de "Clínica privada" (enlaces de corta duración).
