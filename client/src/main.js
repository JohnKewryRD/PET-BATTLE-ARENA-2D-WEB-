/**
 * PET BATTLE ARENA - Punto de Entrada Principal del Cliente
 * Phaser 4 + PixiJS + Socket.IO Client
 */

import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';

const PhaserRuntime = window.Phaser;
const PixiRuntime = window.PIXI;

if (!PixiRuntime || !PixiRuntime.VERSION) {
    console.warn('[Cliente] PIXI no esta disponible; revisa la carga de CDN.');
} else {
    console.log(`[Cliente] PIXI ${PixiRuntime.VERSION} cargado`);
}

if (!PhaserRuntime || typeof PhaserRuntime.Game !== 'function') {
    throw new Error('Phaser no esta disponible. Verifica el script de Phaser 4 en index.html');
}

const CONFIG = {
    serverUrl: window.location.origin,
    gameWidth: 1920,
    gameHeight: 1080,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    }
};

let socket = null;
let game = null;
let demoPetInterval = null;
let demoLikesInterval = null;
let demoGiftInterval = null;
let megaPetCountdownInterval = null;
let isSimulationOwner = false;
let leaderboardViewMode = localStorage.getItem('petArena:leaderboardMode') || 'daily';
window.isSimulationOwner = false;

const GameState = {
    pets: new Map(),
    enemies: new Map(),
    wave: 1,
    likesPerMinute: 0,
    totalLikes: 0,
    totalGifts: 0,
    isMegaPetActive: false,
    maxPets: 200,
    leaderboard: { historical: [], daily: [], dateKey: '' },
    tiktokConnected: false,
    tiktokUsername: '',

    sync(state) {
        if (Array.isArray(state.pets)) {
            const serverPetIds = new Set(state.pets.map((p) => p.id));
            for (const [id] of this.pets) {
                if (!serverPetIds.has(id)) {
                    this.pets.delete(id);
                }
            }
            for (const petData of state.pets) {
                this.pets.set(petData.id, petData);
            }
        }

        if (typeof state.wave === 'number') this.wave = state.wave;
        if (typeof state.likesPerMinute === 'number') this.likesPerMinute = state.likesPerMinute;
        if (typeof state.totalLikes === 'number') this.totalLikes = state.totalLikes;
        if (typeof state.totalGifts === 'number') this.totalGifts = state.totalGifts;
        if (typeof state.isMegaPetActive === 'boolean') this.isMegaPetActive = state.isMegaPetActive;
        if (typeof state.maxPets === 'number') this.maxPets = state.maxPets;
        if (state.leaderboard && typeof state.leaderboard === 'object') {
            this.leaderboard = {
                historical: Array.isArray(state.leaderboard.historical) ? state.leaderboard.historical : [],
                daily: Array.isArray(state.leaderboard.daily) ? state.leaderboard.daily : [],
                dateKey: state.leaderboard.dateKey || ''
            };
        }
        if (typeof state.tiktokConnected === 'boolean') this.tiktokConnected = state.tiktokConnected;
        if (typeof state.tiktokUsername === 'string' || state.tiktokUsername === null) {
            this.tiktokUsername = state.tiktokUsername || '';
        }

        if (Array.isArray(state.enemies)) {
            const serverEnemyIds = new Set(state.enemies.map((e) => e.id));
            for (const [id] of this.enemies) {
                if (!serverEnemyIds.has(id)) {
                    this.enemies.delete(id);
                }
            }
            for (const enemyData of state.enemies) {
                const previous = this.enemies.get(enemyData.id) || {};
                this.enemies.set(enemyData.id, {
                    ...previous,
                    ...enemyData
                });
            }
        }
    },

    addPet(pet) {
        this.pets.set(pet.id, pet);
    },

    upsertPet(pet) {
        const previous = this.pets.get(pet.id) || {};
        this.pets.set(pet.id, { ...previous, ...pet });
    },

    removePet(id) {
        this.pets.delete(id);
    },

    upsertEnemy(enemy) {
        const previous = this.enemies.get(enemy.id) || {};
        this.enemies.set(enemy.id, { ...previous, ...enemy });
    },

    removeEnemy(id) {
        this.enemies.delete(id);
    }
};

function getReadyGameScene() {
    const scene = GameScene.instance;
    if (!scene || !scene.isReady) return null;
    return scene;
}

function connectToServer() {
    return new Promise((resolve, reject) => {
        let settled = false;

        socket = io(CONFIG.serverUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 10
        });

        socket.on('connect', () => {
            window.socket = socket;
            isSimulationOwner = false;
            window.isSimulationOwner = false;
            updateConnectionStatus(true);
            const desiredRoomId = window.petArenaRoomId || window.tiktokUsername || 'demo_room';
            socket.emit('room:join', { roomId: desiredRoomId }, (resp) => {
                if (resp?.ok && resp.roomId) {
                    window.petArenaRoomId = resp.roomId;
                    localStorage.setItem('petArena:roomId', resp.roomId);
                }

                if (!settled) {
                    settled = true;
                    resolve(socket);
                }
            });
        });

        socket.on('disconnect', () => {
            isSimulationOwner = false;
            window.isSimulationOwner = false;
            updateConnectionStatus(false);
        });

        socket.on('connect_error', (error) => {
            updateConnectionStatus(false);
            if (!settled) {
                settled = true;
                reject(error);
            }
        });

        socket.on('game:init', (state) => {
            GameState.sync(state);
            syncSceneWithState();
            updateUI(state);
            updateLeaderboardUI(GameState.leaderboard);
        });

        socket.on('game:update', (state) => {
            GameState.sync(state);
            if (Array.isArray(state.pets) || Array.isArray(state.enemies)) {
                syncSceneWithState();
            }
            updateUI(state);
        });

        socket.on('leaderboard:init', (payload) => {
            GameState.sync({ leaderboard: payload });
            updateLeaderboardUI(GameState.leaderboard);
        });

        socket.on('leaderboard:update', (payload) => {
            GameState.sync({ leaderboard: payload });
            updateLeaderboardUI(GameState.leaderboard);
        });

        socket.on('pet:added', (pet) => {
            GameState.addPet(pet);
            const scene = getReadyGameScene();
            if (scene) {
                scene.spawnPet(pet);
            }
        });

        socket.on('pet:removed', (data) => {
            GameState.removePet(data.id);
            const scene = getReadyGameScene();
            if (scene) {
                scene.removePet(data.id);
            }
        });

        socket.on('pet:updated', (petData) => {
            GameState.upsertPet(petData);
            const scene = getReadyGameScene();
            if (scene) {
                scene.updatePetState(petData);
            }
        });

        socket.on('wave:spawn', (data) => {
            const scene = getReadyGameScene();
            if (scene) {
                scene.spawnWave(data);
            }
        });

        socket.on('enemy:spawned', (enemy) => {
            GameState.upsertEnemy(enemy);
            const scene = getReadyGameScene();
            if (scene) {
                scene.spawnEnemy(enemy);
            }
        });

        socket.on('enemy:updated', (enemy) => {
            GameState.upsertEnemy(enemy);
            const scene = getReadyGameScene();
            if (scene) {
                scene.updateEnemyState(enemy);
            }
        });

        socket.on('enemy:removed', (payload) => {
            GameState.removeEnemy(payload.id);
            const scene = getReadyGameScene();
            if (scene) {
                scene.removeEnemy(payload.id);
            }
        });

        socket.on('simulation:role', (data) => {
            isSimulationOwner = Boolean(data?.isOwner);
            window.isSimulationOwner = isSimulationOwner;
        });

        socket.on('simulation:owner', (data) => {
            isSimulationOwner = Boolean(socket && data?.socketId && socket.id === data.socketId);
            window.isSimulationOwner = isSimulationOwner;
        });

        socket.on('megaPet:activate', (data) => {
            const scene = getReadyGameScene();
            if (scene) {
                scene.activateMegaPet(data);
            }
            showMegaPetBanner(data);
        });

        socket.on('megaPet:deactivate', () => {
            const scene = getReadyGameScene();
            if (scene) {
                scene.deactivateMegaPet();
            }
            hideMegaPetBanner();
        });

        socket.on('pets:upgrade', (data) => {
            const scene = getReadyGameScene();
            if (scene) {
                scene.showUpgradeEffect(data);
            }
        });

        socket.on('event:follow', (data) => {
            const scene = getReadyGameScene();
            if (scene) {
                scene.showFloatingText(
                    260,
                    160 + (Math.random() * 60),
                    data.message,
                    0xff69b4
                );
            }
        });

        socket.on('event:chat', (data) => {
            const scene = getReadyGameScene();
            if (scene) {
                scene.showFloatingText(
                    320,
                    220 + (Math.random() * 80),
                    `${data.username}: ${data.text}`,
                    0x00ffff
                );
            }
        });
    });
}

function syncSceneWithState() {
    if (!GameScene.instance) return;

    const scene = GameScene.instance;
    const renderedPetIds = new Set(
        scene.pets.getChildren()
            .map((pet) => pet?.petData?.id)
            .filter(Boolean)
    );

    for (const pet of GameState.pets.values()) {
        if (!renderedPetIds.has(pet.id)) {
            scene.spawnPet(pet);
        }
    }

    for (const renderedPetId of renderedPetIds) {
        if (!GameState.pets.has(renderedPetId)) {
            scene.removePet(renderedPetId);
        }
    }

    const renderedEnemyIds = new Set(
        scene.enemies.getChildren()
            .map((enemy) => enemy?.enemyData?.id)
            .filter(Boolean)
    );

    for (const enemy of GameState.enemies.values()) {
        if (!renderedEnemyIds.has(enemy.id)) {
            scene.spawnEnemy(enemy);
        } else {
            scene.updateEnemyState(enemy);
        }
    }

    for (const renderedEnemyId of renderedEnemyIds) {
        if (!GameState.enemies.has(renderedEnemyId)) {
            scene.removeEnemy(renderedEnemyId);
        }
    }
}

function updateUI(state) {
    const waveEl = document.getElementById('wave-number');
    if (waveEl) waveEl.textContent = String(state.wave);

    const scene = GameScene.instance;
    const localPetCount = typeof state.petCount === 'number'
        ? state.petCount
        : (scene ? scene.pets.getChildren().filter((p) => p.active).length : GameState.pets.size);
    const localEnemyCount = typeof state.enemyCount === 'number'
        ? state.enemyCount
        : (scene ? scene.enemies.getChildren().filter((e) => e.active).length : GameState.enemies.size);

    const petCountEl = document.getElementById('pet-count');
    if (petCountEl) petCountEl.textContent = String(localPetCount);

    const enemyCountEl = document.getElementById('enemy-count');
    if (enemyCountEl) enemyCountEl.textContent = String(localEnemyCount);

    const giftCountEl = document.getElementById('gift-count');
    if (giftCountEl) giftCountEl.textContent = String(state.totalGifts);

    const activePetsEl = document.getElementById('active-pets');
    if (activePetsEl) activePetsEl.textContent = String(localPetCount);

    const maxPetsEl = document.getElementById('max-pets');
    if (maxPetsEl) maxPetsEl.textContent = String(state.maxPets);

    const likesFillEl = document.getElementById('likes-fill');
    if (likesFillEl) {
        const percentage = Math.min((state.likesPerMinute / 200) * 100, 100);
        likesFillEl.style.width = `${percentage}%`;
    }

    const lpmEl = document.getElementById('lpm-value');
    if (lpmEl) lpmEl.textContent = String(state.likesPerMinute);
}

function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        statusEl.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
        statusEl.textContent = connected ? '⚡ Conectado al servidor' : '⚡ Desconectado';
    }
}

function updateLeaderboardUI(payload) {
    const bodyEl = document.getElementById('leaderboard-body');
    const dateEl = document.getElementById('leaderboard-date');
    if (!bodyEl) return;

    const safePayload = payload && typeof payload === 'object'
        ? payload
        : { historical: [], daily: [], dateKey: '' };
    const historicalRows = Array.isArray(safePayload.historical) ? safePayload.historical : [];
    const dailyRows = Array.isArray(safePayload.daily) ? safePayload.daily : [];
    let activeRows = leaderboardViewMode === 'historical' ? historicalRows : dailyRows;
    if (leaderboardViewMode === 'historical' && activeRows.length === 0 && dailyRows.length > 0) {
        activeRows = dailyRows;
    }
    const safeRows = Array.isArray(activeRows) ? activeRows.slice(0, 10) : [];
    if (dateEl) {
        dateEl.textContent = safePayload.dateKey || '';
    }

    if (safeRows.length === 0) {
        const label = leaderboardViewMode === 'historical'
            ? 'Sin puntuaciones historicas'
            : 'Sin puntuaciones hoy';
        bodyEl.innerHTML = `<div class="leaderboard-empty">${label}</div>`;
        return;
    }

    bodyEl.innerHTML = safeRows.map((row, index) => {
        const name = String(row.displayName || row.username || 'anonymous').slice(0, 24);
        const score = Number(row.score) || 0;
        const kills = Number(row.kills) || 0;
        return `
            <div class="leaderboard-row">
                <span class="leaderboard-rank">#${index + 1}</span>
                <span class="leaderboard-name">${name}</span>
                <span class="leaderboard-kills">${kills}K</span>
                <span class="leaderboard-score">${score}</span>
            </div>
        `;
    }).join('');
}

function setLeaderboardMode(mode) {
    leaderboardViewMode = mode === 'historical' ? 'historical' : 'daily';
    localStorage.setItem('petArena:leaderboardMode', leaderboardViewMode);

    const dailyBtn = document.getElementById('lb-mode-daily');
    const historicalBtn = document.getElementById('lb-mode-historical');
    if (dailyBtn) dailyBtn.classList.toggle('active', leaderboardViewMode === 'daily');
    if (historicalBtn) historicalBtn.classList.toggle('active', leaderboardViewMode === 'historical');

    updateLeaderboardUI(GameState.leaderboard);
}

window.setLeaderboardMode = setLeaderboardMode;

function showMegaPetBanner(data) {
    const banner = document.getElementById('mega-pet-banner');
    const donor = document.getElementById('mega-pet-donor');
    const timer = document.getElementById('mega-pet-timer');
    if (!banner || !donor || !timer) return;

    donor.textContent = data.donorName;
    banner.classList.add('active');

    if (megaPetCountdownInterval) {
        clearInterval(megaPetCountdownInterval);
        megaPetCountdownInterval = null;
    }

    let remaining = Math.ceil((data.duration || 30000) / 1000);
    timer.textContent = String(remaining);

    megaPetCountdownInterval = setInterval(() => {
        remaining -= 1;
        timer.textContent = String(Math.max(remaining, 0));
        if (remaining <= 0) {
            clearInterval(megaPetCountdownInterval);
            megaPetCountdownInterval = null;
        }
    }, 1000);
}

function hideMegaPetBanner() {
    const banner = document.getElementById('mega-pet-banner');
    if (banner) {
        banner.classList.remove('active');
    }
    if (megaPetCountdownInterval) {
        clearInterval(megaPetCountdownInterval);
        megaPetCountdownInterval = null;
    }
}

function clearDemoLoop() {
    if (demoPetInterval) clearInterval(demoPetInterval);
    if (demoLikesInterval) clearInterval(demoLikesInterval);
    if (demoGiftInterval) clearInterval(demoGiftInterval);
    demoPetInterval = null;
    demoLikesInterval = null;
    demoGiftInterval = null;
}

function startDemoLoop() {
    clearDemoLoop();
    if (!socket) return;

    const petTypes = ['gato', 'perro', 'dragon', 'conejo'];

    demoPetInterval = setInterval(() => {
        const type = petTypes[Math.floor(Math.random() * petTypes.length)];
        socket.emit('demo:spawn', {
            owner: 'demo_user',
            type
        });
    }, 2500);

    demoLikesInterval = setInterval(() => {
        socket.emit('likes:add', 5 + Math.floor(Math.random() * 20));
    }, 3000);

    demoGiftInterval = setInterval(() => {
        if (Math.random() > 0.35) return;
        socket.emit('gift:send', {
            username: 'demo_user',
            giftName: 'Demo Gift',
            giftCount: 1,
            diamondCount: 100 + Math.floor(Math.random() * 800)
        });
    }, 12000);
}

window.hydrateSceneFromState = () => {
    syncSceneWithState();
};

window.initGame = async function() {
    try {
        await connectToServer();

        game = new PhaserRuntime.Game({
            type: PhaserRuntime.AUTO,
            width: CONFIG.gameWidth,
            height: CONFIG.gameHeight,
            parent: 'game-container',
            backgroundColor: '#0a0a0f',
            physics: CONFIG.physics,
            scene: [BootScene, GameScene, UIScene],
            scale: {
                mode: PhaserRuntime.Scale.FIT,
                autoCenter: PhaserRuntime.Scale.CENTER_BOTH
            }
        });

        if (window.isDemoMode) {
            startDemoLoop();
        }
    } catch (error) {
        console.error('[Juego] Error al inicializar:', error);
        alert('Error al conectar con el servidor. Por favor recarga la página.');
    }
};

window.addEventListener('resize', () => {
    if (game && game.scale && typeof game.scale.refresh === 'function') {
        game.scale.refresh();
    }
});

window.addEventListener('beforeunload', () => {
    clearDemoLoop();
    if (socket) {
        socket.disconnect();
    }
    window.socket = null;
    window.isSimulationOwner = false;
});

document.addEventListener('DOMContentLoaded', () => {
    setLeaderboardMode(leaderboardViewMode);
});
