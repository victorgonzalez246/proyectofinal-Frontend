# Resumen del proyecto: Clínica Dra. Laura Jiménez

Plataforma web de la clínica de armonización facial: landing pública, portal privado de pacientes y automatización con n8n (con dos agentes de IA).

## Estado actual (septiembre 2026)

| Pieza | Estado | Dónde |
|---|---|---|
| Landing | ✅ Lista (con datos de contacto de relleno) | `src/components/landing/`, datos en `src/config/clinica.js` |
| Aviso de privacidad y consentimiento | ✅ Borrador (falta revisión legal) | `/privacidad`, `src/pages/PrivacyPage.jsx` |
| Portal de pacientes | ✅ Listo con una paciente demo | `/portal`, `src/portal/` |
| Acceso sin contraseña por WhatsApp | ✅ Funciona (en desarrollo, el enlace se muestra en pantalla) | `/portal/acceso` |
| Simulador de backend | ✅ Se mantiene para desarrollo | `server.js` |
| Cerebro maestro de n8n (multi-agente) | ✅ Listo para importar (faltan las cuentas reales) | `n8n/flujos/cerebro-maestro-clinica.json` |
| Panel de la doctora | 🟡 Básico: lista miembros | `/admin`, pendiente de construir completo |

## Cómo correrlo

```bash
npm install
cp .env.example .env     # completa N8N_SHARED_SECRET
npm run server           # simulador en :3001
npm run dev              # sitio en :5173
npm run verificar        # comprueba que todo funcione (21 pruebas)
```

Paciente demo del portal: número **8888 0001**.

## Documentación
- `docs/ARQUITECTURA-PORTAL.md`: stack, arquitectura y contrato de la API.
- `n8n/README.md`: cómo importar y configurar el cerebro de n8n.
- `pendientes/`: lo que falta. Las tareas manuales están en `pendientes/README.md` y el plan de desarrollo en `pendientes/proximos-desarrollos.md`.

## Decisiones clave
- **Frontend 100 % puro y n8n como único backend.** `server.js` solo simula las rutas de n8n en desarrollo.
- **Un solo flujo de n8n** con Router, en lugar de varios flujos, para facilitar el mantenimiento.
- **Privacidad primero:**
  - Datos fuera de git (`db.json` no se versiona).
  - Sesiones con expiración.
  - Modo discreto en el portal.
  - Datos mínimos para la IA.
  - Mensajes de WhatsApp sin nombres de tratamientos.
