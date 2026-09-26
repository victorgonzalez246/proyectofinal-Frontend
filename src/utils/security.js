import DOMPurify from 'dompurify';

/**
 * Sanitiza cualquier entrada de texto del usuario para evitar ataques XSS (Cross-Site Scripting).
 * @param {string} dirtyInput - El texto ingresado por el usuario.
 * @returns {string} El texto limpio y seguro.
 */
export const sanitizeInput = (dirtyInput) => {
  if (!dirtyInput) return dirtyInput;
  return DOMPurify.sanitize(dirtyInput);
};

// NOTA: el hash y la verificación de contraseñas ya no se hacen en el navegador.
// Viven en server.js (simulador), que es el único que ve los hashes.
