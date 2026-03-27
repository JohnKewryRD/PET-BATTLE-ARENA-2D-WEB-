/**
 * Sistema de Partículas
 * Maneja todos los efectos visuales y partículas
 */

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.activeParticles = [];
        this.maxParticles = 500; // Límite de rendimiento
        this.poolKey = 'runtime_particles';
        this.particleTextureKey = this.resolveTextureKey('particle');

        if (this.scene.objectPool) {
            this.scene.objectPool.createPool(this.poolKey, () => {
                const sprite = this.scene.add.sprite(0, 0, this.particleTextureKey);
                this.scene.physics.add.existing(sprite);
                sprite.setActive(false);
                sprite.setVisible(false);
                sprite.setDepth(50);
                return sprite;
            }, 80);
        }
    }

    resolveTextureKey(primaryKey) {
        if (
            this.scene.textures &&
            typeof this.scene.textures.exists === 'function' &&
            this.scene.textures.exists(primaryKey)
        ) {
            return primaryKey;
        }
        return '__WHITE';
    }

    update(delta) {
        // Limpiar partículas muertas
        this.activeParticles = this.activeParticles.filter(p => {
            if (!p.active) {
                return false;
            }
            p.lifetime -= delta;
            if (p.lifetime <= 0) {
                this.releaseParticle(p.sprite);
                return false;
            }
            return true;
        });
    }

    burst(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            this.createParticle(x, y, color);
        }
    }

    createParticle(x, y, color, options = {}) {
        if (this.activeParticles.length >= this.maxParticles) {
            // Eliminar partícula más antigua
            const oldest = this.activeParticles.shift();
            if (oldest && oldest.sprite) this.releaseParticle(oldest.sprite);
        }

        let sprite = null;
        if (this.scene.objectPool) {
            sprite = this.scene.objectPool.get(this.poolKey);
        }
        if (!sprite) {
            sprite = this.scene.add.sprite(x, y, this.particleTextureKey);
            this.scene.physics.add.existing(sprite);
            sprite.setDepth(50);
        }
        sprite.setPosition(x, y);
        sprite.setTint(color);
        const scaleMin = options.scaleMin ?? 0.5;
        const scaleMax = options.scaleMax ?? 1.0;
        sprite.setScale(scaleMin + Math.random() * (scaleMax - scaleMin));
        sprite.setAlpha(1);
        sprite.setActive(true);
        sprite.setVisible(true);
        if (options.depth) {
            sprite.setDepth(options.depth);
        }

        // Velocidad aleatoria
        const angle = typeof options.angle === 'number' ? options.angle : (Math.random() * Math.PI * 2);
        const speedMin = options.speedMin ?? 50;
        const speedMax = options.speedMax ?? 150;
        const speed = speedMin + Math.random() * (speedMax - speedMin);
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        // Física
        if (sprite.body) {
            sprite.body.reset(x, y);
            sprite.body.setEnable(true);
            sprite.body.setVelocity(vx, vy);
            sprite.body.setGravityY(options.gravityY ?? 200);
        }

        // Desvanecer y encoger
        const lifetimeMin = options.lifetimeMin ?? 500;
        const lifetimeMax = options.lifetimeMax ?? 1000;
        const lifetime = lifetimeMin + Math.random() * (lifetimeMax - lifetimeMin);
        
        this.scene.tweens.add({
            targets: sprite,
            alpha: 0,
            scaleX: 0,
            scaleY: 0,
            duration: lifetime,
            ease: 'Power2',
            onComplete: () => {
                if (sprite.active) this.releaseParticle(sprite);
            }
        });

        this.activeParticles.push({
            sprite,
            lifetime,
            active: true
        });

        return sprite;
    }

    releaseParticle(sprite) {
        if (!sprite) return;
        if (sprite.body) {
            sprite.body.setVelocity(0, 0);
            sprite.body.setGravityY(0);
            sprite.body.setEnable(false);
        }
        sprite.setActive(false);
        sprite.setVisible(false);
        if (this.scene.objectPool) {
            this.scene.objectPool.release(this.poolKey, sprite);
        } else {
            sprite.destroy();
        }
    }

    explosion(x, y, color, count = 20) {
        // Anillo de partículas expandiéndose hacia afuera
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            this.createParticle(x, y, color, {
                angle,
                speedMin: 100,
                speedMax: 200,
                scaleMin: 0.3,
                scaleMax: 0.7,
                lifetimeMin: 600,
                lifetimeMax: 1000,
                gravityY: 120
            });
        }
    }

    megaPetActivation(x, y) {
        // Explosión masiva de partículas para activación de mega mascota
        const colors = [0xff00ff, 0x00ffff, 0xffff00, 0xff69b4];
        
        // Múltiples oleadas
        for (let wave = 0; wave < 3; wave++) {
            this.scene.time.delayedCall(wave * 200, () => {
                colors.forEach(color => {
                    this.explosion(x, y, color, 30);
                });
            });
        }

        // Efecto de onda de choque en anillo
        const shockwave = this.scene.add.circle(x, y, 50, 0xffffff, 0.5);
        shockwave.setStrokeStyle(4, 0x00ffff, 1);
        shockwave.setDepth(90);

        this.scene.tweens.add({
            targets: shockwave,
            scaleX: 6,
            scaleY: 6,
            alpha: 0,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => shockwave.destroy()
        });

        // Destello de pantalla
        const flash = this.scene.add.rectangle(
            this.scene.cameras.main.centerX,
            this.scene.cameras.main.centerY,
            this.scene.cameras.main.width,
            this.scene.cameras.main.height,
            0xffffff, 0.5
        );
        flash.setDepth(200);

        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 500,
            onComplete: () => flash.destroy()
        });
    }

    trail(x, y, color) {
        // Efecto de estela ligera para objetos que se mueven rápido
        const sprite = this.createParticle(x, y, color, {
            speedMin: 1,
            speedMax: 4,
            scaleMin: 0.2,
            scaleMax: 0.35,
            lifetimeMin: 220,
            lifetimeMax: 320,
            gravityY: 0,
            depth: 40
        });

        if (sprite) {
            sprite.setAlpha(0.7);
        }
    }

    screenShake(intensity = 5) {
        this.scene.cameras.main.shake(200, intensity / 1000);
    }

    colorFlash(color, duration = 100) {
        const flash = this.scene.add.rectangle(
            this.scene.cameras.main.centerX,
            this.scene.cameras.main.centerY,
            this.scene.cameras.main.width,
            this.scene.cameras.main.height,
            color, 0.3
        );
        flash.setDepth(150);

        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            duration: duration,
            onComplete: () => flash.destroy()
        });
    }

    spawnAmbient() {
        // Partículas flotantes ambientales para atmósfera
        const { width, height } = this.scene.cameras.main;
        
        const sprite = this.scene.add.sprite(
            Math.random() * width,
            height + 20,
            this.particleTextureKey
        );
        sprite.setTint(0xffffff);
        sprite.setScale(0.2 + Math.random() * 0.3);
        sprite.setAlpha(0.2);
        sprite.setDepth(1);

        const duration = 3000 + Math.random() * 3000;
        
        this.scene.tweens.add({
            targets: sprite,
            y: -20,
            alpha: 0,
            duration: duration,
            ease: 'Linear',
            onComplete: () => {
                if (sprite.active) {
                    // Regenerar en la parte inferior
                    sprite.x = Math.random() * width;
                    sprite.y = height + 20;
                    sprite.alpha = 0.2;
                    sprite.setScale(0.2 + Math.random() * 0.3);
                    this.scene.tweens.add({
                        targets: sprite,
                        y: -20,
                        alpha: 0,
                        duration: duration,
                        ease: 'Linear',
                        repeat: -1
                    });
                }
            }
        });
    }
}
