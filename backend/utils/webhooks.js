// Webhooks
const WEBHOOKS = {
  LIBROS: 'https://discord.com/api/webhooks/1490488273070461009/aOBMnkVikBEHA4NX34paor0cWxp1yHv8_e87ajmvocMowNDMMp5rvzai_EK4KqR2b6gb',
  SOLICITUDES: 'https://discord.com/api/webhooks/1490490096950972501/rvbHQz7eent_wL0eLwFX85YcahHV8n6OuhS1W8OJcDFcgjgZQecRDYL0TeWdEMwx7E9d',
  REGISTROS: 'https://discord.com/api/webhooks/1490491884458475812/KWgsdmhGyuF7T_b-L8WHAdGU_ZQmcgWtl5_GX_gerOAy6zQ5qWdqPKjitCQKWZfYZIr6',
  ASCENSOS: 'https://discord.com/api/webhooks/1494546419070009444/q1zYCL8Hl0tMhHEzFv6-E0p0GPx77nbgdMaK_yCCitWnhincQbSe9Yd1n7mw2a6cgUWA'
};

// Imagen de la Air Force
const AIRFORCE_IMAGE = 'https://i.imgur.com/GfmYqNX.png';

// Contadores para IDs incrementales
let contadorLibros = 0;
let contadorSolicitudes = 0;
let contadorRegistros = 0;

// Función para obtener próximo ID de libro
function getNextLibroId() {
  contadorLibros++;
  return `AF-${String(contadorLibros).padStart(5, '0')}`;
}

// Función para obtener próximo ID de solicitud
function getNextSolicitudId() {
  contadorSolicitudes++;
  return `AETC-${String(contadorSolicitudes).padStart(5, '0')}`;
}

// Función para obtener próximo ID de registro
function getNextRegistroId() {
  contadorRegistros++;
  return `REG-${String(contadorRegistros).padStart(5, '0')}`;
}

// Enviar webhook de LIBRO DE VUELO
async function enviarWebhookLibro(datos) {
  const { id, piloto_nombre, piloto_grado, aeronave_id, hora_inicio, hora_fin, duracion, tipo_mision, observaciones } = datos;
  
  const ahora = new Date();
  const fechaUTC = ahora.toUTCString();
  
  const embed = {
    title: '📘 NUEVO REGISTRO DE VUELO',
    color: 0x00aaff,
    fields: [
      { name: '📖 LIBRO', value: `\`${id}\``, inline: true },
      { name: '👨‍✈️ PILOTO', value: `${piloto_grado} - ${piloto_nombre}`, inline: true },
      { name: '✈️ A/C', value: aeronave_id, inline: true },
      { name: '🛫 DEP', value: hora_inicio, inline: true },
      { name: '🛬 ARR', value: hora_fin, inline: true },
      { name: '⏱️ TOF', value: duracion, inline: true },
      { name: '🎯 MOTIVO', value: tipo_mision, inline: true },
      { name: '📝 RMK', value: observaciones || 'N/A', inline: false },
      { name: '🕐 Fecha', value: fechaUTC, inline: false }
    ],
    footer: { text: 'AIR TRAFFIC CONTROL', icon_url: AIRFORCE_IMAGE }
  };

  const body = {
    username: 'AIR TRAFFIC CONTROL',
    avatar_url: AIRFORCE_IMAGE,
    embeds: [embed]
  };

  try {
    const response = await fetch(WEBHOOKS.LIBROS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    console.log('✅ Webhook de libro enviado:', id, response.status);
  } catch (error) {
    console.error('❌ Error al enviar webhook de libro:', error);
  }
}

// Enviar webhook de SOLICITUD (Aprobada, Rechazada o Certificada)
async function enviarWebhookSolicitud(datos) {
  const { id, tipo, estado, piloto_nombre, piloto_grado, fecha, aeronave_solicitada, descripcion, respondida_por } = datos;
  
  const ahora = new Date();
  const fechaUTC = ahora.toUTCString();
  
  let titulo = '';
  let color = 0;

  if (estado === 'Aprobada') {
    titulo = '📨 SOLICITUD APROBADA';
    color = 0x00ff88;
  } else if (estado === 'Rechazada') {
    titulo = '❌ SOLICITUD RECHAZADA';
    color = 0xff4444;
  } else if (estado === 'Certificada') {
    titulo = '🎓 SOLICITUD CERTIFICADA';
    color = 0x00aaff;
  }
  
  const fields = [
    { name: '📋 SOLICITUD', value: `\`${id}\``, inline: true },
    { name: '📌 TIPO DE SOLICITUD', value: tipo, inline: true },
    { name: '👤 PAL', value: `${piloto_grado} - ${piloto_nombre}`, inline: true },
    { name: '⭐ RANGO', value: piloto_grado, inline: true },
    { name: '📅 FECHA', value: fecha, inline: true },
    { name: '👨‍✈️ RESPONDIDA POR', value: respondida_por, inline: true },
    { name: '🕐 Fecha', value: fechaUTC, inline: false }
  ];
  
  if (aeronave_solicitada) {
    fields.push({ name: '✈️ A/C', value: aeronave_solicitada, inline: true });
  }
  
  fields.push({ name: '📝 OBSERVACIONES', value: descripcion || 'N/A', inline: false });
  
  const embed = {
    title: titulo,
    color: color,
    fields: fields,
    footer: { text: 'SOLICITUDES AIR FORCE', icon_url: AIRFORCE_IMAGE }
  };

  const body = {
    username: 'SOLICITUDES AIR FORCE',
    avatar_url: AIRFORCE_IMAGE,
    embeds: [embed]
  };

  try {
    const response = await fetch(WEBHOOKS.SOLICITUDES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    console.log('✅ Webhook de solicitud enviado:', id, response.status);
  } catch (error) {
    console.error('❌ Error al enviar webhook de solicitud:', error);
  }
}

// Enviar webhook de REGISTRO (certificación)
async function enviarWebhookRegistro(datos) {
  const { id, cfi_nombre, cfi_grado, piloto_nombre, piloto_grado, aeronave_id } = datos;
  
  const ahora = new Date();
  const fechaUTC = ahora.toUTCString();
  
  const embed = {
    title: '✅ NUEVA CERTIFICACIÓN REGISTRADA',
    color: 0x00ff88,
    fields: [
      { name: '📋 REG', value: `\`${id}\``, inline: true },
      { name: '👨‍✈️ CFI', value: `${cfi_grado} - ${cfi_nombre}`, inline: true },
      { name: '👤 PAL', value: `${piloto_grado} - ${piloto_nombre}`, inline: true },
      { name: '✈️ A/C', value: aeronave_id, inline: true },
      { name: '🕐 Fecha', value: fechaUTC, inline: false }
    ],
    footer: { text: 'REGISTROS AIR FORCE', icon_url: AIRFORCE_IMAGE }
  };

  const body = {
    username: 'REGISTROS AIR FORCE',
    avatar_url: AIRFORCE_IMAGE,
    embeds: [embed]
  };

  try {
    const response = await fetch(WEBHOOKS.REGISTROS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    console.log('✅ Webhook de registro enviado:', id, response.status);
  } catch (error) {
    console.error('❌ Error al enviar webhook de registro:', error);
  }
}

module.exports = {
  enviarWebhookLibro,
  enviarWebhookSolicitud,
  enviarWebhookRegistro,
  enviarWebhookAscenso,
  getNextLibroId,
  getNextSolicitudId,
  getNextRegistroId
};

// Enviar webhook de ASCENSO/DESCENSO
async function enviarWebhookAscenso(datos) {
  const { tipo, piloto_nombre, piloto_grado, grado_anterior, grado_nuevo, motivo, realizado_por } = datos;
  
  const esAscenso = tipo === 'ascenso';
  const titulo = esAscenso ? '⬆️ ASCENSO DE RANGO' : '⬇️ DESCENSO DE RANGO';
  const color = esAscenso ? 0x00ff88 : 0xff4444;
  const emoji = esAscenso ? '🎉' : '⚠️';
  
  // Fecha en UTC explícita
  const ahora = new Date();
  const fechaUTC = ahora.toUTCString();
  
  const embed = {
    title: `${emoji} ${titulo}`,
    color: color,
    fields: [
      { name: '👤 Piloto', value: `${piloto_grado} - ${piloto_nombre}`, inline: true },
      { name: '📊 Rango Anterior', value: grado_anterior, inline: true },
      { name: '📈 Rango Nuevo', value: grado_nuevo, inline: true },
      { name: '👨‍✈️ Realizado por', value: realizado_por, inline: true },
      { name: '📝 Motivo', value: motivo || 'No especificado', inline: false },
      { name: '🕐 Fecha', value: fechaUTC, inline: false }
    ],
    footer: { text: 'Registros LSAF', icon_url: AIRFORCE_IMAGE }
  };

  const body = {
    username: 'Registros LSAF',
    avatar_url: AIRFORCE_IMAGE,
    embeds: [embed]
  };

  try {
    const response = await fetch(WEBHOOKS.ASCENSOS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    console.log(`✅ Webhook de ${tipo} enviado:`, response.status);
  } catch (error) {
    console.error('❌ Error al enviar webhook de ascenso:', error);
  }
}