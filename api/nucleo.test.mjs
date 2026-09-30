import crypto from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearApi } from './nucleo.mjs';

const HORA = 60 * 60 * 1000;
let reloj;
const api = crearApi({
  secretoSesion: 'secreto-de-test',
  secretoN8n: 'n8n-de-test',
  portalUrl: 'https://clinica.test',
  modoDesarrollo: true,
  ahora: () => reloj,
  cripto: {
    hmac: (k, t) => crypto.createHmac('sha256', k).update(t).digest('hex'),
    sha256: (t) => crypto.createHash('sha256').update(t).digest('hex'),
    aleatorio: (b) => crypto.randomBytes(b).toString('hex'),
    igual: (a, b) => a === b,
  },
});

const nuevaDb = () => ({
  users: [
    { id: 'doc', name: 'Doctora', phone: '+506 8888 8888', role: 'doctor' },
    { id: 'pac', name: 'Paciente Uno', phone: '+506 8888 0001', role: 'member', promociones: { acepta: true } },
  ],
  appointments: [], portal: [], checkins: [], sosAlerts: [], accesos: [],
});
const llamar = (db, metodo, ruta, { body, token, headers = {} } = {}) =>
  api.manejar({ metodo, ruta, body, headers: { ...headers, ...(token ? { authorization: `Bearer ${token}` } : {}) } }, db);
const entrar = (db, telefono) => {
  const { body } = llamar(db, 'POST', '/auth/magic-link', { body: { phone: telefono } });
  return llamar(db, 'POST', '/auth/verify', { body: { token: body.devLink.split('#')[1] } });
};

beforeEach(() => { reloj = Date.parse('2026-09-28T15:00:00Z'); });

describe('núcleo: sesiones y enlaces', () => {
  it('la sesión de la doctora dura 4 h y la de una paciente 8 h', () => {
    const db = nuevaDb();
    const doctora = entrar(db, '8888 8888').body.token;
    const paciente = entrar(db, '8888 0001').body.token;
    reloj += 5 * HORA;
    expect(llamar(db, 'GET', '/admin/hoy', { token: doctora }).status).toBe(401);
    expect(llamar(db, 'GET', '/me/portal', { token: paciente }).status).toBe(200);
    reloj += 4 * HORA;
    expect(llamar(db, 'GET', '/me/portal', { token: paciente }).status).toBe(401);
  });

  it('un enlace vencido no abre sesión y queda marcado como usado', () => {
    const db = nuevaDb();
    const { body } = llamar(db, 'POST', '/auth/magic-link', { body: { phone: '88880001' } });
    reloj += 16 * 60 * 1000;
    const r = llamar(db, 'POST', '/auth/verify', { body: { token: body.devLink.split('#')[1] } });
    expect(r.status).toBe(401);
    expect(db.accesos[0].usado).toBe(true);
    expect(r.cambios).toEqual({ accesos: [db.accesos[0].id] });
  });

  it('la sesión deja de valer si el usuario ya no existe', () => {
    const db = nuevaDb();
    const token = entrar(db, '8888 0001').body.token;
    db.users = db.users.filter((u) => u.id !== 'pac');
    expect(llamar(db, 'GET', '/me', { token }).status).toBe(401);
  });

  it('en producción el enlace no vuelve en la respuesta: sale como evento', () => {
    const produccion = crearApi({ secretoSesion: 's', portalUrl: 'https://c.test', cripto: { sha256: (t) => t, aleatorio: () => 'abc', hmac: () => '', igual: () => false } });
    const r = produccion.manejar({ metodo: 'POST', ruta: '/auth/magic-link', body: { phone: '8888 0001' } }, nuevaDb());
    expect(r.body).toEqual({ ok: true });
    expect(r.eventos[0]).toMatchObject({ event: 'auth.magic_link', role: 'member', link: 'https://c.test/portal/verificar#abc' });
  });
});

describe('núcleo: reglas del panel', () => {
  it('un error no guarda cambios parciales ni emite eventos', () => {
    const db = nuevaDb();
    const r = llamar(db, 'POST', '/appointments', { body: { consentimiento: true, nombre: 'Ok', telefono: '1', tratamiento: 'X', fecha: 'mal' } });
    expect(r.status).toBe(400);
    expect(r.cambios).toEqual({});
    expect(r.eventos).toEqual([]);
  });

  it('lee la query de la ruta (?id=) aunque tenga espacios codificados', () => {
    const db = nuevaDb();
    const token = entrar(db, '8888 8888').body.token;
    db.appointments.push({ id: 'apt 1', nombre: 'A', telefono: '88880001', tratamiento: 'T', fecha: '2026-10-01', estado: 'pendiente', userId: 'pac' });
    const r = llamar(db, 'PATCH', '/admin/citas?id=apt%201', { token, body: { estado: 'confirmada', hora: '09:30' } });
    expect(r.status).toBe(200);
    expect(r.eventos[0]).toMatchObject({ event: 'appointment.confirmed', reprogramada: false });
  });

  it('reprogramar una cita confirmada avisa de nuevo; guardar sin cambios, no', () => {
    const db = nuevaDb();
    const token = entrar(db, '8888 8888').body.token;
    db.appointments.push({ id: 'c1', nombre: 'A', telefono: '88880001', tratamiento: 'T', fecha: '2026-10-01', hora: '09:30', estado: 'confirmada', userId: 'pac' });
    expect(llamar(db, 'PATCH', '/admin/citas?id=c1', { token, body: { estado: 'confirmada' } }).eventos).toHaveLength(0);
    const r = llamar(db, 'PATCH', '/admin/citas?id=c1', { token, body: { hora: '11:00' } });
    expect(r.eventos[0]).toMatchObject({ event: 'appointment.confirmed', reprogramada: true });
  });

  it('valida el plan: sesiones usadas no pueden superar el total y los videos exigen https', () => {
    const db = nuevaDb();
    const token = entrar(db, '8888 8888').body.token;
    const guardar = (plan) => llamar(db, 'PUT', '/admin/pacientes/plan?id=pac', { token, body: plan });
    expect(guardar({ packages: [{ name: 'P', total: 2, used: 3, validUntil: '2027-01-01' }] }).status).toBe(400);
    expect(guardar({ videos: [{ title: 'V', url: 'http://inseguro.test/v.mp4' }] }).status).toBe(400);
    expect(guardar({ videos: [{ title: 'V', url: 'https://seguro.test/v.mp4' }] }).status).toBe(200);
  });

  it('al cambiar el protocolo, solo sobreviven los cuidados marcados que siguen existiendo', () => {
    const db = nuevaDb();
    const token = entrar(db, '8888 8888').body.token;
    const care = (ids) => ({ care: { title: 'Cuidados', since: '2026-09-28T10:00:00-06:00', items: ids.map((id) => ({ id, type: 'do', text: id, hours: 24 })) } });
    llamar(db, 'PUT', '/admin/pacientes/plan?id=pac', { token, body: care(['c1', 'c2']) });
    db.portal[0].careDone = ['c1', 'c2'];
    const r = llamar(db, 'PUT', '/admin/pacientes/plan?id=pac', { token, body: care(['c2', 'c3']) });
    expect(r.body.careDone).toEqual(['c2']);
  });

  it('las rutas de n8n exigen el secreto exacto', () => {
    const db = nuevaDb();
    expect(llamar(db, 'GET', '/n8n/seguimiento', { headers: { 'x-n8n-secret': 'otro' } }).status).toBe(401);
    expect(llamar(db, 'GET', '/n8n/seguimiento', { headers: { 'X-N8N-Secret': 'n8n-de-test' } }).status).toBe(200);
  });
});

describe('núcleo: acceso con código de WhatsApp (plantilla de Autenticación)', () => {
  const pedirCodigo = (db, telefono) => llamar(db, 'POST', '/auth/magic-link', { body: { phone: telefono } }).body.devCodigo;
  const conCodigo = (db, telefono, code) => llamar(db, 'POST', '/auth/verify', { body: { phone: telefono, code } });

  it('entrega un código de 6 dígitos y solo guarda su hash', () => {
    const db = nuevaDb();
    const codigo = pedirCodigo(db, '8888 0001');
    expect(codigo).toMatch(/^\d{6}$/);
    expect(JSON.stringify(db.accesos)).not.toContain(codigo);
  });

  it('el código abre sesión una sola vez, con el rol de quien lo pidió', () => {
    const db = nuevaDb();
    const codigo = pedirCodigo(db, '8888 8888');
    const r = conCodigo(db, '+506 8888-8888', codigo);
    expect(r.status).toBe(200);
    expect(r.body.user.role).toBe('doctor');
    expect(conCodigo(db, '8888 8888', codigo).status).toBe(401);
  });

  it('un código no sirve con otro número ni después de 15 minutos', () => {
    const db = nuevaDb();
    const codigo = pedirCodigo(db, '8888 0001');
    expect(conCodigo(db, '8888 8888', codigo).status).toBe(401);
    reloj += 16 * 60 * 1000;
    expect(conCodigo(db, '8888 0001', codigo).status).toBe(401);
  });

  it('se invalida al quinto intento fallido (fuerza bruta)', () => {
    const db = nuevaDb();
    const codigo = pedirCodigo(db, '8888 0001');
    const incorrecto = codigo === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i += 1) expect(conCodigo(db, '8888 0001', incorrecto).status).toBe(401);
    expect(conCodigo(db, '8888 0001', codigo).status).toBe(401);
    expect(db.accesos[0].usado).toBe(true);
  });

  it('rechaza formatos inválidos sin tocar los accesos', () => {
    const db = nuevaDb();
    pedirCodigo(db, '8888 0001');
    expect(conCodigo(db, '8888 0001', '12ab56').status).toBe(401);
    expect(conCodigo(db, '8888 0001', '').status).toBe(401);
    expect(db.accesos[0].intentos).toBe(0);
  });
});
