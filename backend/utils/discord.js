const fetch = require('node-fetch');

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

async function asignarRolDiscord(userId, roleId) {
    console.log('🎮 asignarRolDiscord llamado:', { userId, roleId });
    
    if (!userId || !roleId) {
        console.log('❌ Faltan userId o roleId');
        return false;
    }
    
    if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
        console.log('❌ Faltan variables de entorno DISCORD_BOT_TOKEN o DISCORD_GUILD_ID');
        return false;
    }
    
    const url = `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}/roles/${roleId}`;
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            console.log(`✅ Rol ${roleId} asignado a usuario ${userId}`);
            return true;
        } else {
            const text = await response.text();
            console.error(`❌ Error ${response.status}: ${text}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Error de red:', error);
        return false;
    }
}

async function removerRolDiscord(userId, roleId) {
    console.log('🎮 removerRolDiscord llamado:', { userId, roleId });
    
    if (!userId || !roleId) return false;
    if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) return false;
    
    const url = `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}/roles/${roleId}`;
    
    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            console.log(`✅ Rol ${roleId} removido de usuario ${userId}`);
            return true;
        } else {
            console.error(`❌ Error ${response.status} al remover rol`);
            return false;
        }
    } catch (error) {
        console.error('❌ Error de red:', error);
        return false;
    }
}

module.exports = { asignarRolDiscord, removerRolDiscord };