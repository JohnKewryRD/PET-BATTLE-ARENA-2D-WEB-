/**
 * Sistema de Audio
 * Usa Howler.js (contexto WebAudio) para efectos reactivos ligeros sin assets externos.
 */

export class AudioSystem {
    constructor() {
        this.enabled = Boolean(window.Howler && window.Howler.ctx);
        this.masterGain = this.enabled ? window.Howler.ctx.createGain() : null;
        this.lastHitAt = 0;
        this.lastSpawnAt = 0;

        if (this.enabled) {
            this.masterGain.gain.value = 0.08;
            this.masterGain.connect(window.Howler.ctx.destination);
        }
    }

    playTone(frequency, durationMs, type = 'sine', volume = 0.08) {
        if (!this.enabled) return;
        const ctx = window.Howler.ctx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + durationMs / 1000 + 0.01);
    }

    playPetSpawn() {
        const now = Date.now();
        if (now - this.lastSpawnAt < 80) return;
        this.lastSpawnAt = now;
        this.playTone(680, 90, 'triangle', 0.05);
    }

    playEnemyHit() {
        const now = Date.now();
        if (now - this.lastHitAt < 45) return;
        this.lastHitAt = now;
        this.playTone(220, 55, 'square', 0.04);
    }

    playBossSpawn() {
        this.playTone(130, 220, 'sawtooth', 0.07);
        setTimeout(() => this.playTone(95, 260, 'sawtooth', 0.08), 120);
    }

    playMegaActivate() {
        this.playTone(420, 120, 'triangle', 0.07);
        setTimeout(() => this.playTone(620, 150, 'triangle', 0.08), 90);
        setTimeout(() => this.playTone(820, 220, 'triangle', 0.08), 200);
    }

    playWaveComplete() {
        this.playTone(520, 100, 'triangle', 0.06);
        setTimeout(() => this.playTone(700, 130, 'triangle', 0.07), 110);
    }
}
