# 🗺️ Hoja de ruta: ecosistema completo (después de la presentación)

Estado al 5 de octubre de 2026: el sitio, el portal de pacientes, el panel de la doctora, Aura (Gemini) y el chat de WhatsApp con IA (texto, notas de voz y fotos) funcionan en producción, en **modo prueba** de Meta.

Esta hoja de ruta lleva el proyecto a **pacientes reales**, con **Chatwoot** como bandeja de atención humana.

**Duración estimada:** unas **2 semanas de trabajo**. El plazo real depende de la **verificación de negocio de Meta** (varios días hábiles, fuera de nuestro control): por eso se inicia en la fase 1.

---

## Fase 0 · Antes de la presentación (hoy)

- [ ] Probar WhatsApp de punta a punta desde un número de prueba: texto, nota de voz y foto.
- [x] Llevar `cierre-proyecto` a `main`.
- [ ] Tener listo el respaldo local por si n8n Cloud falla durante la demo: `node server.js` + `npm run dev` (doctora 8888 8888, paciente 8888 0001).
- **Regla:** no se toca producción hasta después de la demo.

## Fase 1 · Infraestructura (días 1–2)

- [ ] **Dónde vive n8n:** plan pagado de n8n Cloud o servidor propio (VPS con Docker). La prueba gratuita de n8n Cloud vence alrededor del 7 de octubre.
- [ ] **Meta:** iniciar la verificación de negocio, generar el token permanente y aprobar la plantilla `codigo_acceso` (Autenticación).
- [ ] Respaldos de los flujos de Cloud antes de cualquier cambio (`n8n/respaldos-cloud/`, fuera de git).

## Fase 2 · Chatwoot como espejo (días 2–3)

- [ ] Cuenta en Chatwoot con una bandeja tipo **API** (no "WhatsApp": Meta acepta un solo webhook por app y hoy es de n8n).
- [ ] n8n copia cada conversación a Chatwoot: mensaje de la paciente (incluida la transcripción de notas de voz), respuesta de la IA y alertas a la doctora.
- [ ] Interruptor `chatwootActivo` en el nodo Configuración, **apagado por defecto**; los nodos de Chatwoot no pueden detener el chat si fallan.
- [ ] Probar en el n8n local (`npm run probar:n8n`) antes de aplicarlo en Cloud.

## Fase 3 · Chatwoot con traspaso a humano (días 4–6)

- [ ] La doctora o la recepción **toman la conversación** desde Chatwoot y la IA se pausa para esa paciente.
- [ ] Las respuestas humanas salen por WhatsApp (Graph API) y la IA se reactiva al cerrar la conversación.
- [ ] Etiquetas (urgencia, cita, seguimiento) y alertas de emergencia destacadas en la bandeja.
- [ ] La red de seguridad (911, alerta a la doctora, BAJA) sigue antes de cualquier IA.

## Fase 4 · Robustez para producción (días 6–9)

- [ ] **Memoria del chat persistente** (Postgres o Redis): hoy vive en el proceso de n8n y se pierde al reiniciar.
- [ ] **Alertas de errores** de los flujos (flujo de error de n8n → WhatsApp o correo).
- [ ] **Límite de intentos** en el acceso al portal (códigos de un solo uso).
- [ ] **Respaldos automáticos** de la hoja de Google y de los flujos.
- [ ] Revisar el límite de ejecuciones del plan de n8n con el volumen esperado.
- [ ] La hoja de Google como base de datos sirve para empezar; es lo primero que se migra si el volumen crece.

## Fase 5 · Contenido clínico y legal (en paralelo)

- [ ] La doctora revisa `REVISION-DOCTORA.md`, los prompts de la Enfermera y la Recepcionista y las señales de emergencia.
- [ ] La clínica aprueba los términos y el aviso de privacidad (idealmente con asesoría legal).
- [ ] Tratamientos reales en el portal: los registra la doctora desde la ficha de cada paciente.

## Fase 6 · Piloto y lanzamiento (días 10–14)

- [ ] Piloto con 3 a 5 pacientes reales en modo prueba, revisando cada conversación.
- [ ] Ajustes de prompts según el piloto.
- [ ] Salir de modo prueba cuando Meta apruebe la verificación (`modoPruebas = no`).

---

## Depende de la clínica

| Qué | Para qué |
|---|---|
| Plan de n8n o servidor | Que el chat y la API sigan funcionando después de la prueba gratuita |
| Cuenta de Chatwoot | Bandeja de atención humana |
| Verificación de negocio en Meta | Salir de modo prueba y escribir a cualquier paciente |
| Revisión clínica y legal | Prompts, señales de emergencia, términos y privacidad |
