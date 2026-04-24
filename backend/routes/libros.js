const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verificarToken } = require('./auth');
const { enviarWebhookLibro, getNextLibroId } = require('../utils/webhooks');

// Obtener todos los libros de vuelo
router.get('/', verificarToken, (req, res) => {
  // Instructores, Supervisores y Admin pueden ver todos los vuelos
  if (req.piloto.rol === 'Piloto') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  
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
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error al obtener libros de vuelo:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ libros: rows });
  });
});

// Obtener libros de vuelo de un piloto específico (todos pueden ver sus propios vuelos)
router.get('/mis-vuelos', verificarToken, (req, res) => {
  const pilotoId = req.piloto.id;
  
  console.log('📋 Obteniendo mis vuelos para piloto:', pilotoId);
  
  const query = `
    SELECT lv.*, 
           a.modelo as aeronave_modelo, 
           a.tipo as aeronave_tipo
    FROM libros_vuelo lv
    JOIN aeronaves a ON lv.aeronave_id = a.id
    WHERE lv.piloto_id = ?
    ORDER BY lv.fecha_vuelo DESC, lv.hora_inicio DESC
  `;
  
  db.all(query, [pilotoId], (err, rows) => {
    if (err) {
      console.error('Error al obtener vuelos del piloto:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    console.log(`✅ ${rows.length} vuelos encontrados`);
    res.json({ misVuelos: rows });
  });
});

// Crear un nuevo registro de vuelo
router.post('/', verificarToken, (req, res) => {
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
  
  const query = `
    INSERT INTO libros_vuelo (piloto_id, aeronave_id, fecha_vuelo, hora_inicio, hora_fin, tipo_mision, observaciones, observaciones_graficas, horas)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.run(query, [piloto_id, aeronave_id, fecha_vuelo, hora_inicio, hora_fin, tipo_mision, observaciones || null, imagenesJson, horasDecimal], 
    async function(err) {
      if (err) {
        console.error('Error al crear registro:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      db.run("UPDATE pilotos SET horas_totales = horas_totales + ? WHERE id = ?", [horasDecimal, piloto_id]);
      
      // Enviar webhook a Discord
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
      
      res.json({ 
        success: true, 
        mensaje: 'Registro de vuelo creado exitosamente',
        id: this.lastID 
      });
    }
  );
});

// Eliminar un registro de vuelo (solo Admin)
router.delete('/:id', verificarToken, (req, res) => {
  if (req.piloto.rol !== 'Admin') {
    return res.status(403).json({ error: 'Acceso denegado. Solo administradores' });
  }
  
  const { id } = req.params;
  
  db.run("DELETE FROM libros_vuelo WHERE id = ?", [id], function(err) {
    if (err) {
      console.error('Error al eliminar registro:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, mensaje: 'Registro eliminado' });
  });
});

module.exports = router;