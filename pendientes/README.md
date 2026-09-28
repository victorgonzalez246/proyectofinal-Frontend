# 📋 Pendientes: lo que tienes que hacer tú (manual)

Todo lo que se podía resolver desde el código ya está hecho y se comprueba con `npm run verificar`.
Aquí queda **solo lo que requiere tus cuentas, tus decisiones o datos reales**, en orden de prioridad.

Marca cada casilla al terminar. El plan de desarrollo que sigue está en [proximos-desarrollos.md](proximos-desarrollos.md).

---

## 🔴 1. Urgente: el repositorio de GitHub es público

`github.com/victorgonzalez246/proyectofinal-Frontend` se puede ver sin iniciar sesión (verificado).
Su historial contiene `db.json`, con nombres, correos y hashes de contraseñas, y la contraseña de prueba de la doctora (`Admin123!`).
El sistema ya no usa contraseñas (acceso solo por enlace mágico), pero ese historial sigue público.

- [ ] Hacer el repositorio **privado**: GitHub → *Settings* → *General* → *Danger Zone* → *Change visibility*.
- [ ] Si alguna de esas cuentas o contraseñas es real o se reutiliza en otro lado, cámbiala.
- [ ] (Opcional) Limpiar el historial para borrar `db.json` de todos los commits. Reescribe la historia y exige `git push --force`: hazlo solo si entiendes el efecto o pide ayuda.

## 🔴 1b. Terminar la limpieza de la Fase 1 (archivos)

Estos archivos ya no los usa la app, pero moverlos o borrarlos quedó para ti. Los que no están en git (marcados con *) no tienen copia: muévelos fuera del repo en lugar de borrarlos.

- [ ] Mover fuera del repo: `ANTEPROYECTO.html`*, `ANTEPROYECTO.md`*, `ANTEPROYECTO_CLINICA.docx`*, `generate_docx.js`*, `dashboard.zip`*, `login_standalone.html`*, `public/mockup_*.jpg`*.
- [ ] Mover fuera del repo (código descartado): `src/components/dashboard/`* y `src/pages/LoginPage.jsx`*. Son la única fuente de avisos del linter.
- [ ] Borrar con `git rm`: `src/pages/AuthPage.jsx`, `src/components/layout/`, `src/data/welcomeCoupons.js`, `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/brand/logo-variante-*.png`, `public/icons.svg` y `resumen_proyecto.md` (su contenido ya está en el `README.md`).

## 🟠 2. Dejarlo corriendo en tu máquina

- [ ] Revisar y hacer push de lo nuevo: `git push origin main` (después de hacer el repo privado).
- [ ] Crear el archivo `.env` desde `.env.example` (no existe todavía). Sin él, el simulador usa secretos de desarrollo y lo avisa en la consola. **No lo compartas ni lo subas** (está en `.gitignore`).
- [ ] Probar el flujo completo en el navegador:
  1. `npm run server` y `npm run dev`.
  2. Agenda una cita desde la landing con tu número.
  3. Entra a `/portal/acceso` con ese número.
  4. Entra también con el número demo **8888 0001**.
  5. Entra al panel de la doctora con el número **8888 8888**.

## 🟠 3. Datos reales de la clínica

Todos se editan en un solo archivo: [`src/config/clinica.js`](../src/config/clinica.js).

- [ ] Número de WhatsApp real (`whatsapp`, `telefonoVisible`, `telefonoLlamada`).
- [ ] Número real de la doctora en su usuario (`db.json` hoy, la hoja de Google en producción): con él recibe su enlace de acceso al panel.
- [ ] Correo de contacto real (`email`).
- [ ] Confirmar con la doctora las métricas del hero ("+12 años", "99.4 % satisfacción"). Si no son verificables, cámbialas o quítalas.
- [ ] Confirmar si la doctora se presenta como **odontóloga** (así dice la sección "La Doctora") o como médica estética (así dicen otros textos).

## 🟠 4. Revisión clínica (la doctora)

La doctora debe revisar y aprobar estos textos, que escribí como ejemplo:

- [ ] **Base clínica de la Enfermera Virtual:** [`n8n/base-clinica-ejemplo.csv`](../n8n/base-clinica-ejemplo.csv). La Enfermera responde **solo** con lo que diga esta hoja.
- [ ] **Instrucciones previas a cada tratamiento:** en el cerebro de n8n, nodo *Mensajes: recordatorio 24 h*.
- [ ] **Señales de emergencia:** nodo *Red de seguridad clínica* (lista `SENALES`) y las instrucciones del agente Enfermera (`PROMPT_ENFERMERA` en `n8n/generar-cerebro.mjs`).
- [ ] **Cuidados post-tratamiento de la paciente demo:** en `db.example.json`, para usarlos como modelo de los reales.

## 🟠 5. Legal y privacidad

- [ ] Que una persona asesora legal revise el **aviso de privacidad** ([`src/pages/PrivacyPage.jsx`](../src/pages/PrivacyPage.jsx)) según la Ley 8968. Si cambia el texto, actualiza `AVISO_VERSION` en `src/config/clinica.js`.
- [ ] Definir el **consentimiento informado** para fotos de evolución y para el uso de asistentes de IA con datos de salud.
- [ ] Revisar las condiciones de tratamiento de datos de **Meta (WhatsApp)**, **Google** y **Anthropic** antes de usar datos reales.
- [ ] Evaluar si la base de datos debe inscribirse ante la **PRODHAB** (Agencia de Protección de Datos de los Habitantes).

## 🟡 6. Cuentas para poner en producción (n8n es todo el backend)

La guía paso a paso está en [`n8n/README.md`](../n8n/README.md).

- [ ] **n8n 2.x publicado por HTTPS** (n8n Cloud o un servidor), con `NODE_FUNCTION_ALLOW_BUILTIN=crypto`.
- [ ] **Meta / WhatsApp Business:**
  - [ ] Crear la app, conectar el número y generar un token permanente.
  - [ ] Crear y hacer aprobar las **14 plantillas** (nombres, categorías y textos en la guía).
- [ ] **Anthropic:** crear una API key (console.anthropic.com).
- [ ] **Google:**
  - [ ] Crear la **hoja de datos** con sus 6 pestañas y la fila de la doctora (con su número real).
  - [ ] Crear la hoja **Base clínica** (pestaña `BaseClinica`) a partir del CSV.
  - [ ] Crear una carpeta privada de Drive para los respaldos semanales.
  - [ ] Dar acceso al calendario de la doctora.
- [ ] **n8n:**
  - [ ] Importar los **dos** flujos (`n8n/flujos/api-clinica.json` y `cerebro-maestro-clinica.json`).
  - [ ] Crear las **7 credenciales**.
  - [ ] Llenar *Configuración API* (con dos secretos nuevos) y *Configuración* del cerebro.
  - [ ] En los dos flujos: *Settings → Error workflow → Clínica · Cerebro maestro*.
  - [ ] Publicar los dos flujos y registrar el webhook de WhatsApp en Meta.
- [ ] **Sitio:** `VITE_API_URL=https://tu-n8n.com/webhook`, generar el flujo API con `ORIGEN_PERMITIDO` = dominio del sitio, `npm run build` y publicar `dist/` (Vercel o Netlify).
- [ ] **Proxy delante de n8n** con límite de intentos para las rutas públicas (ver la guía).
- [ ] Hacer una prueba real de cada rama con un número propio antes de usarlo con pacientes.

## 🟡 7. Contenido del portal

- [ ] Grabar o elegir los **videos** de "Clínica privada" y definir dónde alojarlos (privados, no en YouTube público).
- [ ] Reunir las fotos de antes y después **con consentimiento firmado** para el portal y para la sección de casos de la landing.

---

### Referencia rápida

| Comando | Para qué |
|---|---|
| `npm run server` | Simulador de backend en :3001 |
| `npm run dev` | Sitio en :5173 |
| `npm run verificar` | Contrato completo de la API contra el simulador + estructura de los flujos de n8n |
| `npm run probar:n8n` | Los dos flujos de n8n en un n8n real y local |
| `npm run build` | Genera la versión de producción |
| `npm run generar:n8n` | Regenera los dos flujos de n8n desde código |
