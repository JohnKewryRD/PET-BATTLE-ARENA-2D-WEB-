# 🐾 PET BATTLE ARENA

Juego 2D en tiempo real integrado con TikTok Live. Los espectadores del stream pueden generar mascotas mediante comentarios del chat, y estas combaten automáticamente contra oleadas de enemigos.

## 🚀 Inicio Rápido

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar TikTok (opcional)

Crea un archivo `.env` basado en `.env.example`:

```env
TIKTOK_USERNAME=tu_usuario_tiktok
PORT=3000
CLIENT_URL=http://localhost:8080
MAX_PETS=200
WAVE_INTERVAL=15000
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
SUPABASE_LEADERBOARD_TABLE=leaderboard_scores
SUPABASE_USER_PROGRESS_TABLE=user_pet_progress
```

### 3. Ejecutar

**Modo Demo (sin TikTok):**
```bash
npm start
```

**Modo Desarrollo (ambos servidores):**
```bash
npm run dev:all
```

## 📁 Estructura del Proyecto

```
pet-battle-arena/
├── server/                 # Backend Node.js
│   ├── index.js            # Entry point + Socket.IO
│   ├── tiktok/            # TikTok Live Connector
│   └── events/            # Event Processor
├── client/                 # Frontend Phaser.js
│   ├── index.html         # HTML + CSS overlay
│   └── src/
│       ├── main.js       # Entry point + Socket client
│       ├── scenes/       # Boot, Game, UI scenes
│       ├── systems/      # Combat, Particles, Waves, Pool
│       └── config/        # Game configuration
├── package.json
└── README.md
```

## 🎮 Mecánicas del Juego

### Generación de Mascotas (desde Chat)

| Comentario | Mascota | Stats |
|------------|---------|-------|
| "gato" | 🐱 Gato | Rápido, bajo daño |
| "perro" | 🐕 Perro | Balanceado |
| "dragon" | 🐉 Dragón | Lento, alto daño |
| "conejo" | 🐰 Conejo | Muy rápido, bajo HP |
| 🔥 | 🐉 (equivale a dragón) | - |

### Sistema de Regalos

| Valor (diamantes) | Efecto |
|-------------------|--------|
| 1-99 | Genera 1 mascota |
| 100-499 | Genera 2 mascotas |
| 500-2,999 | Genera 3 mascotas + upgrade global |
| 3,000+ | **MEGA PET MODE** (30 segundos) |

### Sistema de Likes

- Cada 50 likes: mejora global de mascotas
- Barra de energía visual en pantalla

### Oleadas de Enemigos

- Enemigos aparecen cada 15 segundos
- Dificultad progresiva
- **Boss** cada 5 oleadas

## 🛠️ Stack Tecnológico

- **Backend:** Node.js + Express + Socket.IO
- **TikTok:** tiktok-live-connector
- **Frontend:** Phaser 4 (RC) + PixiJS (CDN `@latest`)
- **Estilos:** HTML/CSS (overlay)
- **Deploy:** OBS Browser Source

## 📺 Configuración en OBS

1. Ejecuta el juego: `npm start`
2. En OBS, añade una **Browser Source**
3. Configuración:
   - URL: `http://localhost:8080`
   - Width: 1920, Height: 1080
   - FPS: 60
4. CSS personalizado para transparencia:
   ```css
   body { background: transparent !important; }
   ```

## 🔧 API de Eventos (Socket.IO)

### Cliente → Servidor

```javascript
// Generar mascota (demo)
socket.emit('pet:spawn', { owner: 'User', type: 'gato' });

// Simular likes
socket.emit('likes:add', 50);

// Simular regalo
socket.emit('gift:send', {
    username: 'user',
    giftName: 'Lion',
    diamondCount: 3000
});
```

### Servidor → Cliente

```javascript
// Estado del juego
socket.on('game:init', (state) => { ... });
socket.on('game:update', (state) => { ... });

// Mascota añadida
socket.on('pet:added', (pet) => { ... });

// Nueva oleada
socket.on('wave:spawn', (data) => { ... });

// Mega Pet activado
socket.on('megaPet:activate', (data) => { ... });
```

## 🎨 Personalización

Edita `client/src/config/GameConfig.js` para modificar:

- Stats de mascotas
- Dificultad de oleadas
- Valores de regalos
- Límites de rendimiento

## 📝 Licencia

MIT - DEV-GAMES-TOK
