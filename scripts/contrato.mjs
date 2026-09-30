// Pruebas del contrato de la API. Las usa `npm run verificar` contra el simulador (server.js)
// y `npm run probar:n8n` contra el flujo "API de la clínica" corriendo en un n8n local.
// Parten de los datos de db.example.json.
import http from 'node:http';

export const ORIGIN = 'http://localhost:5173';

// Receptor que hace de cerebro de n8n: guarda cada evento que emite la API
export const crearReceptorEventos = (port) => {
  const eventos = [];
  const server = http.createServer((req, res) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      try { eventos.push({ ...JSON.parse(data), _secreto: req.headers['x-n8n-secret'] }); } catch { /* ignorado */ }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
  });
  return {
    eventos,
    url: `http://localhost:${port}/`,
    iniciar: () => new Promise((resolve) => server.listen(port, resolve)),
    detener: () => new Promise((resolve) => server.close(resolve)),
    // Espera (hasta 3 s) un evento que cumpla la condición
    esperar: async (event, cumple = () => true) => {
      for (let i = 0; i < 30; i += 1) {
        const e = eventos.find((x) => x.event === event && cumple(x));
        if (e) return e;
        await new Promise((r) => setTimeout(r, 100));
      }
      return null;
    },
  };
};

export const crearCliente = (api) => async (method, ruta, { body, token, secret } = {}) => {
  const res = await fetch(api + ruta, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(secret ? { 'X-N8N-Secret': secret } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, data };
};

/**
 * Recorre el contrato completo. Devuelve el token de la paciente demo para pruebas adicionales.
 * @param {{ api: string, secreto: string, receptor: ReturnType<typeof crearReceptorEventos>, ok: (cond: boolean, texto: string) => void }} opciones
 */
export async function probarContrato({ api, secreto, receptor, ok }) {
  const call = crearCliente(api);
  const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  // Pide un enlace mágico y lo canjea; el enlace llega en el evento auth.magic_link
  const entrar = async (telefono) => {
    await call('POST', '/auth/magic-link', { body: { phone: telefono } });
    const evento = await receptor.esperar('auth.magic_link', (e) => e.phone.replace(/\D/g, '').endsWith(telefono.replace(/\D/g, '')));
    const token = evento?.link?.split('#')[1];
    const verificado = token ? await call('POST', '/auth/verify', { body: { token } }) : { data: null };
    return { evento, magicToken: token, verificado, sesion: verificado.data?.token };
  };

  console.log('\nLanding · citas');
  const cita = { nombre: 'Prueba Verificación', telefono: '8777 6655', tratamiento: 'Valoración General', fecha: manana };
  ok((await call('POST', '/appointments', { body: cita })).status === 400, 'Sin consentimiento, la cita se rechaza');
  const creada = await call('POST', '/appointments', { body: { ...cita, consentimiento: true, avisoVersion: 'test', promociones: true } });
  ok(creada.status === 201 && Object.keys(creada.data).sort().join() === 'id,ok', 'Con consentimiento, la cita se registra y no devuelve datos');
  const eventoCita = await receptor.esperar('appointment.created', (e) => e.appointment?.id === creada.data?.id);
  ok(Boolean(eventoCita) && eventoCita._secreto === secreto, 'La cita avisa al cerebro de n8n con el secreto');

  console.log('\nSeguridad');
  ok((await call('GET', '/admin/pacientes')).status === 401, 'Sin sesión no se pueden leer pacientes');
  ok((await call('GET', '/admin/pacientes', { token: 'inventado' })).status === 401, 'Un token inventado se rechaza');
  const conClave = await call('POST', '/login', { body: { email: 'doctora@laurajimenez.com', password: 'Admin123!' } });
  ok(!conClave.data?.token, 'No existe el acceso con contraseña');

  console.log('\nAcceso por enlace mágico');
  const desconocido = await call('POST', '/auth/magic-link', { body: { phone: '7000 0000' } });
  ok(desconocido.status === 200 && JSON.stringify(desconocido.data) === '{"ok":true}', 'Un número desconocido recibe la misma respuesta');
  const paciente = await entrar('8888 0001');
  ok(paciente.evento?.role === 'member' && Boolean(paciente.magicToken), 'La paciente demo recibe su enlace por el cerebro (WhatsApp)');
  ok(Boolean(paciente.sesion) && paciente.verificado.data.user.role === 'member' && !('password' in paciente.verificado.data.user), 'El enlace abre sesión y no expone datos de acceso');
  ok((await call('POST', '/auth/verify', { body: { token: paciente.magicToken } })).status === 401, 'El enlace no se puede usar dos veces');
  console.log('\nAcceso con código de WhatsApp (plantilla de Autenticación)');
  await call('POST', '/auth/magic-link', { body: { phone: '8888 0001' } });
  const conCodigo = await receptor.esperar('auth.magic_link', (e) => /^\d{6}$/.test(e.codigo || '') && e.codigo !== paciente.evento?.codigo && e.phone.replace(/\D/g, '').endsWith('88880001'));
  ok(Boolean(conCodigo), 'El cerebro recibe un código de 6 dígitos para enviarlo por WhatsApp');
  const errado = conCodigo?.codigo === '000000' ? '111111' : '000000';
  ok((await call('POST', '/auth/verify', { body: { phone: '8888 0001', code: errado } })).status === 401, 'Un código incorrecto no abre sesión');
  const porCodigo = await call('POST', '/auth/verify', { body: { phone: '+506 8888-0001', code: conCodigo?.codigo } });
  ok(porCodigo.status === 200 && porCodigo.data.user.role === 'member', 'El código correcto abre sesión');
  ok((await call('POST', '/auth/verify', { body: { phone: '8888 0001', code: conCodigo?.codigo } })).status === 401, 'El código no se puede usar dos veces');
  const [uid, , exp, firma] = paciente.sesion.split('.');
  ok((await call('GET', '/admin/pacientes', { token: [uid, 'doctor', exp, firma].join('.') })).status === 401, 'Un token con el rol alterado se rechaza');

  console.log('\nPortal de la paciente');
  const sesion = paciente.sesion;
  const portal = await call('GET', '/me/portal', { token: sesion });
  ok(portal.status === 200 && portal.data?.roadmap?.length > 0, 'Carga el mapa de belleza');
  const checkin = await call('POST', '/me/checkins', { token: sesion, body: { mood: 'bien', pain: 2 } });
  ok(checkin.status === 201 && checkin.data.needsFollowUp === false, 'Guarda el check-in');
  ok(Boolean(await receptor.esperar('checkin.created', (e) => e.checkin?.id === checkin.data.id)), 'El check-in llega a la analista emocional');
  const preocupada = await call('POST', '/me/checkins', { token: sesion, body: { mood: 'preocupacion', pain: 3, note: 'Me preocupa la inflamación' } });
  ok(preocupada.data?.needsFollowUp === true, 'Un check-in con preocupación queda marcado para seguimiento');
  const sos = await call('POST', '/me/sos', { token: sesion, body: { reason: 'dolor', note: 'Duele al sonreír' } });
  ok(sos.status === 201 && Boolean(await receptor.esperar('sos.triggered', (e) => e.alert?.id === sos.data.id)), 'El SOS alerta de inmediato');
  ok((await call('GET', '/admin/pacientes', { token: sesion })).status === 403, 'Una paciente no puede entrar al panel');

  console.log('\nPanel de la doctora');
  const doctora = await entrar('8888 8888');
  const sesionDoc = doctora.sesion;
  ok(doctora.evento?.role === 'doctor' && doctora.verificado.data?.user?.role === 'doctor', 'La doctora entra con su enlace mágico');
  ok((await call('GET', '/me/portal', { token: sesionDoc })).status === 403, 'La doctora no usa rutas del portal de pacientes');
  const pacientes = await call('GET', '/admin/pacientes', { token: sesionDoc });
  const nueva = pacientes.data?.find?.((p) => p.phone === cita.telefono);
  ok(pacientes.status === 200 && pacientes.data.some((p) => p.id === 'pac-demo-1' && p.tienePlan) && nueva?.promociones === true, 'Ve el directorio con plan y consentimiento de promociones');
  // El simulador responde 404; en n8n una ruta sin Webhook la contesta n8n (500 sin cuerpo)
  const generico = await call('GET', '/users', { token: sesionDoc });
  ok(generico.status >= 400 && !Array.isArray(generico.data) && !JSON.stringify(generico.data ?? '').includes('@'), 'No hay CRUD genérico: una ruta inexistente no expone datos');

  const pendientes = await call('GET', '/admin/citas?estado=pendiente', { token: sesionDoc });
  ok(pendientes.data?.some?.((c) => c.id === creada.data.id), 'Ve las solicitudes de cita pendientes');
  const sinHora = await call('PATCH', `/admin/citas?id=${creada.data.id}`, { token: sesionDoc, body: { estado: 'confirmada' } });
  ok(sinHora.status === 400, 'No puede confirmar una cita sin hora');
  const confirmada = await call('PATCH', `/admin/citas?id=${creada.data.id}`, { token: sesionDoc, body: { estado: 'confirmada', hora: '15:30' } });
  ok(confirmada.status === 200 && confirmada.data.estado === 'confirmada' && confirmada.data.hora === '15:30', 'Confirma la cita con hora');
  ok(Boolean(await receptor.esperar('appointment.confirmed', (e) => e.cita?.id === creada.data.id && e.cita.hora === '15:30')), 'La confirmación avisa a la paciente');
  const citasN8n = await call('GET', `/n8n/citas?fecha=${manana}&estado=confirmada`, { secret: secreto });
  ok(citasN8n.data?.items?.some((c) => c.id === creada.data.id), 'El recordatorio de 24 h ya la encuentra');
  await call('PATCH', `/admin/citas?id=${creada.data.id}`, { token: sesionDoc, body: { estado: 'cancelada' } });
  ok(Boolean(await receptor.esperar('appointment.cancelled', (e) => e.cita?.id === creada.data.id)), 'La cancelación avisa a la paciente');

  const abiertas = await call('GET', '/admin/alertas?estado=abierta', { token: sesionDoc });
  ok(abiertas.data?.some?.((a) => a.id === sos.data.id && a.tipo === 'sos') && abiertas.data.some((a) => a.id === preocupada.data.id && a.tipo === 'checkin'), 'La bandeja de alertas reúne SOS y check-ins marcados');
  const atendida = await call('PATCH', `/admin/alertas?id=${sos.data.id}`, { token: sesionDoc, body: { estado: 'atendida', respuesta: 'La llamé, todo bien' } });
  ok(atendida.status === 200 && atendida.data.estado === 'atendida', 'Marca una alerta como atendida');
  const hoy = await call('GET', '/admin/hoy', { token: sesionDoc });
  ok(hoy.status === 200 && hoy.data.alertasAbiertas === 1 && Array.isArray(hoy.data.citas), 'El resumen del día cuenta las alertas abiertas');

  const planInvalido = await call('PUT', `/admin/pacientes/plan?id=${nueva?.id}`, { token: sesionDoc, body: { roadmap: [{ date: manana, title: 'X', kind: 'inventado', status: 'next' }] } });
  ok(planInvalido.status === 400, 'Rechaza un plan con datos inválidos');
  const plan = {
    lastTreatment: { name: 'Toxina botulínica', date: `${manana}T10:00:00-06:00` },
    roadmap: [{ date: manana, title: 'Toxina botulínica', kind: 'tratamiento', status: 'current', note: '' }],
    care: { title: 'Cuidados tras la toxina', since: `${manana}T10:00:00-06:00`, items: [{ type: 'dont', text: 'No te acuestes en 4 horas', hours: 4 }] },
    packages: [{ name: 'Mantenimiento anual', total: 2, used: 1, validUntil: '2027-12-31' }],
    certificates: [{ product: 'Botox', brand: 'Allergan', lot: 'L123', expiry: '2028-01', appliedOn: manana, zone: 'Entrecejo', amount: '20 U' }],
  };
  const guardado = await call('PUT', `/admin/pacientes/plan?id=${nueva?.id}`, { token: sesionDoc, body: plan });
  ok(guardado.status === 200 && guardado.data.care.items[0].id && guardado.data.userId === nueva?.id, 'Guarda el plan de una paciente nueva');
  const nuevaPaciente = await entrar(cita.telefono);
  const suPortal = await call('GET', '/me/portal', { token: nuevaPaciente.sesion });
  ok(suPortal.data?.lastTreatment?.name === 'Toxina botulínica' && suPortal.data.packages.length === 1, 'La paciente ve su plan en su portal');
  const ficha = await call('GET', `/admin/pacientes/ficha?id=${nueva?.id}`, { token: sesionDoc });
  ok(ficha.status === 200 && ficha.data.citas.length === 1 && ficha.data.plan?.roadmap?.length === 1, 'La ficha reúne plan, citas y check-ins');

  const campana = await call('POST', '/admin/campanas', { token: sesionDoc, body: { mensaje: 'Este mes: 15 % en skinboosters.' } });
  const eventoCampana = await receptor.esperar('campaign.sent');
  ok(campana.data?.enviados === 1 && eventoCampana?.destinatarios?.length === 1, 'La campaña llega solo a quien aceptó promociones');
  ok((await call('PATCH', `/admin/pacientes?id=${nueva?.id}`, { token: sesionDoc, body: { promociones: true } })).status === 400, 'La doctora no puede dar consentimiento en nombre de la paciente');
  await call('POST', '/n8n/baja', { secret: secreto, body: { telefono: cita.telefono } });
  const trasBaja = await call('POST', '/admin/campanas', { token: sesionDoc, body: { mensaje: 'Otra promoción de prueba.' } });
  ok(trasBaja.status === 400, 'Quien responde BAJA deja de recibir promociones');

  console.log('\nIntegración con n8n');
  ok((await call('GET', '/n8n/seguimiento')).status === 401, 'Las rutas de n8n exigen el secreto');
  const recepcion = await call('GET', '/n8n/paciente?perfil=recepcion&telefono=88880001', { secret: secreto });
  ok(recepcion.status === 200 && recepcion.data.encontrada && !('ultimosCheckins' in recepcion.data), 'La ficha de recepción no incluye datos clínicos');
  const clinica = await call('GET', '/n8n/paciente?perfil=clinico&telefono=88880001', { secret: secreto });
  ok(clinica.status === 200 && Array.isArray(clinica.data.ultimosCheckins) && !('phone' in clinica.data), 'La ficha clínica no incluye el teléfono');
  const reservada = await call('POST', '/n8n/citas', { secret: secreto, body: { nombre: 'Ana Prueba', telefono: '8666 5544', fecha: manana, hora: '09:00' } });
  ok(reservada.status === 201, 'La Recepcionista registra una cita confirmada');
  const resumen = await call('POST', '/n8n/resumen', { secret: secreto, body: { citaId: reservada.data?.id, puntos: ['Uno', 'Dos', 'Tres'] } });
  const conResumen = await call('GET', '/admin/citas?estado=confirmada', { token: sesionDoc });
  ok(resumen.status === 200 && conResumen.data?.find?.((c) => c.id === reservada.data?.id)?.resumen?.puntos?.length === 3, 'El resumen de 3 puntos queda en el panel');

  return { sesion, sesionDoc };
}
