# Clínica Dra. Laura Jiménez: frontend

Landing pública, portal privado de pacientes y panel de la doctora para la clínica de armonización facial.

**Arquitectura:**
- El frontend es 100 % estático y **n8n es el único backend**.
- El navegador solo hace `fetch` a los webhooks de n8n, que guarda los datos en Google Sheets, Drive y Calendar.
- `server.js` es un **simulador de desarrollo** que atiende el mismo contrato con la misma lógica (`api/nucleo.mjs`). No se despliega.

## Stack

| Capa | Herramienta |
|---|---|
| UI | React 19 + Vite, React Router 7, Tailwind CSS 4, framer-motion, lucide-react, sonner (avisos) |
| Formularios | react-hook-form (reglas nativas) |
| HTTP | `fetch` con un cliente mínimo (`src/services/api.js`) |
| API | `api/nucleo.mjs`: una sola implementación del contrato, sin dependencias. La usan `server.js` y el flujo API de n8n |
| Backend y automatizaciones | n8n: flujo **API** + flujo **Cerebro** con dos agentes de IA (Claude). Ver [`n8n/README.md`](n8n/README.md) |
| Pruebas | Vitest (unitarias), `npm run verificar` (contrato contra el simulador), `npm run probar:n8n` (flujos en n8n real) |

## Acceso: sin contraseñas

Pacientes y doctora entran igual: escriben su número en `/portal/acceso` y reciben por WhatsApp un **enlace mágico** de un solo uso (15 minutos). La paciente va a `/portal` y la doctora a `/admin`.

- El token viaja en el fragmento `#` de la URL y solo se guarda su hash.
- La respuesta es idéntica exista o no el número.
- La sesión es un token firmado con HMAC que no se guarda en ninguna base: dura 8 h para pacientes y 4 h para la doctora. Vive en `sessionStorage`.
- Sin n8n conectado (desarrollo), el enlace se muestra en pantalla y en la consola del simulador.

**Cuentas de prueba** (en `db.example.json`):

| Rol | Número |
|---|---|
| Doctora | 8888 8888 |
| Paciente demo (Valeria Rojas) | 8888 0001 |

## Panel de la doctora (`/admin`)

| Sección | Qué hace |
|---|---|
| **Hoy** | Consultas confirmadas del día con el resumen de 3 puntos de la Recepcionista, solicitudes por confirmar y alertas abiertas |
| **Citas** | Confirmar con hora (activa el recordatorio de 24 h), reprogramar, cancelar y reactivar. La paciente recibe cada cambio por WhatsApp |
| **Pacientes** | Directorio y ficha: citas, check-ins y el **plan** que ve la paciente (mapa de belleza, cuidados, paquetes, productos con lote y vencimiento, videos) |
| **Alertas** | SOS del portal y check-ins marcados; atender con una nota o reabrir |
| **Campañas** | Promoción por WhatsApp solo a quienes la aceptaron. Pueden darse de baja respondiendo "BAJA" |

## Cómo correrlo

```bash
npm install
cp .env.example .env     # completa N8N_SHARED_SECRET y SESSION_SECRET
npm run server           # simulador en :3001
npm run dev              # sitio en :5173
```

| Comando | Para qué |
|---|---|
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run verificar` | Contrato completo de la API contra el simulador (base temporal, no toca `db.json`) y estructura de los flujos de n8n |
| `npm run probar:n8n` | Los dos flujos en un n8n real y local, con simuladores de Google Sheets y WhatsApp |
| `npm run generar:n8n` | Regenera los flujos de n8n desde código (después de cambiar `api/` o `n8n/generar-*.mjs`) |
| `npm run lint` | Linter (oxlint) |
| `npm run build` | Versión de producción en `dist/`, con Content-Security-Policy estricto |

La integración continua (`.github/workflows/ci.yml`) corre lint, tests, `verificar` y build en cada push, y además prueba los flujos en n8n real.

## Seguridad

- **Content-Security-Policy:** en producción solo se ejecutan scripts propios (sin `unsafe-inline` ni `unsafe-eval`), y las llamadas van únicamente a la API configurada.
- **XSS:** React escapa todo lo que muestra y el proyecto no usa `innerHTML`. La API valida y recorta cada campo.
- **Permisos:** las rutas `/me/*` operan solo sobre la sesión y las `/admin/*` exigen el rol de doctora. No hay acceso genérico a las tablas.
- **Privacidad:** los mensajes de WhatsApp a pacientes no nombran tratamientos. Los agentes de IA reciben datos mínimos. El flujo API de n8n no guarda ejecuciones.

## Estructura

```text
api/                núcleo de la API (contrato) y conversión tablas ↔ Google Sheets
server.js           simulador de desarrollo (HTTP + db.json sobre el núcleo)
src/
├── admin/          panel de la doctora (carga diferida)
├── portal/         portal de pacientes (carga diferida)
├── components/     landing/, auth/ (guardián de rutas), ui/
├── config/         clinica.js: datos de contacto de la clínica (único lugar para editarlos)
├── context/        sesión (AuthContext)
├── pages/          landing y aviso de privacidad
└── services/       cliente HTTP y servicios de la API
n8n/                generadores y flujos de n8n (API y Cerebro) con su guía
scripts/            verificar y probar:n8n (mismo contrato: scripts/contrato.mjs)
docs/               arquitectura y contrato de la API
pendientes/         tareas manuales y plan de implementación
```

## Despliegue

1. Configura n8n siguiendo [`n8n/README.md`](n8n/README.md).
2. Compila el sitio con `VITE_API_URL=https://tu-n8n.com/webhook npm run build`.
3. Publica `dist/` en Vercel (`vercel.json`) o Netlify (`public/_redirects`). Los dos ya envían todas las rutas a React Router.

## Documentación

- [`docs/ARQUITECTURA-PORTAL.md`](docs/ARQUITECTURA-PORTAL.md): arquitectura y contrato de la API.
- [`n8n/README.md`](n8n/README.md): instalar, configurar y probar los flujos de n8n.
- [`pendientes/README.md`](pendientes/README.md): lo que requiere tus cuentas, datos reales o decisiones.
- [`pendientes/proximos-desarrollos.md`](pendientes/proximos-desarrollos.md): plan por fases y su estado.
