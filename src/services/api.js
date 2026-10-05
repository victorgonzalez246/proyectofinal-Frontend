import { TOKEN_KEY, USER_KEY } from './session.js';

// Cliente HTTP mínimo sobre fetch (antes axios): misma forma de uso en los servicios.
//   api.get(ruta, { params })  ·  api.post / put / patch(ruta, body, { params, headers })
// Devuelve { data } y, si la respuesta no es 2xx, lanza un Error con `response: { status, data }`.
// En desarrollo (Vite) se usan rutas relativas (BASE_URL='') para que el proxy de vite.config.js
// reenvíe las peticiones a localhost:3001 sin problemas de CORS.
// En producción VITE_API_URL apunta al webhook de n8n con la URL completa.
const BASE_URL = import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== 'http://localhost:3001'
  ? import.meta.env.VITE_API_URL
  : ''; // rutas relativas → el proxy de Vite las reenvía a localhost:3001

const conQuery = (ruta, params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')).toString();
  return `${BASE_URL}${ruta}${query ? `?${query}` : ''}`;
};

async function request(method, ruta, body, { params, headers } = {}) {
  // El token vive en sessionStorage (se borra al cerrar la pestaña)
  const token = sessionStorage.getItem(TOKEN_KEY);
  const res = await fetch(conQuery(ruta, params), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = null;
  try { data = await res.json(); } catch { /* respuesta sin cuerpo */ }

  if (!res.ok) {
    // Sesión vencida o inválida: se cierra y se vuelve al acceso.
    // Un visitante público que recibe 401 no debe ser redirigido.
    if (res.status === 401 && token) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      window.location.href = '/portal/acceso';
    }
    const error = new Error(data?.error || `Error ${res.status}`);
    error.response = { status: res.status, data };
    throw error;
  }
  return { data };
}

const api = {
  get: (ruta, config) => request('GET', ruta, undefined, config),
  post: (ruta, body, config) => request('POST', ruta, body ?? undefined, config),
  put: (ruta, body, config) => request('PUT', ruta, body, config),
  patch: (ruta, body, config) => request('PATCH', ruta, body, config),
};

export default api;
