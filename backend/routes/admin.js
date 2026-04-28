const express = require('express');
const router = express.Router();
const { pool, supabase } = require('../config/supabase'); // ✅ Supabase/PostgreSQL
const bcrypt = require('bcryptjs');
const { verificarToken } = require('./auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { enviarWebhookRegistro, getNextRegistroId } = require('../utils/webhooks');

// ============================================
// MIDDLEWARES DE AUTORIZACIÓN
// ============================================

function esAdminOSupervisor(req, res, next) {
  if (req.piloto.rol !== 'Admin' && req.piloto.rol !== 'Supervisor') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol Admin o Supervisor' });
  }
  next();
}

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

function esAdminOInstructor(req, res, next) {
  if (req.piloto.rol === 'Piloto') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol Instructor, Supervisor o Admin' });
  }
  next();
}

// ============================================
// CONFIGURACIÓN DE MULTER PARA SUBIR IMÁGENES
// ============================================

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

console.log('📁 Carpetas de uploads verificadas');

const storage = multer.memoryStorage();

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
});

// ============================================
// ENDPOINTS DE UPLOAD (SUPABASE STORAGE)
// ============================================

// Subir imagen de piloto, aeronave o rango
router.post('/upload/:carpeta/:id', verificarToken, esAdmin, upload.single('imagen'), async (req, res) => {
  try {
    const { carpeta, id } = req.params;
    const file = req.file;
    
    if (!file) return res.status(400).json({ error: 'No se recibió ninguna imagen' });

    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    const filePath = `${carpeta}/${fileName}`;
    
    // Subir a Supabase Storage
    const { data, error } = await supabase.storage
      .from('imagenes')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (error) throw error;

    // Obtener URL pública
    const { data: publicUrl } = supabase.storage
      .from('imagenes')
      .getPublicUrl(filePath);

    const url = publicUrl.publicUrl;

    // Actualizar en la base de datos según la carpeta
    if (carpeta === 'pilotos') {
      await pool.query("UPDATE pilotos SET foto_url = $1 WHERE id = $2", [url, id]);
    } else if (carpeta === 'aeronaves') {
      await pool.query("UPDATE aeronaves SET imagen_url = $1 WHERE id = $2", [url, id]);
    } else if (carpeta === 'ranks') {
      await pool.query("UPDATE rangos SET logo_url = $1 WHERE id = $2", [url, id]);
    }

    res.json({ success: true, url });
  } catch (error) {
    console.error('Error al subir:', error);
    res.status(500).json({ error: error.message });
  }
});

// Subir una imagen de observación
router.post('/upload/observacion', verificarToken, upload.single('imagen'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No se recibió ninguna imagen' });

    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    const filePath = `observaciones/${fileName}`;
    
    const { data, error } = await supabase.storage
      .from('imagenes')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (error) throw error;

    const { data: publicUrl } = supabase.storage
      .from('imagenes')
      .getPublicUrl(filePath);

    res.json({ success: true, url: publicUrl.publicUrl });
  } catch (error) {
    console.error('Error al subir:', error);
    res.status(500).json({ error: error.message });
  }
});

// Subir múltiples imágenes de observación
router.post('/upload/observaciones', verificarToken, upload.array('imagenes', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No se recibieron imágenes' });

    const urls = [];
    
    for (const file of req.files) {
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
      const filePath = `observaciones/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('imagenes')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (error) throw error;

      const { data: publicUrl } = supabase.storage
        .from('imagenes')
        .getPublicUrl(filePath);

      urls.push(publicUrl.publicUrl);
    }

    res.json({ success: true, urls });
  } catch (error) {
    console.error('Error al subir:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GESTIÓN DE RANGOS
// ============================================

router.get('/rangos', verificarToken, esAdminOnly, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM rangos ORDER BY orden ASC");
    res.json({ ranks: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/rangos', verificarToken, esAdminOnly, async (req, res) => {
  try {
    const { ranks } = req.body;
    if (!ranks || !Array.isArray(ranks)) return res.status(400).json({ error: 'Datos inválidos' });
    if (ranks.length === 0) return res.status(400).json({ error: 'No hay rangos para guardar' });

    // ✅ SOLO actualizar discord_role_id y orden de cada rango
    for (const rango of ranks) {
      if (!rango.code) continue;
      await pool.query(
        `UPDATE rangos SET discord_role_id = $1, orden = $2 WHERE code = $3`,
        [rango.discord_role_id || null, rango.orden || 999, rango.code]
      );
    }

    console.log('✅ Rangos actualizados (solo discord_role_id y orden)');
    res.json({ success: true, mensaje: 'Rangos actualizados' });
  } catch (error) {
    console.error('Error al guardar rangos:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/rangos', verificarToken, esAdminOnly, async (req, res) => {
  try {
    const { code, nombre, orden } = req.body;
    if (!code || !nombre) return res.status(400).json({ error: 'Código y nombre requeridos' });
    
    const result = await pool.query(
      "INSERT INTO rangos (code, nombre, orden) VALUES ($1, $2, $3) RETURNING id",
      [code, nombre, orden || 999]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/rangos/:id', verificarToken, esAdminOnly, async (req, res) => {
  try {
    await pool.query("DELETE FROM rangos WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GESTIÓN DE PILOTOS
// ============================================

router.get('/pilotos', verificarToken, esAdminOSupervisor, async (req, res) => {
  try {
    const { incluirInactivos } = req.query;
    let query = `
      SELECT p.*, r.nombre as grado_nombre 
      FROM pilotos p 
      LEFT JOIN rangos r ON p.grado_code = r.code 
    `;
    
    if (incluirInactivos !== 'true') {
      query += " WHERE p.activo = 1 OR p.activo IS NULL ";
    }
    
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
    
    const result = await pool.query(query);
    res.json({ pilotos: result.rows });
  } catch (error) {
    console.error('Error al obtener pilotos:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/pilotos/:id', verificarToken, async (req, res) => {
  try {
    if (req.piloto.rol !== 'Admin' && req.piloto.rol !== 'Supervisor') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const result = await pool.query(`
      SELECT p.id, p.nombre_completo, p.grado_code, p.email, p.tipo_sangre, 
             p.nacionalidad, p.foto_url, p.rol, p.activo, p.discord_id,
             r.nombre as grado_nombre
      FROM pilotos p
      LEFT JOIN rangos r ON p.grado_code = r.code
      WHERE p.id = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Piloto no encontrado' });
    res.json({ piloto: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener piloto:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/pilotos', verificarToken, esAdminOSupervisor, async (req, res) => {
  try {
    const { id, nombre_completo, grado_code, email, password, tipo_sangre, nacionalidad, rol, foto_url, discord_id } = req.body;
    if (!id || !nombre_completo || !grado_code || !email || !password) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    const emailCheck = await pool.query("SELECT id FROM pilotos WHERE email = $1", [email]);
    if (emailCheck.rows.length > 0) return res.status(400).json({ error: 'El email ya está registrado' });
    
    const idCheck = await pool.query("SELECT id FROM pilotos WHERE id = $1", [id]);
    if (idCheck.rows.length > 0) return res.status(400).json({ error: 'El ID ya está registrado' });
    
    const password_hash = bcrypt.hashSync(password, 10);
    
    await pool.query(
  `INSERT INTO pilotos (id, nombre_completo, grado_code, email, password_hash, tipo_sangre, nacionalidad, rol, foto_url, discord_id, activo) 
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)`,
  [id, nombre_completo, grado_code, email, password_hash, tipo_sangre || null, nacionalidad || 'LS', rol || 'Piloto', foto_url || null, discord_id || null]
);
    
    res.json({ success: true, mensaje: 'Piloto agregado', id });
  } catch (error) {
    console.error('Error al crear piloto:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/pilotos/:id', verificarToken, async (req, res) => {
  try {
    if (req.piloto.rol !== 'Admin' && req.piloto.rol !== 'Supervisor') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const { nombre_completo, email, foto_url, discord_id } = req.body;
    await pool.query(
      "UPDATE pilotos SET nombre_completo = $1, email = $2, foto_url = $3, discord_id = $4 WHERE id = $5",
      [nombre_completo, email, foto_url, discord_id || null, req.params.id]
    );
    res.json({ success: true, mensaje: 'Piloto actualizado' });
  } catch (error) {
    console.error('Error al actualizar piloto:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/pilotos/:id/grado', verificarToken, esAdmin, async (req, res) => {
  try {
    const { grado_code } = req.body;
    if (!grado_code) return res.status(400).json({ error: 'Grado requerido' });
    
    await pool.query("UPDATE pilotos SET grado_code = $1 WHERE id = $2", [grado_code, req.params.id]);
    res.json({ success: true, mensaje: 'Grado actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/pilotos/:id/rol', verificarToken, esAdminOnly, async (req, res) => {
  try {
    const { rol } = req.body;
    if (!['Piloto', 'Instructor', 'Supervisor', 'Admin'].includes(rol)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }
    
    await pool.query("UPDATE pilotos SET rol = $1 WHERE id = $2", [rol, req.params.id]);
    res.json({ success: true, mensaje: 'Rol actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/pilotos/:id/password', verificarToken, async (req, res) => {
  try {
    if (req.piloto.rol !== 'Admin' && req.piloto.rol !== 'Supervisor') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'Contraseña debe tener al menos 4 caracteres' });
    }
    
    const password_hash = bcrypt.hashSync(newPassword, 10);
    await pool.query("UPDATE pilotos SET password_hash = $1 WHERE id = $2", [password_hash, req.params.id]);
    res.json({ success: true, mensaje: 'Contraseña actualizada' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/pilotos/:id/archivar', verificarToken, esAdmin, async (req, res) => {
  try {
    await pool.query("UPDATE pilotos SET activo = 0 WHERE id = $1", [req.params.id]);
    res.json({ success: true, mensaje: 'Piloto archivado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/pilotos/:id/activar', verificarToken, esAdmin, async (req, res) => {
  try {
    await pool.query("UPDATE pilotos SET activo = 1 WHERE id = $1", [req.params.id]);
    res.json({ success: true, mensaje: 'Piloto activado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/pilotos/:id', verificarToken, esAdmin, async (req, res) => {
  try {
    if (req.params.id === req.piloto.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
    }
    
    await pool.query("DELETE FROM pilotos WHERE id = $1", [req.params.id]);
    res.json({ success: true, mensaje: 'Piloto eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ASCENSOS Y DESCENSOS
// ============================================

router.get('/pilotos/:id/historial-ascensos', verificarToken, esAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT h.*, p.nombre_completo as realizado_por_nombre 
      FROM historial_ascensos h
      LEFT JOIN pilotos p ON h.realizado_por = p.id
      WHERE h.piloto_id = $1 
      ORDER BY h.fecha DESC
    `, [req.params.id]);
    res.json({ historial: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/pilotos/:id/cambiar-grado', verificarToken, esAdminOSupervisor, async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, motivo } = req.body;
    
    if (!tipo || !['ascenso', 'descenso'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo debe ser ascenso o descenso' });
    }
    
    // Obtener piloto
    const pilotoResult = await pool.query(
      "SELECT grado_code, discord_id, nombre_completo FROM pilotos WHERE id = $1", [id]
    );
    if (pilotoResult.rows.length === 0) return res.status(404).json({ error: 'Piloto no encontrado' });
    
    const piloto = pilotoResult.rows[0]; // ✅ piloto SÍ está definido aquí
    const gradoActual = piloto.grado_code;
    
    // Obtener rango actual
    const rangoActualResult = await pool.query(
      "SELECT orden, nombre, code, discord_role_id FROM rangos WHERE code = $1", [gradoActual]
    );
    if (rangoActualResult.rows.length === 0) return res.status(404).json({ error: 'Rango no encontrado' });
    
    const rangoActual = rangoActualResult.rows[0];
    
    // Calcular nuevo orden
    let nuevoOrden = tipo === 'ascenso' ? rangoActual.orden + 1 : rangoActual.orden - 1;
    
    // Obtener nuevo rango
    const nuevoRangoResult = await pool.query(
      "SELECT code, nombre, discord_role_id FROM rangos WHERE orden = $1", [nuevoOrden]
    );
    if (nuevoRangoResult.rows.length === 0) {
      return res.status(400).json({ error: `No se puede ${tipo}, límite alcanzado` });
    }
    
    const nuevoRango = nuevoRangoResult.rows[0];
    
    // Actualizar grado
    await pool.query("UPDATE pilotos SET grado_code = $1 WHERE id = $2", [nuevoRango.code, id]);
    
    // Guardar historial
    await pool.query(
      `INSERT INTO historial_ascensos (piloto_id, grado_anterior, grado_nuevo, tipo, motivo, realizado_por) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, rangoActual.nombre, nuevoRango.nombre, tipo, motivo || null, req.piloto.id]
    );
    
    // Sincronización con Discord
    try {
      const { asignarRolDiscord, removerRolDiscord } = require('../utils/discord');
      const discordId = piloto.discord_id;
      
      if (rangoActual.discord_role_id && discordId) {
        console.log(`🎮 Removiendo rol ${rangoActual.discord_role_id} de usuario ${discordId}`);
        await removerRolDiscord(discordId, rangoActual.discord_role_id);
      }
      if (nuevoRango.discord_role_id && discordId) {
        console.log(`🎮 Asignando nuevo rol ${nuevoRango.discord_role_id} a usuario ${discordId}`);
        await asignarRolDiscord(discordId, nuevoRango.discord_role_id);
      }
    } catch (discordError) {
      console.error('❌ Error en sincronización con Discord:', discordError);
    }
    
    // Webhook
    try {
      const { enviarWebhookAscenso } = require('../utils/webhooks');
      await enviarWebhookAscenso({
        tipo,
        piloto_nombre: piloto.nombre_completo,
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
    
    res.json({ 
      success: true, 
      mensaje: `Piloto ${tipo === 'ascenso' ? 'ascendido' : 'degradado'} a ${nuevoRango.nombre}`,
      nuevo_grado: nuevoRango.code
    });
    
  } catch (error) {
    console.error('❌ Error en cambiar-grado:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CERTIFICACIONES
// ============================================

router.get('/pilotos/:id/certificaciones', verificarToken, async (req, res) => {
  try {
    if (req.piloto.rol === 'Piloto') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const result = await pool.query(`
      SELECT c.*, a.modelo, a.tipo, a.id as aeronave_id
      FROM certificaciones c
      JOIN aeronaves a ON c.aeronave_id = a.id
      WHERE c.piloto_id = $1
      ORDER BY c.fecha_certificacion DESC
    `, [req.params.id]);
    
    res.json({ certificaciones: result.rows });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/certificar', verificarToken, esAdminOInstructor, async (req, res) => {
  try {
    const { piloto_id, aeronave_id } = req.body;
    const certificado_por = req.piloto.id;
    const certificado_por_nombre = req.piloto.nombre;
    const certificado_por_grado = req.piloto.grado;
    
    console.log('📝 Certificando piloto:', { piloto_id, aeronave_id, certificado_por, rol: req.piloto.rol });
    
    if (!piloto_id || !aeronave_id) {
      return res.status(400).json({ error: 'Faltan datos: piloto_id y aeronave_id son requeridos' });
    }
    
    // Verificar piloto
    const pilotoResult = await pool.query(
      "SELECT nombre_completo, grado_code FROM pilotos WHERE id = $1", [piloto_id]
    );
    if (pilotoResult.rows.length === 0) return res.status(404).json({ error: 'Piloto no encontrado' });
    
    const piloto = pilotoResult.rows[0];
    
    // Verificar aeronave
    const aeronaveResult = await pool.query("SELECT id FROM aeronaves WHERE id = $1", [aeronave_id]);
    if (aeronaveResult.rows.length === 0) return res.status(404).json({ error: 'Aeronave no encontrada' });
    
    // Insertar certificación
    try {
      await pool.query(
        `INSERT INTO certificaciones (piloto_id, aeronave_id, certificado_por) VALUES ($1, $2, $3)`,
        [piloto_id, aeronave_id, certificado_por]
      );
      
      // Webhook de registro
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
      
      console.log('✅ Certificación registrada');
      res.json({ success: true, mensaje: 'Piloto certificado exitosamente' });
      
    } catch (insertError) {
      if (insertError.message.includes('unique') || insertError.message.includes('duplicate')) {
        // Ya está certificado
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
      throw insertError;
    }
    
  } catch (error) {
    console.error('Error al certificar:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/pilotos/:id/aeronaves-certificadas', verificarToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.modelo, a.tipo, a.estado
      FROM certificaciones c
      JOIN aeronaves a ON c.aeronave_id = a.id
      WHERE c.piloto_id = $1 AND a.estado = 'Operativa'
      ORDER BY a.modelo
    `, [req.params.id]);
    
    res.json({ aeronaves: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/pilotos/:id/aeronaves-autorizadas', verificarToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.modelo, a.tipo, a.estado, a.nivel,
             CASE 
               WHEN c.id IS NOT NULL THEN 'certificada'
               WHEN s.id IS NOT NULL THEN 'aprobada'
               ELSE 'ninguna'
             END as estado_certificacion
      FROM aeronaves a
      LEFT JOIN certificaciones c ON a.id = c.aeronave_id AND c.piloto_id = $1
      LEFT JOIN solicitudes s ON a.id = s.aeronave_solicitada AND s.piloto_id = $1 AND s.tipo = 'Certificación' AND s.estado = 'Aprobada'
      WHERE a.estado = 'Operativa'
      AND (c.id IS NOT NULL OR s.id IS NOT NULL)
      ORDER BY 
        CASE WHEN c.id IS NOT NULL THEN 1 ELSE 2 END,
        a.nivel ASC,
        a.modelo ASC
    `, [req.params.id]);
    
    const aeronaves = result.rows.map(a => ({
      id: a.id,
      modelo: a.modelo,
      tipo: a.tipo,
      nivel: a.nivel,
      certificada: a.estado_certificacion === 'certificada',
      estado_texto: a.estado_certificacion === 'certificada' ? '✅ CERTIFICADA' : '⏳ APROBADA'
    }));
    
    res.json({ aeronaves });
  } catch (error) {
    console.error('Error al obtener aeronaves autorizadas:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/pilotos/:id/aeronaves-disponibles', verificarToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.modelo, a.tipo, a.estado, a.nivel
      FROM aeronaves a
      WHERE a.estado = 'Operativa'
      AND a.id NOT IN (
        SELECT aeronave_id FROM certificaciones WHERE piloto_id = $1
      )
      AND a.id NOT IN (
        SELECT aeronave_solicitada FROM solicitudes 
        WHERE piloto_id = $1 
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
    `, [req.params.id]);
    
    res.json({ aeronaves: result.rows });
  } catch (error) {
    console.error('Error al obtener aeronaves disponibles:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GESTIÓN DE AERONAVES
// ============================================

router.get('/aeronaves', verificarToken, esAdminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
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
    `);
    res.json({ aeronaves: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/aeronaves/:id', verificarToken, esAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM aeronaves WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Aeronave no encontrada' });
    res.json({ aeronave: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/aeronaves', verificarToken, esAdminOnly, async (req, res) => {
  try {
    const { id, modelo, nivel, tipo, estado, imagen_url } = req.body;
    
    console.log('📦 Datos recibidos para aeronave:', JSON.stringify(req.body));
    console.log('🖼️ imagen_url recibida:', imagen_url);

    if (!id || !modelo || !nivel || !tipo) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    await pool.query(
      `INSERT INTO aeronaves (id, modelo, nivel, tipo, estado, imagen_url) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, modelo, nivel, tipo, estado || 'Operativa', imagen_url || null]
    );
    res.json({ success: true, mensaje: 'Aeronave agregada', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/aeronaves/:id', verificarToken, esAdminOnly, async (req, res) => {
  try {
    const { modelo, nivel, tipo, estado, imagen_url } = req.body;
    
    // ✅ DEBUG
    console.log('📦 BODY COMPLETO:', JSON.stringify(req.body));
    
    if (!imagen_url) {
      console.log('❌ imagen_url está VACÍO o NULL');
    } else {
      console.log('✅ imagen_url recibido:', imagen_url);
    }
    
    const result = await pool.query(
      `UPDATE aeronaves SET modelo = $1, nivel = $2, tipo = $3, estado = $4, imagen_url = $5 WHERE id = $6`,
      [modelo, nivel, tipo, estado, imagen_url, req.params.id]
    );
    
    console.log('📝 Filas actualizadas:', result.rowCount);
    
    // Verificar si se guardó
    const verify = await pool.query("SELECT imagen_url FROM aeronaves WHERE id = $1", [req.params.id]);
    console.log('🗄️ En BD ahora:', verify.rows[0]?.imagen_url);
    
    res.json({ success: true, mensaje: 'Aeronave actualizada' });
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/aeronaves/:id', verificarToken, esAdminOnly, async (req, res) => {
  try {
    await pool.query("DELETE FROM aeronaves WHERE id = $1", [req.params.id]);
    res.json({ success: true, mensaje: 'Aeronave eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ESTADÍSTICAS
// ============================================

router.get('/stats', verificarToken, esAdmin, async (req, res) => {
  try {
    const [
      totalPilotos,
      totalAeronaves,
      solicitudesPendientes,
      totalVuelos
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) as total FROM pilotos WHERE activo = 1 OR activo IS NULL"),
      pool.query("SELECT COUNT(*) as total FROM aeronaves"),
      pool.query("SELECT COUNT(*) as total FROM solicitudes WHERE estado = 'Pendiente'"),
      pool.query("SELECT COUNT(*) as total FROM libros_vuelo")
    ]);
    
    res.json({ 
      stats: {
        totalPilotos: totalPilotos.rows[0].total,
        totalAeronaves: totalAeronaves.rows[0].total,
        solicitudesPendientes: solicitudesPendientes.rows[0].total,
        totalVuelos: totalVuelos.rows[0].total
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener rangos públicos
router.get('/rangos-public', verificarToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT code, nombre, logo_url FROM rangos ORDER BY orden ASC");
    res.json({ ranks: result.rows });
  } catch (error) {
    console.error('Error al obtener rangos públicos:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ❌ ELIMINADO: Bloque huérfano que causaba el error
// Ya NO hay código fuera de los routers
// ============================================

module.exports = router;
