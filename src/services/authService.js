import api from './api.js';
import { sanitizeInput } from '../utils/security.js';
import { TOKEN_KEY, USER_KEY } from './session.js';

// Guarda la sesión emitida por el servidor
const saveSession = ({ token, user }) => {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
};

// Único método de acceso (pacientes y doctora): enlace mágico por WhatsApp, sin contraseñas
export const authService = {
  /**
   * Solicita el enlace mágico que n8n envía por WhatsApp.
   * La respuesta es la misma exista o no el número. En desarrollo (sin n8n)
   * el simulador devuelve `devLink` para poder probar el flujo.
   */
  async requestMagicLink(phone) {
    try {
      const { data } = await api.post('/auth/magic-link', { phone: sanitizeInput(phone.trim()) });
      return data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'No pudimos enviar el enlace. Intenta de nuevo en unos minutos.');
    }
  },

  /**
   * Canjea el token del enlace mágico (un solo uso) por una sesión.
   */
  async verifyMagicLink(token) {
    try {
      const { data } = await api.post('/auth/verify', { token });
      saveSession(data);
      return { user: data.user, token: data.token };
    } catch (err) {
      throw new Error(err.response?.data?.error || 'El enlace expiró o ya fue usado. Pide uno nuevo.');
    }
  },

  /**
   * Cierre de sesión
   */
  logout() {
    // Invalida el token en el servidor; si falla, igual limpiamos la sesión local
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) {
      api.post('/logout', null, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  },

  /**
   * Obtener usuario autenticado actual desde el almacenamiento
   */
  getCurrentUser() {
    const raw = sessionStorage.getItem(USER_KEY);
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!raw || !token) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }
};
