import axios from 'axios';

// Instancia base de Axios
const api = axios.create({
  baseURL: 'http://localhost:3001', // Apunta al json-server
  headers: {
    'Content-Type': 'application/json',
    // Simulamos headers de seguridad
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  }
});

// Interceptor de peticiones (Request Interceptor)
api.interceptors.request.use(
  (config) => {
    // Aquí interceptamos la petición antes de enviarla
    // Obtenemos el token de sessionStorage (más seguro que localStorage para XSS)
    const token = sessionStorage.getItem('token');
    
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
    // Manejo global de errores de red o autenticación
    if (error.response && error.response.status === 401) {
      console.warn("Acceso denegado o token expirado. Cerrando sesión...");
      sessionStorage.removeItem('token');
      // Redirigir al login si es necesario
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
