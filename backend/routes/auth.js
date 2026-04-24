const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const pool = require('../config/supabase'); // ✅ Cambiado a Supabase

router.post('/login', async (req, res) => { // ✅ Agregado async
  const { email, password } = req.body;
  
  console.log(`🔐 Intento de login: ${email}`);
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan datos', mensaje: 'Debes enviar email y contraseña' });
  }
  
  try {
    // ✅ Consulta adaptada para PostgreSQL ($1 en lugar de ?)
    const pilotoResult = await pool.query(
      "SELECT id, nombre_completo, grado_code, email, password_hash, rol, foto_url, activo FROM pilotos WHERE email = $1", 
      [email]
    );
    
    const piloto = pilotoResult.rows[0]; // ✅ rows[0] en PostgreSQL, no directo como SQLite
    
    if (!piloto) {
      console.log(`❌ Usuario no encontrado: ${email}`);
      return res.status(401).json({ error: 'Credenciales inválidas', mensaje: 'Email o contraseña incorrectos' });
    }
    
    // Verificar si el usuario está archivado
    if (piloto.activo === 0 || piloto.activo === false) { // ✅ PostgreSQL puede devolver boolean
      console.log(`❌ Usuario archivado: ${email}`);
      return res.status(401).json({ 
        error: 'Usuario archivado', 
        mensaje: 'Su cuenta ha sido desactivada. Contacte con un administrador.' 
      });
    }
    
    console.log(`✅ Usuario encontrado: ${piloto.id} - ${piloto.rol}`);
    
    const passwordValida = bcrypt.compareSync(password, piloto.password_hash);
    
    if (!passwordValida) {
      console.log(`❌ Contraseña incorrecta para: ${email}`);
      return res.status(401).json({ error: 'Credenciales inválidas', mensaje: 'Email o contraseña incorrectos' });
    }
    
    // ✅ Consulta adaptada para PostgreSQL
    const rangoResult = await pool.query(
      "SELECT nombre FROM rangos WHERE code = $1", 
      [piloto.grado_code]
    );
    
    const gradoNombre = rangoResult.rows[0] ? rangoResult.rows[0].nombre : piloto.grado_code;
    
    const token = jwt.sign(
      { 
        id: piloto.id, 
        email: piloto.email, 
        nombre: piloto.nombre_completo,
        grado: gradoNombre,
        grado_code: piloto.grado_code,
        rol: piloto.rol,
        foto_url: piloto.foto_url,
        activo: piloto.activo
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    console.log(`🎉 Login exitoso: ${piloto.id} (${piloto.rol})`);
    
    res.json({
      success: true,
      mensaje: 'Login exitoso',
      token: token,
      piloto: {
        id: piloto.id,
        nombre: piloto.nombre_completo,
        grado: gradoNombre,
        email: piloto.email,
        rol: piloto.rol,
        foto_url: piloto.foto_url || null,
        activo: piloto.activo
      }
    });
    
  } catch (error) {
    console.error('❌ Error en login:', error);
    return res.status(500).json({ error: 'Error interno del servidor', mensaje: error.message });
  }
});

const verificarToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. No hay token' });
  }
  
  try {
    const verificado = jwt.verify(token, process.env.JWT_SECRET);
    req.piloto = verificado;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
};

module.exports = { router, verificarToken };