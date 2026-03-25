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
        this.GLOBAL_COOLDOWN = 1000; // 1 segundo entre generaciones por usuario
    }

    generatePetId() {
        return `pet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    checkCooldown(userId) {
        const lastSpawn = this.userCooldowns.get(userId);
        if (lastSpawn && (Date.now() - lastSpawn) < this.GLOBAL_COOLDOWN) {
            return false;
        }
        this.userCooldowns.set(userId, Date.now());
        return true;
    }

    processComment(comment) {
        const { username, text, nickname } = comment;
        
        // Normalizar texto
        const normalizedText = text.toLowerCase().trim();

        // Verificar disparadores de tipo de mascota
        for (const [trigger, config] of Object.entries(this.petTypes)) {
            if (normalizedText.includes(trigger)) {
                if (this.checkCooldown(username)) {
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
        
        if (this.petTypes[type]) {
            this.spawnPet({
                owner: owner || 'demo_user',
                ownerName: owner || 'Usuario Demo',
                type: type,
                ...this.petTypes[type]
            });
        }
    }

    spawnPet(config) {
        const id = this.generatePetId();
        
        const pet = {
            id: id,
            owner: config.owner,
            ownerName: config.ownerName,
            type: config.type,
            name: config.name,
            hp: config.hp,
            maxHp: config.hp,
            damage: config.damage,
            speed: config.speed,
            color: config.color,
            emoji: config.emoji,
            scale: config.scale,
            special: config.special || null,
            level: 1,
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

    processLikes(count) {
        this.server.gameState.totalLikes += count;
        
        // Cada 50 likes, mejorar todas las mascotas ligeramente
        const likesMod = this.server.gameState.totalLikes % 50;
        if (likesMod < count) {
            this.upgradeAllPets(1);
            console.log(`[Likes] Mejora de mascotas activada en ${this.server.gameState.totalLikes} likes totales`);
        }

        // Actualizar LPM
        this.server.gameState.likesPerMinute += count;
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
        });

        this.server.io.emit('pets:upgrade', {
            levelsGained: levels,
            petCount: pets.length
        });
    }
}

module.exports = EventProcessor;
