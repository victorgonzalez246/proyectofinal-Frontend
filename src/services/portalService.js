import api from './api.js';
import { sanitizeInput } from '../utils/security.js';

// Contrato del portal de pacientes. Hoy lo atiende server.js (simulador);
// en producción cada llamada será un webhook de n8n con la misma forma.
const errorMessage = (err, fallback) => err.response?.data?.error || fallback;

export const portalService = {
  async getPortal() {
    const { data } = await api.get('/me/portal');
    return data;
  },

  async saveCare(doneIds) {
    const { data } = await api.put('/me/care', { doneIds });
    return data.doneIds;
  },

  async getCheckins() {
    const { data } = await api.get('/me/checkins');
    return data;
  },

  async sendCheckin({ mood, pain, note = '' }) {
    try {
      const { data } = await api.post('/me/checkins', { mood, pain, note: sanitizeInput(note.trim()) });
      return data;
    } catch (err) {
      throw new Error(errorMessage(err, 'No pudimos guardar tu registro. Intenta de nuevo.'));
    }
  },

  async sendSos({ reason, note = '' }) {
    try {
      const { data } = await api.post('/me/sos', { reason, note: sanitizeInput(note.trim()) });
      return data;
    } catch (err) {
      throw new Error(errorMessage(err, 'No pudimos avisar a la clínica. Llámanos directamente.'));
    }
  },
};
