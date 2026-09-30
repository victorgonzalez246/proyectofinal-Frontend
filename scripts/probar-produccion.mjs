// Prueba rápida del backend real en n8n Cloud: npm run probar:produccion
//   API_URL=https://otra-instancia.app.n8n.cloud/webhook npm run probar:produccion
// Solo hace peticiones que NO envían WhatsApp ni escriben datos:
// CORS para el sitio local, rutas protegidas sin sesión, validaciones y un enlace inválido.
const API = process.env.API_URL || 'https://pansaloca.app.n8n.cloud/webhook';
const ORIGEN = process.env.ORIGEN || 'http://localhost:5173';

let fallos = 0;
const ok = (cond, texto, detalle = '') => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${texto}${!cond && detalle ? ` → ${detalle}` : ''}`);
  if (!cond) fallos += 1;
};
const pedir = async (metodo, ruta, { body, headers = {} } = {}) => {
  try {
    const res = await fetch(`${API}${ruta}`, {
      method: metodo,
      headers: { Origin: ORIGEN, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* sin cuerpo JSON */ }
    return { status: res.status, headers: res.headers, data };
  } catch (err) {
    return { status: 0, error: err.message };
  }
};

console.log(`Backend: ${API}\nOrigen del sitio: ${ORIGEN}\n`);

console.log('Flujo API publicado');
const me = await pedir('GET', '/me');
// n8n Cloud responde 500 (con { code: 404, "… is not registered" } o una página HTML) cuando el flujo no está publicado
const sinPublicar = me.status === 404 || me.data?.code === 404 || /not registered/i.test(me.data?.message || '') || (me.status >= 500 && me.data === null);
ok(me.status !== 0 && !sinPublicar, 'Las rutas existen (el flujo "Clínica · API" está publicado)', me.error || (sinPublicar ? 'el flujo no está publicado en n8n' : `HTTP ${me.status}`));
if (me.status === 0 || sinPublicar) {
  console.log('\n✗ Publica el flujo "Clínica · API" en n8n y vuelve a correr esta prueba.');
  process.exitCode = 1;
} else {
ok(me.status === 401, 'GET /me sin sesión responde 401', `HTTP ${me.status}`);

console.log('\nCORS para el sitio');
const pre = await pedir('OPTIONS', '/auth/magic-link', {
  headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
});
const permitido = pre.headers?.get('access-control-allow-origin');
ok(permitido === ORIGEN || permitido === '*', `El navegador puede llamar desde ${ORIGEN}`, `access-control-allow-origin: ${permitido}`);

console.log('\nPermisos y validaciones (sin enviar WhatsApp)');
ok((await pedir('GET', '/admin/hoy')).status === 401, 'El panel exige sesión de doctora');
ok((await pedir('GET', '/admin/citas', { headers: { Authorization: 'Bearer token.falso.000.firma' } })).status === 401, 'Una sesión inventada se rechaza');
const tel = await pedir('POST', '/auth/magic-link', { body: { phone: '12' } });
ok(tel.status === 400, 'Un teléfono inválido se rechaza antes de enviar nada', `HTTP ${tel.status}`);
const enlace = await pedir('POST', '/auth/verify', { body: { token: 'enlace-que-no-existe' } });
ok(enlace.status === 401, 'Un enlace de acceso inválido no abre sesión (lee la hoja de Google)', `HTTP ${enlace.status} ${JSON.stringify(enlace.data)}`);
const cita = await pedir('POST', '/appointments', { body: { nombre: 'Prueba', telefono: '88880000', tratamiento: 'Valoración General', fecha: '2026-10-10' } });
ok(cita.status === 400, 'Una cita sin aceptar el aviso de privacidad se rechaza', `HTTP ${cita.status}`);

console.log(fallos ? `\n✗ ${fallos} comprobación(es) fallaron` : '\n✓ El backend en n8n responde como el simulador');
// exitCode en vez de process.exit(): en Windows, salir con conexiones abiertas dispara un assert de libuv
process.exitCode = fallos ? 1 : 0;
}
