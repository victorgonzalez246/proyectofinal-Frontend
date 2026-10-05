# Aplicar hoy en n8n Cloud (5 oct 2026)

Qué arregla:
- Las alertas por WhatsApp a la doctora (emergencia del chat, `despertar_doctora` de la Enfermera y "mensaje sin responder") ahora **también quedan en el panel** (Alertas y Hoy), con el distintivo **WhatsApp**, y se marcan atendidas como las demás.
- La Enfermera y la Recepcionista pasan a **Gemini 3.6 Flash**, que hoy responde en 1 s (el 3.5 Flash daba 503 "high demand"). Si falla, usan **Gemini 3.5 Flash-Lite** como respaldo.

Haz los pasos **en este orden**. Antes de empezar, ten abiertos los dos flujos: **Clínica · API** y el **Cerebro**.

## 1. Credencial "Clínica · Secreto n8n" (sin esto fallan `ficha_paciente`, `ficha_recepcion`, `registrar_cita` y los nodos `API: …` con el error 401 "Secreto de n8n inválido")

1. En el flujo **Clínica · API**, abre el nodo **Configuración API** y copia el valor del campo **`n8nSecret`** (completo, sin espacios al inicio ni al final).
2. Ve a **Overview → Credentials** y abre **Clínica · Secreto n8n** (tipo *Header Auth*).
3. **Name:** `X-N8N-Secret`
4. **Value:** pega el valor de `n8nSecret`.
5. **Save**.

No toques la credencial **Header Auth account**: esa es la del token de WhatsApp (Meta).

## 2. Credencial "Google Calendar account" (sin esto fallan `disponibilidad_agenda` y `bloquear_agenda`: "This credential is configured to prevent use within an HTTP Request or GraphQL node")

1. **Overview → Credentials → Google Calendar account**.
2. Busca el campo **Allowed HTTP Request Domains** (abajo, en el formulario de la credencial).
3. Elige **Specific Domains** y en **Allowed Domains** escribe: `www.googleapis.com`
   (o elige **All**). Hoy está en **None**, por eso falla.
4. **Save**. No hace falta volver a conectar la cuenta de Google.

Si `base_clinica` o el respaldo del domingo dieran el mismo error, haz lo mismo en **Google Sheets account** (`sheets.googleapis.com`) y en **Google Drive account** (`www.googleapis.com`).

## 3. Importar el flujo API

1. Abre **Clínica · API**.
2. Haz clic en el lienzo, **Ctrl+A** y **Supr** (borra todos los nodos).
3. Menú **⋯ → Import from File…** → `n8n/respaldos-cloud/api-IMPORTAR-alertas-2026-10-05.json`.
4. **Save** y después **Publish**.

Trae el código nuevo del **Núcleo API** (incluye la línea de la fecha de fin que ya habías añadido) y un Webhook más: **POST /n8n/alerta**. La configuración, las credenciales y los demás webhooks quedan igual.

## 4. Importar el Cerebro

Igual que el paso 3, en el flujo del **Cerebro**, con `n8n/respaldos-cloud/cerebro-IMPORTAR-alertas-2026-10-05.json`. Luego **Save** y **Publish**.

Nodos nuevos: **Modelo respaldo · Enfermera**, **Modelo respaldo · Recepcionista**, **Alerta para el panel · emergencia / Enfermera / sin respuesta** y **API: registrar alerta**. Si algún nodo sale con el triángulo rojo de credencial, ábrelo y elige la credencial de siempre (**Gemini - Aura y WhatsApp** o **Clínica · Secreto n8n**).

## 5. Probar (desde un número de `numerosPrueba` si el modo pruebas está en "si")

Escribe al WhatsApp de la clínica:

1. **Texto:** "Hola, ¿cómo cuido la zona después del bótox?" → responde la Enfermera en pocos segundos.
2. **Agenda:** "Quiero una cita el jueves en la tarde" → la Recepcionista ofrece horarios (prueba los pasos 1 y 2).
3. **Nota de voz:** cualquier pregunta → responde según lo que dijiste.
4. **Foto** con un texto → la Enfermera la comenta.
5. **Molestia:** "Tengo la zona morada y me duele cada vez más" → la Enfermera usa `despertar_doctora`: llega el WhatsApp a la doctora **y** aparece una alerta **WhatsApp · Enfermera IA** en el panel.
6. **Emergencia:** "No puedo respirar bien" → la paciente recibe el mensaje del 911, la doctora el WhatsApp de EMERGENCIA **y** el panel una alerta **WhatsApp · Emergencia**.
7. En el panel: **Alertas** (y la tarjeta de **Hoy**) → abre la alerta → **Atender** → **Marcar como atendida**.

Si una alerta no aparece en el panel, mira la ejecución en n8n: el nodo **API: registrar alerta** muestra el error (casi siempre el paso 1). Aun así, el WhatsApp a la doctora y la respuesta a la paciente salen igual.

## 6. Volver atrás

Repite los pasos 3 y 4 con los respaldos de hoy en la mañana:
- API: `n8n/respaldos-cloud/api-clinica-2026-10-04.json` y vuelve a añadir en **Núcleo API** la línea `if (fechaFin < fechaInicio) …`.
- Cerebro: `n8n/respaldos-cloud/cerebro-maestro-GEMINI-para-importar.json`.

Las credenciales de los pasos 1 y 2 pueden quedarse como están: son correcciones, no dependen de la versión.
