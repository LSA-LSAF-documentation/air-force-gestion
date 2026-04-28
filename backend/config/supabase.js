const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

// Conexión a PostgreSQL (base de datos)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Conexión a Supabase Storage (imágenes)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

pool.connect()
  .then(() => console.log('✅ Conectado a Supabase PostgreSQL'))
  .catch(err => console.error('❌ Error conectando a Supabase:', err.message));

module.exports = { pool, supabase };