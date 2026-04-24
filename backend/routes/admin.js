const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { verificarToken } = require('./auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { enviarWebhookRegistro, getNextRegistroId } = require('../utils/webhooks');

// ============================================
// MIDDLEWARE: Verificar que es Admin
// ============================================

// Verificar si es Admin o Supervisor (para acciones que ambos pueden hacer)
function esAdminOSupervisor(req, res, next) {
  if (req.piloto.rol !== 'Admin' && req.piloto.rol !== 'Supervisor') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol Admin o Supervisor' });
  }
  next();
}

// Verificar si es SOLO Admin (para acciones restringidas)
function esAdminOnly(req, res, next) {
  if (req.piloto.rol !== 'Admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol Admin' });
  }
  next();
}

function esAdmin(req, res, next) {
  if (req.piloto.rol !== 'Admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol Admin' });
  }
  next();
}

// ============================================
// MIDDLEWARE: Verificar que es Admin o Instructor
// ============================================

function esAdminOInstructor(req, res, next) {
  // Permitir a Instructores, Admin y Supervisor
  if (req.piloto.rol === 'Piloto') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol Instructor, Supervisor o Admin' });
  }
  next();
}

// ============================================
// CONFIGURACIÓN DE MULTER PARA SUBIR IMÁGENES
// ============================================

// Crear las carpetas si no existen
const uploadsDir = path.join(__dirname, '../uploads');
const pilotosDir = path.join(uploadsDir, 'pilotos');
const aeronavesDir = path.join(uploadsDir, 'aeronaves');
const ranksDir = path.join(uploadsDir, 'ranks');
const observacionesDir = path.join(uploadsDir, 'observaciones');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(pilotosDir)) fs.mkdirSync(pilotosDir, { recursive: true });
if (!fs.existsSync(aeronavesDir)) fs.mkdirSync(aeronavesDir, { recursive: true });
if (!fs.existsSync(ranksDir)) fs.mkdirSync(ranksDir, { recursive: true });
if (!fs.existsSync(observacionesDir)) fs.mkdirSync(observacionesDir, { recursive: true });

console.log('📁 Carpetas de uploads verificadas:');
console.log('   -', pilotosDir);
console.log('   -', aeronavesDir);
console.log('   -', ranksDir);
console.log('   -', observacionesDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {

  const url = req.originalUrl;

  let destino;

  if (url.includes('piloto')) {
    destino = pilotosDir;
  } else if (url.includes('aeronave')) {
    destino = aeronavesDir;
  } else if (url.includes('rango')) {
    destino = ranksDir;
  } else if (url.includes('observacion')) {
    destino = observacionesDir;
  } else {
    destino = uploadsDir;
  }

  console.log('📁 Destino FINAL:', destino);

  if (!fs.existsSync(destino)) {
    fs.mkdirSync(destino, { recursive: true });
  }

  cb(null, destino);
},

  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = uniqueSuffix + path.extname(file.originalname);
    console.log('📄 Nombre archivo:', filename);
    cb(null, filename);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'));
    }
  }
});

// ============================================
// ENDPOINTS DE UPLOAD
// ============================================

// Subir imagen de piloto
router.post('/upload/piloto/:id', verificarToken, esAdmin, upload.single('imagen'), (req, res) => {
  const { id } = req.params;
  
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen' });
  }
  
  const fileUrl = `/uploads/pilotos/${req.file.filename}`;
  
  db.run("UPDATE pilotos SET foto_url = ? WHERE id = ?", [fileUrl, id], function(err) {
    if (err) {
      console.error('Error al actualizar foto:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, url: fileUrl });
  });
});

// Subir imagen de aeronave
router.post('/upload/aeronave/:id', verificarToken, esAdmin, upload.single('imagen'), (req, res) => {
  const { id } = req.params;
  
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen' });
  }
  
  const fileUrl = `/uploads/aeronaves/${req.file.filename}`;
  
  db.run("UPDATE aeronaves SET imagen_url = ? WHERE id = ?", [fileUrl, id], function(err) {
    if (err) {
      console.error('Error al actualizar imagen:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, url: fileUrl });
  });
});

// Subir logo de rango
router.post('/upload/rango/:id', verificarToken, esAdmin, upload.single('imagen'), (req, res) => {
  const { id } = req.params;
  
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen' });
  }
  
  const fileUrl = `/uploads/ranks/${req.file.filename}`;
  
  db.run("UPDATE rangos SET logo_url = ? WHERE id = ?", [fileUrl, id], function(err) {
    if (err) {
      console.error('Error al actualizar logo:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, url: fileUrl });
  });
});

// Subir imagen de observación
router.post('/upload/observacion', verificarToken, upload.single('imagen'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen' });
  }
  
  const fileUrl = `/uploads/observaciones/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
});

// Subir múltiples imágenes de observación
router.post('/upload/observaciones', verificarToken, upload.array('imagenes', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No se recibieron imágenes' });
  }
  
  const urls = req.files.map(file => `/uploads/observaciones/${file.filename}`);
  res.json({ success: true, urls });
});

// ============================================
// GESTIÓN DE RANGOS
// ============================================

// Obtener todos los rangos
router.get('/rangos', verificarToken, esAdminOnly, (req, res) => {
  db.all("SELECT * FROM rangos ORDER BY orden ASC", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ ranks: rows });
  });
});

// Actualizar rangos (guardar cambios)
router.put('/rangos', verificarToken, esAdminOnly, (req, res) => {
  const { ranks } = req.body;
  
  console.log('📝 Recibiendo rangos para guardar:', ranks);
  
  if (!ranks || !Array.isArray(ranks)) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  
  // Verificar que hay rangos
  if (ranks.length === 0) {
    return res.status(400).json({ error: 'No hay rangos para guardar' });
  }
  
  db.serialize(() => {
    // Primero, eliminar todos los rangos existentes
    db.run("DELETE FROM rangos", (err) => {
      if (err) {
        console.error('Error al eliminar rangos:', err);
        return res.status(500).json({ error: err.message });
      }
      
      let completados = 0;
      let errores = false;
      
      ranks.forEach(rango => {
        // Validar que el rango tiene los campos necesarios
        if (!rango.code || !rango.name) {
          errores = true;
          console.error('Rango inválido:', rango);
          completados++;
          return;
        }
        
        db.run(`INSERT INTO rangos (code, nombre, orden, logo_url, discord_role_id) 
                VALUES (?, ?, ?, ?, ?)`,
          [rango.code, rango.name, rango.orden || 999, rango.logo_url || null, rango.discord_role_id || null],
          (err) => {
            if (err) {
              console.error('Error al insertar rango:', err);
              errores = true;
            }
            completados++;
            
            if (completados === ranks.length) {
              if (errores) {
                res.status(500).json({ error: 'Algunos rangos no se pudieron guardar' });
              } else {
                console.log('✅ Rangos guardados correctamente');
                res.json({ success: true, mensaje: 'Rangos actualizados' });
              }
            }
          }
        );
      });
    });
  });
});

// Agregar nuevo rango
router.post('/rangos', verificarToken, esAdminOnly, (req, res) => {
  const { code, nombre, orden } = req.body;
  
  if (!code || !nombre) {
    return res.status(400).json({ error: 'Código y nombre requeridos' });
  }
  
  db.run("INSERT INTO rangos (code, nombre, orden) VALUES (?, ?, ?)",
    [code, nombre, orden || 999],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Eliminar rango
router.delete('/rangos/:id', verificarToken, esAdminOnly, (req, res) => {
  const { id } = req.params;
  
  db.run("DELETE FROM rangos WHERE id = ?", [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true });
  });
});

// ============================================
// GESTIÓN DE PILOTOS
// ============================================

// Obtener todos los pilotos (para admin panel)
router.get('/pilotos', verificarToken, esAdminOSupervisor, (req, res) => {
  const { incluirInactivos } = req.query;
  
  let query = `
    SELECT p.*, r.nombre as grado_nombre 
    FROM pilotos p 
    LEFT JOIN rangos r ON p.grado_code = r.code 
  `;
  
  if (incluirInactivos !== 'true') {
    query += " WHERE p.activo = 1 OR p.activo IS NULL ";
  }
  
  // Ordenar por rol: Admin(1) → Supervisor(2) → Instructor(3) → Piloto(4)
  query += `
    ORDER BY 
      CASE p.rol
        WHEN 'Admin' THEN 1
        WHEN 'Supervisor' THEN 2
        WHEN 'Instructor' THEN 3
        WHEN 'Piloto' THEN 4
        ELSE 5
      END,
      r.orden ASC,
      p.nombre_completo ASC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error al obtener pilotos:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ pilotos: rows });
  });
});

// Obtener un piloto específico (Admin o Supervisor)
router.get('/pilotos/:id', verificarToken, (req, res) => {
  const { id } = req.params;
  
  if (req.piloto.rol !== 'Admin' && req.piloto.rol !== 'Supervisor') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  
  const query = `
    SELECT p.id, p.nombre_completo, p.grado_code, p.email, p.tipo_sangre, 
           p.nacionalidad, p.foto_url, p.rol, p.activo, p.discord_id,
           r.nombre as grado_nombre
    FROM pilotos p
    LEFT JOIN rangos r ON p.grado_code = r.code
    WHERE p.id = ?
  `;
  
  db.get(query, [id], (err, row) => {
    if (err) {
      console.error('Error al obtener piloto:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Piloto no encontrado' });
      return;
    }
    res.json({ piloto: row });
  });
});

// Agregar nuevo piloto
router.post('/pilotos', verificarToken, esAdminOSupervisor, (req, res) => {
  const { id, nombre_completo, grado_code, email, password, tipo_sangre, nacionalidad, rol, foto_url, discord_id } = req.body;
  
  if (!id || !nombre_completo || !grado_code || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  
  db.get("SELECT id FROM pilotos WHERE email = ?", [email], (err, existing) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (existing) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    
    db.get("SELECT id FROM pilotos WHERE id = ?", [id], (err, existingId) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (existingId) {
        return res.status(400).json({ error: 'El ID ya está registrado' });
      }
      
      const password_hash = bcrypt.hashSync(password, 10);
      
      db.run(`INSERT INTO pilotos 
        (id, nombre_completo, grado_code, email, password_hash, tipo_sangre, nacionalidad, rol, foto_url, activo) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [id, nombre_completo, grado_code, email, password_hash, tipo_sangre || null, nacionalidad || 'LS', rol || 'Piloto', foto_url || null],
        function(err) {
          if (err) {
            console.error('Error al crear piloto:', err);
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ success: true, mensaje: 'Piloto agregado', id });
        }
      );
    });
  });
});

// Actualizar piloto (Admin o Supervisor)
router.put('/pilotos/:id', verificarToken, (req, res) => {
  const { id } = req.params;
  const { nombre_completo, email, foto_url, discord_id } = req.body;
  
  // Permitir acceso a Admin y Supervisor
  if (req.piloto.rol !== 'Admin' && req.piloto.rol !== 'Supervisor') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  
  db.run("UPDATE pilotos SET nombre_completo = ?, email = ?, foto_url = ?, discord_id = ? WHERE id = ?",
    [nombre_completo, email, foto_url, discord_id || null, id],
    function(err) {
      if (err) {
        console.error('Error al actualizar piloto:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true, mensaje: 'Piloto actualizado' });
    }
  );
});

// Actualizar grado/rango de un piloto
router.put('/pilotos/:id/grado', verificarToken, esAdmin, (req, res) => {
  const { id } = req.params;
  const { grado_code } = req.body;
  
  if (!grado_code) {
    return res.status(400).json({ error: 'Grado requerido' });
  }
  
  db.run("UPDATE pilotos SET grado_code = ? WHERE id = ?", [grado_code, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, mensaje: 'Grado actualizado' });
  });
});

// Actualizar rol de un piloto
router.put('/pilotos/:id/rol', verificarToken, esAdminOnly, (req, res) => {
  const { id } = req.params;
  const { rol } = req.body;
  
  if (!['Piloto', 'Instructor', 'Supervisor', 'Admin'].includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }
  
  db.run("UPDATE pilotos SET rol = ? WHERE id = ?", [rol, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, mensaje: 'Rol actualizado' });
  });
});

// Cambiar contraseña (Admin o Supervisor)
router.put('/pilotos/:id/password', verificarToken, (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  
  // Permitir acceso a Admin y Supervisor
  if (req.piloto.rol !== 'Admin' && req.piloto.rol !== 'Supervisor') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Contraseña debe tener al menos 4 caracteres' });
  }
  
  const password_hash = bcrypt.hashSync(newPassword, 10);
  
  db.run("UPDATE pilotos SET password_hash = ? WHERE id = ?", [password_hash, id], function(err) {
    if (err) {
      console.error('Error al cambiar contraseña:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, mensaje: 'Contraseña actualizada' });
  });
});

// Archivar piloto
router.put('/pilotos/:id/archivar', verificarToken, esAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run("UPDATE pilotos SET activo = 0 WHERE id = ?", [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, mensaje: 'Piloto archivado' });
  });
});

// Activar piloto
router.put('/pilotos/:id/activar', verificarToken, esAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run("UPDATE pilotos SET activo = 1 WHERE id = ?", [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, mensaje: 'Piloto activado' });
  });
});

// Eliminar piloto
router.delete('/pilotos/:id', verificarToken, esAdmin, (req, res) => {
  const { id } = req.params;
  
  if (id === req.piloto.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
  }
  
  db.run("DELETE FROM pilotos WHERE id = ?", [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, mensaje: 'Piloto eliminado' });
  });
});

// ============================================
// ASCENSOS Y DESCENSOS
// ============================================

// Obtener historial de ascensos de un piloto
router.get('/pilotos/:id/historial-ascensos', verificarToken, esAdmin, (req, res) => {
  const { id } = req.params;
  
  db.all(`SELECT h.*, p.nombre_completo as realizado_por_nombre 
          FROM historial_ascensos h
          LEFT JOIN pilotos p ON h.realizado_por = p.id
          WHERE h.piloto_id = ? 
          ORDER BY h.fecha DESC`, [id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ historial: rows });
  });
});

// Ascender o degradar piloto
router.post('/pilotos/:id/cambiar-grado', verificarToken, esAdminOSupervisor, async (req, res) => {
  const { id } = req.params;
  const { tipo, motivo } = req.body;
  
  if (!tipo || !['ascenso', 'descenso'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo debe ser ascenso o descenso' });
  }
  
  // Obtener datos del piloto (incluyendo discord_id y nombre)
  db.get("SELECT grado_code, discord_id, nombre_completo FROM pilotos WHERE id = ?", [id], (err, pilotoData) => {
  if (err || !pilotoData) {
    return res.status(404).json({ error: 'Piloto no encontrado' });
  }
  
  const discordId = pilotoData.discord_id;
  const piloto_nombre = pilotoData.nombre_completo;
    
    db.get("SELECT orden, nombre, code, discord_role_id FROM rangos WHERE code = ?", [gradoActual], (err, rangoActual) => {
      if (err || !rangoActual) {
        return res.status(404).json({ error: 'Rango no encontrado' });
      }
      
      let nuevoOrden = rangoActual.orden;
      if (tipo === 'ascenso') {
        nuevoOrden = rangoActual.orden + 1;
      } else {
        nuevoOrden = rangoActual.orden - 1;
      }
      
      db.get("SELECT code, nombre, discord_role_id FROM rangos WHERE orden = ?", [nuevoOrden], (err, nuevoRango) => {
        if (err || !nuevoRango) {
          return res.status(400).json({ error: `No se puede ${tipo}, límite alcanzado` });
        }
        
        db.run("UPDATE pilotos SET grado_code = ? WHERE id = ?", [nuevoRango.code, id], function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          db.run(`INSERT INTO historial_ascensos (piloto_id, grado_anterior, grado_nuevo, tipo, motivo, realizado_por) 
                  VALUES (?, ?, ?, ?, ?, ?)`,
            [id, rangoActual.nombre, nuevoRango.nombre, tipo, motivo || null, req.piloto.id],
            (err) => {
              if (err) console.error('Error al guardar historial:', err);
            }
          );
          
          // ============================================
          // SINCRONIZACIÓN CON DISCORD (roles)
          // ============================================
          (async () => {
            try {
              const { asignarRolDiscord, removerRolDiscord } = require('../utils/discord');
              const rolAnteriorId = rangoActual.discord_role_id;
              const nuevoRolId = nuevoRango.discord_role_id;
              
              // Remover rol anterior SIEMPRE (tanto en ascenso como descenso)
              if (rolAnteriorId && discordId) {
                console.log(`🎮 Removiendo rol ${rolAnteriorId} de usuario ${discordId}`);
                await removerRolDiscord(discordId, rolAnteriorId);
              }
              
              // Asignar nuevo rol SIEMPRE (tanto en ascenso como descenso)
              if (nuevoRolId && discordId) {
                console.log(`🎮 Asignando nuevo rol ${nuevoRolId} a usuario ${discordId}`);
                await asignarRolDiscord(discordId, nuevoRolId);
              }
            } catch (discordError) {
              console.error('❌ Error en sincronización con Discord:', discordError);
            }
          })();
          
          // ============================================
          // ENVIAR WEBHOOK DE ASCENSO/DESCENSO
          // ============================================
          (async () => {
            try {
              const { enviarWebhookAscenso } = require('../utils/webhooks');
              await enviarWebhookAscenso({
                tipo: tipo,
                piloto_nombre: piloto_nombre,
                piloto_grado: rangoActual.nombre,
                grado_anterior: rangoActual.nombre,
                grado_nuevo: nuevoRango.nombre,
                motivo: motivo || null,
                realizado_por: `${req.piloto.grado} - ${req.piloto.nombre}`
              });
              console.log(`✅ Webhook de ${tipo} enviado a Discord`);
            } catch (webhookError) {
              console.error('❌ Error al enviar webhook:', webhookError);
            }
          })();
          
          res.json({ 
            success: true, 
            mensaje: `Piloto ${tipo === 'ascenso' ? 'ascendido' : 'degradado'} a ${nuevoRango.nombre}`,
            nuevo_grado: nuevoRango.code
          });
        });
      });
    });
  });
});
          // ============================================
// SINCRONIZACIÓN CON DISCORD
// ============================================
(async () => {
  try {
    const { asignarRolDiscord, removerRolDiscord } = require('../utils/discord');
    const discordId = piloto.discord_id;
    
    const rolAnteriorId = rangoActual.discord_role_id;
    const nuevoRolId = nuevoRango.discord_role_id;
    
    if (tipo === 'ascenso') {
      // Remover rol anterior
      if (rolAnteriorId && discordId) {
        console.log(`🎮 Removiendo rol anterior ${rolAnteriorId} de usuario ${discordId}`);
        await removerRolDiscord(discordId, rolAnteriorId);
      }
      
      // Asignar nuevo rol
      if (nuevoRolId && discordId) {
        console.log(`🎮 Asignando nuevo rol ${nuevoRolId} a usuario ${discordId}`);
        await asignarRolDiscord(discordId, nuevoRolId);
      }
    } else if (tipo === 'descenso') {
      // Remover rol anterior
      if (rolAnteriorId && discordId) {
        console.log(`🎮 Removiendo rol anterior ${rolAnteriorId} de usuario ${discordId}`);
        await removerRolDiscord(discordId, rolAnteriorId);
      }
      
      // Asignar nuevo rol
      if (nuevoRolId && discordId) {
        console.log(`🎮 Asignando nuevo rol ${nuevoRolId} a usuario ${discordId}`);
        await asignarRolDiscord(discordId, nuevoRolId);
      }
    }
  } catch (discordError) {
    console.error('❌ Error en sincronización con Discord:', discordError);
  }
})();
       


// ============================================
// CERTIFICACIONES
// ============================================

// Obtener certificaciones de un piloto (Admin, Instructor o Supervisor)
router.get('/pilotos/:id/certificaciones', verificarToken, (req, res) => {
  const { id } = req.params;
  
  // Permitir acceso a Admin, Instructor y Supervisor
  if (req.piloto.rol === 'Piloto') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  
  const query = `
    SELECT c.*, a.modelo, a.tipo, a.id as aeronave_id
    FROM certificaciones c
    JOIN aeronaves a ON c.aeronave_id = a.id
    WHERE c.piloto_id = ?
    ORDER BY c.fecha_certificacion DESC
  `;
  
  db.all(query, [id], (err, rows) => {
    if (err) {
      console.error('Error:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ certificaciones: rows });
  });
});

// Certificar a un piloto en una aeronave (Admin o Instructor)
router.post('/certificar', verificarToken, esAdminOInstructor, async (req, res) => {
  const { piloto_id, aeronave_id } = req.body;
  const certificado_por = req.piloto.id;
  const certificado_por_nombre = req.piloto.nombre;
  const certificado_por_grado = req.piloto.grado;
  
  console.log('📝 Certificando piloto:', { piloto_id, aeronave_id, certificado_por, rol: req.piloto.rol });
  
  if (!piloto_id || !aeronave_id) {
    return res.status(400).json({ error: 'Faltan datos: piloto_id y aeronave_id son requeridos' });
  }
  
  db.get("SELECT nombre_completo, grado_code FROM pilotos WHERE id = ?", [piloto_id], async (err, piloto) => {
    if (err) {
      console.error('Error al obtener piloto:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!piloto) {
      return res.status(404).json({ error: 'Piloto no encontrado' });
    }
    
    db.get("SELECT id FROM aeronaves WHERE id = ?", [aeronave_id], (err, aeronave) => {
      if (err) {
        console.error('Error al verificar aeronave:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!aeronave) {
        return res.status(404).json({ error: 'Aeronave no encontrada' });
      }
      
      const query = `INSERT INTO certificaciones (piloto_id, aeronave_id, certificado_por)
                     VALUES (?, ?, ?)`;
      
      db.run(query, [piloto_id, aeronave_id, certificado_por], async function(err) {
        if (err) {
  if (err.message.includes('UNIQUE')) {

    // 🔥 Enviar webhook aunque ya esté certificado
    try {
      const registroId = getNextRegistroId();
      await enviarWebhookRegistro({
        id: registroId,
        cfi_nombre: certificado_por_nombre,
        cfi_grado: certificado_por_grado,
        piloto_nombre: piloto.nombre_completo,
        piloto_grado: piloto.grado_code,
        aeronave_id: aeronave_id
      });
      console.log('✅ Webhook reenviado (ya certificado)');
    } catch (webhookError) {
      console.error('❌ Error webhook:', webhookError);
    }

    return res.status(200).json({ 
      success: true, 
      mensaje: 'Ya estaba certificado pero se registró igual' 
    });
  }
          console.error('Error al certificar:', err);
          res.status(500).json({ error: err.message });
          return;
        }
        
        try {
          const registroId = getNextRegistroId();
          await enviarWebhookRegistro({
            id: registroId,
            cfi_nombre: certificado_por_nombre,
            cfi_grado: certificado_por_grado,
            piloto_nombre: piloto.nombre_completo,
            piloto_grado: piloto.grado_code,
            aeronave_id: aeronave_id
          });
          console.log('✅ Webhook de registro enviado');
        } catch (webhookError) {
          console.error('❌ Error al enviar webhook de registro:', webhookError);
        }
        
        console.log('✅ Certificación registrada con ID:', this.lastID);
        res.json({ success: true, mensaje: 'Piloto certificado exitosamente' });
      });
    });
  });
});


// Obtener aeronaves certificadas por un piloto
router.get('/pilotos/:id/aeronaves-certificadas', verificarToken, (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT a.id, a.modelo, a.tipo, a.estado
    FROM certificaciones c
    JOIN aeronaves a ON c.aeronave_id = a.id
    WHERE c.piloto_id = ? AND a.estado = 'Operativa'
    ORDER BY a.modelo
  `;
  
  db.all(query, [id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ aeronaves: rows });
  });
});

// Obtener aeronaves autorizadas para libros de vuelo (solo certificadas o con solicitud aprobada)
router.get('/pilotos/:id/aeronaves-autorizadas', verificarToken, (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT a.id, a.modelo, a.tipo, a.estado, a.nivel,
           CASE 
             WHEN c.id IS NOT NULL THEN 'certificada'
             WHEN s.id IS NOT NULL THEN 'aprobada'
             ELSE 'ninguna'
           END as estado_certificacion
    FROM aeronaves a
    LEFT JOIN certificaciones c ON a.id = c.aeronave_id AND c.piloto_id = ?
    LEFT JOIN solicitudes s ON a.id = s.aeronave_solicitada AND s.piloto_id = ? AND s.tipo = 'Certificación' AND s.estado = 'Aprobada'
    WHERE a.estado = 'Operativa'
    AND (c.id IS NOT NULL OR s.id IS NOT NULL)
    ORDER BY 
      CASE WHEN c.id IS NOT NULL THEN 1 ELSE 2 END,
      a.nivel ASC,
      a.modelo ASC
  `;
  
  db.all(query, [id, id], (err, rows) => {
    if (err) {
      console.error('Error al obtener aeronaves autorizadas:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Transformar para el frontend
    const aeronaves = rows.map(a => ({
      id: a.id,
      modelo: a.modelo,
      tipo: a.tipo,
      nivel: a.nivel,
      certificada: a.estado_certificacion === 'certificada',
      estado_texto: a.estado_certificacion === 'certificada' ? '✅ CERTIFICADA' : '⏳ APROBADA'
    }));
    
    res.json({ aeronaves });
  });
});

// Obtener aeronaves disponibles para certificar
router.get('/pilotos/:id/aeronaves-disponibles', verificarToken, (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT a.id, a.modelo, a.tipo, a.estado, a.nivel
    FROM aeronaves a
    WHERE a.estado = 'Operativa'
    AND a.id NOT IN (
      SELECT aeronave_id FROM certificaciones WHERE piloto_id = ?
    )
    AND a.id NOT IN (
      SELECT aeronave_solicitada FROM solicitudes 
      WHERE piloto_id = ? 
      AND tipo = 'Certificación'
      AND estado IN ('Aprobada', 'Certificada', 'Pendiente')
      AND aeronave_solicitada IS NOT NULL
    )
    ORDER BY 
      CASE a.nivel
        WHEN 'Básico' THEN 1
        WHEN 'Intermedio' THEN 2
        WHEN 'Avanzado' THEN 3
        ELSE 4
      END,
      a.modelo ASC
  `;
  
  db.all(query, [id, id], (err, rows) => {
    if (err) {
      console.error('Error al obtener aeronaves disponibles:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ aeronaves: rows });
  });
});

// ============================================
// GESTIÓN DE AERONAVES
// ============================================

// Obtener todas las aeronaves
router.get('/aeronaves', verificarToken, esAdminOnly, (req, res) => {
  const query = `
    SELECT * FROM aeronaves 
    ORDER BY 
      CASE nivel
        WHEN 'Básico' THEN 1
        WHEN 'Intermedio' THEN 2
        WHEN 'Avanzado' THEN 3
        ELSE 4
      END,
      tipo ASC,
      id ASC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ aeronaves: rows });
  });
});

// Obtener una aeronave específica
router.get('/aeronaves/:id', verificarToken, esAdmin, (req, res) => {
  const { id } = req.params;
  db.get("SELECT * FROM aeronaves WHERE id = ?", [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Aeronave no encontrada' });
      return;
    }
    res.json({ aeronave: row });
  });
});

// Agregar aeronave
router.post('/aeronaves', verificarToken, esAdminOnly, (req, res) => {
  const { id, modelo, nivel, tipo, estado, imagen_url } = req.body;
  
  if (!id || !modelo || !nivel || !tipo) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  
  db.run(`INSERT INTO aeronaves (id, modelo, nivel, tipo, estado, imagen_url) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, modelo, nivel, tipo, estado || 'Operativa', imagen_url || null],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true, mensaje: 'Aeronave agregada', id });
    }
  );
});

// Actualizar aeronave
router.put('/aeronaves/:id', verificarToken, esAdminOnly, (req, res) => {
  const { id } = req.params;
  const { modelo, nivel, tipo, estado, imagen_url } = req.body;
  
  db.run(`UPDATE aeronaves SET modelo = ?, nivel = ?, tipo = ?, estado = ?, imagen_url = ? WHERE id = ?`,
    [modelo, nivel, tipo, estado, imagen_url, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true, mensaje: 'Aeronave actualizada' });
    }
  );
});

// Eliminar aeronave
router.delete('/aeronaves/:id', verificarToken, esAdminOnly, (req, res) => {
  const { id } = req.params;
  
  db.run("DELETE FROM aeronaves WHERE id = ?", [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, mensaje: 'Aeronave eliminada' });
  });
});

// ============================================
// ESTADÍSTICAS
// ============================================

router.get('/stats', verificarToken, esAdmin, (req, res) => {
  const stats = {};
  
  db.get("SELECT COUNT(*) as total FROM pilotos WHERE activo = 1 OR activo IS NULL", [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    stats.totalPilotos = row.total;
    
    db.get("SELECT COUNT(*) as total FROM aeronaves", [], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      stats.totalAeronaves = row.total;
      
      db.get("SELECT COUNT(*) as total FROM solicitudes WHERE estado = 'Pendiente'", [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.solicitudesPendientes = row.total;
        
        db.get("SELECT COUNT(*) as total FROM libros_vuelo", [], (err, row) => {
          if (err) return res.status(500).json({ error: err.message });
          stats.totalVuelos = row.total;
          
          res.json({ stats });
        });
      });
    });
  });
});
// Obtener rangos (público para todos los usuarios autenticados)
router.get('/rangos-public', verificarToken, (req, res) => {
  db.all("SELECT code, nombre, logo_url FROM rangos ORDER BY orden ASC", [], (err, rows) => {
    if (err) {
      console.error('Error al obtener rangos públicos:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ ranks: rows });
  });
});

module.exports = router;