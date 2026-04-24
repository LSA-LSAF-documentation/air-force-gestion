const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verificarToken } = require('./auth');

// Obtener todos los pilotos activos
router.get('/', verificarToken, (req, res) => {
  if (req.piloto.rol === 'Piloto') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  
  const query = `
    SELECT p.id, p.nombre_completo, p.grado_code, p.email, p.tipo_sangre, 
           p.nacionalidad, p.foto_url, p.created_at, p.activo,
           r.nombre as grado_nombre, r.orden as grado_orden
    FROM pilotos p
    LEFT JOIN rangos r ON p.grado_code = r.code
    WHERE p.activo = 1 OR p.activo IS NULL
    ORDER BY r.orden DESC, p.nombre_completo ASC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error al obtener pilotos:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ pilotos: rows || [] });
  });
});

// Obtener un piloto específico por ID (cualquier usuario autenticado puede ver su propio perfil)
router.get('/:id', verificarToken, (req, res) => {
  const { id } = req.params;
  
  // Solo puede ver su propio perfil (o Admin/Supervisor/Instructor puede ver cualquier)
  if (req.piloto.id !== id && req.piloto.rol === 'Piloto') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  
  const query = `
    SELECT p.id, p.nombre_completo, p.grado_code, p.email, p.tipo_sangre, 
           p.nacionalidad, p.foto_url, p.created_at, p.rol, p.activo,
           r.nombre as grado_nombre
    FROM pilotos p
    LEFT JOIN rangos r ON p.grado_code = r.code
    WHERE p.id = ?
  `;
  
  db.get(query, [id], (err, row) => {
    if (err) {
      console.error('Error al obtener piloto:', err.message);
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

// Obtener horas de vuelo del piloto por aeronave (ordenado por fecha de último vuelo)
router.get('/:id/horas-vuelo', verificarToken, (req, res) => {
  const { id } = req.params;
  const usuarioId = req.piloto.id;
  const usuarioRol = req.piloto.rol;
  
  if (usuarioId !== id && usuarioRol === 'Piloto') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  
  const query = `
    SELECT a.id as aeronave_id, a.modelo, a.tipo,
           ROUND(SUM(
             (strftime('%s', lv.hora_fin) - strftime('%s', lv.hora_inicio)) / 3600.0
           ), 1) as horas_totales,
           COUNT(lv.id) as numero_vuelos,
           MAX(lv.fecha_vuelo) as ultimo_vuelo
    FROM libros_vuelo lv
    JOIN aeronaves a ON lv.aeronave_id = a.id
    WHERE lv.piloto_id = ?
    GROUP BY a.id, a.modelo, a.tipo
    ORDER BY ultimo_vuelo DESC
  `;
  
  db.all(query, [id], (err, rows) => {
    if (err) {
      console.error('Error al obtener horas de vuelo:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ horas: rows || [] });
  });
});

// Obtener historial de ascensos de un piloto
router.get('/:id/historial-ascensos', verificarToken, (req, res) => {
  const { id } = req.params;
  
  db.all(`SELECT h.*, p.nombre_completo as realizado_por_nombre 
          FROM historial_ascensos h
          LEFT JOIN pilotos p ON h.realizado_por = p.id
          WHERE h.piloto_id = ? 
          ORDER BY h.fecha DESC`, [id], (err, rows) => {
    if (err) {
      console.error('Error al obtener historial:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ historial: rows });
  });
});

module.exports = router;