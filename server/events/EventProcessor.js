/**
 * Procesador de Eventos
 * Procesa eventos de TikTok y los convierte en acciones del juego
 */

class EventProcessor {
    constructor(server) {
        this.server = server;
        
        // Configuraciones de tipos de mascotas
        this.petTypes = {
            'gato': {
                name: 'Gato',
                hp: 80,
                damage: 15,
                speed: 12,
                color: 0xFF6B9D,  // Rosa
                emoji: '🐱',
                scale: 1.0
            },
            'perro': {
                name: 'Perro',
                hp: 120,
                damage: 20,
                speed: 8,
                color: 0xC4A484,  // Marrón
                emoji: '🐕',
                scale: 1.2
            },
            'dragon': {
                name: 'Dragón',
                hp: 200,
                damage: 40,
                speed: 5,
                color: 0xFF4500,  // Rojo-Naranja
                emoji: '🐉',
                scale: 1.5,
                special: 'fire'
            },
            'conejo': {
                name: 'Conejo',
                hp: 50,
                damage: 8,
                speed: 15,
                color: 0xFFFFFF,  // Blanco
                emoji: '🐰',
                scale: 0.8
            }
        };

        // Seguimiento de enfriamiento por usuario
        this.userCooldowns = new Map();
        this.userLikeBuckets = new Map();
        this.GLOBAL_COOLDOWN = 1000; // 1 segundo entre generaciones por usuario
    }

    generatePetId() {
        return `pet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    checkCooldown(userId) {
        const normalizedUser = String(userId || '').trim().toLowerCase() || 'anonymous';
        const lastSpawn = this.userCooldowns.get(normalizedUser);
        if (lastSpawn && (Date.now() - lastSpawn) < this.GLOBAL_COOLDOWN) {
            return false;
        }
        this.userCooldowns.set(normalizedUser, Date.now());
        return true;
    }

    normalizeOwner(ownerUsername) {
        return String(ownerUsername || '').trim().toLowerCase() || 'anonymous';
    }

    getOwnerProgress(ownerUsername) {
        const owner = this.normalizeOwner(ownerUsername);
        const progressMap = this.server.gameState.userProgress;
        if (!progressMap.has(owner)) {
            progressMap.set(owner, { level: 1 });
        }
        return progressMap.get(owner);
    }

    increaseOwnerLevel(ownerUsername, levels) {
        const owner = this.normalizeOwner(ownerUsername);
        const progress = this.getOwnerProgress(ownerUsername);
        progress.level = Math.max(1, (progress.level || 1) + levels);
        if (typeof this.server.upsertUserProgress === 'function') {
            this.server.upsertUserProgress(owner, progress.level);
        }
        return progress.level;
    }

    syncOwnerProgressFromPet(pet) {
        if (!pet) return;
        const owner = this.normalizeOwner(pet.owner);
        const progress = this.getOwnerProgress(owner);
        progress.level = Math.max(progress.level || 1, pet.level || 1);
        if (typeof this.server.upsertUserProgress === 'function') {
            this.server.upsertUserProgress(owner, progress.level);
        }
    }

    hasActivePetForOwner(ownerUsername) {
        const normalizedOwner = String(ownerUsername || '').trim().toLowerCase();
        if (!normalizedOwner) return false;
        return Array.from(this.server.gameState.pets.values()).some(
            (pet) => String(pet.owner || '').trim().toLowerCase() === normalizedOwner
        );
    }

    processComment(comment) {
        const username = String(comment?.username || '').trim().toLowerCase() || 'anonymous';
        const text = String(comment?.text || '');
        const nickname = comment?.nickname || username;
        
        // Normalizar texto
        const normalizedText = text.toLowerCase().trim();

        // Verificar disparadores de tipo de mascota
        for (const [trigger, config] of Object.entries(this.petTypes)) {
            if (normalizedText.includes(trigger)) {
                const hasActivePet = this.hasActivePetForOwner(username);
                if (!hasActivePet || this.checkCooldown(username)) {
                    this.spawnPet({
                        owner: username,
                        ownerName: nickname,
                        type: trigger,
                        ...config
                    });
                    console.log(`[Evento] ${nickname} generó un ${config.name}!`);
                }
                return;
            }
        }

        // Verificar disparadores de emoji
        if (text.includes('🔥')) {
            this.spawnPet({
                owner: username,
                ownerName: nickname,
                type: 'dragon',
                ...this.petTypes['dragon']
            });
        } else if (text.includes('🐱') || text.includes('😺')) {
            this.spawnPet({
                owner: username,
                ownerName: nickname,
                type: 'gato',
                ...this.petTypes['gato']
            });
        } else if (text.includes('🐕') || text.includes('🐶')) {
            this.spawnPet({
                owner: username,
                ownerName: nickname,
                type: 'perro',
                ...this.petTypes['perro']
            });
        } else if (text.includes('🐰') || text.includes('🐇')) {
            this.spawnPet({
                owner: username,
                ownerName: nickname,
                type: 'conejo',
                ...this.petTypes['conejo']
            });
        }
    }

    processPetSpawn(data) {
        // Manejar generación de mascotas desde Socket.IO (modo demostración)
        const { owner, type } = data;

        const petType = this.petTypes[type] ? type : 'gato';
        if (this.petTypes[petType]) {
            this.spawnPet({
                owner: owner || 'demo_user',
                ownerName: owner || 'Usuario Demo',
                type: petType,
                ...this.petTypes[petType]
            });
        }
    }

    processDemoSpawn(data) {
        this.processPetSpawn(data || {});
    }

    spawnPet(config) {
        const id = this.generatePetId();
        const normalizedOwner = this.normalizeOwner(config.owner);
        const ownerProgress = this.getOwnerProgress(normalizedOwner);
        const spawnLevel = Math.max(1, Number(ownerProgress.level) || 1);
        const hpAtLevel = config.hp + (spawnLevel - 1) * 10;
        const damageAtLevel = config.damage + (spawnLevel - 1) * 5;
        
        const pet = {
            id: id,
            owner: normalizedOwner,
            ownerName: config.ownerName || normalizedOwner,
            type: config.type,
            name: config.name,
            hp: hpAtLevel,
            maxHp: hpAtLevel,
            damage: damageAtLevel,
            speed: config.speed,
            color: config.color,
            emoji: config.emoji,
            scale: config.scale,
            special: config.special || null,
            level: spawnLevel,
            xp: 0,
            // Posición será establecida por el cliente
            x: 0,
            y: 0,
            createdAt: Date.now(),
            // Estadísticas de combate
            attackCooldown: 0,
            targetId: null,
            isAttacking: false,
            isDead: false
        };

        this.syncOwnerProgressFromPet(pet);
        this.server.addPet(pet);
        return pet;
    }

    processGift(gift) {
        const { username, nickname, giftName, giftCount, diamondCount, isViralGift } = gift;

        // Actualizar total de regalos
        this.server.gameState.totalGifts += diamondCount;

        console.log(`[Regalo] ${nickname} envió ${giftCount}x ${giftName} (${diamondCount} diamantes)`);

        // Efectos basados en nivel
        if (isViralGift) {
            // ACTIVACIÓN DE MEGA MASCOTA
            this.server.activateMegaPet(nickname, 30000);
            return;
        }

        if (diamondCount >= 500) {
            // Regalo mayor - generar 3 mascotas a la vez
            const types = ['gato', 'perro', 'dragon'];
            types.forEach(type => {
                this.spawnPet({
                    owner: username,
                    ownerName: nickname,
                    type: type,
                    ...this.petTypes[type]
                });
            });
            
            // Mejorar todas las mascotas existentes
            this.upgradeAllPets(2);
        } else if (diamondCount >= 100) {
            // Regalo menor - generar 2 mascotas
            const types = ['gato', 'perro'];
            types.forEach(type => {
                this.spawnPet({
                    owner: username,
                    ownerName: nickname,
                    type: type,
                    ...this.petTypes[type]
                });
            });
        } else {
            // Micro regalo - generar 1 mascota
            this.spawnPet({
                owner: username,
                ownerName: nickname,
                type: 'gato',
                ...this.petTypes['gato']
            });
        }
    }

    processLikes(payload) {
        const likeCount = Math.max(
            0,
            Number(typeof payload === 'object' ? payload?.likeCount : payload) || 0
        );
        if (likeCount <= 0) return;

        const usernameRaw = typeof payload === 'object' ? (payload?.username || payload?.owner) : '';
        const username = String(usernameRaw || '').trim().toLowerCase();

        this.server.gameState.totalLikes += likeCount;
        this.server.gameState.likesCurrentMinute += likeCount;

        // Regla principal: cada 50 likes del mismo usuario, sube su(s) mascota(s).
        if (username) {
            const accumulated = (this.userLikeBuckets.get(username) || 0) + likeCount;
            const levelUps = Math.floor(accumulated / 50);
            const remaining = accumulated % 50;
            this.userLikeBuckets.set(username, remaining);

            if (levelUps > 0) {
                const upgradedCount = this.upgradePetsByOwner(username, levelUps);
                if (upgradedCount > 0) {
                    console.log(`[Likes] ${username} subio ${upgradedCount} mascota(s) +${levelUps} nivel(es) por likes.`);
                }
            }
        }
    }

    upgradePetsByOwner(ownerUsername, levels) {
        if (!ownerUsername || levels <= 0) return 0;
        const normalizedOwner = this.normalizeOwner(ownerUsername);
        this.increaseOwnerLevel(normalizedOwner, levels);

        const pets = Array.from(this.server.gameState.pets.values()).filter(
            (pet) => this.normalizeOwner(pet.owner) === normalizedOwner
        );

        pets.forEach((pet) => {
            pet.level += levels;
            pet.hp += levels * 10;
            pet.maxHp += levels * 10;
            pet.damage += levels * 5;
            this.syncOwnerProgressFromPet(pet);
            this.server.io.emit('pet:updated', {
                id: pet.id,
                hp: pet.hp,
                maxHp: pet.maxHp,
                level: pet.level,
                damage: pet.damage
            });
        });

        if (pets.length > 0) {
            this.server.io.emit('pets:upgrade', {
                levelsGained: levels,
                petCount: pets.length,
                owner: normalizedOwner
            });
        }

        return pets.length;
    }

    processFollow(subscriber) {
        // Seguir da un pequeño impulso de HP a todas las mascotas
        console.log(`[Seguir] ¡${subscriber.nickname} siguió!`);
        
        this.server.io.emit('event:follow', {
            username: subscriber.nickname,
            message: `${subscriber.nickname} se unió como follower! 💜`
        });
    }

    processShare(sharer) {
        // Compartir genera una mascota especial arcoíris
        console.log(`[Compartir] ¡${sharer.username} compartió el stream!`);
        
        this.spawnPet({
            owner: sharer.username,
            ownerName: sharer.username,
            type: 'conejo',
            name: 'Conejo Arcoíris',
            hp: 30,
            damage: 5,
            speed: 20,
            color: 0xFF69B4, // Rosa arcoíris
            emoji: '🌈',
            scale: 0.6
        });
    }

    upgradeAllPets(levels) {
        const pets = Array.from(this.server.gameState.pets.values());
        
        pets.forEach(pet => {
            pet.level += levels;
            pet.hp += levels * 10;
            pet.maxHp += levels * 10;
            pet.damage += levels * 5;
            this.syncOwnerProgressFromPet(pet);
            this.server.io.emit('pet:updated', {
                id: pet.id,
                hp: pet.hp,
                maxHp: pet.maxHp,
                level: pet.level,
                damage: pet.damage
            });
        });

        this.server.io.emit('pets:upgrade', {
            levelsGained: levels,
            petCount: pets.length
        });
    }
}

module.exports = EventProcessor;
