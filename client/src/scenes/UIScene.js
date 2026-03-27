/**
 * Escena de UI
 * Maneja elementos HUD y superposiciones
 */

const Phaser = window.Phaser;

export class UIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UIScene' });
    }

    create() {
        // Esta escena se ejecuta en paralelo a GameScene
        // Los elementos de UI se manejan a través de superposición HTML/CSS en index.html
        console.log('[UIScene] Superposición de UI lista');
    }
}
