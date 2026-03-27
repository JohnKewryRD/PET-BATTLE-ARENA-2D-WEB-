/**
 * PET BATTLE ARENA - Punto de Entrada del Servidor
 * Multi-tenant por roomId para múltiples streamers en paralelo
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const TikTokConnector = require('./tiktok/TikTokConnector');
const EventProcessor = require('./events/EventProcessor');

class PetBattleArenaServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST']
            }
        });

        this.port = parseInt(process.env.PORT, 10) || 3000;
        this.maxPets = parseInt(process.env.MAX_PETS, 10) || 200;
        this.maxEnemies = parseInt(process.env.MAX_ENEMIES, 10) || 120;
        this.waveIntervalMs = parseInt(process.env.WAVE_INTERVAL, 10) || 15000;
        this.stateBroadcastIntervalMs = parseInt(process.env.STATE_BROADCAST_INTERVAL_MS, 10) || 250;
        this.leaderboardLimit = parseInt(process.env.LEADERBOARD_LIMIT, 10) || 10;

        this.supabaseUrl = process.env.SUPABASE_URL || '';
        this.supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        this.supabaseTable = process.env.SUPABASE_LEADERBOARD_TABLE || 'leaderboard_scores';
        this.adminTokenTable = process.env.SUPABASE_ADMIN_TOKENS_TABLE || 'admin_room_tokens';
        this.adminTokenPepper = process.env.ADMIN_TOKEN_PEPPER || '';

        this.rooms = new Map();
        this.tickInterval = null;
        this.isShuttingDown = false;

        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketIO();
        this.startGameLoop();

        this.bootstrapPersistence();
        this.setupProcessHandlers();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, '..', 'client')));
    }

    setupRoutes() {
        this.app.post('/connect', async (req, res) => {
            const usernameRaw = String(req.body?.username || '').trim();
            if (!usernameRaw) {
                return res.status(400).json({ error: 'Nombre de usuario requerido' });
            }

            const cleanUsername = usernameRaw.replace('@', '').trim();
            const roomId = this.normalizeRoomId(req.body?.roomId || `room_${cleanUsername}`);
            const room = this.ensureRoom(roomId, { activate: true });

            try {
                if (
                    room.isTikTokConnected &&
                    room.tiktokUsername &&
                    room.tiktokUsername === cleanUsername
                ) {
                    return res.json({
                        success: true,
                        roomId,
                        username: room.tiktokUsername,
                        adminToken: null,
                        message: 'Ya existe una sesión activa para este usuario'
                    });
                }

                if (room.tiktokConnector) {
                    room.tiktokConnector.disconnect();
                }

                room.tiktokUsername = cleanUsername;
                room.tiktokConnector = new TikTokConnector(cleanUsername, room.eventProcessor);
                await room.tiktokConnector.connect();
                room.isTikTokConnected = true;
                const generatedAdminToken = await this.provisionRoomAdminToken(roomId, cleanUsername);

                this.emitToRoom(roomId, 'room:status', {
                    roomId,
                    connected: true,
                    username: cleanUsername
                });

                return res.json({
                    success: true,
                    roomId,
                    username: cleanUsername,
                    adminToken: generatedAdminToken,
                    message: 'Conectado exitosamente a TikTok Live'
                });
            } catch (error) {
                room.isTikTokConnected = false;
                return res.status(500).json({
                    error: 'No se pudo conectar a TikTok. Asegúrate de tener un live activo.',
                    details: error.message
                });
            }
        });

        this.app.get('/status', (req, res) => {
            const roomId = this.resolveRoomIdFromRequest(req);
            const room = roomId ? this.rooms.get(roomId) : null;

            if (!room) {
                return res.json({
                    connected: false,
                    roomId: roomId || null,
                    username: null,
                    gameState: null
                });
            }

            return res.json({
                connected: room.isTikTokConnected,
                roomId,
                username: room.tiktokUsername,
                gameState: this.getGameState(roomId)
            });
        });

        this.app.post('/admin/leaderboard/reset', async (req, res) => {
            const mode = req.body?.mode === 'daily' ? 'daily' : 'all';
            const rawRoomId = req.body?.roomId || req.query?.roomId || '';
            if (!rawRoomId) {
                return res.status(400).json({ error: 'roomId requerido' });
            }
            const roomId = this.normalizeRoomId(rawRoomId);

            if (!(await this.isValidAdminRequest(req, roomId))) {
                return res.status(401).json({ error: 'No autorizado para este roomId' });
            }

            try {
                await this.resetLeaderboard(mode, roomId);
                this.emitToRoom(roomId, 'leaderboard:update', this.getLeaderboardPayload(roomId));
                return res.json({ success: true, mode, roomId });
            } catch (error) {
                return res.status(500).json({
                    error: 'No se pudo resetear leaderboard',
                    details: error.message
                });
            }
        });

        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', rooms: this.rooms.size, timestamp: Date.now() });
        });
    }

    setupSocketIO() {
        this.io.on('connection', (socket) => {
            socket.currentRoomId = null;

            socket.on('room:join', (data, ack) => {
                const roomId = this.normalizeRoomId(data?.roomId || data?.username || 'demo_room');
                this.joinSocketToRoom(socket, roomId);
                const room = this.ensureRoom(roomId, { activate: true });

                this.assignSimulationOwnerIfNeeded(roomId, socket);
                socket.emit('game:init', this.getGameState(roomId));
                socket.emit('leaderboard:init', this.getLeaderboardPayload(roomId));
                socket.emit('room:status', {
                    roomId,
                    connected: room.isTikTokConnected,
                    username: room.tiktokUsername || null
                });

                if (typeof ack === 'function') {
                    ack({ ok: true, roomId });
                }
            });

            socket.on('demo:spawn', (data) => {
                const roomId = socket.currentRoomId;
                if (!roomId) return;
                const room = this.ensureRoom(roomId, { activate: true });
                room.eventProcessor.processPetSpawn(data || {});
            });

            socket.on('pet:spawn', (data) => {
                const roomId = socket.currentRoomId;
                if (!roomId) return;
                const room = this.ensureRoom(roomId, { activate: true });
                room.eventProcessor.processPetSpawn(data || {});
            });

            socket.on('likes:add', (count) => {
                const roomId = socket.currentRoomId;
                if (!roomId) return;
                const likes = Number(count) || 0;
                if (likes <= 0) return;
                const room = this.ensureRoom(roomId, { activate: true });
                room.eventProcessor.processLikes(likes);
            });

            socket.on('gift:send', (data) => {
                const roomId = socket.currentRoomId;
                if (!roomId) return;
                const payload = data || {};
                const room = this.ensureRoom(roomId, { activate: true });
                room.eventProcessor.processGift({
                    username: payload.username || 'demo_user',
                    nickname: payload.username || 'Usuario Demo',
                    giftName: payload.giftName || 'Demo Gift',
                    giftCount: Number(payload.giftCount) || 1,
                    diamondCount: Number(payload.diamondCount) || 1,
                    isViralGift: Number(payload.diamondCount) >= 3000
                });
            });

            socket.on('enemy:damage', (data) => {
                const roomId = socket.currentRoomId;
                if (!roomId || !this.isSimulationOwner(roomId, socket.id)) return;
                if (!data || !data.enemyId) return;
                const damage = Number(data.damage) || 0;
                if (damage <= 0) return;
                this.applyEnemyDamage(roomId, data.enemyId, damage, data.petId || null);
            });

            socket.on('pet:damage', (data) => {
                const roomId = socket.currentRoomId;
                if (!roomId || !this.isSimulationOwner(roomId, socket.id)) return;
                if (!data || !data.petId) return;
                const damage = Number(data.damage) || 0;
                if (damage <= 0) return;
                this.applyPetDamage(roomId, data.petId, damage);
            });

            socket.on('disconnect', () => {
                const roomId = socket.currentRoomId;
                if (!roomId) return;
                this.reassignSimulationOwnerOnDisconnect(roomId, socket.id);
                this.cleanupRoomIfIdle(roomId);
            });
        });
    }

    startGameLoop() {
        this.tickInterval = setInterval(() => this.gameTick(), 100);
        console.log(`[Servidor] Bucle del juego iniciado - Puerto: ${this.port}`);
    }

    gameTick() {
        const now = Date.now();
        for (const [roomId, room] of this.rooms) {
            room.gameState.waveTimer += 100;

            if (room.gameState.isMegaPetActive && now > room.gameState.megaPetEndTime) {
                this.endMegaPetMode(roomId);
            }

            if (
                this.getRoomSocketCount(roomId) > 0 &&
                now - room.lastStateBroadcastAt >= this.stateBroadcastIntervalMs
            ) {
                room.lastStateBroadcastAt = now;
                this.emitToRoom(roomId, 'game:update', this.getRealtimeState(roomId));
            }
        }
    }

    ensureRoom(roomId, options = {}) {
        const normalizedId = this.normalizeRoomId(roomId || 'default_room');
        let room = this.rooms.get(normalizedId);
        if (!room) {
            room = {
                id: normalizedId,
                tiktokUsername: null,
                tiktokConnector: null,
                isTikTokConnected: false,
                simulationOwnerSocketId: null,
                waveIntervalRef: null,
                lpmIntervalRef: null,
                leaderboardFlushTimer: null,
                pendingLeaderboardFlush: new Map(),
                lastStateBroadcastAt: 0,
                gameState: {
                    pets: new Map(),
                    enemies: new Map(),
                    leaderboard: new Map(),
                    wave: 0,
                    waveTimer: 0,
                    likesPerMinute: 0,
                    likesCurrentMinute: 0,
                    totalLikes: 0,
                    totalGifts: 0,
                    isMegaPetActive: false,
                    megaPetEndTime: 0
                },
                eventProcessor: null
            };

            const roomAdapter = {
                gameState: room.gameState,
                io: { emit: (event, payload) => this.emitToRoom(normalizedId, event, payload) },
                addPet: (pet) => this.addPet(normalizedId, pet),
                removePet: (petId) => this.removePet(normalizedId, petId),
                activateMegaPet: (donorName, duration) => this.activateMegaPet(normalizedId, donorName, duration)
            };
            room.eventProcessor = new EventProcessor(roomAdapter);

            this.rooms.set(normalizedId, room);
        }

        if (options.activate !== false) {
            this.startRoomIntervals(normalizedId);
        }

        return room;
    }

    startRoomIntervals(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        if (!room.waveIntervalRef) {
            room.waveIntervalRef = setInterval(() => this.spawnWave(roomId), this.waveIntervalMs);
        }
        if (!room.lpmIntervalRef) {
            room.lpmIntervalRef = setInterval(() => this.calculateLPM(roomId), 60000);
        }
    }

    stopRoomIntervals(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        if (room.waveIntervalRef) clearInterval(room.waveIntervalRef);
        if (room.lpmIntervalRef) clearInterval(room.lpmIntervalRef);
        room.waveIntervalRef = null;
        room.lpmIntervalRef = null;
    }

    joinSocketToRoom(socket, roomId) {
        if (socket.currentRoomId) {
            socket.leave(socket.currentRoomId);
        }
        socket.join(roomId);
        socket.currentRoomId = roomId;
    }

    resolveRoomIdFromRequest(req) {
        const raw = req.query?.roomId || req.query?.username || req.body?.roomId || '';
        if (raw) return this.normalizeRoomId(raw);
        return null;
    }

    normalizeRoomId(value) {
        const input = String(value || '').trim().toLowerCase();
        const slug = input.replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 64);
        return slug || 'default_room';
    }

    emitToRoom(roomId, event, payload) {
        this.io.to(roomId).emit(event, payload);
    }

    getRoomSocketCount(roomId) {
        return this.io.sockets.adapter.rooms.get(roomId)?.size || 0;
    }

    spawnWave(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const wave = room.gameState.wave + 1;
        room.gameState.wave = wave;
        room.gameState.waveTimer = 0;

        const enemyCount = Math.min(3 + Math.floor(wave / 2), 10);
        const hasBoss = wave % 5 === 0;
        const difficulty = this.calculateDifficulty(wave);

        this.emitToRoom(roomId, 'wave:spawn', {
            wave,
            enemyCount,
            hasBoss,
            difficulty
        });

        for (let i = 0; i < enemyCount; i++) {
            setTimeout(() => {
                this.spawnEnemyEntity(roomId, { wave, difficulty, isBoss: false });
            }, i * 350);
        }

        if (hasBoss) {
            setTimeout(() => {
                this.spawnEnemyEntity(roomId, { wave, difficulty, isBoss: true });
            }, 2200);
        }
    }

    calculateDifficulty(wave) {
        return {
            speed: 1 + (wave * 0.1),
            health: 1 + (wave * 0.15),
            damage: 1 + (wave * 0.12)
        };
    }

    calculateLPM(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        room.gameState.likesPerMinute = room.gameState.likesCurrentMinute;
        room.gameState.likesCurrentMinute = 0;
    }

    getGameState(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        return {
            roomId,
            pets: Array.from(room.gameState.pets.values()),
            enemies: Array.from(room.gameState.enemies.values()),
            leaderboard: this.getLeaderboardPayload(roomId),
            wave: room.gameState.wave,
            waveTimer: room.gameState.waveTimer,
            likesPerMinute: room.gameState.likesPerMinute,
            totalLikes: room.gameState.totalLikes,
            totalGifts: room.gameState.totalGifts,
            isMegaPetActive: room.gameState.isMegaPetActive,
            megaPetEndTime: room.gameState.megaPetEndTime,
            maxPets: this.maxPets,
            tiktokConnected: room.isTikTokConnected,
            tiktokUsername: room.tiktokUsername
        };
    }

    getRealtimeState(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        return {
            roomId,
            wave: room.gameState.wave,
            waveTimer: room.gameState.waveTimer,
            likesPerMinute: room.gameState.likesPerMinute,
            totalLikes: room.gameState.totalLikes,
            totalGifts: room.gameState.totalGifts,
            isMegaPetActive: room.gameState.isMegaPetActive,
            megaPetEndTime: room.gameState.megaPetEndTime,
            maxPets: this.maxPets,
            petCount: room.gameState.pets.size,
            enemyCount: room.gameState.enemies.size,
            tiktokConnected: room.isTikTokConnected,
            tiktokUsername: room.tiktokUsername
        };
    }

    addPet(roomId, pet) {
        const room = this.rooms.get(roomId);
        if (!room) return false;
        if (room.gameState.pets.size >= this.maxPets) return false;

        room.gameState.pets.set(pet.id, pet);
        this.emitToRoom(roomId, 'pet:added', pet);
        return true;
    }

    removePet(roomId, petId) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        if (!room.gameState.pets.has(petId)) return;

        room.gameState.pets.delete(petId);
        this.emitToRoom(roomId, 'pet:removed', { id: petId });
    }

    spawnEnemyEntity(roomId, { wave, difficulty, isBoss = false }) {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        if (room.gameState.enemies.size >= this.maxEnemies) return null;

        const side = Math.floor(Math.random() * 4);
        let x;
        let y;
        switch (side) {
            case 0:
                x = Math.floor(Math.random() * 1920);
                y = -30;
                break;
            case 1:
                x = 1950;
                y = Math.floor(Math.random() * 1080);
                break;
            case 2:
                x = Math.floor(Math.random() * 1920);
                y = 1110;
                break;
            default:
                x = -30;
                y = Math.floor(Math.random() * 1080);
                break;
        }

        const id = `enemy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const healthMultiplier = isBoss ? 6.5 : 1;
        const damageMultiplier = isBoss ? 2.8 : 1;
        const speedMultiplier = isBoss ? 0.6 : 1;
        const hp = Math.max(1, Math.floor(50 * difficulty.health * healthMultiplier));

        const enemy = {
            id,
            wave,
            x,
            y,
            typeIndex: Math.min(Math.floor(difficulty.health / 2), 3),
            isBoss,
            hp,
            maxHp: hp,
            damage: Math.max(1, Math.floor(10 * difficulty.damage * damageMultiplier)),
            speed: Math.max(1, 2 + difficulty.speed * speedMultiplier),
            createdAt: Date.now()
        };

        room.gameState.enemies.set(id, enemy);
        this.emitToRoom(roomId, 'enemy:spawned', enemy);
        return enemy;
    }

    applyEnemyDamage(roomId, enemyId, rawDamage, petId) {
        const room = this.rooms.get(roomId);
        if (!room) return false;

        const enemy = room.gameState.enemies.get(enemyId);
        if (!enemy) return false;

        const clampedDamage = Math.min(Math.max(Math.floor(rawDamage), 1), 250);
        enemy.hp = Math.max(0, enemy.hp - clampedDamage);

        if (enemy.hp === 0) {
            room.gameState.enemies.delete(enemyId);
            this.registerKillForPet(roomId, petId, enemy);
            this.emitToRoom(roomId, 'enemy:removed', { id: enemyId, petId });
            return true;
        }

        this.emitToRoom(roomId, 'enemy:updated', {
            id: enemy.id,
            hp: enemy.hp,
            maxHp: enemy.maxHp
        });
        return true;
    }

    applyPetDamage(roomId, petId, rawDamage) {
        const room = this.rooms.get(roomId);
        if (!room) return false;

        const pet = room.gameState.pets.get(petId);
        if (!pet) return false;

        const clampedDamage = Math.min(Math.max(Math.floor(rawDamage), 1), 250);
        pet.hp = Math.max(0, pet.hp - clampedDamage);

        if (pet.hp === 0) {
            this.removePet(roomId, petId);
            return true;
        }

        this.emitToRoom(roomId, 'pet:updated', {
            id: pet.id,
            hp: pet.hp,
            maxHp: pet.maxHp
        });
        return true;
    }

    registerKillForPet(roomId, petId, enemy) {
        const room = this.rooms.get(roomId);
        if (!room || !petId) return;

        const pet = room.gameState.pets.get(petId);
        if (!pet) return;

        const username = pet.owner || pet.ownerName || 'anonymous';
        const displayName = pet.ownerName || username;
        const points = enemy?.isBoss ? 50 : 10;
        const today = this.getTodayDateKey();

        const existing = room.gameState.leaderboard.get(username) || {
            roomId,
            username,
            displayName,
            score: 0,
            kills: 0,
            dailyScore: 0,
            dailyKills: 0,
            scoreDate: today,
            updatedAt: Date.now()
        };

        if (existing.scoreDate !== today) {
            existing.dailyScore = 0;
            existing.dailyKills = 0;
            existing.scoreDate = today;
        }

        existing.displayName = displayName;
        existing.score += points;
        existing.kills += 1;
        existing.dailyScore += points;
        existing.dailyKills += 1;
        existing.updatedAt = Date.now();
        room.gameState.leaderboard.set(username, existing);

        this.emitToRoom(roomId, 'leaderboard:update', this.getLeaderboardPayload(roomId));
        this.scheduleLeaderboardFlush(roomId, existing);
    }

    getLeaderboardHistoricalState(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return [];
        return Array.from(room.gameState.leaderboard.values())
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (b.kills !== a.kills) return b.kills - a.kills;
                return b.updatedAt - a.updatedAt;
            })
            .slice(0, this.leaderboardLimit)
            .map((row) => this.toPublicLeaderboardRow(row));
    }

    getLeaderboardDailyState(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return [];
        const today = this.getTodayDateKey();
        return Array.from(room.gameState.leaderboard.values())
            .filter((row) => row.scoreDate === today)
            .sort((a, b) => {
                if (b.dailyScore !== a.dailyScore) return b.dailyScore - a.dailyScore;
                if (b.dailyKills !== a.dailyKills) return b.dailyKills - a.dailyKills;
                return b.updatedAt - a.updatedAt;
            })
            .slice(0, this.leaderboardLimit)
            .map((row) => this.toPublicLeaderboardRow(row, true));
    }

    toPublicLeaderboardRow(entry, daily = false) {
        return {
            roomId: entry.roomId,
            username: entry.username,
            displayName: entry.displayName,
            score: daily ? entry.dailyScore : entry.score,
            kills: daily ? entry.dailyKills : entry.kills,
            updatedAt: entry.updatedAt
        };
    }

    getLeaderboardPayload(roomId) {
        return {
            roomId,
            dateKey: this.getTodayDateKey(),
            daily: this.getLeaderboardDailyState(roomId),
            historical: this.getLeaderboardHistoricalState(roomId)
        };
    }

    getTodayDateKey() {
        return new Date().toISOString().slice(0, 10);
    }

    activateMegaPet(roomId, donorName, duration = 30000) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        room.gameState.isMegaPetActive = true;
        room.gameState.megaPetEndTime = Date.now() + duration;

        this.emitToRoom(roomId, 'megaPet:activate', {
            donorName,
            duration,
            pets: Array.from(room.gameState.pets.values())
        });
    }

    endMegaPetMode(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        room.gameState.isMegaPetActive = false;
        this.emitToRoom(roomId, 'megaPet:deactivate', {});
    }

    assignSimulationOwnerIfNeeded(roomId, socket) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        if (room.simulationOwnerSocketId) {
            socket.emit('simulation:role', { isOwner: socket.id === room.simulationOwnerSocketId });
            return;
        }

        room.simulationOwnerSocketId = socket.id;
        this.emitToRoom(roomId, 'simulation:owner', { socketId: room.simulationOwnerSocketId });
        socket.emit('simulation:role', { isOwner: true });
    }

    isSimulationOwner(roomId, socketId) {
        const room = this.rooms.get(roomId);
        if (!room) return false;
        return room.simulationOwnerSocketId === socketId;
    }

    reassignSimulationOwnerOnDisconnect(roomId, socketId) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        if (room.simulationOwnerSocketId !== socketId) return;

        const roomSockets = this.io.sockets.adapter.rooms.get(roomId);
        const nextOwnerId = roomSockets ? Array.from(roomSockets)[0] : null;
        room.simulationOwnerSocketId = nextOwnerId || null;

        this.emitToRoom(roomId, 'simulation:owner', { socketId: room.simulationOwnerSocketId });
        if (nextOwnerId) {
            this.io.to(nextOwnerId).emit('simulation:role', { isOwner: true });
        }
    }

    cleanupRoomIfIdle(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        const socketCount = this.getRoomSocketCount(roomId);
        if (socketCount > 0) return;
        if (room.isTikTokConnected) return;

        this.stopRoomIntervals(roomId);
        if (room.leaderboardFlushTimer) clearTimeout(room.leaderboardFlushTimer);
        room.pendingLeaderboardFlush.clear();
        this.rooms.delete(roomId);
    }

    isSupabaseConfigured() {
        return Boolean(this.supabaseUrl && this.supabaseServiceRoleKey);
    }

    getSupabaseRestUrl(pathname) {
        return `${this.supabaseUrl.replace(/\/$/, '')}/rest/v1/${pathname}`;
    }

    async bootstrapPersistence() {
        if (!this.isSupabaseConfigured()) {
            console.log('[Servidor] Supabase no configurado, leaderboard en memoria');
            return;
        }

        try {
            const select = 'room_id,username,display_name,score,kills,daily_score,daily_kills,score_date,updated_at';
            const url = this.getSupabaseRestUrl(
                `${this.supabaseTable}?select=${encodeURIComponent(select)}&order=score.desc,updated_at.desc&limit=5000`
            );

            const response = await fetch(url, {
                headers: {
                    apikey: this.supabaseServiceRoleKey,
                    Authorization: `Bearer ${this.supabaseServiceRoleKey}`
                }
            });
            if (!response.ok) {
                const body = await response.text();
                throw new Error(`Supabase load failed: ${response.status} ${body}`);
            }

            const rows = await response.json();
            rows.forEach((row) => {
                const roomId = this.normalizeRoomId(row.room_id || 'default_room');
                const room = this.ensureRoom(roomId, { activate: false });
                room.gameState.leaderboard.set(row.username, {
                    roomId,
                    username: row.username,
                    displayName: row.display_name || row.username,
                    score: Number(row.score) || 0,
                    kills: Number(row.kills) || 0,
                    dailyScore: Number(row.daily_score) || 0,
                    dailyKills: Number(row.daily_kills) || 0,
                    scoreDate: row.score_date || this.getTodayDateKey(),
                    updatedAt: row.updated_at ? Date.parse(row.updated_at) : Date.now()
                });
            });

            console.log(`[Servidor] Leaderboards cargados desde Supabase (${rows.length} registros)`);
        } catch (error) {
            console.error('[Servidor] Error cargando leaderboard desde Supabase:', error.message);
        }
    }

    scheduleLeaderboardFlush(roomId, entry) {
        if (!this.isSupabaseConfigured() || !entry) return;

        const room = this.rooms.get(roomId);
        if (!room) return;

        room.pendingLeaderboardFlush.set(entry.username, {
            room_id: roomId,
            username: entry.username,
            display_name: entry.displayName,
            score: entry.score,
            kills: entry.kills,
            daily_score: entry.dailyScore || 0,
            daily_kills: entry.dailyKills || 0,
            score_date: entry.scoreDate || this.getTodayDateKey(),
            updated_at: new Date(entry.updatedAt).toISOString()
        });

        if (room.leaderboardFlushTimer) return;

        room.leaderboardFlushTimer = setTimeout(() => {
            this.flushLeaderboardToSupabase(roomId);
        }, 1200);
    }

    async flushLeaderboardToSupabase(roomId) {
        if (!this.isSupabaseConfigured()) return;
        const room = this.rooms.get(roomId);
        if (!room) return;

        if (room.pendingLeaderboardFlush.size === 0) {
            room.leaderboardFlushTimer = null;
            return;
        }

        const payload = Array.from(room.pendingLeaderboardFlush.values());
        room.pendingLeaderboardFlush.clear();
        room.leaderboardFlushTimer = null;

        try {
            const url = this.getSupabaseRestUrl(`${this.supabaseTable}?on_conflict=room_id,username`);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: this.supabaseServiceRoleKey,
                    Authorization: `Bearer ${this.supabaseServiceRoleKey}`,
                    Prefer: 'resolution=merge-duplicates,return=minimal'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const body = await response.text();
                throw new Error(`Supabase upsert failed: ${response.status} ${body}`);
            }
        } catch (error) {
            console.error('[Servidor] Error guardando leaderboard en Supabase:', error.message);
        }
    }

    getRequestAdminToken(req) {
        const bearer = req.headers.authorization || '';
        const bearerToken = bearer.startsWith('Bearer ') ? bearer.slice('Bearer '.length) : '';
        const headerToken = req.headers['x-admin-token'] || '';
        return String(headerToken || bearerToken || '').trim();
    }

    hashAdminToken(roomId, token) {
        const normalizedRoomId = this.normalizeRoomId(roomId);
        return crypto
            .createHash('sha256')
            .update(`${normalizedRoomId}:${token}:${this.adminTokenPepper}`)
            .digest('hex');
    }

    safeHashEqual(left, right) {
        if (!left || !right || left.length !== right.length) return false;
        try {
            return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
        } catch (error) {
            return false;
        }
    }

    async isValidAdminRequest(req, roomId) {
        if (!this.isSupabaseConfigured()) return false;

        const token = this.getRequestAdminToken(req);
        if (!token || !roomId) return false;

        const encodedRoomId = encodeURIComponent(this.normalizeRoomId(roomId));
        const select = encodeURIComponent('room_id,token_hash,active');
        const url = this.getSupabaseRestUrl(
            `${this.adminTokenTable}?select=${select}&room_id=eq.${encodedRoomId}&active=eq.true&limit=1`
        );

        try {
            const response = await fetch(url, {
                headers: {
                    apikey: this.supabaseServiceRoleKey,
                    Authorization: `Bearer ${this.supabaseServiceRoleKey}`
                }
            });

            if (!response.ok) {
                const body = await response.text();
                throw new Error(`Supabase token lookup failed: ${response.status} ${body}`);
            }

            const rows = await response.json();
            if (!Array.isArray(rows) || rows.length === 0) return false;

            const tokenHash = rows[0].token_hash || '';
            const inputHash = this.hashAdminToken(roomId, token);
            return this.safeHashEqual(tokenHash, inputHash);
        } catch (error) {
            console.error('[Servidor] Error validando admin token:', error.message);
            return false;
        }
    }

    async provisionRoomAdminToken(roomId, username = '') {
        if (!this.isSupabaseConfigured()) return null;
        if (!roomId) return null;

        const normalizedRoomId = this.normalizeRoomId(roomId);
        const plainToken = `adm_${crypto.randomBytes(24).toString('hex')}`;
        const tokenHash = this.hashAdminToken(normalizedRoomId, plainToken);
        const url = this.getSupabaseRestUrl(`${this.adminTokenTable}?on_conflict=room_id`);

        const payload = [
            {
                room_id: normalizedRoomId,
                token_hash: tokenHash,
                active: true,
                updated_at: new Date().toISOString()
            }
        ];

        if (username) {
            payload[0].owner_username = String(username).trim().slice(0, 80);
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: this.supabaseServiceRoleKey,
                Authorization: `Bearer ${this.supabaseServiceRoleKey}`,
                Prefer: 'resolution=merge-duplicates,return=minimal'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Supabase admin token upsert failed: ${response.status} ${body}`);
        }

        return plainToken;
    }

    async resetLeaderboard(mode, roomId) {
        const normalizedRoomId = this.normalizeRoomId(roomId);
        const today = this.getTodayDateKey();
        const room = this.rooms.get(normalizedRoomId);

        if (mode === 'daily') {
            if (room) {
                room.gameState.leaderboard.forEach((entry) => {
                    entry.dailyScore = 0;
                    entry.dailyKills = 0;
                    entry.scoreDate = today;
                    entry.updatedAt = Date.now();
                    this.scheduleLeaderboardFlush(normalizedRoomId, entry);
                });
            }

            if (this.isSupabaseConfigured()) {
                const url = this.getSupabaseRestUrl(`rpc/reset_room_daily_scores`);
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        apikey: this.supabaseServiceRoleKey,
                        Authorization: `Bearer ${this.supabaseServiceRoleKey}`
                    },
                    body: JSON.stringify({
                        p_room_id: normalizedRoomId,
                        p_score_date: today
                    })
                });
                if (!response.ok) {
                    const body = await response.text();
                    throw new Error(`Supabase daily reset failed: ${response.status} ${body}`);
                }
            }

            return;
        }

        if (room) {
            room.gameState.leaderboard.clear();
            room.pendingLeaderboardFlush.clear();
            if (room.leaderboardFlushTimer) clearTimeout(room.leaderboardFlushTimer);
            room.leaderboardFlushTimer = null;
        }

        if (!this.isSupabaseConfigured()) return;

        const url = this.getSupabaseRestUrl(`${this.supabaseTable}?room_id=eq.${encodeURIComponent(normalizedRoomId)}`);
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                apikey: this.supabaseServiceRoleKey,
                Authorization: `Bearer ${this.supabaseServiceRoleKey}`
            }
        });
        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Supabase delete failed: ${response.status} ${body}`);
        }
    }

    setupProcessHandlers() {
        const shutdown = (signal) => this.shutdown(signal);
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    }

    async shutdown(signal) {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;
        console.log(`[Servidor] Apagando por ${signal}...`);

        if (this.tickInterval) clearInterval(this.tickInterval);

        for (const [roomId, room] of this.rooms) {
            this.stopRoomIntervals(roomId);
            if (room.tiktokConnector) {
                room.tiktokConnector.disconnect();
            }
            if (room.leaderboardFlushTimer) clearTimeout(room.leaderboardFlushTimer);
            await this.flushLeaderboardToSupabase(roomId);
        }

        this.io.close(() => {
            this.server.close(() => {
                console.log('[Servidor] Apagado limpio completado');
                process.exit(0);
            });
        });
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`[Servidor] PET BATTLE ARENA ejecutándose en http://localhost:${this.port}`);
        });
    }
}

module.exports = PetBattleArenaServer;

if (require.main === module) {
    const server = new PetBattleArenaServer();
    server.start();
}
