/**
 * Escena de Carga
 * Maneja la carga de recursos e inicialización
 */

import { GAME_CONFIG } from '../config/GameConfig.js';

export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Crear barra de carga
        this.createLoadingBar();
        
        // Generar gráficos de reemplazo (ya que no tenemos hojas de sprites reales)
        this.generateAssets();
    }

    createLoadingBar() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Barra de fondo
        const bgBar = this.add.rectangle(width / 2, height / 2, 400, 30, 0x222222);
        bgBar.setOrigin(0.5);

        // Barra de progreso
        const progressBar = this.add.rectangle(width / 2 - 195, height / 2, 0, 26, 0x00ffff);
        progressBar.setOrigin(0, 0.5);

        // Texto de carga
        const loadingText = this.add.text(width / 2, height / 2 - 50, 'CARGANDO...', {
            fontFamily: 'Arial Black',
            fontSize: '32px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Texto de progreso
        const progressText = this.add.text(width / 2, height / 2 + 60, '0%', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#00ffff'
        }).setOrigin(0.5);

        // Actualizar progreso
        this.load.on('progress', (value) => {
            progressBar.width = 390 * value;
            progressText.setText(Math.floor(value * 100) + '%');
        });

        this.load.on('complete', () => {
            progressText.setText('LISTO!');
            this.time.delayedCall(500, () => {
                this.scene.start('GameScene');
            });
        });
    }

    generateAssets() {
        // Generar sprites de mascotas como círculos coloreados
        const petTypes = ['gato', 'perro', 'dragon', 'conejo'];
        const colors = {
            'gato': 0xFF6B9D,
            'perro': 0xC4A484,
            'dragon': 0xFF4500,
            'conejo': 0xFFFFFF
        };

        petTypes.forEach(type => {
            const size = type === 'dragon' ? 64 : type === 'perro' ? 48 : 40;
            
            // Crear objeto de gráficos
            const graphics = this.make.graphics({ x: 0, y: 0, add: false });
            
            // Dibujar cuerpo
            graphics.fillStyle(colors[type], 1);
            graphics.fillCircle(size / 2, size / 2, size / 2 - 2);
            
            // Dibujar ojos
            graphics.fillStyle(0x000000, 1);
            graphics.fillCircle(size / 2 - 8, size / 2 - 5, 4);
            graphics.fillCircle(size / 2 + 8, size / 2 - 5, 4);
            
            // Dibujar brillo
            graphics.fillStyle(0xFFFFFF, 0.3);
            graphics.fillCircle(size / 2 - 10, size / 2 - 10, 6);

            // Generar textura
            graphics.generateTexture(`pet_${type}`, size, size);
        });

        // Generar sprites de enemigos
        const enemyColors = [0xff6b6b, 0x9b59b6, 0x3498db, 0x2ecc71];
        for (let i = 0; i < 4; i++) {
            const graphics = this.make.graphics({ x: 0, y: 0, add: false });
            const size = 40;
            
            // Dibujar cuerpo del enemigo
            graphics.fillStyle(enemyColors[i], 1);
            graphics.fillCircle(size / 2, size / 2, size / 2 - 2);
            
            // Dibujar ojos enojados
            graphics.fillStyle(0xffffff, 1);
            graphics.fillCircle(size / 2 - 8, size / 2 - 5, 5);
            graphics.fillCircle(size / 2 + 8, size / 2 - 5, 5);
            graphics.fillStyle(0xff0000, 1);
            graphics.fillCircle(size / 2 - 8, size / 2 - 5, 2);
            graphics.fillCircle(size / 2 + 8, size / 2 - 5, 2);

            graphics.generateTexture(`enemy_${i}`, size, size);
        }

        // Generar sprite de mega mascota
        const megaGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        const megaSize = 128;
        
        // Efecto de degradado arcoíris
        megaGraphics.fillStyle(0xff00ff, 1);
        megaGraphics.fillCircle(megaSize / 2, megaSize / 2, megaSize / 2 - 4);
        megaGraphics.fillStyle(0x00ffff, 0.5);
        megaGraphics.fillCircle(megaSize / 2, megaSize / 2, megaSize / 3);
        megaGraphics.fillStyle(0xffffff, 0.3);
        megaGraphics.fillCircle(megaSize / 2, megaSize / 2, megaSize / 4);
        
        // Corona
        megaGraphics.fillStyle(0xffd700, 1);
        megaGraphics.fillTriangle(
            megaSize / 2 - 20, megaSize / 2 - 30,
            megaSize / 2, megaSize / 2 - 55,
            megaSize / 2 + 20, megaSize / 2 - 30
        );

        megaGraphics.generateTexture('mega_pet', megaSize, megaSize);

        // Generar proyectil
        const projGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        projGraphics.fillStyle(0xffff00, 1);
        projGraphics.fillCircle(8, 8, 6);
        projGraphics.fillStyle(0xffffff, 0.5);
        projGraphics.fillCircle(6, 6, 2);
        projGraphics.generateTexture('projectile', 16, 16);

        // Generar partícula
        const particleGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        particleGraphics.fillStyle(0xffffff, 1);
        particleGraphics.fillCircle(4, 4, 4);
        particleGraphics.generateTexture('particle', 8, 8);

        // Generar fondo de barra de vida
        const hpBarGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        hpBarGraphics.fillStyle(0x333333, 1);
        hpBarGraphics.fillRect(0, 0, 60, 8);
        hpBarGraphics.generateTexture('hp_bar_bg', 60, 8);

        // Generar relleno de barra de vida
        const hpFillGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        hpFillGraphics.fillStyle(0x00ff00, 1);
        hpFillGraphics.fillRect(0, 0, 58, 6);
        hpFillGraphics.generateTexture('hp_bar_fill', 58, 6);

        // Generar efecto de ataque
        const attackGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        attackGraphics.fillStyle(0xff6600, 1);
        attackGraphics.fillCircle(16, 16, 16);
        attackGraphics.fillStyle(0xffff00, 0.7);
        attackGraphics.fillCircle(16, 16, 10);
        attackGraphics.generateTexture('attack_effect', 32, 32);
    }

    create() {
        console.log('[BootScene] Recursos generados');
    }
}
