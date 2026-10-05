// Textos de las plantillas de WhatsApp aprobadas en Meta (fuente única).
// Los usa el cerebro en "modo pruebas": mientras Meta revisa las plantillas, los mensajes salen como
// texto libre con este mismo texto (solo llegan a números que escribieron a la clínica en las últimas 24 h).
// Si cambias un texto aquí, cámbialo también en Meta (la tabla de n8n/README.md se genera igual).
export const PLANTILLAS = {
  cita_recibida_v2: {
    cuerpo: 'Hola {{1}}, gracias por escribirnos. Recibimos tu solicitud de cita para el {{2}} y muy pronto te escribiremos por este medio para confirmar la hora. Mientras tanto, ya puedes entrar a tu portal privado desde el botón de abajo.',
    boton: { texto: 'Ir a mi portal', ruta: '/portal/acceso' },
  },
  nueva_solicitud_cita: {
    cuerpo: 'Hola doctora, llegó una nueva solicitud de cita. La paciente {{1}}, con número {{2}}, desea agendar {{3}} para el {{4}}. Puede revisarla y confirmarla en el panel médico.',
  },
  cita_confirmada_v2: {
    cuerpo: 'Hola {{1}}, te confirmamos que tu cita quedó agendada para el {{2}} a las {{3}}. Puedes ver los detalles en tu portal privado y con gusto te esperamos en la clínica.',
    boton: { texto: 'Ver mi cita', ruta: '/portal' },
  },
  cita_cancelada: {
    cuerpo: 'Hola {{1}}, te avisamos que tu cita del {{2}} fue cancelada. Si deseas elegir una nueva fecha, solo responde a este mensaje y con gusto te ayudamos.',
  },
  codigo_acceso: {
    // Plantilla de Autenticación: Meta fija el texto; el código también va en el botón "Copiar código"
    cuerpo: '*{{1}}* es tu código de verificación. Por tu seguridad, no lo compartas. Vence en 15 minutos.',
  },
  alerta_clinica: {
    cuerpo: 'Hola doctora, hay una alerta de tipo {{1}} que necesita su atención. La paciente es {{2}} y su teléfono es {{3}}. Lo que ocurrió: {{4}}. Puede ver todos los detalles en el panel médico.',
  },
  sos_recibido: {
    cuerpo: 'Hola {{1}}, la Dra. Laura ya recibió tu aviso y te escribirá en pocos minutos. Si se trata de una emergencia médica, por favor llama de inmediato al 911.',
  },
  resumen_consulta: {
    cuerpo: 'Hola doctora, este es el resumen de la consulta de hoy con {{1}} a las {{2}}. Primer punto: {{3}}. Segundo punto: {{4}}. Tercer punto: {{5}}. Encontrará más detalles en el panel médico.',
  },
  recordatorio_cita: {
    cuerpo: 'Hola {{1}}, te recordamos que te esperamos mañana {{2}} a las {{3}}. Para prepararte antes de tu cita: {{4}}. Si necesitas cambiar la hora, solo responde a este mensaje.',
  },
  seguimiento_tratamiento_v2: {
    cuerpo: 'Hola {{1}}, queremos saber cómo te sientes hoy después de tu visita. Puedes contarnos desde tu portal privado o simplemente responder a este mensaje.',
    boton: { texto: 'Contar cómo me siento', ruta: '/portal' },
  },
  proximo_paso_mapa_v2: {
    cuerpo: 'Hola {{1}}, te recordamos que tu próximo paso en tu mapa de belleza está previsto para el {{2}}. Puedes ver tu plan completo en tu portal cuando gustes.',
    boton: { texto: 'Ver mi mapa', ruta: '/portal/mapa' },
  },
  resumen_semana_clinica: {
    cuerpo: 'Hola doctora, esta semana hay {{1}} pasos programados en los mapas de belleza de sus pacientes: {{2}}. Puede revisarlos con calma en el panel médico.',
  },
  promocion: {
    cuerpo: 'Hola {{1}}, en la clínica de la Dra. Laura tenemos una novedad especial para ti: {{2}} Si prefieres no recibir más promociones, solo responde BAJA.',
  },
};
