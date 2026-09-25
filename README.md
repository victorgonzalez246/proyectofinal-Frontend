# 🏥 Proyecto Clínica Estética - Frontend

Este repositorio contiene la aplicación frontend para la gestión de la Clínica Estética de la Dra. Laura Jiménez. Fue inicializado con **React** y **Vite**, preparado con herramientas modernas de diseño, y blindado con prácticas de ciberseguridad para operar de manera independiente usando una base de datos mock local (`json-server`).

---

## 🛠️ Tecnologías y Librerías Base

- **Core:** React 19 + Vite
- **Enrutamiento:** React Router DOM v7
- **Estilos y UI:** Tailwind CSS v4
- **Iconos:** Lucide React
- **Gráficos:** Recharts
- **Peticiones HTTP:** Axios

## 🔒 Ciberseguridad Implementada (Frontend Impenetrable)

A pesar de no contar con un Backend real, se han implementado múltiples barreras de seguridad para proteger la integridad de la aplicación:

1. **Protección XSS (Cross-Site Scripting):** 
   - Uso de `DOMPurify` para sanitizar entradas de usuario.
   - Implementación de **Content Security Policy (CSP)** en el `index.html`.
2. **Hasheo de Contraseñas:** 
   - Las contraseñas se hashean en el frontend con `bcryptjs` antes de enviarse al almacenamiento local (`db.json`), asegurando que jamás se guarden en texto plano.
3. **Validación de Esquemas:** 
   - Uso de `Zod` para garantizar que la estructura y los datos enviados cumplan con reglas estrictas.
4. **Candado Local (Servidor Mock Seguro):**
   - El `json-server` fue encapsulado en un archivo Node (`server.js`) con un **middleware de seguridad**.
   - Cualquier intento de acceder a los datos directamente a través de `http://localhost:3001` sin un Token de Autorización válido será bloqueado (`401 Acceso Denegado`).
5. **Comunicaciones Seguras:**
   - Se configuró un interceptor global en Axios (`src/services/api.js`).
   - El Token JWT se almacena de forma segura en `sessionStorage` en lugar de `localStorage`.
   - Las sesiones inválidas o expiradas son interceptadas automáticamente para desconectar al usuario.

---

## 📁 Estructura del Proyecto

```text
src/
├── assets/         # Imágenes, iconos y recursos estáticos
├── components/     
│   ├── layout/     # Componentes estructurales (MainLayout, AdminLayout, Navbars)
│   └── ui/         # Componentes reutilizables (Botones, Tarjetas, Inputs)
├── context/        # Estado global de React (AuthContext)
├── hooks/          # Custom Hooks de React (ej. useAuth)
├── pages/          # Páginas y vistas principales (Login, Dashboard, Pacientes)
├── services/       # Lógica de llamadas a la API (api.js configurado con interceptores)
└── utils/          # Funciones de ayuda y seguridad (security.js con DOMPurify y bcrypt)
```

---

## 🚀 Cómo inicializar el proyecto

Para trabajar en el entorno de desarrollo, es necesario levantar tanto la aplicación de React como nuestro servidor seguro local.

Abre dos terminales diferentes en la carpeta `clinica-app`:

**Terminal 1 (Frontend - Vite):**
```bash
npm run dev
```

**Terminal 2 (Base de Datos con Candado Local):**
```bash
npm run server
```

---

## 🧪 Testing
El proyecto está configurado para pruebas unitarias y de componentes.
- **Librerías:** Vitest, React Testing Library, JSDom.
- **Comando:** `npm run test`

---
*Este documento será actualizado progresivamente conforme se vayan añadiendo páginas, componentes y flujos de negocio.*

---

## ✅ Estado de Avance (Hitos Completados)

### 1. Módulo de Autenticación y Registro VIP
- **Diseño UI/UX Premium:** Interfaz de pantalla dividida con fotografía editorial y un formulario minimalista, respetando estrictamente el manual de marca y los espaciados (*whitespace*).
- **Integración Segura:** Protección de candado local en `server.js` (`json-server`) conectada al frontend, guardando contraseñas en formato hash.
- **Flujo de Usuarios:** Funcionalidad completa para que pacientes se registren (recibiendo cupones) y el equipo médico acceda a su portal de administración de forma exclusiva y limpia.
