/**
 * Configuración del Juego
 * Configuración central para todos los ajustes del juego
 */

export const GAME_CONFIG = {
    // Dimensiones del juego
    width: 1920,
    height: 1080,

    // Física
    physics: {
        gravity: 800,
        debug: false
    },

    // Tipos de mascotas con estadísticas
    petTypes: {
        gato: {
            name: 'Gato',
            hp: 80,
            damage: 15,
            speed: 12,
            color: 0xFF6B9D,
            emoji: '🐱',
            scale: 1.0,
            attackRange: 80,
            cooldown: 500
        },
        perro: {
            name: 'Perro',
            hp: 120,
            damage: 20,
            speed: 8,
            color: 0xC4A484,
            emoji: '🐕',
            scale: 1.2,
            attackRange: 80,
            cooldown: 600
        },
        dragon: {
            name: 'Dragón',
            hp: 200,
            damage: 40,
            speed: 5,
            color: 0xFF4500,
            emoji: '🐉',
            scale: 1.5,
            attackRange: 150,
            cooldown: 800,
            special: 'fire'
        },
        conejo: {
            name: 'Conejo',
            hp: 50,
            damage: 8,
            speed: 15,
            color: 0xFFFFFF,
            emoji: '🐰',
            scale: 0.8,
            attackRange: 60,
            cooldown: 400
        }
    },

    // Configuraciones de enemigos
    enemy: {
        baseHp: 50,
        baseDamage: 10,
        baseSpeed: 2,
        spawnFromEdges: true
    },

    // Configuración de oleadas
    waves: {
        baseEnemyCount: 3,
        maxEnemiesPerWave: 10,
        spawnDelay: 500,
        waveInterval: 15000,
        difficultyIncreasePerWave: {
            health: 0.15,
            damage: 0.12,
            speed: 0.1
        }
    },

    // Evento de Mega Mascota
    megaPet: {
        triggerGiftValue: 3000,
        duration: 30000,
        attackRadius: 300,
        attackInterval: 300,
        baseDamage: 50
    },

    // Niveles de regalos
    giftTiers: {
        micro: { min: 1, max: 99 },
        minor: { min: 100, max: 499 },
        major: { min: 500, max: 2999 },
        legendary: { min: 3000, max: Infinity }
    },

    // Sistema de likes
    likes: {
        upgradeThreshold: 50,
        maxLpm: 200
    },

    // Combate
    combat: {
        critChance: 0.1,
        critMultiplier: 1.5,
        xpPerLevel: 100
    },

    // Rendimiento
    performance: {
        maxPets: 200,
        maxEnemies: 50,
        maxParticles: 500,
        targetFps: 60
    },

    // Configuración visual
    visuals: {
        enableScreenShake: true,
        enableParticles: true,
        enableDamageNumbers: true,
        enableFloatingText: true
    },

    // Colores
    colors: {
        primary: 0x00ffff,
        secondary: 0xff00ff,
        success: 0x00ff00,
        danger: 0xff0000,
        warning: 0xffff00,
        info: 0x3498db
    }
};

// Congelar config para prevenir modificaciones accidentales
Object.freeze(GAME_CONFIG);
Object.freeze(GAME_CONFIG.petTypes);
Object.freeze(GAME_CONFIG.giftTiers);
Object.freeze(GAME_CONFIG.waves);
