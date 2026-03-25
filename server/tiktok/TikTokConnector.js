/**
 * Conector TikTok Live
 * Usa tiktok-live-connector para capturar eventos del stream en vivo
 */

const { WebcastPushConnection } = require('tiktok-live-connector');

class TikTokConnector {
    constructor(username, eventProcessor) {
        this.username = username.replace('@', '');
        this.eventProcessor = eventProcessor;
        this.connection = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            console.log(`[TikTok] Conectando al stream en vivo de @${this.username}...`);

            this.connection = new WebcastPushConnection(this.username, {
                sessionLengthInMinutes: 240,
                fetchExistingStreamEvents: true,
                enableWebsocketUpgrade: true,
                rtmpUrl: null,
                livehost: undefined,
            });

            // Configurar escuchadores de eventos
            this.setupEventListeners();

            // Conectar
            await this.connection.connect();
            this.isConnected = true;

            console.log(`[TikTok] Conectado exitosamente a @${this.username}`);
            
            return true;
        } catch (error) {
            console.error('[TikTok] Error de conexión:', error.message);
            throw error;
        }
    }

    setupEventListeners() {
        // Mensajes de chat (comentarios)
        this.connection.on('chat', (data) => {
            const comment = {
                userId: data.user?.userId || 'unknown',
                username: data.uniqueId || data.commentUser?.uniqueId || 'anonymous',
                text: data.comment || '',
                // Nombre para mostrar del comentarista
                nickname: data.nickname || data.commentUser?.nickname || 'Anónimo',
                // Foto de perfil
                avatar: data.user?.avatarThumb?.urlList?.[0] || null
            };
            
            this.eventProcessor.processComment(comment);
        });

        // Eventos de regalos
        this.connection.on('gift', (data) => {
            const gift = {
                userId: data.user?.userId || 'unknown',
                username: data.uniqueId || 'anonymous',
                nickname: data.nickname || 'Anónimo',
                giftName: data.giftName || 'Desconocido',
                giftCount: data.repeatCount || 1,
                giftId: data.giftId,
                diamondCount: data.diamondCount || 0,
                // Si este regalo debe activar Mega Mascota
                isViralGift: this.isViralGift(data.giftName, data.diamondCount)
            };
            
            this.eventProcessor.processGift(gift);
        });

        // Eventos de likes
        this.connection.on('like', (data) => {
            const likeEvent = {
                userId: data.user?.userId || 'unknown',
                username: data.uniqueId || 'anonymous',
                likeCount: data.likeCount || 1,
                // Likes acumulativos para este stream
                totalLikes: data.totalLikedCount || 0
            };
            
            this.eventProcessor.processLikes(likeEvent.likeCount);
        });

        // Eventos de suscripción/seguir
        this.connection.on('subscribe', (data) => {
            const subscriber = {
                userId: data.user?.userId || 'unknown',
                username: data.uniqueId || 'anonymous',
                nickname: data.nickname || 'Anónimo'
            };
            
            // Los seguidores dan un pequeño impulso a todas las mascotas
            this.eventProcessor.processFollow(subscriber);
        });

        // Eventos de compartir
        this.connection.on('share', (data) => {
            const sharer = {
                username: data.uniqueId || 'anonymous'
            };
            
            // Los compartidos generan una mascota helper especial
            this.eventProcessor.processShare(sharer);
        });

        // Tarjeta de espectador (par social)
        this.connection.on('social', (data) => {
            console.log('[TikTok] Evento social:', data);
        });

        // Fin del stream
        this.connection.on('streamEnd', () => {
            console.log('[TikTok] El stream ha terminado');
            this.isConnected = false;
            // Intentar reconexión
            this.reconnect();
        });

        // Manejo de errores
        this.connection.on('error', (error) => {
            console.error('[TikTok] Error de WebSocket:', error.message);
        });

        // Desconectar
        this.connection.on('disconnect', () => {
            console.log('[TikTok] Desconectado del stream en vivo');
            this.isConnected = false;
        });
    }

    isViralGift(giftName, diamondCount) {
        // Regalos virales que activan el modo Mega Mascota
        const viralGifts = [
            'Lion', 'Universe', 'Galaxy', 'Meteor', 
            'Dragon', 'Phoenix', 'Rainbow', 'Crown',
            'TikTok', 'Gold', 'Diamond'
        ];

        // También activar en regalos de 3000+ diamantes
        const isHighValue = diamondCount >= 3000;

        return viralGifts.some(vg => 
            giftName?.toLowerCase().includes(vg.toLowerCase())
        ) || isHighValue;
    }

    async reconnect() {
        console.log('[TikTok] Intentando reconectar en 10 segundos...');
        setTimeout(async () => {
            try {
                await this.connect();
            } catch (error) {
                console.error('[TikTok] Reconexión fallida:', error.message);
                // Intentar de nuevo
                this.reconnect();
            }
        }, 10000);
    }

    disconnect() {
        if (this.connection) {
            this.connection.disconnect();
            this.isConnected = false;
            console.log('[TikTok] Desconectado');
        }
    }

    getStatus() {
        return {
            connected: this.isConnected,
            username: this.username,
            roomId: this.connection?.roomInfo?.roomId || null
        };
    }
}

module.exports = TikTokConnector;
