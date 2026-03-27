/**
 * Escena de Carga — generación de sprites runtime compatible con Phaser 4 RC
 */

import { GAME_CONFIG } from '../config/GameConfig.js';

const Phaser = window.Phaser;

export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        this.createLoadingBar();
        this.generateAssets();
    }

    createLoadingBar() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;

        // Dark background
        const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x050510);
        bg.setDepth(0);

        // Grid overlay
        const grid = this.add.graphics();
        grid.lineStyle(1, 0x00f5ff, 0.04);
        for (let x = 0; x < W; x += 60) { grid.moveTo(x, 0); grid.lineTo(x, H); }
        for (let y = 0; y < H; y += 60) { grid.moveTo(0, y); grid.lineTo(W, y); }
        grid.strokePath();
        grid.setDepth(1);

        // Title
        const title = this.add.text(W / 2, H / 2 - 80, 'PET BATTLE ARENA', {
            fontFamily: '"Courier New", monospace',
            fontSize: '40px',
            fontStyle: 'bold',
            color: '#00f5ff',
            stroke: '#003344',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(10).setAlpha(0);
        this.tweens.add({ targets: title, alpha: 1, duration: 800 });

        this.add.text(W / 2, H / 2 - 35, 'CARGANDO...', {
            fontFamily: '"Courier New", monospace',
            fontSize: '16px',
            color: '#8892a4',
        }).setOrigin(0.5).setDepth(10);

        // Bar
        const barW = Math.min(500, W * 0.45);
        const barX = W / 2 - barW / 2;
        const barY = H / 2 + 20;

        const barTrack = this.add.graphics();
        barTrack.fillStyle(0x0a0a1e, 1);
        barTrack.fillRoundedRect(barX - 2, barY - 2, barW + 4, 12, 5);
        barTrack.lineStyle(1, 0x00f5ff, 0.3);
        barTrack.strokeRoundedRect(barX - 2, barY - 2, barW + 4, 12, 5);
        barTrack.setDepth(10);

        const barFill = this.add.graphics();
        barFill.setDepth(11);

        const pct = this.add.text(W / 2, barY + 26, '0%', {
            fontFamily: '"Courier New", monospace',
            fontSize: '14px',
            color: '#00f5ff'
        }).setOrigin(0.5).setDepth(11);

        this.load.on('progress', (val) => {
            barFill.clear();
            barFill.fillStyle(0x00f5ff, 1);
            barFill.fillRoundedRect(barX, barY, barW * val, 8, 4);
            barFill.fillStyle(0xffffff, 0.3);
            barFill.fillRoundedRect(barX, barY, barW * val, 3, 2);
            pct.setText(Math.floor(val * 100) + '%');
        });

        this.load.on('complete', () => {
            pct.setText('LISTO!');
            this.time.delayedCall(400, () => this.scene.start('GameScene'));
        });
    }

    // ─── Helper ───────────────────────────────────────────────────────────────
    _g() {
        return this.make.graphics({ x: 0, y: 0, add: false });
    }

    // Draw a polygon (array of {x,y}) filled with given color
    _poly(g, pts, color, alpha = 1) {
        g.fillStyle(color, alpha);
        g.fillPoints(pts, true);
    }

    // Glow rings
    _glow(g, x, y, r, color) {
        g.fillStyle(color, 0.06); g.fillCircle(x, y, r + 18);
        g.fillStyle(color, 0.1);  g.fillCircle(x, y, r + 10);
        g.fillStyle(color, 0.15); g.fillCircle(x, y, r + 4);
    }

    generateAssets() {
        this._makeCat();
        this._makeDog();
        this._makeDragon();
        this._makeRabbit();
        this._makeEnemies();
        this._makeMegaPet();
        this._makeProjectile();
        this._makeParticle();
        this._makeHpAssets();
    }

    // ── CAT ────────────────────────────────────────────────────────────────────
    _makeCat() {
        const S = 56, cx = S / 2, cy = S / 2 + 2;
        const g = this._g();

        this._glow(g, cx, cy, 18, 0xFF6B9D);

        // Tail (Phaser 4 RC compatible: segmented curve approximation)
        g.lineStyle(5, 0xFF6B9D, 1);
        g.lineBetween(cx + 18, cy + 8, cx + 25, cy + 2);
        g.lineBetween(cx + 25, cy + 2, cx + 24, cy - 6);
        g.lineBetween(cx + 24, cy - 6, cx + 18, cy - 8);

        // Body shadow
        g.fillStyle(0xcc4466, 0.5);
        g.fillEllipse(cx + 2, cy + 3, 36, 30);

        // Body
        g.fillStyle(0xFF6B9D, 1);
        g.fillEllipse(cx, cy, 36, 30);

        // Belly
        g.fillStyle(0xffb8d0, 0.7);
        g.fillEllipse(cx, cy + 4, 20, 16);

        // Ears
        g.fillStyle(0xFF6B9D, 1);
        this._poly(g, [{ x: cx - 12, y: cy - 12 }, { x: cx - 21, y: cy - 28 }, { x: cx - 4, y: cy - 20 }], 0xFF6B9D);
        this._poly(g, [{ x: cx + 12, y: cy - 12 }, { x: cx + 21, y: cy - 28 }, { x: cx + 4, y: cy - 20 }], 0xFF6B9D);
        // Inner ears
        this._poly(g, [{ x: cx - 11, y: cy - 14 }, { x: cx - 17, y: cy - 26 }, { x: cx - 5, y: cy - 19 }], 0xff93bb);
        this._poly(g, [{ x: cx + 11, y: cy - 14 }, { x: cx + 17, y: cy - 26 }, { x: cx + 5, y: cy - 19 }], 0xff93bb);

        // Eyes bg
        g.fillStyle(0x111122, 1);
        g.fillEllipse(cx - 9, cy - 4, 10, 11);
        g.fillEllipse(cx + 9, cy - 4, 10, 11);

        // Iris
        g.fillStyle(0x00ddff, 1);
        g.fillEllipse(cx - 9, cy - 4, 7, 9);
        g.fillEllipse(cx + 9, cy - 4, 7, 9);

        // Pupil
        g.fillStyle(0x000000, 1);
        g.fillEllipse(cx - 9, cy - 4, 3, 8);
        g.fillEllipse(cx + 9, cy - 4, 3, 8);

        // Shine
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(cx - 7, cy - 6, 2);
        g.fillCircle(cx + 11, cy - 6, 2);

        // Nose
        this._poly(g, [{ x: cx - 2, y: cy + 2 }, { x: cx + 2, y: cy + 2 }, { x: cx, y: cy + 5 }], 0xff4488);

        // Whiskers
        g.lineStyle(1, 0xffccdd, 0.8);
        g.lineBetween(cx - 14, cy + 1, cx - 4, cy + 3);
        g.lineBetween(cx - 14, cy + 4, cx - 4, cy + 5);
        g.lineBetween(cx + 4, cy + 3, cx + 14, cy + 1);
        g.lineBetween(cx + 4, cy + 5, cx + 14, cy + 4);

        g.generateTexture('pet_gato', S, S);
        g.destroy();
    }

    // ── DOG ────────────────────────────────────────────────────────────────────
    _makeDog() {
        const S = 60, cx = S / 2, cy = S / 2;
        const g = this._g();

        this._glow(g, cx, cy, 20, 0xC4A484);

        // Floppy ears (behind body)
        g.fillStyle(0xa87a56, 1);
        g.fillEllipse(cx - 18, cy - 2, 14, 24);
        g.fillEllipse(cx + 18, cy - 2, 14, 24);
        g.fillStyle(0xc89a76, 1);
        g.fillEllipse(cx - 17, cy - 3, 10, 19);
        g.fillEllipse(cx + 17, cy - 3, 10, 19);

        // Body shadow
        g.fillStyle(0x8a6040, 0.4);
        g.fillEllipse(cx + 2, cy + 4, 44, 36);

        // Body
        g.fillStyle(0xC4A484, 1);
        g.fillEllipse(cx, cy, 44, 36);

        // Belly
        g.fillStyle(0xe8d0b4, 0.8);
        g.fillEllipse(cx, cy + 5, 24, 18);

        // Snout
        g.fillStyle(0xe0c09a, 1);
        g.fillEllipse(cx, cy + 4, 22, 16);

        // Eyes
        g.fillStyle(0x1a0a00, 1);
        g.fillCircle(cx - 10, cy - 4, 6);
        g.fillCircle(cx + 10, cy - 4, 6);
        g.fillStyle(0x8b5020, 0.9);
        g.fillCircle(cx - 10, cy - 4, 4);
        g.fillCircle(cx + 10, cy - 4, 4);
        g.fillStyle(0x000000, 1);
        g.fillCircle(cx - 10, cy - 4, 2.5);
        g.fillCircle(cx + 10, cy - 4, 2.5);
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(cx - 8, cy - 6, 1.5);
        g.fillCircle(cx + 12, cy - 6, 1.5);

        // Nose
        g.fillStyle(0x1a0a00, 1);
        g.fillEllipse(cx, cy + 1, 11, 8);
        g.fillStyle(0x000000, 0.4);
        g.fillCircle(cx - 2, cy + 1, 1.5);
        g.fillCircle(cx + 2, cy + 1, 1.5);

        // Collar
        g.fillStyle(0x0044cc, 1);
        g.fillRect(cx - 16, cy + 14, 32, 5);
        g.fillStyle(0xffc200, 1);
        g.fillCircle(cx, cy + 17, 4);

        g.generateTexture('pet_perro', S, S);
        g.destroy();
    }

    // ── DRAGON ─────────────────────────────────────────────────────────────────
    _makeDragon() {
        const S = 80, cx = S / 2, cy = S / 2 + 4;
        const g = this._g();

        this._glow(g, cx, cy - 4, 26, 0xFF4500);

        // Wings (triangles)
        this._poly(g, [{ x: cx - 8, y: cy - 10 }, { x: cx - 36, y: cy - 34 }, { x: cx - 4, y: cy + 2 }], 0xcc2200, 0.8);
        this._poly(g, [{ x: cx + 8, y: cy - 10 }, { x: cx + 36, y: cy - 34 }, { x: cx + 4, y: cy + 2 }], 0xcc2200, 0.8);
        this._poly(g, [{ x: cx - 10, y: cy - 12 }, { x: cx - 28, y: cy - 30 }, { x: cx - 5, y: cy }], 0xff5500, 0.4);
        this._poly(g, [{ x: cx + 10, y: cy - 12 }, { x: cx + 28, y: cy - 30 }, { x: cx + 5, y: cy }], 0xff5500, 0.4);

        // Tail
        g.fillStyle(0xcc3300, 1);
        g.fillEllipse(cx + 24, cy + 6, 18, 12);
        g.fillEllipse(cx + 32, cy + 2, 12, 8);
        // Tail spike
        this._poly(g, [{ x: cx + 28, y: cy - 4 }, { x: cx + 38, y: cy - 14 }, { x: cx + 34, y: cy + 2 }], 0xff8800);

        // Body shadow
        g.fillStyle(0x991100, 0.4);
        g.fillEllipse(cx + 2, cy + 4, 44, 38);

        // Body
        g.fillStyle(0xFF4500, 1);
        g.fillEllipse(cx, cy, 44, 38);

        // Belly scales
        g.fillStyle(0xff8844, 0.6);
        g.fillEllipse(cx, cy + 6, 26, 22);

        // Scale lines
        g.lineStyle(1, 0xcc3300, 0.5);
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 4; col++) {
                const sx = cx - 12 + col * 8 + (row % 2 === 0 ? 0 : 4);
                const sy = cy - 2 + row * 7;
                g.strokeCircle(sx, sy, 4);
            }
        }

        // Head
        g.fillStyle(0xFF4500, 1);
        g.fillEllipse(cx, cy - 17, 30, 26);

        // Snout
        g.fillStyle(0xff7744, 1);
        g.fillEllipse(cx, cy - 10, 20, 12);

        // Horns
        this._poly(g, [{ x: cx - 8, y: cy - 26 }, { x: cx - 14, y: cy - 42 }, { x: cx - 4, y: cy - 26 }], 0xffd700);
        this._poly(g, [{ x: cx + 8, y: cy - 26 }, { x: cx + 14, y: cy - 42 }, { x: cx + 4, y: cy - 26 }], 0xffd700);
        // Horn highlight
        this._poly(g, [{ x: cx - 8, y: cy - 27 }, { x: cx - 12, y: cy - 39 }, { x: cx - 7, y: cy - 27 }], 0xfffff0, 0.4);
        this._poly(g, [{ x: cx + 8, y: cy - 27 }, { x: cx + 12, y: cy - 39 }, { x: cx + 7, y: cy - 27 }], 0xfffff0, 0.4);

        // Eyes bg
        g.fillStyle(0x220000, 1);
        g.fillCircle(cx - 10, cy - 19, 7);
        g.fillCircle(cx + 10, cy - 19, 7);
        // Iris
        g.fillStyle(0xff6600, 1);
        g.fillCircle(cx - 10, cy - 19, 5);
        g.fillCircle(cx + 10, cy - 19, 5);
        // Pupil slot
        g.fillStyle(0x000000, 1);
        g.fillRect(cx - 11.5, cy - 23, 3, 8);
        g.fillRect(cx + 8.5,  cy - 23, 3, 8);
        // Eye glow
        g.fillStyle(0xffaa00, 0.4);
        g.fillCircle(cx - 10, cy - 19, 8);
        g.fillCircle(cx + 10, cy - 19, 8);
        // Shine
        g.fillStyle(0xffffff, 0.6);
        g.fillCircle(cx - 8, cy - 22, 2);
        g.fillCircle(cx + 12, cy - 22, 2);

        // Nostrils
        g.fillStyle(0x880000, 1);
        g.fillCircle(cx - 4, cy - 9, 2);
        g.fillCircle(cx + 4, cy - 9, 2);

        // Fire hint
        g.fillStyle(0xffcc00, 0.7);
        this._poly(g, [{ x: cx - 4, y: cy - 7 }, { x: cx + 4, y: cy - 7 }, { x: cx, y: cy + 1 }], 0xffcc00, 0.7);

        g.generateTexture('pet_dragon', S, S);
        g.destroy();
    }

    // ── RABBIT ─────────────────────────────────────────────────────────────────
    _makeRabbit() {
        const S = 52, cx = S / 2, cy = S / 2 + 2;
        const g = this._g();

        this._glow(g, cx, cy, 17, 0xddddf0);

        // Long ears
        g.fillStyle(0xddddf0, 1);
        g.fillEllipse(cx - 9, cy - 26, 11, 30);
        g.fillEllipse(cx + 9, cy - 26, 11, 30);
        g.fillStyle(0xffaabb, 0.7);
        g.fillEllipse(cx - 9, cy - 27, 6, 23);
        g.fillEllipse(cx + 9, cy - 27, 6, 23);

        // Body shadow
        g.fillStyle(0xaaaacc, 0.3);
        g.fillEllipse(cx + 2, cy + 3, 34, 30);

        // Body
        g.fillStyle(0xf0f0f8, 1);
        g.fillEllipse(cx, cy, 34, 30);

        // Belly
        g.fillStyle(0xfffaff, 0.7);
        g.fillEllipse(cx, cy + 4, 18, 14);

        // Eyes bg
        g.fillStyle(0x100015, 1);
        g.fillCircle(cx - 8, cy - 4, 5.5);
        g.fillCircle(cx + 8, cy - 4, 5.5);
        // Iris
        g.fillStyle(0xff44aa, 0.9);
        g.fillCircle(cx - 8, cy - 4, 4);
        g.fillCircle(cx + 8, cy - 4, 4);
        // Pupil
        g.fillStyle(0x000000, 1);
        g.fillCircle(cx - 8, cy - 4, 2);
        g.fillCircle(cx + 8, cy - 4, 2);
        // Shine
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(cx - 6, cy - 6, 1.5);
        g.fillCircle(cx + 10, cy - 6, 1.5);

        // Nose
        this._poly(g, [{ x: cx - 2, y: cy + 2 }, { x: cx + 2, y: cy + 2 }, { x: cx, y: cy + 5 }], 0xff6699);

        // Whiskers
        g.lineStyle(1, 0xbbbbcc, 0.8);
        g.lineBetween(cx - 13, cy + 1, cx - 4, cy + 3);
        g.lineBetween(cx - 13, cy + 4, cx - 4, cy + 5);
        g.lineBetween(cx + 4, cy + 3, cx + 13, cy + 1);
        g.lineBetween(cx + 4, cy + 5, cx + 13, cy + 4);

        // Tail
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(cx - 18, cy + 4, 5);

        g.generateTexture('pet_conejo', S, S);
        g.destroy();
    }

    // ── ENEMIES ────────────────────────────────────────────────────────────────
    _makeEnemies() {
        const defs = [
            { color: 0xff4444, accent: 0xff8800, eyeColor: 0xffff00 }, // Slime
            { color: 0x9b59b6, accent: 0xcc44ff, eyeColor: 0x00ffcc }, // Shadow
            { color: 0x2255ee, accent: 0x44aaff, eyeColor: 0xffff00 }, // Golem
            { color: 0x228844, accent: 0x44ff88, eyeColor: 0xff4444 }, // Beast
        ];
        defs.forEach((d, i) => this._makeEnemy(i, d));
    }

    _makeEnemy(i, def) {
        const S = 50, cx = S / 2, cy = S / 2;
        const g = this._g();

        // Danger glow
        g.fillStyle(def.color, 0.08); g.fillCircle(cx, cy, 28);
        g.fillStyle(def.color, 0.12); g.fillCircle(cx, cy, 22);

        if (i === 0) {
            // Slime — blob
            g.fillStyle(def.color, 0.4);
            g.fillEllipse(cx, cy + 6, 40, 14);
            g.fillStyle(def.color, 1);
            g.fillCircle(cx, cy - 2, 18);
            g.fillEllipse(cx - 8, cy + 8, 14, 10);
            g.fillEllipse(cx + 8, cy + 8, 14, 10);
            g.fillEllipse(cx, cy + 10, 22, 12);
            g.fillStyle(def.accent, 0.3);
            g.fillEllipse(cx - 4, cy - 10, 10, 8);

        } else if (i === 1) {
            // Shadow — 8-point star using triangles
            g.fillStyle(def.color, 1);
            for (let j = 0; j < 8; j++) {
                const a1 = (j / 8) * Math.PI * 2;
                const a2 = ((j + 0.5) / 8) * Math.PI * 2;
                const a3 = ((j + 1) / 8) * Math.PI * 2;
                this._poly(g, [
                    { x: cx, y: cy },
                    { x: cx + Math.cos(a1) * 20, y: cy + Math.sin(a1) * 20 },
                    { x: cx + Math.cos(a2) * 11, y: cy + Math.sin(a2) * 11 },
                ], def.color);
                this._poly(g, [
                    { x: cx, y: cy },
                    { x: cx + Math.cos(a2) * 11, y: cy + Math.sin(a2) * 11 },
                    { x: cx + Math.cos(a3) * 20, y: cy + Math.sin(a3) * 20 },
                ], def.color);
            }
            g.fillStyle(def.accent, 0.4);
            g.fillCircle(cx, cy, 10);

        } else if (i === 2) {
            // Golem — plated circle
            g.fillStyle(0x112244, 1);
            g.fillCircle(cx, cy, 22);
            g.fillStyle(def.color, 1);
            g.fillCircle(cx, cy, 20);
            g.fillStyle(def.accent, 0.25);
            g.fillCircle(cx, cy, 14);
            g.lineStyle(2, def.accent, 0.7);
            g.strokeCircle(cx, cy, 14);
            g.strokeCircle(cx, cy, 20);
            // Rivets
            g.fillStyle(def.accent, 0.9);
            for (let j = 0; j < 6; j++) {
                const a = (j / 6) * Math.PI * 2;
                g.fillCircle(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17, 2.5);
            }

        } else {
            // Beast — rounded square with claws
            g.fillStyle(def.color, 1);
            g.fillRoundedRect(cx - 18, cy - 18, 36, 36, 8);
            g.fillStyle(def.accent, 0.25);
            g.fillRoundedRect(cx - 12, cy - 12, 24, 24, 5);
            // Claws
            g.fillStyle(0xdddddd, 0.9);
            for (let j = 0; j < 3; j++) {
                this._poly(g, [
                    { x: cx - 13 + j * 6, y: cy + 18 },
                    { x: cx - 11 + j * 6, y: cy + 27 },
                    { x: cx - 9 + j * 6,  y: cy + 18 }
                ], 0xdddddd, 0.9);
            }
        }

        // Eyes — always white + colored iris
        g.fillStyle(0xffffff, 1);
        g.fillCircle(cx - 8, cy - 5, 6.5);
        g.fillCircle(cx + 8, cy - 5, 6.5);

        g.fillStyle(def.eyeColor, 0.95);
        g.fillCircle(cx - 8, cy - 5, 4.5);
        g.fillCircle(cx + 8, cy - 5, 4.5);

        g.fillStyle(0x000000, 1);
        g.fillCircle(cx - 7, cy - 5, 2.5);
        g.fillCircle(cx + 9, cy - 5, 2.5);

        // Angry brows
        g.lineStyle(2.5, 0x000000, 0.9);
        g.lineBetween(cx - 14, cy - 12, cx - 3, cy - 9);
        g.lineBetween(cx + 14, cy - 12, cx + 3, cy - 9);

        // Mouth / fangs
        g.lineStyle(2, 0xffffff, 0.7);
        g.lineBetween(cx - 5, cy + 4, cx + 5, cy + 4);
        g.fillStyle(0xffffff, 0.9);
        this._poly(g, [{ x: cx - 3, y: cy + 4 }, { x: cx - 1, y: cy + 9 }, { x: cx + 1, y: cy + 4 }], 0xffffff, 0.9);
        this._poly(g, [{ x: cx + 3, y: cy + 4 }, { x: cx + 1, y: cy + 9 }, { x: cx + 5, y: cy + 4 }], 0xffffff, 0.9);

        g.generateTexture(`enemy_${i}`, S, S);
        g.destroy();
    }

    // ── MEGA PET ───────────────────────────────────────────────────────────────
    _makeMegaPet() {
        const S = 160, cx = S / 2, cy = S / 2;
        const g = this._g();

        // Outer glow rings
        const glowColors = [0xff00cc, 0x7c4dff, 0x00f5ff, 0xffd700, 0xff4500];
        glowColors.forEach((c, idx) => {
            g.fillStyle(c, 0.04 + idx * 0.01);
            g.fillCircle(cx, cy, 75 - idx * 6);
        });

        // Star burst (8 rays using thin triangles)
        for (let j = 0; j < 16; j++) {
            const a = (j / 16) * Math.PI * 2;
            const r = j % 2 === 0 ? 62 : 38;
            this._poly(g, [
                { x: cx, y: cy },
                { x: cx + Math.cos(a - 0.08) * r, y: cy + Math.sin(a - 0.08) * r },
                { x: cx + Math.cos(a + 0.08) * r, y: cy + Math.sin(a + 0.08) * r },
            ], 0xffd700, 0.18);
        }

        // Orbit ring
        g.lineStyle(3, 0x00f5ff, 0.4);
        g.strokeEllipse(cx, cy, 100, 34);
        g.lineStyle(2, 0xff00cc, 0.3);
        g.strokeEllipse(cx, cy, 80, 27);

        // Body — layered circles
        g.fillStyle(0x1a0030, 1);   g.fillCircle(cx, cy, 44);
        g.fillStyle(0xff00cc, 1);   g.fillCircle(cx, cy, 42);
        g.fillStyle(0x7c4dff, 0.75); g.fillCircle(cx, cy, 36);
        g.fillStyle(0x00f5ff, 0.5); g.fillCircle(cx, cy, 28);
        g.fillStyle(0xffffff, 0.1); g.fillEllipse(cx - 8, cy - 8, 26, 20);

        // Crown
        const crownY = cy - 36;
        g.fillStyle(0xffd700, 1);
        g.fillRect(cx - 18, crownY, 36, 10);
        // 3 spikes using triangles
        this._poly(g, [{ x: cx - 18, y: crownY }, { x: cx - 18, y: crownY - 16 }, { x: cx - 8, y: crownY }], 0xffd700);
        this._poly(g, [{ x: cx - 3, y: crownY }, { x: cx, y: crownY - 22 }, { x: cx + 3, y: crownY }], 0xffd700);
        this._poly(g, [{ x: cx + 18, y: crownY }, { x: cx + 18, y: crownY - 16 }, { x: cx + 8, y: crownY }], 0xffd700);
        // Crown gems
        g.fillStyle(0xff0050, 1); g.fillCircle(cx - 13, crownY - 8, 4);
        g.fillStyle(0x00f5ff, 1); g.fillCircle(cx, crownY - 12, 4);
        g.fillStyle(0x7c4dff, 1); g.fillCircle(cx + 13, crownY - 8, 4);

        // Eyes
        g.fillStyle(0x000000, 1);
        g.fillEllipse(cx - 13, cy - 6, 15, 15);
        g.fillEllipse(cx + 13, cy - 6, 15, 15);
        g.fillStyle(0x00f5ff, 1);
        g.fillEllipse(cx - 13, cy - 6, 11, 11);
        g.fillEllipse(cx + 13, cy - 6, 11, 11);
        g.fillStyle(0xff00cc, 0.8);
        g.fillCircle(cx - 13, cy - 6, 5.5);
        g.fillCircle(cx + 13, cy - 6, 5.5);
        g.fillStyle(0x000000, 1);
        g.fillCircle(cx - 13, cy - 6, 3);
        g.fillCircle(cx + 13, cy - 6, 3);
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(cx - 10, cy - 9, 3);
        g.fillCircle(cx + 16, cy - 9, 3);

        // Smile arc (series of circles)
        g.fillStyle(0xffd700, 1);
        for (let j = -5; j <= 5; j++) {
            const a = (j / 12) * Math.PI;
            g.fillCircle(cx + Math.cos(Math.PI - a) * 11, cy + 8 + Math.sin(Math.PI - a) * 5, 1.8);
        }

        // Corner sparkles (4 diagonal points)
        const sparks = [
            { x: cx - 40, y: cy - 18 },
            { x: cx + 40, y: cy - 14 },
            { x: cx - 30, y: cy + 34 },
            { x: cx + 32, y: cy + 30 },
        ];
        sparks.forEach(s => {
            g.fillStyle(0xffffff, 0.8);
            g.fillCircle(s.x, s.y, 3);
            g.fillStyle(0xffd700, 0.5);
            g.fillCircle(s.x, s.y, 5);
            // Mini cross
            g.lineStyle(1.5, 0xffffff, 0.7);
            g.lineBetween(s.x - 5, s.y, s.x + 5, s.y);
            g.lineBetween(s.x, s.y - 5, s.x, s.y + 5);
        });

        g.generateTexture('mega_pet', S, S);
        g.destroy();
    }

    // ── PROJECTILE ────────────────────────────────────────────────────────────
    _makeProjectile() {
        const S = 20, g = this._g();
        g.fillStyle(0xffff00, 0.2); g.fillCircle(S / 2, S / 2, 9);
        g.fillStyle(0xffffff, 1);   g.fillCircle(S / 2, S / 2, 5);
        g.fillStyle(0xffee00, 0.9); g.fillCircle(S / 2, S / 2, 4);
        g.fillStyle(0xffffff, 0.7); g.fillCircle(S / 2 - 1, S / 2 - 1, 2);
        g.generateTexture('projectile', S, S);
        g.destroy();
    }

    // ── PARTICLE ──────────────────────────────────────────────────────────────
    _makeParticle() {
        const S = 12, g = this._g();
        g.fillStyle(0xffffff, 0.4); g.fillCircle(S / 2, S / 2, S / 2);
        g.fillStyle(0xffffff, 1);   g.fillCircle(S / 2, S / 2, S / 4);
        g.generateTexture('particle', S, S);
        g.destroy();
    }

    // ── HP BAR ASSETS ─────────────────────────────────────────────────────────
    _makeHpAssets() {
        {
            const g = this._g();
            g.fillStyle(0x0a0a1e, 0.95);
            g.fillRoundedRect(0, 0, 60, 8, 4);
            g.lineStyle(1, 0x333355, 0.8);
            g.strokeRoundedRect(0, 0, 60, 8, 4);
            g.generateTexture('hp_bar_bg', 60, 8);
            g.destroy();
        }
        {
            const g = this._g();
            g.fillStyle(0x00ff66, 1);
            g.fillRoundedRect(0, 0, 58, 6, 3);
            g.generateTexture('hp_bar_fill', 58, 6);
            g.destroy();
        }
        {
            const g = this._g();
            g.fillStyle(0xff8800, 0.2); g.fillCircle(18, 18, 16);
            g.fillStyle(0xff8800, 1);   g.fillCircle(18, 18, 12);
            g.fillStyle(0xffff00, 0.9); g.fillCircle(18, 18, 7);
            g.fillStyle(0xffffff, 0.6); g.fillCircle(18, 18, 3);
            g.generateTexture('attack_effect', 36, 36);
            g.destroy();
        }
        {
            const g = this._g();
            g.fillStyle(0x00f5ff, 0.15);
            g.fillPoints([
                { x: 10, y: 2 }, { x: 18, y: 6 }, { x: 18, y: 12 },
                { x: 10, y: 18 }, { x: 2, y: 12 }, { x: 2, y: 6 }
            ], true);
            g.lineStyle(1.5, 0x00f5ff, 0.8);
            g.strokePoints([
                { x: 10, y: 2 }, { x: 18, y: 6 }, { x: 18, y: 12 },
                { x: 10, y: 18 }, { x: 2, y: 12 }, { x: 2, y: 6 }
            ], true);
            g.generateTexture('shield', 20, 20);
            g.destroy();
        }
    }

    create() {
        console.log('[BootScene] Assets premium generados ✓');
    }
}
