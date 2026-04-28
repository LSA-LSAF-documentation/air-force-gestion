const express = require('express');
const router = express.Router();
const { pool } = require('../config/supabase');
const { verificarToken } = require('./auth');
const { enviarWebhookLibro, getNextLibroId } = require('../utils/webhooks');

// Obtener todos los libros de vuelo
router.get('/', verificarToken, async (req, res) => {
  try {
    //if (req.piloto.rol === 'Piloto') {
    //  return res.status(403).json({ error: 'Acceso denegado' });
    //}
    
    const query = `
      SELECT lv.*, 
             p.nombre_completo as piloto_nombre, 
             p.grado_code as piloto_grado,
             a.modelo as aeronave_modelo, 
             a.tipo as aeronave_tipo,
             r.nombre as grado_nombre
      FROM libros_vuelo lv
      JOIN pilotos p ON lv.piloto_id = p.id
      JOIN aeronaves a ON lv.aeronave_id = a.id
      LEFT JOIN rangos r ON p.grado_code = r.code
      ORDER BY lv.fecha_vuelo DESC, lv.hora_inicio DESC
    `;
    
    const result = await pool.query(query);
    res.json({ libros: result.rows });
  } catch (error) {
    console.error('Error al obtener libros de vuelo:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener libros de vuelo de un piloto específico
router.get('/mis-vuelos', verificarToken, async (req, res) => {
  try {
    const pilotoId = req.piloto.id;
    console.log('📋 Obteniendo mis vuelos para piloto:', pilotoId);
    
    const query = `
      SELECT lv.*, 
             a.modelo as aeronave_modelo, 
             a.tipo as aeronave_tipo
      FROM libros_vuelo lv
      JOIN aeronaves a ON lv.aeronave_id = a.id
      WHERE lv.piloto_id = $1
      ORDER BY lv.fecha_vuelo DESC, lv.hora_inicio DESC
    `;
    
    const result = await pool.query(query, [pilotoId]);
    console.log(`✅ ${result.rows.length} vuelos encontrados`);
    res.json({ misVuelos: result.rows });
  } catch (error) {
    console.error('Error al obtener vuelos del piloto:', error);
    res.status(500).json({ error: error.message });
  }
});

// Crear un nuevo registro de vuelo
router.post('/', verificarToken, async (req, res) => {
  try {
    const { aeronave_id, fecha_vuelo, hora_inicio, hora_fin, tipo_mision, observaciones, observaciones_graficas } = req.body;
    const piloto_id = req.piloto.id;
    const piloto_nombre = req.piloto.nombre;
    const piloto_grado = req.piloto.grado;
    
    if (!aeronave_id || !fecha_vuelo || !hora_inicio || !hora_fin || !tipo_mision) {
      return res.status(400).json({ error: 'Faltan datos', mensaje: 'Todos los campos son obligatorios' });
    }
    
    // Calcular duración correctamente
    const [h1, m1] = hora_inicio.split(':');
    const [h2, m2] = hora_fin.split(':');
    let minutosInicio = parseInt(h1) * 60 + parseInt(m1);
    let minutosFin = parseInt(h2) * 60 + parseInt(m2);
    let duracionMinutos = minutosFin - minutosInicio;
    
    if (duracionMinutos < 0) {
      duracionMinutos += 24 * 60;
    }
    
    const horasDuracion = Math.floor(duracionMinutos / 60);
    const minutosDuracion = duracionMinutos % 60;
    const duracionTexto = `${horasDuracion}h ${minutosDuracion}m`;
    const horasDecimal = duracionMinutos / 60;
    
    const imagenesJson = observaciones_graficas && observaciones_graficas.length > 0 
      ? JSON.stringify(observaciones_graficas) 
      : null;
    
    const result = await pool.query(
      `INSERT INTO libros_vuelo (piloto_id, aeronave_id, fecha_vuelo, hora_inicio, hora_fin, tipo_mision, observaciones, observaciones_graficas, horas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [piloto_id, aeronave_id, fecha_vuelo, hora_inicio, hora_fin, tipo_mision, observaciones || null, imagenesJson, horasDecimal]
    );
    
    const nuevoId = result.rows[0].id;
    
    // Actualizar horas totales del piloto
    await pool.query("UPDATE pilotos SET horas_totales = horas_totales + $1 WHERE id = $2", [horasDecimal, piloto_id]);
    
    // Enviar webhook a Discord
    try {
      const libroId = getNextLibroId();
      await enviarWebhookLibro({
        id: libroId,
        piloto_nombre: piloto_nombre,
        piloto_grado: piloto_grado,
        aeronave_id: aeronave_id,
        hora_inicio: hora_inicio,
        hora_fin: hora_fin,
        duracion: duracionTexto,
        tipo_mision: tipo_mision,
        observaciones: observaciones
      });
    } catch (webhookError) {
      console.error('❌ Error al enviar webhook:', webhookError);
    }
    
    res.json({ 
      success: true, 
      mensaje: 'Registro de vuelo creado exitosamente',
      id: nuevoId
    });
  } catch (error) {
    console.error('Error al crear registro:', error);
    res.status(500).json({ error: error.message });
  }
});

// Eliminar un registro de vuelo (solo Admin)
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    if (req.piloto.rol !== 'Admin') {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores' });
    }
    
    const { id } = req.params;
    await pool.query("DELETE FROM libros_vuelo WHERE id = $1", [id]);
    res.json({ success: true, mensaje: 'Registro eliminado' });
  } catch (error) {
    console.error('Error al eliminar registro:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;