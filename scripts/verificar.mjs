// Verificación rápida de todo el sistema: npm run verificar
// Levanta el simulador con una base temporal (no toca db.json) y un receptor que hace de
// cerebro de n8n, y recorre el contrato completo de la API (scripts/contrato.mjs).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearCliente, crearReceptorEventos, probarContrato } from './contrato.mjs';

const PORT = 3990;
const API = `http://localhost:${PORT}`;
const SECRET = 'verificacion-local';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clinica-verificar-'));
const DB = path.join(tmp, 'db.json');
fs.copyFileSync('db.example.json', DB);

let fallos = 0;
const ok = (cond, texto) => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${texto}`);
  if (!cond) fallos += 1;
};

const receptor = crearReceptorEventos(3991);
let server;
const arrancar = async () => {
  server = spawn(process.execPath, ['server.js'], {
    env: {
      ...process.env,
      DB_FILE: DB,
      PORT: String(PORT),
      N8N_SHARED_SECRET: SECRET,
      N8N_WEBHOOK_URL: receptor.url,
      SESSION_SECRET: 'secreto-de-verificacion',
      ALLOWED_ORIGINS: 'http://localhost:5173',
    },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i += 1) {
    try {
      await fetch(`${API}/me`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('El simulador no arrancó');
};
const detener = () => new Promise((resolve) => { server.once('exit', resolve); server.kill(); });

try {
  await receptor.iniciar();
  await arrancar();
  const { sesion } = await probarContrato({ api: API, secreto: SECRET, receptor, ok });

  console.log('\nSesiones');
  await detener();
  await arrancar();
  const call = crearCliente(API);
  ok((await call('GET', '/me/portal', { token: sesion })).status === 200, 'La sesión sigue válida después de reiniciar el servidor');
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  ok(!JSON.stringify(db).includes(sesion) && db.accesos.every((a) => /^[0-9a-f]{64}$/.test(a.hash) && !('token' in a)), 'No se guardan sesiones ni enlaces en claro');
} catch (err) {
  ok(false, `Error inesperado: ${err.message}`);
} finally {
  if (server && server.exitCode === null) await detener();
  await receptor.detener();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('\nFlujos de n8n');
try {
  const revisar = (archivo) => {
    const wf = JSON.parse(fs.readFileSync(archivo, 'utf8'));
    const nombres = new Set(wf.nodes.map((n) => n.name));
    const rotas = Object.entries(wf.connections).flatMap(([origen, tipos]) =>
      Object.values(tipos).flat(2).filter((c) => !nombres.has(c.node)).map((c) => `${origen} → ${c.node}`).concat(nombres.has(origen) ? [] : [origen]));
    return { wf, rotas };
  };
  const cerebro = revisar('n8n/flujos/cerebro-maestro-clinica.json');
  ok(cerebro.rotas.length === 0, `Cerebro: ${cerebro.wf.nodes.length} nodos y ninguna conexión rota`);
  ok(cerebro.wf.nodes.some((n) => n.name === 'Agente IA 1 · Enfermera Virtual') && cerebro.wf.nodes.some((n) => n.name === 'Agente IA 2 · Recepcionista VIP'), 'Cerebro: incluye los dos agentes de IA');
  const apiWf = revisar('n8n/flujos/api-clinica.json');
  ok(apiWf.rotas.length === 0, `API: ${apiWf.wf.nodes.length} nodos y ninguna conexión rota`);
  const codigo = (archivo) => fs.readFileSync(archivo, 'utf8').replace(/\r\n/g, '\n').replace(/^export /gm, '');
  const jsNucleo = apiWf.wf.nodes.find((n) => n.name === 'Núcleo API')?.parameters.jsCode || '';
  ok(jsNucleo.includes(codigo('api/nucleo.mjs')) && jsNucleo.includes(codigo('api/hojas.mjs')), 'API: el nodo Núcleo lleva la versión actual de api/ (si falla: npm run generar:n8n)');
  const webhooks = apiWf.wf.nodes.filter((n) => n.type === 'n8n-nodes-base.webhook').map((n) => n.name).sort();
  const { RUTAS } = await import('../n8n/generar-api.mjs');
  ok(webhooks.join() === RUTAS.map(([m, r]) => `${m} ${r}`).sort().join(), `API: un Webhook por cada una de las ${RUTAS.length} rutas del contrato`);
} catch (err) {
  ok(false, `No se pudieron leer los flujos: ${err.message}`);
}

console.log(fallos ? `\n✗ ${fallos} verificación(es) fallaron\n` : '\n✓ Todo funciona\n');
process.exit(fallos ? 1 : 0);
