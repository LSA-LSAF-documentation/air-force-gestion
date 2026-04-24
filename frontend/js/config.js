// ============================================
// CONFIGURACIÓN DE LA ORGANIZACIÓN
// ============================================

const ORG_CONFIG = {
    // Nombre de la organización
    nombre: "LSAF Air Force",
    nombreCorto: "LSAF",
    
    // URLs de los logos (usar rutas locales o URLs externas)
    logos: {
        principal: "img/lsaf.png",           // Logo principal de la sidebar
        secundario1: "img/airforce.png",     // Logo secundario 1
        secundario2: "img/aetc.png",         // Logo secundario 2
        fallback1: "https://i.imgur.com/FeE9uvO.png",
        fallback2: "https://i.imgur.com/GfmYqNX.png",
        fallback3: "https://i.imgur.com/wioFUxA.png"
    },
    
    // Títulos y textos
    textos: {
        sistema: "Sistema de Gestión de Vuelos",
        footer: "Sistema de Gestión de Vuelos",
        loginTitulo: "Sistema de Gestión de Vuelos",
        loginSubtitulo: "Acceso al sistema"
    },
    
    // Colores principales (opcional, para futuras personalizaciones)
    colores: {
        primario: "#1a2a4f",
        secundario: "#4a7db5",
        acento: "#8b9dc3"
    }
};

// Para usar en el navegador
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ORG_CONFIG;
}