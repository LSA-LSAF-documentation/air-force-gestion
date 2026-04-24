const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const db = new sqlite3.Database('database/airforce.db');

const tablas = ['rangos', 'pilotos', 'aeronaves', 'libros_vuelo', 'solicitudes', 'certificaciones', 'historial_ascensos'];

let sqlOutput = '';

function exportarTabla(nombre, callback) {
  db.all(`SELECT * FROM ${nombre}`, (err, rows) => {
    if (err) {
      console.error(`Error en ${nombre}:`, err);
      callback();
      return;
    }
    
    if (rows.length === 0) {
      console.log(`⚠️ Tabla ${nombre} vacía`);
      callback();
      return;
    }
    
    // Obtener columnas
    const columnas = Object.keys(rows[0]);
    const columnasStr = columnas.map(c => `"${c}"`).join(',');
    
    sqlOutput += `\n-- Datos de ${nombre}\n`;
    sqlOutput += `INSERT INTO "${nombre}" (${columnasStr}) VALUES\n`;
    
    const values = rows.map(row => {
      const vals = columnas.map(col => {
        let val = row[col];
        if (val === null) return 'NULL';
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
        if (typeof val === 'number') return val;
        if (val instanceof Date) return `'${val.toISOString()}'`;
        return `'${val}'`;
      });
      return `(${vals.join(',')})`;
    }).join(',\n');
    
    sqlOutput += values + ';\n';
    console.log(`✅ Tabla ${nombre}: ${rows.length} registros`);
    callback();
  });
}

function exportarTodas(index) {
  if (index >= tablas.length) {
    fs.writeFileSync('backup.sql', sqlOutput);
    console.log('\n✅ Exportación completada a backup.sql');
    db.close();
    return;
  }
  exportarTabla(tablas[index], () => exportarTodas(index + 1));
}

exportarTodas(0);