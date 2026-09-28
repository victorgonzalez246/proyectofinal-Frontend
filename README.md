# Clínica Dra. Laura Jiménez: frontend

Landing pública, portal privado de pacientes y panel de la doctora para la clínica de armonización facial.

**Arquitectura:** el frontend es 100 % estático y **n8n es el único backend**. El navegador solo hace `fetch`/`axios` a webhooks; los datos los guarda n8n en Google Sheets, Drive y Calendar. `server.js` es un **simulador de desarrollo** que imita esos webhooks: no se despliega.

## Stack

| Capa | Herramienta |
|---|---|
| UI | React 19 + Vite, React Router 7, Tailwind CSS 4, framer-motion, lucide-react |
| Formularios | react-hook-form + Zod |
| HTTP | Axios (`src/services/api.js`) |
| Seguridad en el navegador | DOMPurify (`src/utils/security.js`) y Content-Security-Policy en `index.html` |
| Backend y automatizaciones | n8n (`n8n/`), con Claude para los dos agentes de IA |
| Simulador de desarrollo | json-server encapsulado en `server.js` |

## Acceso: sin contraseñas

Pacientes y doctora entran igual: escriben su número en `/portal/acceso` y reciben por WhatsApp un **enlace mágico** de un solo uso (15 minutos). Al abrirlo, la paciente va a `/portal` y la doctora a `/admin`.

- El token viaja en el fragmento `#` de la URL y solo se guarda su hash.
- La respuesta es idéntica exista o no el número.
- La sesión se guarda en `sessionStorage` y expira a las 8 horas.
- Sin n8n conectado (desarrollo), el enlace se muestra en pantalla y en la consola del simulador.

**Cuentas de prueba** (en `db.example.json`):

| Rol | Número |
|---|---|
| Doctora | 8888 8888 |
| Paciente demo (Valeria Rojas) | 8888 0001 |

## Cómo correrlo

```bash
npm install
cp .env.example .env     # completa N8N_SHARED_SECRET
npm run server           # simulador en :3001
npm run dev              # sitio en :5173
```

| Comando | Para qué |
|---|---|
| `npm run verificar` | Comprueba el sistema completo sobre una base temporal (no toca `db.json`) |
| `npm run lint` | Linter (oxlint) |
| `npm run build` | Versión de producción en `dist/` |
| `node n8n/generar-cerebro.mjs` | Regenera el flujo de n8n desde código |

## Estructura

```text
src/
├── components/     landing/, auth/ (guardián de rutas), ui/
├── config/         clinica.js: datos de contacto de la clínica (único lugar para editarlos)
├── context/        sesión (AuthContext)
├── pages/          landing, aviso de privacidad, panel de la doctora
├── portal/         portal de pacientes (carga diferida)
├── services/       api.js, authService.js, portalService.js
└── utils/          sanitización
server.js           simulador de los webhooks de n8n (solo desarrollo)
n8n/                cerebro maestro de n8n y su guía
docs/               arquitectura y contrato de la API
pendientes/         tareas manuales y plan de implementación
```

## Estado

| Pieza | Estado |
|---|---|
| Landing con solicitud de cita y consentimiento | ✅ Lista (datos de contacto de relleno) |
| Portal de pacientes | ✅ Listo con una paciente demo |
| Acceso por enlace mágico (pacientes y doctora) | ✅ Funciona contra el simulador |
| Panel de la doctora | 🟡 Solo directorio de pacientes: ver `pendientes/proximos-desarrollos.md` |
| Cerebro de n8n (dos agentes de IA) | 🟡 Listo para importar; falta probarlo con cuentas reales |

## Documentación

- [`docs/ARQUITECTURA-PORTAL.md`](docs/ARQUITECTURA-PORTAL.md): arquitectura y contrato de la API.
- [`n8n/README.md`](n8n/README.md): importar y configurar el cerebro de n8n.
- [`pendientes/README.md`](pendientes/README.md): tareas manuales (cuentas, datos reales, revisión legal).
- [`pendientes/proximos-desarrollos.md`](pendientes/proximos-desarrollos.md): plan de implementación por fases.
