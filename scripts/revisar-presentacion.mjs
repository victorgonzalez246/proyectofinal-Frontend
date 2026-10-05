// Repaso antes de presentar: npm run revisar
// Comprueba el código (tests, lint, build, contrato) y que producción responda:
// sitio en Vercel, Aura con Gemini, API de n8n Cloud y modelos de Gemini.
// Solo lee: no escribe en n8n, Vercel ni Meta, y no envía WhatsApp.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const SITIO = 'https://clinica-dra-laura.vercel.app';
const N8N = 'https://pansaloca.app.n8n.cloud/webhook';
const MODELOS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash'];

let fallos = 0;
let avisos = 0;
const ok = (cond, texto, detalle = '') => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${texto}${detalle ? ` (${detalle})` : ''}`);
  if (!cond) fallos += 1;
};
const aviso = (texto) => {
  console.log(`  ⚠ ${texto}`);
  avisos += 1;
};

// Lee .env sin mostrar valores
const env = {};
if (fs.existsSync('.env')) {
  for (const linea of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
}

console.log('\n1. Entorno');
ok(Number(process.versions.node.split('.')[0]) >= 24, 'Node 24 o superior', `v${process.versions.node}`);
ok(fs.existsSync('node_modules'), 'Dependencias instaladas (npm install)');
ok(fs.existsSync('.env'), 'Existe .env (ver CONFIGURAR-EN-LAPTOP.md, sección 3)');
ok(Boolean(env.GEMINI_API_KEY), 'GEMINI_API_KEY en .env');
for (const k of ['SESSION_SECRET', 'N8N_SHARED_SECRET']) if (!env[k]) aviso(`${k} vacío en .env: el simulador local usa uno de desarrollo`);
if (!fs.existsSync('db.json')) aviso('No hay db.json: para la demo local corre npm run sembrar:demo');

console.log('\n2. Código');
for (const [script, texto] of [['test', 'Tests'], ['lint', 'Lint'], ['build', 'Build'], ['verificar', 'Contrato de la API y flujos de n8n']]) {
  const r = spawnSync(`npm run ${script}`, { shell: true, encoding: 'utf8' });
  const salida = `${r.stdout}\n${r.stderr}`;
  const resumen = salida.match(/Tests\s+\d+ passed[^\n]*/)?.[0]?.trim() || '';
  ok(r.status === 0, texto, resumen);
  if (r.status !== 0) console.log(salida.split('\n').slice(-15).join('\n'));
}

const pedir = async (url, opciones = {}) => {
  try {
    const r = await fetch(url, { ...opciones, signal: AbortSignal.timeout(60000) });
    return { status: r.status, texto: await r.text() };
  } catch (err) {
    return { status: 0, texto: String(err.message) };
  }
};

console.log('\n3. Sitio en Vercel');
for (const [ruta, debeDecir] of [['/', 'Dra. Laura'], ['/terminos.html', 'Términos y Condiciones'], ['/privacidad.html', 'Gemini']]) {
  const r = await pedir(SITIO + ruta);
  ok(r.status === 200 && r.texto.includes(debeDecir), `${SITIO}${ruta}`, `HTTP ${r.status}`);
}

console.log('\n4. Aura en producción (una pregunta real)');
{
  const r = await pedir(`${SITIO}/api/asistente/v1/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: SITIO, 'anthropic-version': '2023-06-01', 'x-api-key': 'proxy' },
    body: JSON.stringify({ model: 'x', max_tokens: 120, stream: true, messages: [{ role: 'user', content: '¿Qué horario tiene la clínica?' }] }),
  });
  const respuesta = [...r.texto.matchAll(/"text":"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).join('').replace(/\\n/g, ' ');
  ok(r.status === 200 && respuesta.length > 10, 'Aura responde', respuesta ? `«${respuesta.slice(0, 90)}…»` : `HTTP ${r.status}`);
}

console.log('\n5. n8n Cloud');
{
  // Sin secreto, la API debe rechazar (401): prueba que el flujo API está publicado sin crear datos
  const r = await pedir(`${N8N}/n8n/alerta`, { method: 'POST', headers: { 'content-type': 'application/json', origin: SITIO }, body: '{}' });
  ok(r.status === 401, 'Flujo API publicado y protegido', `HTTP ${r.status}`);
  if (r.status === 404) aviso('404 en n8n: flujo API inactivo o la prueba de n8n Cloud venció');
  const citas = await pedir(`${N8N}/appointments`, { method: 'OPTIONS', headers: { origin: SITIO, 'access-control-request-method': 'POST' } });
  ok(citas.status > 0 && citas.status < 500, 'n8n Cloud responde', `HTTP ${citas.status}`);
}

console.log('\n6. Modelos de Gemini (la key del .env)');
if (env.GEMINI_API_KEY) {
  for (const modelo of MODELOS) {
    const inicio = Date.now();
    const r = await pedir(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'responde ok' }] }], generationConfig: { maxOutputTokens: 5 } }),
    });
    const s = ((Date.now() - inicio) / 1000).toFixed(1);
    ok(r.status === 200, modelo, `HTTP ${r.status}, ${s} s`);
    if (r.status === 200 && Number(s) > 8) aviso(`${modelo} está lento (${s} s): Google con mucha demanda`);
  }
}

console.log('\n7. Manual (no se puede comprobar desde aquí)');
console.log('  • En n8n Cloud: "Clínica · Cerebro maestro (nuevo)" y "Clínica · API" activos; Settings → Usage and plan: días y ejecuciones restantes.');
console.log('  • Cada número de prueba debe escribir "hola" a la clínica (ventana de 24 h de Meta) y recibir respuesta.');
console.log('  • Respaldo si n8n falla en la demo: npm run sembrar:demo, npm run server y npm run dev (doctora 8888 8888, paciente 8888 0001).');

console.log(`\n${fallos === 0 ? '✓ Listo para presentar' : `✗ ${fallos} comprobación(es) fallaron`}${avisos ? ` · ${avisos} aviso(s)` : ''}\n`);
process.exit(fallos === 0 ? 0 : 1);
