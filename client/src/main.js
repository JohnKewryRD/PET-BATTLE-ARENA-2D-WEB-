/**
 * PET BATTLE ARENA - Punto de Entrada Principal del Cliente
 * Phaser.js + Socket.IO Client
 */

// Configuración del Juego
const CONFIG = {
    serverUrl: window.location.origin,
    gameWidth: 1920,
    gameHeight: 1080,
    physics: {
        arcade: {
            debug: false
        }
    }
};

// Importar escenas
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';

// Conexión Socket.IO
let socket = null;

// Instancia del juego
let game = null;

// Conectar al servidor
function connectToServer() {
    return new Promise((resolve, reject) => {
        socket = io(CONFIG.serverUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 10
        });

        // Eventos de conexión
        socket.on('connect', () => {
            console.log('[Socket] Conectado al servidor');
            updateConnectionStatus(true);
            resolve(socket);
        });

        socket.on('disconnect', () => {
            console.log('[Socket] Desconectado del servidor');
            updateConnectionStatus(false);
        });

        socket.on('connect_error', (error) => {
            console.error('[Socket] Error de conexión:', error);
            updateConnectionStatus(false);
            reject(error);
        });

        // Eventos del juego
        socket.on('game:init', (state) => {
            console.log('[Juego] Estado inicial recibido', state);
            GameState.sync(state);
        });

        socket.on('game:update', (state) => {
            GameState.sync(state);
            updateUI(state);
        });

        socket.on('pet:added', (pet) => {
            console.log('[Mascota] Añadida:', pet);
            GameState.addPet(pet);
            if (GameScene.instance) {
                GameScene.instance.spawnPet(pet);
            }
        });

        socket.on('pet:removed', (data) => {
            GameState.removePet(data.id);
            if (GameScene.instance) {
                GameScene.instance.removePet(data.id);
            }
        });

        socket.on('wave:spawn', (data) => {
            console.log('[Oleada] Generando:', data);
            if (GameScene.instance) {
                GameScene.instance.spawnWave(data);
            }
        });

        socket.on('megaPet:activate', (data) => {
            console.log('[MegaMascota] Activada por:', data.donorName);
            if (GameScene.instance) {
                GameScene.instance.activateMegaPet(data);
            }
            showMegaPetBanner(data);
        });

        socket.on('megaPet:deactivate', () => {
            if (GameScene.instance) {
                GameScene.instance.deactivateMegaPet();
            }
            hideMegaPetBanner();
        });

        socket.on('pets:upgrade', (data) => {
            console.log('[Mascotas] Todas mejoradas:', data);
            if (GameScene.instance) {
                GameScene.instance.showUpgradeEffect(data);
            }
        });

        socket.on('event:follow', (data) => {
            console.log('[Seguir]', data.username);
            if (GameScene.instance) {
                GameScene.instance.showFloatingText(data.username, data.message, 0xff69b4);
            }
        });

        socket.on('event:chat', (data) => {
            console.log('[Chat]', data.username, ':', data.text);
            if (GameScene.instance) {
                GameScene.instance.showFloatingText(100, 100, `${data.username}: ${data.text}`, 0x00ffff);
            }
        });
    });
}

// Gestión del Estado del Juego
const GameState = {
    pets: new Map(),
    enemies: new Map(),
    wave: 1,
    likesPerMinute: 0,
    totalLikes: 0,
    totalGifts: 0,
    isMegaPetActive: false,
    maxPets: 200,
    tiktokConnected: false,
    tiktokUsername: '',

    sync(state) {
        // Sincronizar mascotas
        const serverPetIds = new Set(state.pets.map(p => p.id));
        
        // Eliminar mascotas que ya no existen
        for (const [id] of this.pets) {
            if (!serverPetIds.has(id)) {
                this.pets.delete(id);
            }
        }

        // Actualizar o añadir mascotas
        for (const petData of state.pets) {
            this.pets.set(petData.id, petData);
        }

        // Sincronizar enemigos
        const serverEnemyIds = new Set(state.enemies.map(e => e.id));
        for (const [id] of this.enemies) {
            if (!serverEnemyIds.has(id)) {
                this.enemies.delete(id);
            }
        }
        for (const enemyData of state.enemies) {
            this.enemies.set(enemyData.id, enemyData);
        }

        // Sincronizar otro estado
        this.wave = state.wave;
        this.likesPerMinute = state.likesPerMinute;
        this.totalLikes = state.totalLikes;
        this.totalGifts = state.totalGifts;
        this.isMegaPetActive = state.isMegaPetActive;
        this.maxPets = state.maxPets;
        this.tiktokConnected = state.tiktokConnected;
        this.tiktokUsername = state.tiktokUsername;
    },

    addPet(pet) {
        this.pets.set(pet.id, pet);
    },

    removePet(id) {
        this.pets.delete(id);
    },

    getPets() {
        return Array.from(this.pets.values());
    },

    getEnemies() {
        return Array.from(this.enemies.values());
    }
};

// Actualizaciones de UI
function updateUI(state) {
    // Actualizar número de oleada
    const waveEl = document.getElementById('wave-number');
    if (waveEl) waveEl.textContent = state.wave;

    // Actualizar contador de mascotas
    const petCountEl = document.getElementById('pet-count');
    if (petCountEl) petCountEl.textContent = state.pets.length;

    // Actualizar contador de enemigos
    const enemyCountEl = document.getElementById('enemy-count');
    if (enemyCountEl) enemyCountEl.textContent = state.enemies.length;

    // Actualizar contador de regalos
    const giftCountEl = document.getElementById('gift-count');
    if (giftCountEl) giftCountEl.textContent = state.totalGifts;

    // Actualizar mascotas activas
    const activePetsEl = document.getElementById('active-pets');
    if (activePetsEl) activePetsEl.textContent = state.pets.length;

    // Actualizar máximo de mascotas
    const maxPetsEl = document.getElementById('max-pets');
    if (maxPetsEl) maxPetsEl.textContent = state.maxPets;

    // Actualizar barra de likes (LPM a porcentaje, máximo 200 LPM = 100%)
    const likesFillEl = document.getElementById('likes-fill');
    if (likesFillEl) {
        const percentage = Math.min((state.likesPerMinute / 200) * 100, 100);
        likesFillEl.style.width = percentage + '%';
    }

    // Actualizar valor LPM
    const lpmEl = document.getElementById('lpm-value');
    if (lpmEl) lpmEl.textContent = state.likesPerMinute;
}

function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        statusEl.className = 'connection-status ' + (connected ? 'connected' : 'disconnected');
        statusEl.textContent = connected ? '⚡ Conectado al servidor' : '⚡ Desconectado';
    }
}

function showMegaPetBanner(data) {
    const banner = document.getElementById('mega-pet-banner');
    const donor = document.getElementById('mega-pet-donor');
    const timer = document.getElementById('mega-pet-timer');
    
    if (banner && donor && timer) {
        donor.textContent = data.donorName;
        banner.classList.add('active');
        
        // Iniciar cuenta regresiva
        let remaining = Math.ceil((data.duration || 30000) / 1000);
        timer.textContent = remaining;
        
        const countdown = setInterval(() => {
            remaining--;
            timer.textContent = remaining;
            if (remaining <= 0) {
                clearInterval(countdown);
            }
        }, 1000);
    }
}

function hideMegaPetBanner() {
    const banner = document.getElementById('mega-pet-banner');
    if (banner) {
        banner.classList.remove('active');
    }
}

// Inicializar juego (llamado desde HTML después de conexión TikTok)
window.initGame = async function() {
    console.log('[Juego] Inicializando PET BATTLE ARENA...');

    try {
        // Conectar al servidor Socket.IO
        await connectToServer();
        console.log('[Socket] Conectado exitosamente');

        // Crear juego Phaser
        game = new Phaser.Game({
            type: Phaser.AUTO,
            width: CONFIG.gameWidth,
            height: CONFIG.gameHeight,
            parent: 'game-container',
            backgroundColor: '#0a0a0f',
            physics: CONFIG.physics,
            scene: [BootScene, GameScene, UIScene],
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH
            }
        });

        console.log('[Juego] Phaser inicializado');
    } catch (error) {
        console.error('[Juego] Error al inicializar:', error);
        alert('Error al conectar con el servidor. Por favor recarga la página.');
    }
};

// Manejar cambio de tamaño de ventana
window.addEventListener('resize', () => {
    if (game) {
        game.scale.refresh();
    }
});

// Auto-inicializar si ya está conectado a TikTok
document.addEventListener('DOMContentLoaded', () => {
    console.log('[App] DOM listo - esperando conexión de TikTok...');
});
