# Admin Tokens por Room

El reset de leaderboard valida un token distinto por `roomId`.
Ahora el alta del token es automatica al conectar un live nuevo en `/connect`.

## Variables necesarias

- `SUPABASE_ADMIN_TOKENS_TABLE=admin_room_tokens`
- `ADMIN_TOKEN_PEPPER=<secreto_largo>`

## Flujo automatico

1. El streamer conecta su TikTok desde la UI.
2. El backend genera un token admin nuevo para ese `roomId`.
3. Se guarda solo el hash en Supabase.
4. El token plano se devuelve en esa respuesta y el frontend lo guarda en `localStorage`.

No necesitas ejecutar comando manual para cada streamer nuevo si usa este flujo.

## Rotacion manual (opcional)

```bash
npm run admin:token:set -- room_streamer123 mi_token_super_secreto
```

Esto guarda el hash en `public.admin_room_tokens` y deja `active=true`.

## Desactivar token de un room (opcional)

```bash
npm run admin:token:set -- room_streamer123 mi_token_cualquiera --inactive
```

## Comportamiento de seguridad

- `POST /admin/leaderboard/reset` requiere `roomId`.
- El backend compara `x-admin-token` (o bearer) contra el hash del `roomId`.
- Un token de un room no sirve para resetear otro room.
- No hay reset global sin `roomId`.
