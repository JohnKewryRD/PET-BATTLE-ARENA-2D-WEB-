/**
 * Escena del Juego
 * Lógica principal del juego - combate, generación, partículas
 */

import { GAME_CONFIG } from '../config/GameConfig.js';
import { ObjectPool } from '../systems/ObjectPool.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { WaveSystem } from '../systems/WaveSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';

const Phaser = window.Phaser;

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.isReady = false;
    }

    create() {
        GameScene.instance = this;
        this.isReady = true;
        console.log('[GameScene] Iniciando...');

        // Inicializar sistemas
        this.objectPool = new ObjectPool(this);
        this.combatSystem = new CombatSystem(this);
        this.particleSystem = new ParticleSystem(this);
        this.waveSystem = new WaveSystem(this);
        this.audioSystem = new AudioSystem();

        // Crear mundo del juego
        try { this.createWorld(); } catch(e) { console.error('[GameScene] createWorld ERROR:', e); }

        // Grupos de entidades
        this.pets = this.add.group();
        this.enemies = this.add.group();
        this.projectiles = this.add.group();

        // Estado de Mega Mascota
        this.isMegaPetActive = false;
        this.megaPetSprite = null;
        this.fusedPets = [];

        // Crear efectos de fondo
        try { this.createBackground(); } catch(e) { console.error('[GameScene] createBackground ERROR:', e); }

        // Iniciar bucle del juego
        this.lastUpdate = 0;
        this.gameTime = 0;

        if (typeof window.hydrateSceneFromState === 'function') {
            window.hydrateSceneFromState();
        }

        console.log('[GameScene] Listo');
    }

    createWorld() {
        const { width, height } = this.cameras.main;

        // Physics bounds
        this.physics.world.setBounds(50, 50, width - 100, height - 100);

        // ── Deep background ───────────────────────────────────────────────────
        const g = this.add.graphics();
        g.fillStyle(0x050510, 1);
        g.fillRect(0, 0, width, height);

        // Subtle radial glow in center
        for (let i = 6; i >= 1; i--) {
            g.fillStyle(0x0d0d2e, 0.025 * i);
            g.fillEllipse(width / 2, height / 2, width * 0.7 * (i / 6), height * 0.7 * (i / 6));
        }

        // ── Simple dot grid (safe Phaser 3 API) ──────────────────────────────
        g.fillStyle(0x00f5ff, 0.04);
        const gs = 55;
        for (let gx = gs; gx < width; gx += gs) {
            for (let gy = gs; gy < height; gy += gs) {
                g.fillCircle(gx, gy, 1);
            }
        }

        // ── Corner ambient glows (ADD blend) ─────────────────────────────────
        const ambient = this.add.graphics();
        ambient.setBlendMode(Phaser.BlendModes.ADD);
        ambient.fillStyle(0x00f5ff, 0.04); ambient.fillCircle(0, 0, 320);
        ambient.fillStyle(0xff00cc, 0.04); ambient.fillCircle(width, height, 320);
        ambient.fillStyle(0x7c4dff, 0.03); ambient.fillCircle(width, 0, 260);
        ambient.fillStyle(0xff6600, 0.03); ambient.fillCircle(0, height, 260);

        // ── Arena floor ───────────────────────────────────────────────────────
        const arena = this.add.graphics();
        arena.fillStyle(0x0a0a1e, 0.75);
        arena.fillRoundedRect(50, 50, width - 100, height - 100, 10);

        // Scanlines — need beginPath() before moveTo/lineTo
        arena.lineStyle(1, 0xffffff, 0.01);
        arena.beginPath();
        for (let y = 56; y < height - 52; y += 5) {
            arena.moveTo(54, y);
            arena.lineTo(width - 54, y);
        }
        arena.strokePath();

        // ── Arena border (using lineBetween — guaranteed to work) ─────────────
        const border = this.add.graphics();

        // Outer soft glow: 4 semi-transparent thick lines around the rect
        [{ t: 8, a: 0.03 }, { t: 5, a: 0.06 }, { t: 3, a: 0.12 }].forEach(({ t, a }) => {
            border.lineStyle(t, 0x00f5ff, a);
            border.beginPath();
            border.moveTo(50, 50); border.lineTo(width - 50, 50);
            border.lineTo(width - 50, height - 50); border.lineTo(50, height - 50);
            border.closePath(); border.strokePath();
        });

        // Main border — bright cyan
        border.lineStyle(2.5, 0x00f5ff, 0.85);
        border.beginPath();
        border.moveTo(50, 50); border.lineTo(width - 50, 50);
        border.lineTo(width - 50, height - 50); border.lineTo(50, height - 50);
        border.closePath(); border.strokePath();

        // Inner border dim
        border.lineStyle(1, 0x00f5ff, 0.2);
        border.beginPath();
        border.moveTo(56, 56); border.lineTo(width - 56, 56);
        border.lineTo(width - 56, height - 56); border.lineTo(56, height - 56);
        border.closePath(); border.strokePath();

        // ── Corner ornaments ─────────────────────────────────────────────────
        const corners = [
            { x: 50,         y: 50 },
            { x: width - 50, y: 50 },
            { x: 50,         y: height - 50 },
            { x: width - 50, y: height - 50 }
        ];
        const d = 28;
        corners.forEach(corner => {
            const sx = corner.x < width / 2 ? 1 : -1;
            const sy = corner.y < height / 2 ? 1 : -1;

            // L-shaped bracket
            border.lineStyle(3, 0x00f5ff, 0.9);
            border.beginPath();
            border.moveTo(corner.x + sx * d, corner.y);
            border.lineTo(corner.x, corner.y);
            border.lineTo(corner.x, corner.y + sy * d);
            border.strokePath();

            // Corner dot + glow
            border.fillStyle(0x00f5ff, 0.25); border.fillCircle(corner.x, corner.y, 14);
            border.fillStyle(0x00f5ff, 0.9);  border.fillRect(corner.x - 4, corner.y - 4, 8, 8);
        });

        // ── Center marker ─────────────────────────────────────────────────────
        const cx2 = width / 2, cy2 = height / 2;
        border.fillStyle(0x00f5ff, 0.12); border.fillCircle(cx2, cy2, 22);
        border.lineStyle(1, 0x00f5ff, 0.18); border.strokeCircle(cx2, cy2, 22);
        border.lineStyle(1, 0x00f5ff, 0.07); border.strokeCircle(cx2, cy2, 44);

        border.lineStyle(1, 0x00f5ff, 0.08);
        border.beginPath();
        border.moveTo(cx2 - 60, cy2); border.lineTo(cx2 + 60, cy2);
        border.moveTo(cx2, cy2 - 60); border.lineTo(cx2, cy2 + 60);
        border.strokePath();

        // Depth ordering
        g.setDepth(0);
        ambient.setDepth(0);
        arena.setDepth(1);
        border.setDepth(2);
    }

    createBackground() {
        const { width, height } = this.cameras.main;

        // ── Floating ambient dust particles ───────────────────────────────────
        const ambientColors = [0x00f5ff, 0xff00cc, 0x7c4dff, 0xffd700, 0x2ed573];
        this.ambientParticles = [];

        for (let i = 0; i < 50; i++) {
            const color = ambientColors[Math.floor(Math.random() * ambientColors.length)];
            const r     = Math.random() * 2.5 + 0.5;
            const particle = this.add.circle(
                80 + Math.random() * (width - 160),
                Math.random() * height,
                r,
                color,
                0.05 + Math.random() * 0.15
            );
            particle.setDepth(3);
            particle.setBlendMode(Phaser.BlendModes.ADD);

            const dur = 3500 + Math.random() * 4000;

            this.tweens.add({
                targets: particle,
                y:       particle.y - 80 - Math.random() * 150,
                alpha:   0,
                x:       particle.x + (Math.random() - 0.5) * 60,
                duration: dur,
                repeat:  -1,
                yoyo:    false,
                delay:   Math.random() * 4000,
                onRepeat: () => {
                    particle.x     = 80 + Math.random() * (width - 160);
                    particle.y     = height - 60;
                    particle.alpha = 0.05 + Math.random() * 0.15;
                    particle.setRadius(Math.random() * 2.5 + 0.5);
                }
            });

            this.ambientParticles.push(particle);
        }

        // ── Twinkle stars (tiny static) ────────────────────────────────────
        for (let i = 0; i < 80; i++) {
            const star = this.add.circle(
                Math.random() * width,
                Math.random() * height,
                Math.random() * 1.5 + 0.5,
                0xffffff,
                Math.random() * 0.08 + 0.02
            );
            star.setDepth(1);

            this.tweens.add({
                targets: star,
                alpha:   { from: star.alpha * 0.2, to: star.alpha },
                duration: 1500 + Math.random() * 2500,
                repeat:  -1,
                yoyo:    true,
                delay:   Math.random() * 3000,
                ease:    'Sine.easeInOut'
            });
        }

        // ── Animated arena energy lines (vertical pulses) ─────────────────
        this._spawnEnergyLine(width, height);
    }

    resolveTextureKey(primaryKey) {
        if (this.textures && typeof this.textures.exists === 'function' && this.textures.exists(primaryKey)) {
            return primaryKey;
        }
        if (!this._missingTextureWarned) this._missingTextureWarned = new Set();
        if (!this._missingTextureWarned.has(primaryKey)) {
            this._missingTextureWarned.add(primaryKey);
            console.warn(`[GameScene] Textura faltante: ${primaryKey}. Usando fallback __WHITE.`);
        }
        // Fallback seguro para que las entidades sigan viendose si faltan texturas runtime.
        return '__WHITE';
    }

    _spawnEnergyLine(width, height) {
        const x    = 60 + Math.random() * (width - 120);
        const line = this.add.rectangle(x, height - 60, 1, 0, 0x00f5ff, 0.4);
        line.setOrigin(0.5, 1);
        line.setDepth(3);
        line.setBlendMode(Phaser.BlendModes.ADD);

        const lineH = 40 + Math.random() * 120;

        this.tweens.add({
            targets:  line,
            height:   lineH,
            duration: 300,
            yoyo:     true,
            ease:     'Sine.easeOut',
            onComplete: () => {
                line.destroy();
                this.time.delayedCall(600 + Math.random() * 2000, () => {
                    if (this.scene.isActive()) this._spawnEnergyLine(width, height);
                });
            }
        });
    }

    update(time, delta) {
        this.gameTime += delta;
        this.lastUpdate = time;

        // Actualizar todos los sistemas
        this.combatSystem.update(delta);
        this.waveSystem.update(delta);
        this.particleSystem.update(delta);

        // Actualizar IA de mascotas
        this.pets.getChildren().forEach(pet => {
            if (pet.active && pet.alive) {
                this.updatePetAI(pet, delta);
                this.updatePetVisuals(pet);
            }
        });

        // Actualizar enemigos
        this.enemies.getChildren().forEach(enemy => {
            if (enemy.active && enemy.alive) {
                this.updateEnemyAI(enemy, delta);
                this.updateEnemyVisuals(enemy);
            }
        });

        // Actualizar mega mascota
        if (this.isMegaPetActive && this.megaPetSprite) {
            this.updateMegaPet(delta);
        }
    }

    updatePetAI(pet, delta) {
        // Encontrar enemigo más cercano
        let nearestEnemy = null;
        let nearestDist = Infinity;

        this.enemies.getChildren().forEach(enemy => {
            if (enemy.active && enemy.alive) {
                const dist = Phaser.Math.Distance.Between(
                    pet.x, pet.y, enemy.x, enemy.y
                );
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestEnemy = enemy;
                }
            }
        });

        // Movimiento y ataque
        if (nearestEnemy) {
            const attackRange = pet.petData.type === 'dragon' ? 150 : 80;
            
            if (nearestDist > attackRange) {
                // Mover hacia enemigo
                const angle = Phaser.Math.Angle.Between(
                    pet.x, pet.y, nearestEnemy.x, nearestEnemy.y
                );
                
                const speed = pet.petData.speed * (delta / 1000) * 60;
                pet.x += Math.cos(angle) * speed;
                pet.y += Math.sin(angle) * speed;
                
                // Mirar hacia enemigo
                pet.setFlipX(Math.cos(angle) < 0);
            } else {
                // Atacar
                if (pet.attackCooldown <= 0) {
                    this.combatSystem.petAttack(pet, nearestEnemy);
                    pet.attackCooldown = 500; // 0.5s de enfriamiento
                }
            }
        } else {
            // Vagabundear
            this.wanderPet(pet, delta);
        }

        // Actualizar enfriamiento
        pet.attackCooldown -= delta;
    }

    wanderPet(pet, delta) {
        // Movimiento aleatorio cuando no hay enemigos
        if (!pet.wanderTimer || pet.wanderTimer <= 0) {
            pet.wanderDirection = Math.random() * Math.PI * 2;
            pet.wanderTimer = 1000 + Math.random() * 2000;
        }
        
        const speed = pet.petData.speed * 0.3 * (delta / 1000) * 60;
        pet.x += Math.cos(pet.wanderDirection) * speed;
        pet.y += Math.sin(pet.wanderDirection) * speed;
        pet.wanderTimer -= delta;

        // Mantener dentro de límites
        const { width, height } = this.cameras.main;
        pet.x = Phaser.Math.Clamp(pet.x, 100, width - 100);
        pet.y = Phaser.Math.Clamp(pet.y, 100, height - 100);
    }

    updateEnemyAI(enemy, delta) {
        // Encontrar mascota más cercana
        let nearestPet = null;
        let nearestDist = Infinity;

        this.pets.getChildren().forEach(pet => {
            if (pet.active && pet.alive) {
                const dist = Phaser.Math.Distance.Between(
                    enemy.x, enemy.y, pet.x, pet.y
                );
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestPet = pet;
                }
            }
        });

        // Mover y atacar
        if (nearestPet) {
            const attackRange = 60;
            
            if (nearestDist > attackRange) {
                const angle = Phaser.Math.Angle.Between(
                    enemy.x, enemy.y, nearestPet.x, nearestPet.y
                );
                
                const speed = enemy.enemyData.speed * (delta / 1000) * 60;
                enemy.x += Math.cos(angle) * speed;
                enemy.y += Math.sin(angle) * speed;
                enemy.setFlipX(Math.cos(angle) < 0);
            } else {
                if (enemy.attackCooldown <= 0) {
                    this.combatSystem.enemyAttack(enemy, nearestPet);
                    enemy.attackCooldown = 800;
                }
            }
        }

        enemy.attackCooldown -= delta;
    }

    updateMegaPet(delta) {
        // Mega mascota se mueve hacia enemigos y ataca a todos en rango
        if (!this.megaPetSprite) return;

        let nearestEnemy = null;
        let nearestDist = Infinity;

        this.enemies.getChildren().forEach(enemy => {
            if (enemy.active && enemy.alive) {
                const dist = Phaser.Math.Distance.Between(
                    this.megaPetSprite.x, this.megaPetSprite.y,
                    enemy.x, enemy.y
                );
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestEnemy = enemy;
                }
            }
        });

        if (nearestEnemy && nearestDist > 200) {
            const angle = Phaser.Math.Angle.Between(
                this.megaPetSprite.x, this.megaPetSprite.y,
                nearestEnemy.x, nearestEnemy.y
            );
            
            const speed = 8 * (delta / 1000) * 60;
            this.megaPetSprite.x += Math.cos(angle) * speed;
            this.megaPetSprite.y += Math.sin(angle) * speed;
        }

        // Efecto de ataque masivo
        if (this.megaPetAttackTimer <= 0) {
            this.megaPetMassAttack();
            this.megaPetAttackTimer = 300;
        }
        this.megaPetAttackTimer -= delta;

        // Efecto de pulso
        const scale = 1 + Math.sin(this.gameTime * 0.01) * 0.1;
        this.megaPetSprite.setScale(scale);
    }

    megaPetMassAttack() {
        if (!this.megaPetSprite) return;

        this.enemies.getChildren().forEach(enemy => {
            if (enemy.active && enemy.alive) {
                const dist = Phaser.Math.Distance.Between(
                    this.megaPetSprite.x, this.megaPetSprite.y,
                    enemy.x, enemy.y
                );
                
                if (dist < 300) {
                    // Daño basado en distancia
                    const damage = Math.floor(50 * (1 - dist / 300));
                    this.reportEnemyDamage(enemy.enemyData.id, damage, null);
                    
                    // Retroalimentación visual
                    this.particleSystem.explosion(enemy.x, enemy.y, 0xff00ff);
                    this.tweens.add({
                        targets: enemy,
                        alpha: 0.5,
                        duration: 100,
                        yoyo: true
                    });
                }
            }
        });
    }

    // Métodos públicos para generación
    spawnPet(petData) {
        const { width, height } = this.cameras.main;
        
        // Posición de generación aleatoria
        const x = 100 + Math.random() * (width - 200);
        const y = 100 + Math.random() * (height - 200);

        // Crear sprite
        const petTexture = this.resolveTextureKey(`pet_${petData.type}`);
        const sprite = this.add.sprite(x, y, petTexture);
        sprite.setScale(petData.scale || 1);
        if (petTexture === '__WHITE') {
            sprite.setTint(petData.color || 0xffffff);
            sprite.setDisplaySize(40, 40);
        }
        sprite.setDepth(10);

        const hpBarBg = this.add.graphics();
        hpBarBg.setDepth(11);
        const hpBarFill = this.add.graphics();
        hpBarFill.setDepth(12);

        // Almacenar datos de mascota
        sprite.petData = petData;
        sprite.alive = true;
        sprite.attackCooldown = 0;
        sprite.wanderTimer = 0;

        // Nombre del dueño — premium badge
        const nameText = this.add.text(x, y - 34, petData.ownerName, {
            fontSize: '13px',
            fontFamily: '"Rajdhani", "Arial", sans-serif',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#050510',
            strokeThickness: 3,
            shadow: { offsetX: 0, offsetY: 1, color: '#000', blur: 4, fill: true }
        });
        nameText.setOrigin(0.5);
        nameText.setDepth(12);
        sprite.nameText = nameText;

        // Indicador de nivel — colored pill
        const levelText = this.add.text(x + 22, y - 22, `Lv${petData.level}`, {
            fontSize: '11px',
            fontFamily: '"Orbitron", "Arial", monospace',
            fontStyle: 'bold',
            color: '#ffd700',
            stroke: '#1a0e00',
            strokeThickness: 2
        });
        levelText.setOrigin(0.5);
        levelText.setDepth(12);
        sprite.levelText = levelText;
        sprite.hpBarBg = hpBarBg;
        sprite.hpBarFill = hpBarFill;

        // Cuerpo de física
        this.physics.add.existing(sprite);
        sprite.body.setCircle(20);
        sprite.body.setCollideWorldBounds(true);

        // Añadir al grupo
        this.pets.add(sprite);

        // Efecto de generación
        this.particleSystem.burst(x, y, petData.color, 10);
        this.audioSystem.playPetSpawn();

        // Texto flotante
        this.showFloatingText(x, y - 50, `+${petData.name}`, petData.color);

        return sprite;
    }

    removePet(petId) {
        this.pets.getChildren().forEach(pet => {
            if (pet.petData && pet.petData.id === petId) {
                // Efecto de muerte
                this.particleSystem.explosion(pet.x, pet.y, 0xff0000, 20);
                
                // Eliminar texto de nombre
                if (pet.nameText) pet.nameText.destroy();
                if (pet.levelText) pet.levelText.destroy();
                if (pet.hpBarBg) pet.hpBarBg.destroy();
                if (pet.hpBarFill) pet.hpBarFill.destroy();
                
                pet.destroy();
            }
        });
    }

    updatePetState(petData) {
        const pet = this.pets.getChildren().find((entity) => entity.petData?.id === petData.id);
        if (!pet || !pet.petData) return;
        Object.assign(pet.petData, petData);
        if (pet.levelText && typeof pet.petData.level === 'number') {
            pet.levelText.setText(`Nv${pet.petData.level}`);
        }
    }

    spawnWave(waveData) {
        this.waveSystem.spawnWave(waveData, this);
    }

    spawnEnemy(enemyData) {
        if (!enemyData || !enemyData.id) return null;
        const existing = this.findEnemyById(enemyData.id);
        if (existing) {
            this.updateEnemyState(enemyData);
            return existing;
        }

        const typeIndex = enemyData.typeIndex || 0;
        const enemyTexture = this.resolveTextureKey(`enemy_${typeIndex}`);
        const sprite = this.add.sprite(enemyData.x, enemyData.y, enemyTexture);
        const scale = enemyData.isBoss ? 3 : (0.8 + Math.random() * 0.4);
        sprite.setScale(scale);
        sprite.setDepth(5);
        if (enemyTexture === '__WHITE') {
            sprite.setDisplaySize(enemyData.isBoss ? 44 : 28, enemyData.isBoss ? 44 : 28);
        }
        sprite.setTint(enemyData.isBoss ? 0xff0000 : 0xff6666);

        sprite.enemyData = {
            id: enemyData.id,
            hp: enemyData.hp,
            maxHp: enemyData.maxHp,
            damage: enemyData.damage,
            speed: enemyData.speed,
            isBoss: !!enemyData.isBoss
        };
        sprite.alive = true;
        sprite.attackCooldown = 0;

        // Barra de vida
        const hpBarBg = this.add.graphics();
        hpBarBg.fillStyle(0x333333, 1);
        hpBarBg.fillRect(enemyData.x - 25, enemyData.y - 25, 50, 6);
        hpBarBg.setDepth(6);

        const hpBarFill = this.add.graphics();
        hpBarFill.setDepth(6);
        sprite.hpBar = hpBarFill;
        sprite.hpBarBg = hpBarBg;

        this.enemies.add(sprite);
        this.waveSystem.onEnemySpawned();

        // Efecto de generación
        this.particleSystem.burst(enemyData.x, enemyData.y, 0xff0000, enemyData.isBoss ? 14 : 5);

        if (enemyData.isBoss) {
            this.showFloatingText(
                this.cameras.main.centerX,
                this.cameras.main.centerY - 40,
                'JEFE',
                0xff0000
            );
            this.cameras.main.shake(220, 0.01);
            this.audioSystem.playBossSpawn();
        }

        return sprite;
    }

    updateEnemyState(enemyData) {
        const enemy = this.findEnemyById(enemyData.id);
        if (!enemy || !enemy.enemyData) return;
        if (typeof enemyData.hp === 'number') enemy.enemyData.hp = enemyData.hp;
        if (typeof enemyData.maxHp === 'number') enemy.enemyData.maxHp = enemyData.maxHp;
    }

    removeEnemy(enemyId) {
        const enemy = this.findEnemyById(enemyId);
        if (!enemy) return;
        this.onEnemyDeath(enemy);
    }

    findEnemyById(enemyId) {
        if (!this.enemies || typeof this.enemies.getChildren !== 'function') {
            return null;
        }
        return this.enemies.getChildren().find((enemy) => enemy.enemyData?.id === enemyId) || null;
    }

    activateMegaPet(data) {
        this.isMegaPetActive = true;
        this.megaPetAttackTimer = 0;

        const { width, height } = this.cameras.main;
        
        // Crear mega mascota en el centro
        const megaTexture = this.resolveTextureKey('mega_pet');
        this.megaPetSprite = this.add.sprite(width / 2, height / 2, megaTexture);
        if (megaTexture === '__WHITE') {
            this.megaPetSprite.setTint(0xff00ff);
            this.megaPetSprite.setDisplaySize(80, 80);
        }
        this.megaPetSprite.setScale(2);
        this.megaPetSprite.setDepth(100);
        this.megaPetSprite.setAlpha(0);

        // Aparecer
        this.tweens.add({
            targets: this.megaPetSprite,
            alpha: 1,
            scale: 2.5,
            duration: 1000,
            ease: 'Back.easeOut'
        });

        // Tormenta de partículas
        this.particleSystem.megaPetActivation(width / 2, height / 2);
        this.audioSystem.playMegaActivate();

        // Ocultar mascotas fusionadas temporalmente
        this.fusedPets = [];
        this.pets.getChildren().forEach(pet => {
            if (pet.active) {
                this.fusedPets.push(pet);
                this.tweens.add({
                    targets: [pet, pet.nameText, pet.levelText],
                    alpha: 0,
                    duration: 500
                });
            }
        });

        // Marcador de efecto de sonido
        console.log('[MegaPet] El efecto de sonido se reproduciría aquí');
    }

    deactivateMegaPet() {
        this.isMegaPetActive = false;

        if (this.megaPetSprite) {
            // Desvanecer y destruir
            this.tweens.add({
                targets: this.megaPetSprite,
                alpha: 0,
                scale: 0,
                duration: 500,
                onComplete: () => {
                    this.megaPetSprite.destroy();
                    this.megaPetSprite = null;
                }
            });
        }

        // Restaurar mascotas
        this.fusedPets.forEach(pet => {
            this.tweens.add({
                targets: [pet, pet.nameText, pet.levelText],
                alpha: 1,
                duration: 500
            });
        });
    }

    showUpgradeEffect(data) {
        this.pets.getChildren().forEach(pet => {
            if (pet.active && pet.alive) {
                this.particleSystem.burst(pet.x, pet.y, 0xffff00, 5);
                
                // Texto de subida de nivel
                const levelUpText = this.add.text(pet.x, pet.y - 40, `↑ Nv${pet.petData.level}`, {
                    fontSize: '16px',
                    fontFamily: 'Arial Black',
                    color: '#ffff00',
                    stroke: '#000000',
                    strokeThickness: 2
                });
                levelUpText.setOrigin(0.5);
                levelUpText.setDepth(50);

                this.tweens.add({
                    targets: levelUpText,
                    y: pet.y - 80,
                    alpha: 0,
                    duration: 1000,
                    onComplete: () => levelUpText.destroy()
                });
            }
        });
    }

    showFloatingText(x, y, text, color = 0xffffff) {
        const colorHex = '#' + color.toString(16).padStart(6, '0');
        const floatText = this.add.text(x, y, text, {
            fontSize: '18px',
            fontFamily: 'Arial Black',
            color: colorHex,
            stroke: '#000000',
            strokeThickness: 3
        });
        floatText.setOrigin(0.5);
        floatText.setDepth(100);

        this.tweens.add({
            targets: floatText,
            y: y - 50,
            alpha: 0,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => floatText.destroy()
        });
    }

    // Llamado cuando el enemigo muere
    onEnemyDeath(enemy) {
        // Actualizar referencia de barra de vida
        if (enemy.hpBar) enemy.hpBar.destroy();
        if (enemy.hpBarBg) enemy.hpBarBg.destroy();
        
        // Efecto de explosión
        this.particleSystem.explosion(enemy.x, enemy.y, 0xff0000, 15);
        
        // Eliminar
        this.time.delayedCall(100, () => {
            enemy.destroy();
        });

        this.waveSystem.onEnemyDeath();
    }

    reportEnemyDamage(enemyId, damage, petId = null) {
        if (!window.socket) return;
        if (!window.isSimulationOwner) return;
        window.socket.emit('enemy:damage', {
            enemyId,
            damage,
            petId
        });
    }

    reportPetDamage(petId, damage) {
        if (!window.socket) return;
        if (!window.isSimulationOwner) return;
        window.socket.emit('pet:damage', {
            petId,
            damage
        });
    }

    // Llamado cuando la mascota recibe daño
    onPetDamaged(pet, damage) {
        // Parpadear en rojo
        this.tweens.add({
            targets: pet,
            tint: 0xff0000,
            duration: 50,
            yoyo: true
        });

        // Número de daño
        const dmgText = this.add.text(pet.x, pet.y - 20, `-${damage}`, {
            fontSize: '14px',
            fontFamily: 'Arial Black',
            color: '#ff0000',
            stroke: '#000000',
            strokeThickness: 2
        });
        dmgText.setOrigin(0.5);
        dmgText.setDepth(50);

        this.tweens.add({
            targets: dmgText,
            y: pet.y - 40,
            alpha: 0,
            duration: 800,
            onComplete: () => dmgText.destroy()
        });
    }

    updatePetVisuals(pet) {
        if (!pet.petData) return;

        if (pet.nameText) {
            pet.nameText.x = pet.x;
            pet.nameText.y = pet.y - 38;
        }
        if (pet.levelText) {
            pet.levelText.x = pet.x + 26;
            pet.levelText.y = pet.y - 26;
        }
        if (pet.hpBarBg) {
            pet.hpBarBg.clear();
            // Bar background
            pet.hpBarBg.fillStyle(0x0a0a1e, 0.9);
            pet.hpBarBg.fillRoundedRect(pet.x - 26, pet.y - 28, 52, 6, 3);
            pet.hpBarBg.lineStyle(1, 0x333355, 0.6);
            pet.hpBarBg.strokeRoundedRect(pet.x - 26, pet.y - 28, 52, 6, 3);
        }
        if (pet.hpBarFill) {
            const hpRatio = Phaser.Math.Clamp(pet.petData.hp / pet.petData.maxHp, 0, 1);
            pet.hpBarFill.clear();
            const barColor = hpRatio > 0.6 ? 0x00ff88 : hpRatio > 0.3 ? 0xffaa00 : 0xff4444;
            pet.hpBarFill.fillStyle(barColor, 1);
            pet.hpBarFill.fillRoundedRect(pet.x - 25, pet.y - 27, 50 * hpRatio, 4, 2);
            // Sheen on fill
            if (hpRatio > 0.05) {
                pet.hpBarFill.fillStyle(0xffffff, 0.2);
                pet.hpBarFill.fillRoundedRect(pet.x - 25, pet.y - 27, 50 * hpRatio, 2, 1);
            }
        }
    }

    updateEnemyVisuals(enemy) {
        if (!enemy.enemyData) return;

        if (enemy.hpBarBg) {
            enemy.hpBarBg.clear();
            enemy.hpBarBg.fillStyle(0x0a0a1e, 0.9);
            enemy.hpBarBg.fillRoundedRect(enemy.x - 27, enemy.y - 28, 54, 7, 3);
            enemy.hpBarBg.lineStyle(1, 0x553333, 0.6);
            enemy.hpBarBg.strokeRoundedRect(enemy.x - 27, enemy.y - 28, 54, 7, 3);
        }

        if (enemy.hpBar) {
            const hpRatio = Phaser.Math.Clamp(enemy.enemyData.hp / enemy.enemyData.maxHp, 0, 1);
            enemy.hpBar.clear();
            const barColor = hpRatio > 0.5 ? 0xff6644 : hpRatio > 0.25 ? 0xff4400 : 0xff0000;
            enemy.hpBar.fillStyle(barColor, 1);
            enemy.hpBar.fillRoundedRect(enemy.x - 26, enemy.y - 27, 52 * hpRatio, 5, 2);
            if (hpRatio > 0.05) {
                enemy.hpBar.fillStyle(0xffffff, 0.15);
                enemy.hpBar.fillRoundedRect(enemy.x - 26, enemy.y - 27, 52 * hpRatio, 2, 1);
            }
        }
    }
}
