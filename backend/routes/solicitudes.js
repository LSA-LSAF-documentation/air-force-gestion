const express = require('express');
const router = express.Router();
const { pool } = require('../config/supabase');
const { verificarToken } = require('./auth');
const { enviarWebhookSolicitud, getNextSolicitudId } = require('../utils/webhooks');

// Verificar si el usuario es Instructor o Admin
function esInstructorOAdmin(req, res, next) {
  console.log('🔐 Verificando rol - Usuario:', req.piloto.id, 'Rol:', req.piloto.rol);
  if (req.piloto.rol === 'Piloto') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol Instructor, Supervisor o Admin' });
  }
  next();
}

// Obtener todas las solicitudes
router.get('/', verificarToken, async (req, res) => {
  try {
    if (req.piloto.rol === 'Piloto') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const query = `
      SELECT s.*, 
             p.nombre_completo as piloto_nombre, 
             p.grado_code as piloto_grado,
             p.id as piloto_id,
             r.nombre as grado_nombre,
             a.modelo as aeronave_modelo
      FROM solicitudes s
      JOIN pilotos p ON s.piloto_id = p.id
      LEFT JOIN rangos r ON p.grado_code = r.code
      LEFT JOIN aeronaves a ON s.aeronave_solicitada = a.id
      ORDER BY 
        CASE s.estado
          WHEN 'Pendiente' THEN 1
          WHEN 'Aprobada' THEN 2
          WHEN 'Certificada' THEN 3
          WHEN 'Rechazada' THEN 4
          ELSE 5
        END,
        s.fecha_solicitud DESC
    `;
    
    const result = await pool.query(query);
    console.log(`✅ ${result.rows.length} solicitudes encontradas`);
    res.json({ solicitudes: result.rows });
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener mis solicitudes
router.get('/mis-solicitudes', verificarToken, async (req, res) => {
  try {
    const pilotoId = req.piloto.id;
    
    const query = `
      SELECT s.*, 
             p.nombre_completo as piloto_nombre, 
             p.grado_code as piloto_grado,
             r.nombre as grado_nombre,
             a.modelo as aeronave_modelo
      FROM solicitudes s
      JOIN pilotos p ON s.piloto_id = p.id
      LEFT JOIN rangos r ON p.grado_code = r.code
      LEFT JOIN aeronaves a ON s.aeronave_solicitada = a.id
      WHERE s.piloto_id = $1
      ORDER BY 
        CASE s.estado
          WHEN 'Pendiente' THEN 1
          WHEN 'Aprobada' THEN 2
          WHEN 'Certificada' THEN 3
          WHEN 'Rechazada' THEN 4
          ELSE 5
        END,
        s.fecha_solicitud DESC
    `;
    
    const result = await pool.query(query, [pilotoId]);
    res.json({ misSolicitudes: result.rows });
  } catch (error) {
    console.error('Error al obtener mis solicitudes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Crear una nueva solicitud
router.post('/', verificarToken, async (req, res) => {
  try {
    const { tipo, descripcion, aeronave_solicitada } = req.body;
    const piloto_id = req.piloto.id;
    
    console.log('📝 Creando solicitud:', { tipo, descripcion, aeronave_solicitada, piloto_id });
    
    if (!tipo || !descripcion) {
      return res.status(400).json({ error: 'Faltan datos', mensaje: 'Todos los campos son obligatorios' });
    }
    
    if (tipo === 'Certificación' && !aeronave_solicitada) {
      return res.status(400).json({ error: 'Debes seleccionar una aeronave para certificar' });
    }
    
    const result = await pool.query(
      `INSERT INTO solicitudes (piloto_id, tipo, descripcion, estado, aeronave_solicitada) 
       VALUES ($1, $2, $3, 'Pendiente', $4) RETURNING id`,
      [piloto_id, tipo, descripcion, aeronave_solicitada || null]
    );
    
    const nuevoId = result.rows[0].id;
    console.log('✅ Solicitud creada con ID:', nuevoId);
    res.json({ success: true, mensaje: 'Solicitud creada', id: nuevoId });
  } catch (error) {
    console.error('Error al crear solicitud:', error);
    res.status(500).json({ error: error.message });
  }
});

// Aprobar/Rechazar/Certificar solicitud
router.put('/:id', verificarToken, esInstructorOAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    console.log('📝 Actualizando solicitud ID:', id, 'a estado:', estado);
    
    if (!estado || !['Aprobada', 'Rechazada', 'Certificada'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    
    // Obtener la solicitud
    const solicitudResult = await pool.query(
      `SELECT s.*, p.nombre_completo as piloto_nombre, p.grado_code as piloto_grado 
       FROM solicitudes s 
       LEFT JOIN pilotos p ON s.piloto_id = p.id 
       WHERE s.id = $1`,
      [id]
    );
    
    if (solicitudResult.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    
    const solicitud = solicitudResult.rows[0];
    
    let aprobada_por = null;
    if (estado === 'Aprobada') {
      aprobada_por = `${req.piloto.grado} - ${req.piloto.nombre}`;
    }
    
    // Actualizar solicitud (NOW() en lugar de datetime('now', 'utc'))
    const updateResult = await pool.query(
      `UPDATE solicitudes 
       SET estado = $1, fecha_respuesta = NOW(), respondida_por = $2, aprobada_por = $3 
       WHERE id = $4`,
      [estado, req.piloto.id, aprobada_por, id]
    );
    
    console.log('Filas afectadas:', updateResult.rowCount);
    
    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: 'No se actualizó ninguna solicitud (ID incorrecto)' });
    }
    
    console.log('✅ Solicitud actualizada a:', estado);
    
    // Enviar webhooks
    if (estado === 'Aprobada' || estado === 'Rechazada') {
      try {
        const solicitudId = getNextSolicitudId();
        await enviarWebhookSolicitud({
          id: solicitudId,
          tipo: solicitud.tipo,
          estado: estado,
          piloto_nombre: solicitud.piloto_nombre,
          piloto_grado: solicitud.piloto_grado,
          fecha: new Date(solicitud.fecha_solicitud).toLocaleDateString(),
          aeronave_solicitada: solicitud.aeronave_solicitada || null,
          descripcion: solicitud.descripcion,
          respondida_por: estado === 'Aprobada' ? `${req.piloto.grado} - ${req.piloto.nombre}` : null
        });
        console.log(`✅ Webhook de solicitud ${estado} enviado`);
      } catch (webhookError) {
        console.error('❌ Error al enviar webhook:', webhookError);
      }
    } else if (estado === 'Certificada') {
      try {
        const { enviarWebhookRegistro, getNextRegistroId } = require('../utils/webhooks');
        const registroId = getNextRegistroId();
        await enviarWebhookRegistro({
          id: registroId,
          cfi_nombre: req.piloto.nombre,
          cfi_grado: req.piloto.grado,
          piloto_nombre: solicitud.piloto_nombre,
          piloto_grado: solicitud.piloto_grado,
          aeronave_id: solicitud.aeronave_solicitada
        });
        console.log('✅ Webhook de registro (certificación) enviado');
      } catch (webhookError) {
        console.error('❌ Error al enviar webhook de registro:', webhookError);
      }
    }
    
    res.json({ success: true, mensaje: `Solicitud ${estado.toLowerCase()}` });
  } catch (error) {
    console.error('Error al actualizar solicitud:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;