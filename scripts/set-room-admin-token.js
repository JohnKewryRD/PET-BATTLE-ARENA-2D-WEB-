#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const crypto = require('crypto');

const roomIdRaw = process.argv[2] || '';
const token = process.argv[3] || '';
const active = !process.argv.includes('--inactive');

if (!roomIdRaw || !token) {
    console.error('Uso: node scripts/set-room-admin-token.js <roomId> <plainToken> [--inactive]');
    process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const table = process.env.SUPABASE_ADMIN_TOKENS_TABLE || 'admin_room_tokens';
const pepper = process.env.ADMIN_TOKEN_PEPPER || '';

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env/.env.local');
    process.exit(1);
}

function normalizeRoomId(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .slice(0, 64) || 'default_room';
}

function hashAdminToken(roomId, plainToken) {
    return crypto
        .createHash('sha256')
        .update(`${roomId}:${plainToken}:${pepper}`)
        .digest('hex');
}

async function run() {
    const roomId = normalizeRoomId(roomIdRaw);
    const tokenHash = hashAdminToken(roomId, token);
    const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}?on_conflict=room_id`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify([
            {
                room_id: roomId,
                token_hash: tokenHash,
                active
            }
        ])
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Error guardando token: ${response.status} ${errorBody}`);
    }

    console.log(`Token admin actualizado para room_id=${roomId} (active=${active})`);
}

run().catch((error) => {
    console.error(error.message);
    process.exit(1);
});

