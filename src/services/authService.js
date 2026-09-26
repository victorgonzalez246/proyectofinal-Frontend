import api from './api.js';
import { sanitizeInput } from '../utils/security.js';
import { TOKEN_KEY, USER_KEY } from './session.js';
import { WELCOME_COUPONS } from '../data/welcomeCoupons.js';

export { WELCOME_COUPONS };

// Guarda la sesión emitida por el servidor
const saveSession = ({ token, user }) => {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const authService = {
  /**
   * Registro con membresía al Club de Beneficios.
   * El servidor valida el correo, hashea la contraseña, fuerza el rol 'member'
   * y emite el token de sesión.
   */
  async register({ name, email, phone = '', password, subscribeOffers = true }) {
    try {
      const { data } = await api.post('/register', {
        name: sanitizeInput(name.trim()),
        email: sanitizeInput(email.trim().toLowerCase()),
        phone: phone ? sanitizeInput(phone.trim()) : '',
        password,
        subscribeOffers,
      });
      saveSession(data);

      return {
        user: data.user,
        token: data.token,
        welcomeCoupons: data.user.coupons || WELCOME_COUPONS
      };
    } catch (err) {
      throw new Error(err.response?.data?.error || 'No se pudo completar el registro. Intenta de nuevo.');
    }
  },

  /**
   * Inicio de Sesión (Miembro o Doctora).
   * La contraseña se verifica en el servidor; el navegador nunca recibe hashes.
   */
  async login({ email, password }) {
    try {
      const { data } = await api.post('/login', {
        email: sanitizeInput(email.trim().toLowerCase()),
        password,
      });
      saveSession(data);

      return {
        user: data.user,
        token: data.token
      };
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Credenciales inválidas. Por favor verifica tu correo y contraseña.');
    }
  },

  /**
   * Portal de pacientes: solicita el enlace mágico que n8n envía por WhatsApp.
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
