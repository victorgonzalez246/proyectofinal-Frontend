import DOMPurify from 'dompurify';
import bcrypt from 'bcryptjs';

/**
 * Sanitiza cualquier entrada de texto del usuario para evitar ataques XSS (Cross-Site Scripting).
 * @param {string} dirtyInput - El texto ingresado por el usuario.
 * @returns {string} El texto limpio y seguro.
 */
export const sanitizeInput = (dirtyInput) => {
  if (!dirtyInput) return dirtyInput;
  return DOMPurify.sanitize(dirtyInput);
};

/**
 * Hashea una contraseña en el frontend antes de enviarla al db.json.
 * NOTA: En un entorno real esto debe hacerse en el Backend, pero para
 * arquitectura sin backend (json-server), esto evita guardar contraseñas en texto plano.
 * @param {string} password - Contraseña en texto plano.
 * @returns {string} Contraseña hasheada.
 */
export const hashPassword = (password) => {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
};

/**
 * Verifica si una contraseña coincide con su hash almacenado en db.json.
 * @param {string} password - Contraseña en texto plano ingresada en login.
 * @param {string} hash - Hash guardado en db.json.
 * @returns {boolean} True si coincide.
 */
export const comparePassword = (password, hash) => {
  return bcrypt.compareSync(password, hash);
};
