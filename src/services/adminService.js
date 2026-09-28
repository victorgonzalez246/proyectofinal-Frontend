import api from './api.js';

// Contrato del panel de la doctora (rutas /admin/*). Lo atiende server.js en desarrollo
// y el flujo "API de la clínica" de n8n en producción, con la misma lógica (api/nucleo.mjs).
const errorMessage = (err, fallback) => err.response?.data?.error || fallback;

const call = async (request, fallback) => {
  try {
    const { data } = await request();
    return data;
  } catch (err) {
    throw new Error(errorMessage(err, fallback));
  }
};

export const adminService = {
  getHoy: () => call(() => api.get('/admin/hoy'), 'No pudimos cargar el resumen del día.'),

  getCitas: (estado = '') =>
    call(() => api.get('/admin/citas', { params: estado ? { estado } : {} }), 'No pudimos cargar las citas.'),

  updateCita: (id, cambios) =>
    call(() => api.patch('/admin/citas', cambios, { params: { id } }), 'No pudimos actualizar la cita.'),

  getPacientes: () => call(() => api.get('/admin/pacientes'), 'No pudimos cargar las pacientes.'),

  getPaciente: (id) =>
    call(() => api.get('/admin/pacientes/ficha', { params: { id } }), 'No pudimos cargar la ficha de la paciente.'),

  retirarPromociones: (id) =>
    call(() => api.patch('/admin/pacientes', { promociones: false }, { params: { id } }), 'No pudimos actualizar el consentimiento.'),

  savePlan: (id, plan) =>
    call(() => api.put('/admin/pacientes/plan', plan, { params: { id } }), 'No pudimos guardar el plan.'),

  getAlertas: (estado = '') =>
    call(() => api.get('/admin/alertas', { params: estado ? { estado } : {} }), 'No pudimos cargar las alertas.'),

  updateAlerta: (id, { estado, respuesta = '' }) =>
    call(
      () => api.patch('/admin/alertas', { estado, respuesta: respuesta.trim() }, { params: { id } }),
      'No pudimos actualizar la alerta.'
    ),

  sendCampana: (mensaje) =>
    call(() => api.post('/admin/campanas', { mensaje: mensaje.trim() }), 'No pudimos enviar la promoción.'),
};
