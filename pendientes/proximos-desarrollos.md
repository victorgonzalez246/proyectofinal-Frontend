# 🛠️ Próximos desarrollos (en orden)

Trabajo de código que sigue. Cada punto indica por qué va en ese lugar.

## 1. Dashboard de la doctora (siguiente)

Es lo que más desbloquea: hoy solo la paciente demo tiene datos en el portal, y el recordatorio de 24 h solo funciona con citas confirmadas.

Debe permitir:
- **Citas:** ver las solicitudes de la landing, confirmarlas o cancelarlas y asignarles hora (el recordatorio de n8n usa `estado: "confirmada"` y `hora`).
- **Pacientes:** crear o editar el plan de cada paciente, es decir:
  - el mapa de belleza (pasos, fechas, notas);
  - el último tratamiento y su protocolo de cuidados;
  - los paquetes (sesiones);
  - los productos aplicados (marca, lote, vencimiento).
- **Alertas:** bandeja de SOS y check-ins marcados, con su estado (abierta o atendida).
- **Resumen del día:** consultas de hoy con el resumen de 3 puntos de la Recepcionista.
- **Club:** lo que ya existe hoy (miembros y cupones).

Base disponible:
- **Rutas del simulador:** `server.js` ya permite a la doctora leer y escribir `/appointments`, `/portal`, `/checkins` y `/sosAlerts`.
- **Diseño:** reutilizar el del portal (`src/portal/portal.css`, tema claro/oscuro).

## 2. Fotos de evolución

- Subida de fotos desde el dashboard de la doctora.
- En desarrollo, guardarlas fuera de `public/` y servirlas solo con sesión válida. En producción, una carpeta privada de Google Drive servida por n8n.
- Registrar el consentimiento de cada foto.

## 3. Llevar el portal a los webhooks de n8n (producción)

Cuando el dashboard esté listo y los datos reales estén en Google Sheets:
- Crear en el cerebro las ramas de webhook para cada ruta pública del contrato (`docs/ARQUITECTURA-PORTAL.md`, sección 4):
  - la sesión y el enlace mágico;
  - `/me/portal`, los check-ins, el SOS y los cuidados;
  - las citas.
- Cambiar `VITE_API_URL` a la URL de n8n. El frontend no necesita más cambios.
- `server.js` queda como simulador para desarrollo y para `npm run verificar`.

## 4. Videos de Clínica privada

- Reproductor con enlaces firmados o de corta duración (no enlaces públicos).
- Cargar la URL de cada video desde el dashboard de la doctora.

## 5. Mejoras menores

- En el panel de la doctora, "Enviar promoción" es simulado: conectarlo a una rama del cerebro de n8n.
- Reducir el bundle principal (más de 500 kB): dividir en partes el panel de la doctora y las librerías pesadas (`xlsx`, `jspdf`, `recharts`) si no se usan en la landing.
- Agregar las pruebas de `npm run verificar` a una integración continua (GitHub Actions) cuando el repo sea privado.
