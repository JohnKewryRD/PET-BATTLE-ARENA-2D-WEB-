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
    const waveEl = document.getElementById('wave-display');
    if (waveEl) waveEl.textContent = `OLEADA ${state.wave}`;

    const scene = GameScene.instance;
    const localPetCount = typeof state.petCount === 'number'
        ? state.petCount
        : (scene ? scene.pets.getChildren().filter((p) => p.active).length : GameState.pets.size);
    const localEnemyCount = typeof state.enemyCount === 'number'
        ? state.enemyCount
        : (scene ? scene.enemies.getChildren().filter((e) => e.active).length : GameState.enemies.size);

    const petCountEl = document.getElementById('stat-pets');
    if (petCountEl) petCountEl.textContent = String(localPetCount);

    const enemyCountEl = document.getElementById('stat-enemies');
    if (enemyCountEl) enemyCountEl.textContent = String(localEnemyCount);

    const giftCountEl = document.getElementById('stat-gifts');
    if (giftCountEl) giftCountEl.textContent = String(state.totalGifts || 0);

    const activePetsEl = document.getElementById('active-pets-display');
    if (activePetsEl) activePetsEl.textContent = String(localPetCount);

    // Update Log View Stats
    const totalPetsStat = document.getElementById('total-pets-stat');
    if (totalPetsStat) totalPetsStat.textContent = String(state.totalSpawnedPets || localPetCount);

    const totalKillsStat = document.getElementById('total-kills-stat');
    if (totalKillsStat) totalKillsStat.textContent = String(state.totalEnemiesKilled || localEnemyCount);

    const totalWavesStat = document.getElementById('total-waves-stat');
    if (totalWavesStat) totalWavesStat.textContent = String(state.wave);

    const energyFillEl = document.getElementById('energy-fill');
    if (energyFillEl) {
        const percentage = Math.min((state.likesPerMinute / 200) * 100, 100);
        energyFillEl.style.width = `${percentage}%`;
    }

    const lpmEl = document.getElementById('lpm-display');
    if (lpmEl) lpmEl.textContent = `${state.likesPerMinute} LPM`;
}

function updateConnectionStatus(connected) {
    const statusText = document.getElementById('server-status-text');
    if (statusText) {
        statusText.textContent = connected ? 'Server: Online' : 'Server: Offline';
        statusText.parentElement.classList.toggle('text-primary', connected);
        statusText.parentElement.classList.toggle('text-error', !connected);
    }
}

function updateLeaderboardUI(payload) {
    const sidebarEl = document.getElementById('sidebar-ranking-list');
    const podiumEl = document.getElementById('donors-podium');
    const listEl = document.getElementById('donors-list');
    
    if (!sidebarEl && !podiumEl && !listEl) return;

    const safePayload = payload && typeof payload === 'object'
        ? payload
        : { historical: [], daily: [], dateKey: '' };
    
    const donors = safePayload.daily.length > 0 ? safePayload.daily : safePayload.historical;
    
    // 1. Update Sidebar (Top 5 for more density)
    if (sidebarEl) {
        const sidebarRows = donors.slice(0, 5);
        if (sidebarRows.length === 0) {
            sidebarEl.innerHTML = '<div class="leaderboard-empty text-[10px] opacity-40 italic">Synchronizing...</div>';
        } else {
            sidebarEl.innerHTML = sidebarRows.map((row, idx) => `
                <div class="flex items-center justify-between group cursor-pointer hover:bg-white/5 p-1 rounded transition-colors">
                    <div class="flex items-center gap-3">
                        <span class="text-[10px] font-black ${idx === 0 ? 'text-secondary' : 'text-on-surface-variant/40'}">0${idx+1}</span>
                        <span class="text-[11px] font-bold text-on-surface truncate w-32">${row.username}</span>
                    </div>
                    <span class="text-[11px] font-black text-primary">${row.score}</span>
                </div>
            `).join('');
        }
    }

    // 2. Update Hall of Emitters (Podium + List)
    if (podiumEl && listEl) {
        if (donors.length === 0) {
            podiumEl.innerHTML = '<div class="col-span-full text-center opacity-40 font-mono text-sm italic">Waiting for top emitters...</div>';
            listEl.innerHTML = '';
        } else {
            const top3 = donors.slice(0, 3);
            const rest = donors.slice(3, 11);

            // Reorder for podium aesthetic: Rank 2, Rank 1, Rank 3
            const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
            
            podiumEl.innerHTML = podiumOrder.map((row, i) => {
                const actualRank = donors.findIndex(d => d.username === row.username) + 1;
                const isFirst = actualRank === 1;
                return `
                <div class="${isFirst ? 'md:order-2 md:-translate-y-6' : i === 0 ? 'md:order-1' : 'md:order-3'} relative group">
                    <div class="bg-surface-container-high/40 backdrop-blur-xl p-8 rounded-2xl border ${isFirst ? 'border-secondary/50 shadow-[0_0_40px_rgba(255,81,250,0.2)] scale-110' : 'border-outline-variant/10'} text-center transition-all duration-500 hover:border-primary/40">
                        <div class="relative inline-block mb-6">
                            <div class="w-24 h-24 rounded-full bg-surface-container-highest flex items-center justify-center border-4 ${isFirst ? 'border-secondary' : 'border-primary/30'} text-4xl font-black ${isFirst ? 'text-secondary' : 'text-primary'} shadow-inner">
                                ${row.username.charAt(0).toUpperCase()}
                            </div>
                            <div class="absolute -bottom-2 -right-2 w-10 h-10 rounded-full ${isFirst ? 'bg-secondary' : 'bg-primary'} flex items-center justify-center font-black text-black text-lg border-4 border-[#1b0c2a]">
                                ${actualRank}
                            </div>
                        </div>
                        <h3 class="font-headline text-2xl font-bold text-on-surface mb-1 truncate px-2">@${row.username}</h3>
                        <p class="text-xs font-label text-on-surface-variant uppercase tracking-widest font-black mb-4">Master Emitter</p>
                        <div class="bg-surface-container-lowest/50 py-3 rounded-xl border border-outline-variant/5">
                            <span class="block text-2xl font-black ${isFirst ? 'text-secondary' : 'text-primary'} font-headline">${row.score}</span>
                            <span class="text-[9px] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Energy Units</span>
                        </div>
                    </div>
                    ${isFirst ? '<div class="absolute -top-12 left-1/2 -translate-x-1/2 text-5xl animate-bounce drop-shadow-[0_0_10px_#ff51fa]">👑</div>' : ''}
                </div>`;
            }).join('');

            listEl.innerHTML = rest.map((row, idx) => `
                <div class="bg-surface-container-low/60 p-6 rounded-2xl border border-outline-variant/10 flex items-center justify-between group hover:border-primary/40 transition-all backdrop-blur-sm">
                    <div class="flex items-center gap-6">
                        <div class="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center border-2 border-primary/20 text-xl font-headline font-black text-primary group-hover:scale-110 transition-transform">
                            ${row.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p class="font-headline text-lg font-bold text-on-surface">@${row.username}</p>
                            <div class="flex items-center gap-3">
                                <span class="text-[11px] font-black text-secondary">RANK #0${idx + 4}</span>
                                <div class="w-1 h-1 rounded-full bg-on-surface-variant/30"></div>
                                <span class="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Active Emitter</span>
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-2xl font-black text-on-surface group-hover:text-primary transition-colors font-headline">${row.score}</p>
                        <p class="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em]">Diamonds Shared</p>
                    </div>
                </div>
            `).join('');
        }
    }
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
    const container = document.getElementById('mega-banner-container');
    const donor = document.getElementById('mega-donor-display');
    const timer = document.getElementById('mega-timer-display');
    if (!container || !donor || !timer) return;

    donor.textContent = data.donorName;
    container.classList.remove('hidden');
    container.classList.add('flex');

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
    const container = document.getElementById('mega-banner-container');
    if (container) {
        container.classList.add('hidden');
        container.classList.remove('flex');
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
                mode: PhaserRuntime.Scale.RESIZE,
                autoCenter: PhaserRuntime.Scale.NO_CENTER
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
