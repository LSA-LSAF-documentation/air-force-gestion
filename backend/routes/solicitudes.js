const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verificarToken } = require('./auth');
const { enviarWebhookSolicitud, getNextSolicitudId } = require('../utils/webhooks');

// Verificar si el usuario es Instructor o Admin
function esInstructorOAdmin(req, res, next) {
  console.log('🔐 Verificando rol - Usuario:', req.piloto.id, 'Rol:', req.piloto.rol);
  // Permitir a Instructores, Admin y Supervisor
  if (req.piloto.rol === 'Piloto') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol Instructor, Supervisor o Admin' });
  }
  next();
}

// Obtener todas las solicitudes (Instructores, Supervisores y Admin pueden ver todas)
router.get('/', verificarToken, (req, res) => {
  // Pilotos solo pueden ver sus propias solicitudes
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
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error al obtener solicitudes:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    console.log(`✅ ${rows.length} solicitudes encontradas`);
    res.json({ solicitudes: rows });
  });
});

// Obtener mis solicitudes (todos pueden)
router.get('/mis-solicitudes', verificarToken, (req, res) => {
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
    WHERE s.piloto_id = ?
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
  
  db.all(query, [pilotoId], (err, rows) => {
    if (err) {
      console.error('Error al obtener mis solicitudes:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ misSolicitudes: rows });
  });
});

// Crear una nueva solicitud (todos pueden)
router.post('/', verificarToken, (req, res) => {
  const { tipo, descripcion, aeronave_solicitada } = req.body;
  const piloto_id = req.piloto.id;
  
  console.log('📝 Creando solicitud:', { tipo, descripcion, aeronave_solicitada, piloto_id });
  
  if (!tipo || !descripcion) {
    return res.status(400).json({ error: 'Faltan datos', mensaje: 'Todos los campos son obligatorios' });
  }
  
  if (tipo === 'Certificación' && !aeronave_solicitada) {
    return res.status(400).json({ error: 'Debes seleccionar una aeronave para certificar' });
  }
  
  const query = `INSERT INTO solicitudes (piloto_id, tipo, descripcion, estado, aeronave_solicitada) 
                 VALUES (?, ?, ?, 'Pendiente', ?)`;
  
  db.run(query, [piloto_id, tipo, descripcion, aeronave_solicitada || null], function(err) {
    if (err) {
      console.error('Error al crear solicitud:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    console.log('✅ Solicitud creada con ID:', this.lastID);
    res.json({ success: true, mensaje: 'Solicitud creada', id: this.lastID });
  });
});

// Aprobar/Rechazar/Certificar solicitud
router.put('/:id', verificarToken, esInstructorOAdmin, (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  
  console.log('📝 Actualizando solicitud ID:', id, 'a estado:', estado);
  
  if (!estado || !['Aprobada', 'Rechazada', 'Certificada'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  
  db.get("SELECT s.*, p.nombre_completo as piloto_nombre, p.grado_code as piloto_grado FROM solicitudes s LEFT JOIN pilotos p ON s.piloto_id = p.id WHERE s.id = ?", [id], (err, solicitud) => {
    if (err) {
      console.error('Error al obtener solicitud:', err);
      return res.status(500).json({ error: err.message });
    }
    
    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    
    let aprobada_por = null;
    if (estado === 'Aprobada') {
      aprobada_por = `${req.piloto.grado} - ${req.piloto.nombre}`;
    }
    
    const query = `UPDATE solicitudes SET estado = ?, fecha_respuesta = datetime('now', 'utc'), respondida_por = ?, aprobada_por = ? WHERE id = ?`;
    
    db.run(query, [estado, req.piloto.id, aprobada_por, id], function(err) {
      if (err) {
        console.error('Error al actualizar solicitud:', err);
        return res.status(500).json({ error: err.message });
      }
      
      console.log('Filas afectadas:', this.changes);
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'No se actualizó ninguna solicitud (ID incorrecto)' });
      }
      
      console.log('✅ Solicitud actualizada a:', estado);
      
      if (estado === 'Aprobada' || estado === 'Rechazada') {
        const solicitudId = getNextSolicitudId();
        enviarWebhookSolicitud({
          id: solicitudId,
          tipo: solicitud.tipo,
          estado: estado,
          piloto_nombre: solicitud.piloto_nombre,
          piloto_grado: solicitud.piloto_grado,
          fecha: new Date(solicitud.fecha_solicitud).toLocaleDateString(),
          aeronave_solicitada: solicitud.aeronave_solicitada || null,
          descripcion: solicitud.descripcion,
          respondida_por: estado === 'Aprobada' ? `${req.piloto.grado} - ${req.piloto.nombre}` : null
        }).then(() => {
          console.log(`✅ Webhook de solicitud ${estado} enviado`);
        }).catch((webhookError) => {
          console.error('❌ Error al enviar webhook:', webhookError);
        });
      } else if (estado === 'Certificada') {
        const { enviarWebhookRegistro, getNextRegistroId } = require('../utils/webhooks');
        const registroId = getNextRegistroId();
        enviarWebhookRegistro({
          id: registroId,
          cfi_nombre: req.piloto.nombre,
          cfi_grado: req.piloto.grado,
          piloto_nombre: solicitud.piloto_nombre,
          piloto_grado: solicitud.piloto_grado,
          aeronave_id: solicitud.aeronave_solicitada
        }).then(() => {
          console.log(`✅ Webhook de registro (certificación) enviado`);
        }).catch((webhookError) => {
          console.error('❌ Error al enviar webhook de registro:', webhookError);
        });
      }
      
      res.json({ success: true, mensaje: `Solicitud ${estado.toLowerCase()}` });
    });
  });
});

module.exports = router;