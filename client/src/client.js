/**
 * PET BATTLE ARENA - Cliente Completo
 * JavaScript todo-en-uno para compatibilidad con navegadores
 */

// ============================================
// CONFIGURACIÓN DEL JUEGO
// ============================================
const GAME_CONFIG = {
    width: 1920,
    height: 1080,
    physics: { gravity: 800, debug: false },
    petTypes: {
        gato: { name: 'Gato', hp: 80, damage: 15, speed: 12, color: 0xFF6B9D, emoji: '🐱', scale: 1.0, attackRange: 80 },
        perro: { name: 'Perro', hp: 120, damage: 20, speed: 8, color: 0xC4A484, emoji: '🐕', scale: 1.2, attackRange: 80 },
        dragon: { name: 'Dragón', hp: 200, damage: 40, speed: 5, color: 0xFF4500, emoji: '🐉', scale: 1.5, attackRange: 150, special: 'fire' },
        conejo: { name: 'Conejo', hp: 50, damage: 8, speed: 15, color: 0xFFFFFF, emoji: '🐰', scale: 0.8, attackRange: 60 }
    },
    performance: { maxPets: 200, maxEnemies: 50, maxParticles: 500, targetFps: 60 }
};

// ============================================
// ESTADO DEL JUEGO
// ============================================
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
    tiktokUsername: ''
};

// ============================================
// CLASE DEL JUEGO PHASER
// ============================================
class PetBattleGame extends Phaser.Scene {
    constructor() {
        super({ key: 'PetBattleGame' });
        this.pets = null;
        this.enemies = null;
        this.isMegaPetActive = false;
        this.megaPetSprite = null;
        this.gameTime = 0;
        this.lastUpdate = 0;
    }

    preload() {
        // Generar todos los recursos proceduralmente
        this.generateAssets();
    }

    generateAssets() {
        const petTypes = ['gato', 'perro', 'dragon', 'conejo'];
        const colors = { gato: 0xFF6B9D, perro: 0xC4A484, dragon: 0xFF4500, conejo: 0xFFFFFF };

        petTypes.forEach(type => {
            const size = type === 'dragon' ? 64 : type === 'perro' ? 48 : 40;
            const g = this.make.graphics({ x: 0, y: 0, add: false });
            
            // Cuerpo
            g.fillStyle(colors[type], 1);
            g.fillCircle(size / 2, size / 2, size / 2 - 2);
            
            // Ojos
            g.fillStyle(0x000000, 1);
            g.fillCircle(size / 2 - 8, size / 2 - 5, 4);
            g.fillCircle(size / 2 + 8, size / 2 - 5, 4);
            
            // Brillo
            g.fillStyle(0xFFFFFF, 0.3);
            g.fillCircle(size / 2 - 10, size / 2 - 10, 6);

            g.generateTexture(`pet_${type}`, size, size);
        });

        // Sprites de enemigos
        const enemyColors = [0xff6b6b, 0x9b59b6, 0x3498db, 0x2ecc71];
        for (let i = 0; i < 4; i++) {
            const g = this.make.graphics({ x: 0, y: 0, add: false });
            const size = 40;
            
            g.fillStyle(enemyColors[i], 1);
            g.fillCircle(size / 2, size / 2, size / 2 - 2);
            g.fillStyle(0xffffff, 1);
            g.fillCircle(size / 2 - 8, size / 2 - 5, 5);
            g.fillCircle(size / 2 + 8, size / 2 - 5, 5);
            g.fillStyle(0xff0000, 1);
            g.fillCircle(size / 2 - 8, size / 2 - 5, 2);
            g.fillCircle(size / 2 + 8, size / 2 - 5, 2);

            g.generateTexture(`enemy_${i}`, size, size);
        }

        // Mega mascota
        const mg = this.make.graphics({ x: 0, y: 0, add: false });
        const mSize = 128;
        mg.fillStyle(0xff00ff, 1);
        mg.fillCircle(mSize / 2, mSize / 2, mSize / 2 - 4);
        mg.fillStyle(0x00ffff, 0.5);
        mg.fillCircle(mSize / 2, mSize / 2, mSize / 3);
        mg.fillStyle(0xffffff, 0.3);
        mg.fillCircle(mSize / 2, mSize / 2, mSize / 4);
        mg.fillStyle(0xffd700, 1);
        mg.fillTriangle(mSize / 2 - 20, mSize / 2 - 30, mSize / 2, mSize / 2 - 55, mSize / 2 + 20, mSize / 2 - 30);
        mg.generateTexture('mega_pet', mSize, mSize);

        // Partícula
        const pg = this.make.graphics({ x: 0, y: 0, add: false });
        pg.fillStyle(0xffffff, 1);
        pg.fillCircle(4, 4, 4);
        pg.generateTexture('particle', 8, 8);
    }

    create() {
        // Crear mundo
        this.createWorld();
        
        // Crear grupos
        this.pets = this.add.group();
        this.enemies = this.group;

        // Partículas ambientales
        this.createAmbientParticles();

        // Configurar listeners de socket
        this.setupSocketListeners();

        console.log('[GameScene] Listo');
    }

    createWorld() {
        const { width, height } = this.cameras.main;

        // Fondo
        const bg = this.add.graphics();
        bg.fillStyle(0x0a0a0f, 1);
        bg.fillRect(0, 0, width, height);

        // Cuadrícula
        bg.lineStyle(1, 0x1a1a2e, 0.5);
        for (let x = 0; x < width; x += 50) {
            bg.moveTo(x, 0);
            bg.lineTo(x, height);
        }
        for (let y = 0; y < height; y += 50) {
            bg.moveTo(0, y);
            bg.lineTo(width, y);
        }
        bg.strokePath();

        // Borde
        bg.lineStyle(4, 0x00ffff, 0.3);
        bg.strokeRect(50, 50, width - 100, height - 100);

        // Física
        this.physics.world.setBounds(50, 50, width - 100, height - 100);
    }

    createAmbientParticles() {
        const { width, height } = this.cameras.main;
        for (let i = 0; i < 20; i++) {
            const p = this.add.circle(
                Math.random() * width,
                Math.random() * height,
                Math.random() * 3 + 1,
                0xffffff, 0.15
            );
            this.tweens.add({
                targets: p,
                y: p.y - 50 - Math.random() * 100,
                alpha: 0,
                duration: 3000 + Math.random() * 2000,
                repeat: -1,
                onRepeat: () => {
                    p.x = Math.random() * width;
                    p.y = height + 20;
                    p.alpha = 0.1 + Math.random() * 0.2;
                }
            });
        }
    }

    setupSocketListeners() {
        if (!window.socket) return;

        window.socket.on('pet:added', (pet) => {
            this.spawnPet(pet);
        });

        window.socket.on('pet:removed', (data) => {
            this.removePet(data.id);
        });

        window.socket.on('wave:spawn', (data) => {
            this.spawnWave(data);
        });

        window.socket.on('megaPet:activate', (data) => {
            this.activateMegaPet(data);
        });

        window.socket.on('megaPet:deactivate', () => {
            this.deactivateMegaPet();
        });

        window.socket.on('game:update', (state) => {
            this.updateUI(state);
        });
    }

    update(time, delta) {
        this.gameTime += delta;

        // Actualizar mascotas
        this.pets.getChildren().forEach(pet => {
            if (pet.active) {
                this.updatePetAI(pet, delta);
            }
        });

        // Actualizar enemigos
        this.enemies.getChildren().forEach(enemy => {
            if (enemy.active) {
                this.updateEnemyAI(enemy, delta);
            }
        });

        // Actualizar mega mascota
        if (this.isMegaPetActive && this.megaPetSprite) {
            this.updateMegaPet(delta);
        }
    }

    updatePetAI(pet, delta) {
        let nearestEnemy = null;
        let nearestDist = Infinity;

        this.enemies.getChildren().forEach(enemy => {
            if (enemy.active) {
                const dist = Phaser.Math.Distance.Between(pet.x, pet.y, enemy.x, enemy.y);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestEnemy = enemy;
                }
            }
        });

        if (nearestEnemy) {
            const attackRange = pet.petData.type === 'dragon' ? 150 : 80;
            
            if (nearestDist > attackRange) {
                const angle = Phaser.Math.Angle.Between(pet.x, pet.y, nearestEnemy.x, nearestEnemy.y);
                const speed = pet.petData.speed * (delta / 1000) * 60;
                pet.x += Math.cos(angle) * speed;
                pet.y += Math.sin(angle) * speed;
                pet.setFlipX(Math.cos(angle) < 0);
            } else if (pet.attackCooldown <= 0) {
                this.petAttack(pet, nearestEnemy);
                pet.attackCooldown = 500;
            }
        } else {
            this.wanderPet(pet, delta);
        }
        pet.attackCooldown -= delta;
    }

    wanderPet(pet, delta) {
        if (!pet.wanderTimer || pet.wanderTimer <= 0) {
            pet.wanderDirection = Math.random() * Math.PI * 2;
            pet.wanderTimer = 1000 + Math.random() * 2000;
        }
        const speed = pet.petData.speed * 0.3 * (delta / 1000) * 60;
        pet.x += Math.cos(pet.wanderDirection) * speed;
        pet.y += Math.sin(pet.wanderDirection) * speed;
        pet.wanderTimer -= delta;
        
        const { width, height } = this.cameras.main;
        pet.x = Phaser.Math.Clamp(pet.x, 100, width - 100);
        pet.y = Phaser.Math.Clamp(pet.y, 100, height - 100);
    }

    updateEnemyAI(enemy, delta) {
        let nearestPet = null;
        let nearestDist = Infinity;

        this.pets.getChildren().forEach(pet => {
            if (pet.active) {
                const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, pet.x, pet.y);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestPet = pet;
                }
            }
        });

        if (nearestPet && nearestDist > 60) {
            const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, nearestPet.x, nearestPet.y);
            const speed = enemy.enemyData.speed * (delta / 1000) * 60;
            enemy.x += Math.cos(angle) * speed;
            enemy.y += Math.sin(angle) * speed;
            enemy.setFlipX(Math.cos(angle) < 0);
        } else if (nearestPet && enemy.attackCooldown <= 0) {
            this.enemyAttack(enemy, nearestPet);
            enemy.attackCooldown = 800;
        }
        enemy.attackCooldown -= delta;
    }

    petAttack(pet, enemy) {
        const damage = pet.petData.damage + (pet.petData.level || 1) * 5;
        enemy.enemyData.hp -= damage;
        
        this.tweens.add({ targets: pet, scaleX: pet.scaleX * 1.2, scaleY: pet.scaleY * 1.2, duration: 50, yoyo: true });
        this.tweens.add({ targets: enemy, alpha: 0.7, duration: 50, yoyo: true });
        this.particleBurst(enemy.x, enemy.y, 0xffff00, 5);
        this.cameras.main.shake(50, 0.002);

        if (enemy.enemyData.hp <= 0) {
            this.enemyDeath(enemy);
        }
    }

    enemyAttack(enemy, pet) {
        const damage = enemy.enemyData.damage;
        pet.petData.hp -= damage;
        
        this.tweens.add({ targets: pet, tint: 0xff0000, duration: 50, yoyo: true });
        this.showDamageNumber(pet.x, pet.y - 20, damage);

        if (pet.petData.hp <= 0) {
            this.petDeath(pet);
        }
    }

    enemyDeath(enemy) {
        this.particleExplosion(enemy.x, enemy.y, 0xff0000, 15);
        this.tweens.add({
            targets: enemy,
            alpha: 0,
            scale: 0,
            duration: 200,
            onComplete: () => enemy.destroy()
        });
    }

    petDeath(pet) {
        this.particleExplosion(pet.x, pet.y, 0xff0000, 20);
        if (pet.nameText) pet.nameText.destroy();
        if (pet.levelText) pet.levelText.destroy();
        pet.destroy();
    }

    spawnPet(petData) {
        const { width, height } = this.cameras.main;
        const x = 100 + Math.random() * (width - 200);
        const y = 100 + Math.random() * (height - 200);

        const sprite = this.add.sprite(x, y, `pet_${petData.type}`);
        sprite.setScale(petData.scale || 1);
        sprite.setDepth(10);
        sprite.petData = petData;
        sprite.attackCooldown = 0;

        // Nombre
        const nameText = this.add.text(x, y - 30, petData.ownerName || 'Jugador', {
            fontSize: '14px', fontFamily: 'Arial', color: '#ffffff', stroke: '#000000', strokeThickness: 2
        });
        nameText.setOrigin(0.5);
        nameText.setDepth(12);
        sprite.nameText = nameText;

        // Nivel
        const levelText = this.add.text(x + 20, y - 20, `Nv${petData.level || 1}`, {
            fontSize: '12px', fontFamily: 'Arial', color: '#ffff00', stroke: '#000000', strokeThickness: 1
        });
        levelText.setOrigin(0.5);
        levelText.setDepth(12);
        sprite.levelText = levelText;

        this.physics.add.existing(sprite);
        sprite.body.setCircle(20);
        sprite.body.setCollideWorldBounds(true);

        this.pets.add(sprite);
        this.particleBurst(x, y, petData.color, 10);
        this.showFloatingText(x, y - 50, `+${petData.name}`, petData.color);

        return sprite;
    }

    removePet(petId) {
        this.pets.getChildren().forEach(pet => {
            if (pet.petData && pet.petData.id === petId) {
                this.particleExplosion(pet.x, pet.y, 0xff0000, 20);
                if (pet.nameText) pet.nameText.destroy();
                if (pet.levelText) pet.levelText.destroy();
                pet.destroy();
            }
        });
    }

    spawnWave(waveData) {
        this.showWaveAnnouncement(waveData.wave);
        
        for (let i = 0; i < waveData.enemyCount; i++) {
            this.time.delayedCall(i * 500, () => {
                this.spawnEnemy(waveData);
            });
        }

        // Jefe cada 5 oleadas
        if (waveData.wave % 5 === 0) {
            this.time.delayedCall(2000, () => this.spawnBoss(waveData));
        }
    }

    spawnEnemy(waveData) {
        const { width, height } = this.cameras.main;
        const side = Math.floor(Math.random() * 4);
        let x, y;
        
        switch (side) {
            case 0: x = Math.random() * width; y = -30; break;
            case 1: x = width + 30; y = Math.random() * height; break;
            case 2: x = Math.random() * width; y = height + 30; break;
            case 3: x = -30; y = Math.random() * height; break;
        }

        const typeIndex = Math.min(Math.floor(waveData.difficulty / 2), 3);
        const sprite = this.add.sprite(x, y, `enemy_${typeIndex}`);
        sprite.setScale(0.8 + Math.random() * 0.4);
        sprite.setDepth(5);
        sprite.setTint(0xff6666);

        sprite.enemyData = {
            hp: Math.floor(50 * waveData.difficulty.health),
            maxHp: Math.floor(50 * waveData.difficulty.health),
            damage: Math.floor(10 * waveData.difficulty.damage),
            speed: 2 + waveData.difficulty.speed
        };
        sprite.attackCooldown = 0;

        this.physics.add.existing(sprite);
        sprite.body.setCircle(20);

        this.enemies.add(sprite);
        this.particleBurst(x, y, 0xff0000, 5);
    }

    spawnBoss(waveData) {
        const { width, height } = this.cameras.main;
        
        const bossText = this.add.text(width / 2, height / 2, '👹 JEFE 👹', {
            fontSize: '64px', fontFamily: 'Arial Black', color: '#ff0000', stroke: '#000000', strokeThickness: 4
        });
        bossText.setOrigin(0.5);
        bossText.setDepth(200);
        this.tweens.add({ targets: bossText, alpha: 0, y: height / 2 - 100, duration: 1500, delay: 2000, onComplete: () => bossText.destroy() });

        const sprite = this.add.sprite(width / 2, -50, 'enemy_0');
        sprite.setScale(3);
        sprite.setDepth(50);
        sprite.setTint(0xff0000);
        sprite.enemyData = {
            hp: 500 * waveData.difficulty.health,
            maxHp: 500 * waveData.difficulty.health,
            damage: 30 * waveData.difficulty.damage,
            speed: 1 + waveData.difficulty.speed * 0.5,
            isBoss: true
        };
        sprite.attackCooldown = 0;

        this.tweens.add({ targets: sprite, y: 150, duration: 1000, ease: 'Bounce.easeOut' });
        this.particleExplosion(width / 2, 150, 0xff0000, 30);
        this.cameras.main.shake(500, 0.01);

        this.enemies.add(sprite);
    }

    showWaveAnnouncement(waveNumber) {
        const { width, height } = this.cameras.main;
        
        const text = this.add.text(width / 2, height / 2 - 50, `OLEADA ${waveNumber}`, {
            fontSize: '72px', fontFamily: 'Arial Black', color: '#ffffff', stroke: '#ff00ff', strokeThickness: 6
        });
        text.setOrigin(0.5);
        text.setAlpha(0);
        text.setDepth(200);

        this.tweens.add({
            targets: text,
            alpha: 1, scaleX: 1.2, scaleY: 1.2,
            duration: 300, ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: text,
                    alpha: 0, scaleX: 0.5, scaleY: 0.5,
                    duration: 500, delay: 1000,
                    onComplete: () => text.destroy()
                });
            }
        });

        this.cameras.main.shake(300, 0.005);
    }

    activateMegaPet(data) {
        this.isMegaPetActive = true;
        const { width, height } = this.cameras.main;
        
        this.megaPetSprite = this.add.sprite(width / 2, height / 2, 'mega_pet');
        this.megaPetSprite.setScale(2);
        this.megaPetSprite.setDepth(100);
        this.megaPetSprite.setAlpha(0);

        this.tweens.add({
            targets: this.megaPetSprite,
            alpha: 1, scale: 2.5,
            duration: 1000, ease: 'Back.easeOut'
        });

        this.particleMegaPetActivation(width / 2, height / 2);

        // Ocultar todas las mascotas
        this.pets.getChildren().forEach(pet => {
            if (pet.active) {
                this.tweens.add({ targets: [pet, pet.nameText, pet.levelText], alpha: 0, duration: 500 });
            }
        });
    }

    deactivateMegaPet() {
        this.isMegaPetActive = false;
        
        if (this.megaPetSprite) {
            this.tweens.add({
                targets: this.megaPetSprite,
                alpha: 0, scale: 0,
                duration: 500,
                onComplete: () => { this.megaPetSprite.destroy(); this.megaPetSprite = null; }
            });
        }

        this.pets.getChildren().forEach(pet => {
            this.tweens.add({ targets: [pet, pet.nameText, pet.levelText], alpha: 1, duration: 500 });
        });
    }

    updateMegaPet(delta) {
        if (!this.megaPetSprite) return;

        let nearestEnemy = null;
        let nearestDist = Infinity;

        this.enemies.getChildren().forEach(enemy => {
            if (enemy.active) {
                const dist = Phaser.Math.Distance.Between(this.megaPetSprite.x, this.megaPetSprite.y, enemy.x, enemy.y);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestEnemy = enemy;
                }
            }
        });

        if (nearestEnemy && nearestDist > 200) {
            const angle = Phaser.Math.Angle.Between(this.megaPetSprite.x, this.megaPetSprite.y, nearestEnemy.x, nearestEnemy.y);
            this.megaPetSprite.x += Math.cos(angle) * 8 * (delta / 1000) * 60;
            this.megaPetSprite.y += Math.sin(angle) * 8 * (delta / 1000) * 60;
        }

        const scale = 1 + Math.sin(this.gameTime * 0.01) * 0.1;
        this.megaPetSprite.setScale(scale);

        // Ataque masivo
        this.enemies.getChildren().forEach(enemy => {
            if (enemy.active) {
                const dist = Phaser.Math.Distance.Between(this.megaPetSprite.x, this.megaPetSprite.y, enemy.x, enemy.y);
                if (dist < 300) {
                    const damage = Math.floor(50 * (1 - dist / 300));
                    enemy.enemyData.hp -= damage;
                    this.particleExplosion(enemy.x, enemy.y, 0xff00ff);
                    this.tweens.add({ targets: enemy, alpha: 0.5, duration: 100, yoyo: true });
                    
                    if (enemy.enemyData.hp <= 0) {
                        this.enemyDeath(enemy);
                    }
                }
            }
        });
    }

    updateUI(state) {
        // Actualizar oleada
        const waveEl = document.getElementById('wave-number');
        if (waveEl) waveEl.textContent = state.wave;

        // Actualizar contadores
        const petCountEl = document.getElementById('pet-count');
        if (petCountEl) petCountEl.textContent = this.pets.getChildren().length;

        const enemyCountEl = document.getElementById('enemy-count');
        if (enemyCountEl) enemyCountEl.textContent = this.enemies.getChildren().length;

        const giftCountEl = document.getElementById('gift-count');
        if (giftCountEl) giftCountEl.textContent = state.totalGifts;

        const activePetsEl = document.getElementById('active-pets');
        if (activePetsEl) activePetsEl.textContent = this.pets.getChildren().length;

        // Actualizar likes
        const likesFillEl = document.getElementById('likes-fill');
        if (likesFillEl) {
            likesFillEl.style.width = Math.min((state.likesPerMinute / 200) * 100, 100) + '%';
        }

        const lpmEl = document.getElementById('lpm-value');
        if (lpmEl) lpmEl.textContent = state.likesPerMinute;
    }

    // Efectos de partículas
    particleBurst(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            const p = this.add.sprite(x, y, 'particle');
            p.setTint(color);
            p.setScale(0.5 + Math.random() * 0.5);
            p.setDepth(50);

            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 100;
            
            this.physics.add.existing(p);
            p.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
            p.body.setGravityY(200);

            this.tweens.add({
                targets: p,
                alpha: 0, scaleX: 0, scaleY: 0,
                duration: 500 + Math.random() * 500,
                onComplete: () => p.destroy()
            });
        }
    }

    particleExplosion(x, y, color, count = 20) {
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const speed = 100 + Math.random() * 100;
            
            const p = this.add.sprite(x, y, 'particle');
            p.setTint(color);
            p.setScale(0.3 + Math.random() * 0.4);
            p.setDepth(50);

            this.physics.add.existing(p);
            p.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

            this.tweens.add({
                targets: p,
                alpha: 0, scaleX: 0, scaleY: 0,
                duration: 600 + Math.random() * 400,
                onComplete: () => p.destroy()
            });
        }
    }

    particleMegaPetActivation(x, y) {
        const colors = [0xff00ff, 0x00ffff, 0xffff00, 0xff69b4];
        
        for (let wave = 0; wave < 3; wave++) {
            this.time.delayedCall(wave * 200, () => {
                colors.forEach(color => this.particleExplosion(x, y, color, 30));
            });
        }

        // Onda de choque
        const ring = this.add.circle(x, y, 50, 0xffffff, 0.5);
        ring.setStrokeStyle(4, 0x00ffff, 1);
        ring.setDepth(90);
        this.tweens.add({
            targets: ring,
            scaleX: 6, scaleY: 6, alpha: 0,
            duration: 1000,
            onComplete: () => ring.destroy()
        });

        // Destello
        const flash = this.add.rectangle(this.cameras.main.centerX, this.cameras.main.centerY, this.cameras.main.width, this.cameras.main.height, 0xffffff, 0.5);
        flash.setDepth(200);
        this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
    }

    showFloatingText(x, y, text, color = 0xffffff) {
        const t = this.add.text(x, y, text, {
            fontSize: '18px', fontFamily: 'Arial Black', color: '#ffffff', stroke: '#000000', strokeThickness: 3
        });
        t.setOrigin(0.5);
        t.setDepth(100);

        this.tweens.add({
            targets: t,
            y: y - 50, alpha: 0,
            duration: 1500, ease: 'Power2',
            onComplete: () => t.destroy()
        });
    }

    showDamageNumber(x, y, damage) {
        const t = this.add.text(x, y, `-${damage}`, {
            fontSize: '14px', fontFamily: 'Arial Black', color: '#ff0000', stroke: '#000000', strokeThickness: 2
        });
        t.setOrigin(0.5);
        t.setDepth(100);

        this.tweens.add({
            targets: t,
            y: y - 30, alpha: 0,
            duration: 800, ease: 'Power2',
            onComplete: () => t.destroy()
        });
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================
window.initGame = async function() {
    console.log('[Juego] Inicializando PET BATTLE ARENA...');

    try {
        // Conectar a Socket.IO
        window.socket = io(window.location.origin, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000
        });

        window.socket.on('connect', () => {
            console.log('[Socket] Conectado');
            updateConnectionStatus(true);
        });

        window.socket.on('disconnect', () => {
            updateConnectionStatus(false);
        });

        window.socket.on('connect_error', () => {
            updateConnectionStatus(false);
        });

        // Crear juego Phaser
        const game = new Phaser.Game({
            type: Phaser.AUTO,
            width: GAME_CONFIG.width,
            height: GAME_CONFIG.height,
            parent: 'game-container',
            backgroundColor: '#0a0a0f',
            physics: {
                default: 'arcade',
                arcade: { debug: false }
            },
            scene: [PetBattleGame],
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH
            }
        });

        console.log('[Juego] Phaser inicializado');
    } catch (error) {
        console.error('[Juego] Error:', error);
    }
};

function updateConnectionStatus(connected) {
    const el = document.getElementById('connection-status');
    if (el) {
        el.className = 'connection-status ' + (connected ? 'connected' : 'disconnected');
        el.textContent = connected ? '⚡ Conectado al servidor' : '⚡ Desconectado';
    }
}
