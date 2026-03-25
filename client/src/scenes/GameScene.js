/**
 * Escena del Juego
 * Lógica principal del juego - combate, generación, partículas
 */

import { GAME_CONFIG } from '../config/GameConfig.js';
import { ObjectPool } from '../systems/ObjectPool.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { WaveSystem } from '../systems/WaveSystem.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        GameScene.instance = this;
    }

    create() {
        console.log('[GameScene] Iniciando...');

        // Inicializar sistemas
        this.objectPool = new ObjectPool(this);
        this.combatSystem = new CombatSystem(this);
        this.particleSystem = new ParticleSystem(this);
        this.waveSystem = new WaveSystem(this);

        // Crear mundo del juego
        this.createWorld();

        // Grupos de entidades
        this.pets = this.add.group();
        this.enemies = this.add.group();
        this.projectiles = this.add.group();

        // Estado de Mega Mascota
        this.isMegaPetActive = false;
        this.megaPetSprite = null;
        this.fusedPets = [];

        // Crear efectos de fondo
        this.createBackground();

        // Iniciar bucle del juego
        this.lastUpdate = 0;
        this.gameTime = 0;

        console.log('[GameScene] Listo');
    }

    createWorld() {
        const { width, height } = this.cameras.main;

        // Límites del arena (paredes invisibles)
        this.physics.world.setBounds(50, 50, width - 100, height - 100);

        // Piso del arena con patrón de cuadrícula
        const graphics = this.add.graphics();
        
        // Fondo oscuro
        graphics.fillStyle(0x0a0a0f, 1);
        graphics.fillRect(0, 0, width, height);

        // Líneas de cuadrícula
        graphics.lineStyle(1, 0x1a1a2e, 0.5);
        const gridSize = 50;
        
        for (let x = 0; x < width; x += gridSize) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, height);
        }
        for (let y = 0; y < height; y += gridSize) {
            graphics.moveTo(0, y);
            graphics.lineTo(width, y);
        }
        graphics.strokePath();

        // Brillo del borde del arena
        graphics.lineStyle(4, 0x00ffff, 0.3);
        graphics.strokeRect(50, 50, width - 100, height - 100);

        // Decoraciones de esquinas
        const corners = [
            { x: 50, y: 50 },
            { x: width - 50, y: 50 },
            { x: 50, y: height - 50 },
            { x: width - 50, y: height - 50 }
        ];

        corners.forEach(corner => {
            graphics.fillStyle(0x00ffff, 0.5);
            graphics.fillCircle(corner.x, corner.y, 10);
        });
    }

    createBackground() {
        const { width, height } = this.cameras.main;

        // Partículas flotantes ambientales
        this.ambientParticles = [];
        for (let i = 0; i < 30; i++) {
            const particle = this.add.circle(
                Math.random() * width,
                Math.random() * height,
                Math.random() * 3 + 1,
                0xffffff,
                0.1 + Math.random() * 0.2
            );
            
            this.tweens.add({
                targets: particle,
                y: particle.y - 50 - Math.random() * 100,
                alpha: 0,
                duration: 3000 + Math.random() * 2000,
                repeat: -1,
                yoyo: false,
                onRepeat: () => {
                    particle.x = Math.random() * width;
                    particle.y = height + 20;
                    particle.alpha = 0.1 + Math.random() * 0.2;
                }
            });
        }
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
            }
        });

        // Actualizar enemigos
        this.enemies.getChildren().forEach(enemy => {
            if (enemy.active && enemy.alive) {
                this.updateEnemyAI(enemy, delta);
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
                    enemy.enemyData.hp -= damage;
                    
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
        const sprite = this.add.sprite(x, y, `pet_${petData.type}`);
        sprite.setScale(petData.scale || 1);
        sprite.setDepth(10);

        // Añadir barra de vida
        const hpBar = this.add.graphics();
        hpBar.setDepth(11);

        // Almacenar datos de mascota
        sprite.petData = petData;
        sprite.alive = true;
        sprite.attackCooldown = 0;
        sprite.wanderTimer = 0;

        // Nombre del dueño
        const nameText = this.add.text(x, y - 30, petData.ownerName, {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        });
        nameText.setOrigin(0.5);
        nameText.setDepth(12);
        sprite.nameText = nameText;

        // Indicador de nivel
        const levelText = this.add.text(x + 20, y - 20, `Nv${petData.level}`, {
            fontSize: '12px',
            fontFamily: 'Arial',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 1
        });
        levelText.setOrigin(0.5);
        levelText.setDepth(12);
        sprite.levelText = levelText;

        // Cuerpo de física
        this.physics.add.existing(sprite);
        sprite.body.setCircle(20);
        sprite.body.setCollideWorldBounds(true);

        // Añadir al grupo
        this.pets.add(sprite);

        // Efecto de generación
        this.particleSystem.burst(x, y, petData.color, 10);

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
                
                pet.destroy();
            }
        });
    }

    spawnWave(waveData) {
        this.waveSystem.spawnWave(waveData, this);
    }

    spawnEnemy(enemyData) {
        const { width, height } = this.cameras.main;
        
        // Generar desde los bordes
        const side = Math.floor(Math.random() * 4);
        let x, y;
        
        switch (side) {
            case 0: x = Math.random() * width; y = -30; break;
            case 1: x = width + 30; y = Math.random() * height; break;
            case 2: x = Math.random() * width; y = height + 30; break;
            case 3: x = -30; y = Math.random() * height; break;
        }

        const typeIndex = Math.min(Math.floor(enemyData.difficulty / 2), 3);
        const sprite = this.add.sprite(x, y, `enemy_${typeIndex}`);
        sprite.setScale(0.8 + Math.random() * 0.4);
        sprite.setDepth(5);
        sprite.setTint(0xff6666);

        sprite.enemyData = {
            hp: Math.floor(50 * enemyData.difficulty.health),
            maxHp: Math.floor(50 * enemyData.difficulty.health),
            damage: Math.floor(10 * enemyData.difficulty.damage),
            speed: 2 + enemyData.difficulty.speed
        };
        sprite.alive = true;
        sprite.attackCooldown = 0;

        // Barra de vida
        const hpBarBg = this.add.graphics();
        hpBarBg.fillStyle(0x333333, 1);
        hpBarBg.fillRect(x - 25, y - 25, 50, 6);
        hpBarBg.setDepth(6);

        const hpBarFill = this.add.graphics();
        hpBarFill.setDepth(6);
        sprite.hpBar = hpBarFill;
        sprite.hpBarBg = hpBarBg;

        this.enemies.add(sprite);

        // Efecto de generación
        this.particleSystem.burst(x, y, 0xff0000, 5);

        return sprite;
    }

    activateMegaPet(data) {
        this.isMegaPetActive = true;
        this.megaPetAttackTimer = 0;

        const { width, height } = this.cameras.main;
        
        // Crear mega mascota en el centro
        this.megaPetSprite = this.add.sprite(width / 2, height / 2, 'mega_pet');
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
        const floatText = this.add.text(x, y, text, {
            fontSize: '18px',
            fontFamily: 'Arial Black',
            color: '#ffffff',
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
}
