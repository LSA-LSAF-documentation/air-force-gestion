const express = require('express');
const router = express.Router();
const { pool } = require('../config/supabase');
const { verificarToken } = require('./auth');

// Obtener todos los pilotos activos
router.get('/', verificarToken, async (req, res) => {
  try {
    const query = `
      SELECT p.id, p.nombre_completo, p.grado_code, p.email, p.tipo_sangre, 
             p.nacionalidad, p.foto_url, p.created_at, p.activo,
             r.nombre as grado_nombre, r.orden as grado_orden
      FROM pilotos p
      LEFT JOIN rangos r ON p.grado_code = r.code
      WHERE p.activo = 1 OR p.activo IS NULL
      ORDER BY r.orden DESC, p.nombre_completo ASC
    `;
    
    const result = await pool.query(query);
    res.json({ pilotos: result.rows || [] });
  } catch (error) {
    console.error('Error al obtener pilotos:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Obtener un piloto específico por ID
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (req.piloto.id !== id && req.piloto.rol === 'Piloto') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const query = `
      SELECT p.id, p.nombre_completo, p.grado_code, p.email, p.tipo_sangre, 
             p.nacionalidad, p.foto_url, p.created_at, p.rol, p.activo,
             r.nombre as grado_nombre
      FROM pilotos p
      LEFT JOIN rangos r ON p.grado_code = r.code
      WHERE p.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Piloto no encontrado' });
    }
    
    res.json({ piloto: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener piloto:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Obtener horas de vuelo del piloto por aeronave
router.get('/:id/horas-vuelo', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.piloto.id;
    const usuarioRol = req.piloto.rol;
    
    if (usuarioRol === 'Piloto' && usuarioId !== id) {
    return res.status(403).json({ error: 'Acceso denegado' });
}
    
    // Nota: PostgreSQL usa EXTRACT(EPOCH FROM ...) en lugar de strftime
    const query = `
      SELECT a.id as aeronave_id, a.modelo, a.tipo,
             ROUND(SUM(
               EXTRACT(EPOCH FROM (lv.hora_fin::time - lv.hora_inicio::time)) / 3600.0
             ), 1) as horas_totales,
             COUNT(lv.id) as numero_vuelos,
             MAX(lv.fecha_vuelo) as ultimo_vuelo
      FROM libros_vuelo lv
      JOIN aeronaves a ON lv.aeronave_id = a.id
      WHERE lv.piloto_id = $1
      GROUP BY a.id, a.modelo, a.tipo
      ORDER BY ultimo_vuelo DESC
    `;
    
    const result = await pool.query(query, [id]);
    res.json({ horas: result.rows || [] });
  } catch (error) {
    console.error('Error al obtener horas de vuelo:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Obtener historial de ascensos de un piloto
router.get('/:id/historial-ascensos', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT h.*, p.nombre_completo as realizado_por_nombre 
       FROM historial_ascensos h
       LEFT JOIN pilotos p ON h.realizado_por = p.id
       WHERE h.piloto_id = $1 
       ORDER BY h.fecha DESC`,
      [id]
    );
    
    res.json({ historial: result.rows });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
