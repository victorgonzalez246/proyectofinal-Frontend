import axios from 'axios';
import { TOKEN_KEY, USER_KEY } from './session.js';

// Instancia base de Axios
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001', // Apunta al servidor simulado
  headers: {
    'Content-Type': 'application/json',
  }
});

// Interceptor de peticiones (Request Interceptor)
api.interceptors.request.use(
  (config) => {
    // Obtenemos el token de sessionStorage (más seguro que localStorage para XSS)
    const token = sessionStorage.getItem(TOKEN_KEY);

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor de respuestas (Response Interceptor)
api.interceptors.response.use(
  (response) => {
    // Si la respuesta es exitosa, la devolvemos directamente
    return response;
  },
  (error) => {
    // Solo cerramos sesión si había una sesión activa (token expirado o inválido).
    // Un visitante público que recibe 401 no debe ser redirigido al login.
    if (error.response?.status === 401 && sessionStorage.getItem(TOKEN_KEY)) {
      console.warn("Sesión expirada o inválida. Cerrando sesión...");
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
