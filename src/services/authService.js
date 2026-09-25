import api from './api.js';
import { hashPassword, comparePassword, sanitizeInput } from '../utils/security.js';

const TOKEN_KEY = 'clinica_auth_token';
const USER_KEY = 'clinica_user_data';

// Lista de cupones de bienvenida otorgados automáticamente
export const WELCOME_COUPONS = [
  {
    code: 'BIENVENIDA15',
    title: '15% OFF en tu Primer Tratamiento',
    discount: '15%',
    description: 'Válido en cualquier tratamiento facial o valoración integral.',
    validUntil: '2026-12-31',
    category: 'Facial & Armonización',
    status: 'active'
  },
  {
    code: 'VIPSKIN2026',
    title: 'Hydrafacial Glow de Cortesía con Sesión Láser',
    discount: '100% en Hydrafacial complementario',
    description: 'Beneficio exclusivo para miembros suscritos al club de beneficios.',
    validUntil: '2026-10-31',
    category: 'Promoción Club VIP',
    status: 'active'
  }
];

export const authService = {
  /**
   * Registro con membresía al Club de Beneficios
   */
  async register({ name, email, phone = '', password, subscribeOffers = true }) {
    const cleanName = sanitizeInput(name.trim());
    const cleanEmail = sanitizeInput(email.trim().toLowerCase());
    const cleanPhone = phone ? sanitizeInput(phone.trim()) : '';

    // 1. Validar si ya existe el correo
    const existing = await api.get(`/users?email=${encodeURIComponent(cleanEmail)}`);
    if (existing.data && existing.data.length > 0) {
      throw new Error('Este correo electrónico ya se encuentra registrado.');
    }

    // 2. Hashear contraseña de forma segura
    const hashedPassword = hashPassword(password);

    // 3. Crear nuevo usuario miembro
    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      password: hashedPassword,
      role: 'member', // 'member' (paciente suscrito) o 'doctor'
      dateJoined: new Date().toISOString(),
      subscribedToOffers: subscribeOffers,
      coupons: [...WELCOME_COUPONS]
    };

    const response = await api.post('/users', newUser);
    const createdUser = response.data;

    // 4. Crear sesión inmediata
    const token = `token_${createdUser.id}_${Date.now()}`;
    const safeUser = { ...createdUser };
    delete safeUser.password;

    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(safeUser));

    return {
      user: safeUser,
      token,
      welcomeCoupons: WELCOME_COUPONS
    };
  },

  /**
   * Inicio de Sesión (Miembro o Doctora)
   */
  async login({ email, password }) {
    const cleanEmail = sanitizeInput(email.trim().toLowerCase());

    // 1. Buscar usuario por correo
    const res = await api.get(`/users?email=${encodeURIComponent(cleanEmail)}`);
    const users = res.data;

    if (!users || users.length === 0) {
      throw new Error('Credenciales inválidas. Por favor verifica tu correo y contraseña.');
    }

    const foundUser = users[0];

    // 2. Comparar contraseñas mediante bcrypt
    const isMatch = comparePassword(password, foundUser.password);
    if (!isMatch) {
      throw new Error('Credenciales inválidas. Por favor verifica tu correo y contraseña.');
    }

    // 3. Generar token y almacenar sesión
    const token = `token_${foundUser.id}_${Date.now()}`;
    const safeUser = { ...foundUser };
    delete safeUser.password;

    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(safeUser));

    return {
      user: safeUser,
      token
    };
  },

  /**
   * Cierre de sesión
   */
  logout() {
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
