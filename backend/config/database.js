const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

// Asegurar que la carpeta database existe
const dbDir = path.join(__dirname, '../../database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(path.join(dbDir, 'airforce.db'), (err) => {
  if (err) {
    console.error('Error al conectar:', err.message);
  } else {
    console.log('✅ Conectado a SQLite');
  }
});

// ============================================
// CREAR TODAS LAS TABLAS
// ============================================

db.serialize(() => {
  // 1. TABLA DE RANGOS (catálogo)
  db.run(`CREATE TABLE IF NOT EXISTS rangos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    orden INTEGER NOT NULL,
    created_at DATETIME DEFAULT (datetime('now', 'utc'))
  )`);

  // 2. TABLA DE PILOTOS
  db.run(`CREATE TABLE IF NOT EXISTS pilotos (
  id TEXT PRIMARY KEY,
  nombre_completo TEXT NOT NULL,
  grado_code TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  tipo_sangre TEXT,
  nacionalidad TEXT DEFAULT 'LS',
  rol TEXT DEFAULT 'Piloto',
  foto_url TEXT,
  horas_totales REAL DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now', 'utc')),
  FOREIGN KEY(grado_code) REFERENCES rangos(code)
)`);

  // 3. TABLA DE AERONAVES
  db.run(`CREATE TABLE IF NOT EXISTS aeronaves (
    id TEXT PRIMARY KEY,
    modelo TEXT NOT NULL,
    tipo TEXT NOT NULL,
    estado TEXT DEFAULT 'Operativa',
    imagen_url TEXT,
    created_at DATETIME DEFAULT (datetime('now', 'utc'))
  )`);

  // 4. TABLA DE CERTIFICACIONES (piloto + aeronave)
  db.run(`CREATE TABLE IF NOT EXISTS certificaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    piloto_id TEXT NOT NULL,
    aeronave_id TEXT NOT NULL,
    fecha_certificacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    certificado_por TEXT NOT NULL,
    FOREIGN KEY(piloto_id) REFERENCES pilotos(id),
    FOREIGN KEY(aeronave_id) REFERENCES aeronaves(id),
    UNIQUE(piloto_id, aeronave_id)
  )`);

  // 5. TABLA DE LIBROS DE VUELO
  db.run(`CREATE TABLE IF NOT EXISTS libros_vuelo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    piloto_id TEXT NOT NULL,
    aeronave_id TEXT NOT NULL,
    fecha_vuelo DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    tipo_mision TEXT NOT NULL,
    observaciones TEXT,
    horas REAL,
    created_at DATETIME DEFAULT (datetime('now', 'utc')),
    FOREIGN KEY(piloto_id) REFERENCES pilotos(id),
    FOREIGN KEY(aeronave_id) REFERENCES aeronaves(id)
  )`);

  // 6. TABLA DE SOLICITUDES
  db.run(`CREATE TABLE IF NOT EXISTS solicitudes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    piloto_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    estado TEXT DEFAULT 'Pendiente',
    fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_respuesta DATETIME DEFAULT (datetime('now', 'utc')),
    respondida_por TEXT,
    FOREIGN KEY(piloto_id) REFERENCES pilotos(id)
  )`);

  // 7. TABLA DE HISTORIAL DE ASCENSOS/DESCENSOS
  db.run(`CREATE TABLE IF NOT EXISTS historial_ascensos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    piloto_id TEXT NOT NULL,
    grado_anterior TEXT NOT NULL,
    grado_nuevo TEXT NOT NULL,
    tipo TEXT NOT NULL,
    motivo TEXT,
    realizado_por TEXT NOT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(piloto_id) REFERENCES pilotos(id)
  )`);

  console.log('✅ Todas las tablas creadas/verificadas');
});

// Crear Admin de prueba si no existe
db.get("SELECT id FROM pilotos WHERE rol = 'Admin'", [], (err, row) => {
  if (err) {
    console.error('Error al verificar Admin:', err);
    return;
  }
  
  if (!row) {
    const bcrypt = require('bcryptjs');
    const passwordHash = bcrypt.hashSync('123456', 10);
    const adminId = 'ADMIN01';
    const adminEmail = 'admin@airforce.mil';
    
    db.run(`INSERT INTO pilotos (id, nombre_completo, grado_code, email, password_hash, rol, activo) 
            VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [adminId, 'Administrador', 'Capt', adminEmail, passwordHash, 'Admin'],
      (err) => {
        if (err) {
          console.error('Error al crear Admin:', err);
        } else {
          console.log('✅ Admin de prueba creado:');
          console.log('   Email: admin@airforce.mil');
          console.log('   Contraseña: 123456');
        }
      }
    );
  }
});
// ============================================
// INSERTAR DATOS INICIALES
// ============================================

setTimeout(() => {
  db.serialize(() => {
    // Insertar rangos
    db.get("SELECT COUNT(*) as count FROM rangos", (err, row) => {
      if (err) return;
      if (row.count === 0) {
        const rangos = [
          ['Amn', 'Aviador', 1], ['A1C', 'Aviador de primera', 2],
          ['SrA', 'Aviador Mayor', 3], ['SSgt', 'Sargento de personal', 4],
          ['TSgt', 'Sargento Técnico', 5], ['MSgt', 'Sargento Maestre', 6],
          ['SMSgt', 'Sargento Maestre Mayor', 7], ['CMSgt', 'Sargento Maestre de la Fuerza Aérea', 8],
          ['CMSAF', 'Suboficial Mayor de la Fuerza Aérea', 9], ['2d Lt', 'Teniente Segundo', 10],
          ['1st Lt', 'Teniente Primero', 11], ['Capt', 'Capitán', 12],
          ['Maj', 'Major', 13], ['Lt Col', 'Teniente Coronel', 14],
          ['Col', 'Coronel', 15], ['Brig Gen', 'Brigadier General', 16],
          ['Maj Gen', 'Mayor General', 17], ['Lt Gen', 'Teniente General', 18],
          ['Gen', 'General', 19]
        ];
        rangos.forEach(r => {
          db.run("INSERT INTO rangos (code, nombre, orden) VALUES (?, ?, ?)", r);
        });
        console.log('✅ Rangos insertados');
      }
    });

    // Insertar pilotos de ejemplo
    db.get("SELECT COUNT(*) as count FROM pilotos", (err, row) => {
      if (err) return;
      if (row.count === 0) {
        const passwordHash = bcrypt.hashSync('123456', 10);
        const pilotos = [
          ['CAP123', 'Carlos Pérez', 'Capt', 'carlos.perez@airforce.mil', 'O+', 'LS', 'Admin'],
          ['MAJ456', 'Laura Méndez', 'Maj', 'laura.mendez@airforce.mil', 'A+', 'LS', 'Instructor'],
          ['LT789', 'Miguel Rodríguez', '1st Lt', 'miguel.rodriguez@airforce.mil', 'B+', 'US', 'Piloto']
        ];
        pilotos.forEach(p => {
          db.run(`INSERT INTO pilotos (id, nombre_completo, grado_code, email, password_hash, tipo_sangre, nacionalidad, rol) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
            [p[0], p[1], p[2], p[3], passwordHash, p[4], p[5], p[6]]);
        });
        console.log('✅ Pilotos insertados');
      }
    });
  });
}, 100);

module.exports = db;