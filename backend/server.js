// Forzar zona horaria UTC
process.env.TZ = 'UTC';
console.log('🕐 Zona horaria configurada a:', new Date().toString());


const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Cargar variables de entorno
dotenv.config();

// Importar base de datos
//const db = require('./config/database');
const pool = require('./config/supabase');

// Importar rutas
const authRoutes = require('./routes/auth');
const aeronavesRoutes = require('./routes/aeronaves');
const librosRoutes = require('./routes/libros');
const solicitudesRoutes = require('./routes/solicitudes');
const pilotosRoutes = require('./routes/pilotos');
const adminRoutes = require('./routes/admin');

// Crear aplicación Express
const app = express();

// ============================================
// MIDDLEWARES
// ============================================

app.use(cors()); // Permitir peticiones desde el frontend
app.use(express.json()); // Parsear JSON
app.use(express.urlencoded({ extended: true })); // Parsear formularios

// ============================================
// SERVIR ARCHIVOS ESTÁTICOS (IMÁGENES)
// ============================================

// Crear carpeta uploads si no existe
const uploadsDir = path.join(__dirname, 'uploads');
const subDirs = ['pilotos', 'aeronaves', 'ranks'];

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

subDirs.forEach(dir => {
  const dirPath = path.join(uploadsDir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Servir archivos estáticos desde la carpeta uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log('📁 Sirviendo archivos estáticos desde:', path.join(__dirname, 'uploads'));

// Servir archivos estáticos del frontend (opcional, para desarrollo)
app.use(express.static(path.join(__dirname, '../frontend')));

// ============================================
// RUTAS PÚBLICAS
// ============================================

app.use('/api', authRoutes.router);

// ============================================
// RUTAS PROTEGIDAS (requieren token)
// ============================================

app.use('/api/aeronaves', aeronavesRoutes);
app.use('/api/libros', librosRoutes);
app.use('/api/solicitudes', solicitudesRoutes);
app.use('/api/pilotos', pilotosRoutes);
app.use('/api/admin', adminRoutes);

// ============================================
// RUTAS DE PRUEBA
// ============================================

// Ruta principal
app.get('/', (req, res) => {
  res.json({ 
    mensaje: '🚁 API de la Fuerza Aérea funcionando correctamente',
    version: '1.0.0',
    endpoints_disponibles: {
      auth: 'POST /api/login',
      aeronaves: 'GET /api/aeronaves',
      libros: 'GET /api/libros, POST /api/libros, DELETE /api/libros/:id',
      solicitudes: 'GET /api/solicitudes, POST /api/solicitudes, PUT /api/solicitudes/:id',
      pilotos: 'GET /api/pilotos, GET /api/pilotos/:id',
      admin: 'GET/POST/PUT/DELETE /api/admin/*'
    }
  });
});

// Ruta de prueba para ver la base de datos (solo para desarrollo)
app.get('/api/test-db', (req, res) => {
  db.all("SELECT id, nombre_completo, grado_code, email, rol FROM pilotos LIMIT 5", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ 
      mensaje: 'Conexión a DB exitosa', 
      pilotos: rows.map(p => ({ ...p, password_hash: '[OCULTO]' }))
    });
  });
});

// ============================================
// MANEJO DE ERRORES 404
// ============================================

app.use((req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    mensaje: `La ruta ${req.method} ${req.url} no existe`
  });
});

// ============================================
// MANEJO DE ERRORES GENERAL
// ============================================

app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    mensaje: err.message 
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║     🚁 LSAF Air Force - Sistema de Gestión de Vuelos     ║
╠══════════════════════════════════════════════════════════╣
║  Servidor corriendo en: http://localhost:${PORT}          ║
║  API disponible en: http://localhost:${PORT}/api          ║
║  Imágenes estáticas en: http://localhost:${PORT}/uploads  ║
╚══════════════════════════════════════════════════════════╝
  `);
});

// Manejo de cierre graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado');
    process.exit(0);
  });
});



module.exports = app;