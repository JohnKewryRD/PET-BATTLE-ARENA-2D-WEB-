/**
 * Pool de Objetos
 * Gestiona la agrupación de objetos para optimización de rendimiento
 */

export class ObjectPool {
    constructor(scene) {
        this.scene = scene;
        this.pools = new Map();
        this.maxPoolSize = 100;
    }

    createPool(key, factory, initialSize = 10) {
        if (this.pools.has(key)) {
            console.warn(`El pool ${key} ya existe`);
            return this.pools.get(key);
        }

        const pool = {
            available: [],
            inUse: new Set(),
            factory: factory
        };

        // Pre-poblar pool
        for (let i = 0; i < initialSize; i++) {
            const obj = factory();
            obj.active = false;
            pool.available.push(obj);
        }

        this.pools.set(key, pool);
        console.log(`[ObjectPool] Pool creado: ${key} con ${initialSize} objetos`);

        return pool;
    }

    get(key) {
        const pool = this.pools.get(key);
        if (!pool) {
            console.warn(`El pool ${key} no existe`);
            return null;
        }

        let obj;
        if (pool.available.length > 0) {
            obj = pool.available.pop();
        } else if (pool.inUse.size < this.maxPoolSize) {
            // Crear nuevo si está bajo el límite
            obj = pool.factory();
        } else {
            // Pool agotado, devolver null
            console.warn(`Pool ${key} agotado`);
            return null;
        }

        obj.active = true;
        pool.inUse.add(obj);
        return obj;
    }

    release(key, obj) {
        const pool = this.pools.get(key);
        if (!pool) {
            console.warn(`El pool ${key} no existe`);
            return;
        }

        if (!pool.inUse.has(obj)) {
            return;
        }

        obj.active = false;
        pool.inUse.delete(obj);
        pool.available.push(obj);
    }

    releaseAll(key) {
        const pool = this.pools.get(key);
        if (!pool) return;

        pool.available.push(...pool.inUse);
        pool.inUse.clear();
    }

    clear(key) {
        const pool = this.pools.get(key);
        if (!pool) return;

        pool.available.forEach(obj => {
            if (obj.destroy) obj.destroy();
        });
        pool.inUse.forEach(obj => {
            if (obj.destroy) obj.destroy();
        });

        pool.available = [];
        pool.inUse.clear();
    }

    getStats() {
        const stats = {};
        this.pools.forEach((pool, key) => {
            stats[key] = {
                available: pool.available.length,
                inUse: pool.inUse.size,
                total: pool.available.length + pool.inUse.size
            };
        });
        return stats;
    }

    // Utilidad para crear pool de partículas
    createParticlePool() {
        return this.createPool('particles', () => {
            const sprite = this.scene.add.sprite(0, 0, 'particle');
            sprite.setActive(false);
            sprite.setVisible(false);
            return sprite;
        }, 50);
    }

    // Utilidad para crear pool de proyectiles
    createProjectilePool() {
        return this.createPool('projectiles', () => {
            const sprite = this.scene.add.sprite(0, 0, 'projectile');
            sprite.setActive(false);
            sprite.setVisible(false);
            return sprite;
        }, 30);
    }
}
