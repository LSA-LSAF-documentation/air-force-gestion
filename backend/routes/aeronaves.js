const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verificarToken } = require('./auth');

// Obtener todas las aeronaves (todos los autenticados pueden ver)
router.get('/', verificarToken, (req, res) => {
  const query = "SELECT * FROM aeronaves ORDER BY id";
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error al obtener aeronaves:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ aeronaves: rows });
  });
});

module.exports = router;