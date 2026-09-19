const jsonServer = require('json-server');
const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

// Usamos los middlewares por defecto de json-server (CORS, estáticos, etc)
server.use(middlewares);
server.use(jsonServer.bodyParser);

// 🔒 MIDDLEWARE DE CANDADO LOCAL
server.use((req, res, next) => {
  // 1. Permitimos el registro (POST a /users) o el inicio de sesión sin token
  if (req.method === 'POST' && (req.path === '/users' || req.path === '/login')) {
    return next();
  }

  // 2. Verificamos el token para todas las demás rutas
  const authHeader = req.header('Authorization');

  // Como estamos simulando, usaremos un token genérico seguro que el frontend enviará
  if (authHeader === 'Bearer clinica-segura-token-2026') {
    next(); // Acceso permitido, el candado se abre
  } else {
    // Acceso bloqueado
    res.status(401).json({ error: '🔒 Acceso Denegado. Candado Local Activado.' });
  }
});

// Usamos el enrutador para que maneje db.json
server.use(router);

// Arrancamos el servidor
server.listen(3001, () => {
  console.log('✅ Base de datos simulada corriendo en puerto 3001');
  console.log('🔒 Candado de Seguridad Local: ACTIVADO');
});
