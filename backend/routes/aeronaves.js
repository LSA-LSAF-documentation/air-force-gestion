const express = require('express');
const router = express.Router();
const { pool } = require('../config/supabase');
const { verificarToken } = require('./auth');

// Obtener todas las aeronaves (todos los autenticados pueden ver)
router.get('/', verificarToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM aeronaves ORDER BY id");
    res.json({ aeronaves: result.rows });
  } catch (error) {
    console.error('Error al obtener aeronaves:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;