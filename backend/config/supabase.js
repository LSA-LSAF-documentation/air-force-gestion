const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Necesario para Supabase
  }
});

// Probar conexión al iniciar
pool.connect()
  .then(() => console.log('✅ Conectado a Supabase PostgreSQL'))
  .catch(err => console.error('❌ Error conectando a Supabase:', err.message));

module.exports = pool;