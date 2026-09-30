# Pruebas (testings)

Pruebas automatizadas del frontend con **Vitest** y **Testing Library**. Ninguna necesita n8n, internet ni claves: la API, el clima y el asistente se simulan o se usan en local.

```bash
npm test                  # todo el proyecto (incluye esta carpeta y las pruebas junto al código)
npm run test:unitarias    # lógica pura: analítica y métricas
npm run test:componentes  # componentes de React en un navegador simulado (jsdom)
npm run test:integracion  # datos de demostración + API real (api/nucleo.mjs) + proxy del asistente
```

## Estructura

| Carpeta | Qué prueba | Archivos |
|---|---|---|
| `unitarias/` | Cálculos de los dashboards, sin interfaz | `analitica.test.js`: evolución de cada paciente (curva de recuperación, mejora de la molestia, cuidados, plan, paquetes, curva promedio). `analitica-operativa.test.js`: demanda por día, franjas, anticipación, canal, fidelización y alertas |
| `componentes/` | Lo que ve y usa la persona: textos, roles ARIA, teclado, estados de carga y error | `AdminMetricas` (dashboard de la doctora), `EvolucionPaciente` (dashboard de la paciente), `AsistenteVirtual` (chat con IA), `ClimaPiel` (API externa), `ControlAccesibilidad` (tamaño de texto, contraste, animaciones) |
| `integracion/` | Varias piezas juntas | `sembrado-y-analitica.test.mjs`: genera los datos de demostración en un archivo temporal, entra como doctora y como paciente por enlace mágico y calcula los dashboards con las respuestas reales de la API. `proxy-asistente.test.mjs`: el proxy del asistente como servidor HTTP (errores 503, 400, 413, 405) |
| `setup-dom.js` | Preparación común de las pruebas de componentes | jest-dom, limpieza entre pruebas y APIs del navegador que jsdom no trae |

Además, junto al código viven las pruebas previas del proyecto: `api/*.test.mjs` (contrato de la API y Google Sheets), `src/services/*.test.js` y `src/admin/*.test.js`.

## Criterios

- **Se prueba el comportamiento, no la implementación**: los componentes se buscan por su rol y nombre accesible (`getByRole('button', { name: … })`), igual que los usa un lector de pantalla.
- **Accesibilidad incluida**: cada prueba de componente verifica `aria-expanded`, `aria-pressed`, `role="switch"`, `role="alert"`, foco y la tabla equivalente de cada gráfico.
- **Sin dependencias externas**: `fetch` y los servicios se simulan con `vi.fn()` y `vi.mock()`. La prueba del proxy nunca llega a llamar al modelo.
- **Independientes de la zona horaria**: las fechas de prueba caen el mismo día en Costa Rica y en UTC (la integración continua corre en UTC).
- **No se toca `db.json`**: la integración genera sus datos en una carpeta temporal.
