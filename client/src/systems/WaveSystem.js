/**
 * Sistema de Oleadas
 * Gestiona la generación de oleadas de enemigos y progresión de dificultad
 */

export class WaveSystem {
    constructor(scene) {
        this.scene = scene;
        this.currentWave = 0;
        this.enemiesRemaining = 0;
        this.spawnGraceRemaining = 0;
        this.waveInProgress = false;
        this.spawnTimer = 0;
        this.waveDelay = 5000; // 5 segundos entre oleadas
    }

    update(delta) {
        if (this.spawnGraceRemaining > 0) {
            this.spawnGraceRemaining -= delta;
        }
        if (this.waveInProgress) {
            // Verificar si la oleada está completa
            if (this.spawnGraceRemaining <= 0 && this.enemiesRemaining <= 0) {
                this.waveComplete();
            }
        }
    }

    spawnWave(waveData, gameScene) {
        this.currentWave = waveData.wave;
        this.enemiesRemaining = 0;
        this.spawnGraceRemaining = 5000;
        this.waveInProgress = true;
        this.spawnDelay = 0;

        // Mostrar anuncio de oleada
        this.showWaveAnnouncement(waveData.wave);
    }

    showWaveAnnouncement(waveNumber) {
        const { width, height } = this.scene.cameras.main;
        
        // Texto de oleada
        const waveText = this.scene.add.text(width / 2, height / 2 - 50, `OLEADA ${waveNumber}`, {
            fontSize: '72px',
            fontFamily: 'Arial Black',
            color: '#ffffff',
            stroke: '#ff00ff',
            strokeThickness: 6
        });
        waveText.setOrigin(0.5);
        waveText.setAlpha(0);
        waveText.setDepth(200);

        // Animar entrada
        this.scene.tweens.add({
            targets: waveText,
            alpha: 1,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: waveText,
                    alpha: 0,
                    scaleX: 0.5,
                    scaleY: 0.5,
                    duration: 500,
                    delay: 1000,
                    onComplete: () => waveText.destroy()
                });
            }
        });

        // Destello de pantalla
        this.scene.particleSystem.colorFlash(0xff00ff, 200);

        // Vibración de pantalla
        this.scene.cameras.main.shake(300, 0.005);
    }

    onEnemyDeath() {
        if (this.enemiesRemaining > 0) {
            this.enemiesRemaining--;
        }
    }

    onEnemySpawned() {
        this.enemiesRemaining++;
        this.spawnGraceRemaining = 0;
    }

    waveComplete() {
        this.waveInProgress = false;
        
        // Efectos de oleada completada
        const { width, height } = this.scene.cameras.main;
        
        // Texto de victoria
        const victoryText = this.scene.add.text(width / 2, height / 2, '¡OLEADA COMPLETADA!', {
            fontSize: '48px',
            fontFamily: 'Arial Black',
            color: '#00ff00',
            stroke: '#000000',
            strokeThickness: 4
        });
        victoryText.setOrigin(0.5);
        victoryText.setDepth(200);

        this.scene.tweens.add({
            targets: victoryText,
            alpha: 0,
            y: height / 2 - 100,
            duration: 1500,
            delay: 2000,
            onComplete: () => victoryText.destroy()
        });

        // Puntos/efectos de bonificación
        this.scene.particleSystem.colorFlash(0x00ff00, 300);
        if (this.scene.audioSystem) {
            this.scene.audioSystem.playWaveComplete();
        }
    }

    getDifficultyMultiplier(wave) {
        return {
            health: 1 + (wave * 0.15),
            damage: 1 + (wave * 0.12),
            speed: 1 + (wave * 0.1)
        };
    }
}
