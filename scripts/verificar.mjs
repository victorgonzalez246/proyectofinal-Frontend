// Verificación rápida de todo el sistema: npm run verificar
// Levanta el simulador con una base temporal (no toca db.json) y prueba cada pieza.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3990;
const API = `http://localhost:${PORT}`;
const SECRET = 'verificacion-local';
const ORIGIN = 'http://localhost:5173';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clinica-verificar-'));
const DB = path.join(tmp, 'db.json');
fs.copyFileSync('db.example.json', DB);

let fallos = 0;
const ok = (cond, texto) => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${texto}`);
  if (!cond) fallos += 1;
};

let server;
const arrancar = async () => {
  server = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, DB_FILE: DB, PORT: String(PORT), N8N_SHARED_SECRET: SECRET, N8N_WEBHOOK_URL: '', ALLOWED_ORIGINS: ORIGIN },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i += 1) {
    try {
      await fetch(`${API}/users`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('El simulador no arrancó');
};
const detener = () => new Promise((resolve) => { server.once('exit', resolve); server.kill(); });

const call = async (method, ruta, { body, token, secret } = {}) => {
  const res = await fetch(API + ruta, {
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

const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

try {
  await arrancar();

  console.log('\nLanding · citas');
  const cita = { nombre: 'Prueba Verificación', telefono: '8777 6655', tratamiento: 'Valoración General', fecha: manana };
  ok((await call('POST', '/appointments', { body: cita })).status === 400, 'Sin consentimiento, la cita se rechaza');
  ok((await call('POST', '/appointments', { body: { ...cita, consentimiento: true, avisoVersion: 'test' } })).status === 201, 'Con consentimiento, la cita se registra');

  console.log('\nSeguridad');
  ok((await call('GET', '/users')).status === 401, 'Sin sesión no se pueden leer usuarios');
  ok((await call('GET', '/users', { token: 'inventado' })).status === 401, 'Un token inventado se rechaza');

  console.log('\nPortal · acceso por enlace mágico');
  const desconocido = await call('POST', '/auth/magic-link', { body: { phone: '7000 0000' } });
  ok(desconocido.status === 200 && !desconocido.data.devLink, 'Un número desconocido recibe la misma respuesta, sin enlace');
  const magic = await call('POST', '/auth/magic-link', { body: { phone: '8888 0001' } });
  const tokenMagico = magic.data?.devLink?.split('#')[1];
  ok(Boolean(tokenMagico), 'La paciente demo recibe su enlace (modo desarrollo)');
  const verificado = await call('POST', '/auth/verify', { body: { token: tokenMagico } });
  const sesion = verificado.data?.token;
  ok(Boolean(sesion) && !('password' in (verificado.data?.user || {})), 'El enlace abre sesión y no expone la contraseña');
  ok((await call('POST', '/auth/verify', { body: { token: tokenMagico } })).status === 401, 'El enlace no se puede usar dos veces');

  console.log('\nPortal · datos de la paciente');
  const portal = await call('GET', '/me/portal', { token: sesion });
  ok(portal.status === 200 && portal.data?.roadmap?.length > 0, 'Carga el mapa de belleza');
  ok((await call('POST', '/me/checkins', { token: sesion, body: { mood: 'bien', pain: 2 } })).status === 201, 'Guarda el check-in');
  ok((await call('GET', '/users', { token: sesion })).status === 403, 'Una paciente no puede listar a otras pacientes');

  console.log('\nIntegración con n8n');
  ok((await call('GET', '/n8n/seguimiento')).status === 401, 'Las rutas de n8n exigen el secreto');
  const recepcion = await call('GET', '/n8n/paciente?perfil=recepcion&telefono=88880001', { secret: SECRET });
  ok(recepcion.status === 200 && recepcion.data.encontrada && !('ultimosCheckins' in recepcion.data), 'La ficha de recepción no incluye datos clínicos');
  const clinica = await call('GET', '/n8n/paciente?perfil=clinico&telefono=88880001', { secret: SECRET });
  ok(clinica.status === 200 && Array.isArray(clinica.data.ultimosCheckins) && !('phone' in clinica.data), 'La ficha clínica no incluye el teléfono');

  console.log('\nSesiones');
  await detener();
  await arrancar();
  ok((await call('GET', '/me/portal', { token: sesion })).status === 200, 'La sesión sigue válida después de reiniciar el servidor');
  await call('POST', '/logout', { token: sesion });
  ok((await call('GET', '/me/portal', { token: sesion })).status === 401, 'Cerrar sesión invalida el token');
} catch (err) {
  ok(false, `Error inesperado: ${err.message}`);
} finally {
  if (server && server.exitCode === null) await detener();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('\nCerebro de n8n');
try {
  const wf = JSON.parse(fs.readFileSync('n8n/flujos/cerebro-maestro-clinica.json', 'utf8'));
  const nombres = new Set(wf.nodes.map((n) => n.name));
  const rotas = Object.entries(wf.connections).flatMap(([origen, tipos]) =>
    Object.values(tipos).flat(2).filter((c) => !nombres.has(c.node)).map((c) => `${origen} → ${c.node}`).concat(nombres.has(origen) ? [] : [origen]));
  ok(rotas.length === 0, `El flujo tiene ${wf.nodes.length} nodos y ninguna conexión rota`);
  ok(wf.nodes.some((n) => n.name === 'Agente IA 1 · Enfermera Virtual') && wf.nodes.some((n) => n.name === 'Agente IA 2 · Recepcionista VIP'), 'Incluye los dos agentes de IA');
} catch (err) {
  ok(false, `No se pudo leer el flujo: ${err.message}`);
}

console.log(fallos ? `\n✗ ${fallos} verificación(es) fallaron\n` : '\n✓ Todo funciona\n');
process.exit(fallos ? 1 : 0);
