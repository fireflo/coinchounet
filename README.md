# Coinchounet - Complete Coinche Card Game

Full-stack multiplayer coinche card game with AI bots.

## Quick Start


- **Bun** `>=1.1`
- **Node.js** `>=18` (only required if running npm scripts directly)
- **Mise** (optional) for task orchestration defined in `mise.toml`.

Install dependencies:

```bash
bun install
```

## Development Workflow

### Start the frontend

```bash
bun run dev
```

This launches Vite at `http://localhost:5173`. Specify API/socket backends through environment variables in a `.env` file:

```bash
VITE_API_BASE_URL=https://api.example.com/v1
VITE_SOCKET_BASE_URL=wss://api.example.com/v1
```

If `VITE_SOCKET_BASE_URL` is omitted, the Socket.IO client falls back to `VITE_API_BASE_URL`.

### Serve the OpenAPI spec

```bash
mise run swagger:ui
```

Hosts Swagger UI at `http://localhost:8080` for `specs/openapi.yaml`.

### Formatting & linting

```bash
bun run lint
bun run format
```

### Tests

Socket.IO unit tests (`vitest`) will be restored once the new realtime implementation is finalized. Re-enable by recreating `tests/socket-client.spec.ts` and running:

```bash
bun run test
```

## Frontend Structure

```
src/
  api/            // REST helpers and shared types
  app/            // Shell layout and navigation
  features/       // Route-driven feature bundles (auth, lobby, room, game)
  realtime/       // Socket.IO client, context, and hooks
  styles/         // Tailwind entrypoint and theme tokens
```

Key realtime components:

- `src/realtime/socket.ts`: low-level Socket.IO wrapper with acknowledgement helpers.
- `src/realtime/SocketContext.tsx`: React provider exposing `ensureConnected`, `joinChannel`, and `emitWithAck`.
- `src/realtime/useRealtimeGame.ts`: subscribes to `game:{id}` channels to sync TanStack Query caches.

## Development Auth Bypass

The landing page offers a temporary admin/password shortcut intended **only for local development**:

- Username: `admin`
- Password: `password`

Submit the form and you will redirect straight to the lobby view. Remove this before deploying production builds.

## Styling

Tailwind utilities are available through `src/styles/index.css`. IDE warnings about `@tailwind` directives disappear once the Tailwind/PostCSS language plugin is enabled. Vite automatically processes Tailwind via `postcss.config.js`.

## Next Steps

- Implement realtime hooks for lobby/room lists similar to `useRealtimeGame`.
- Add actionable handlers for playing cards and bidding (`emitWithAck` + optimistic UI).
- Re-enable Vitest coverage for the Socket.IO client and new hooks.
- Harden authentication by replacing the dev bypass with OAuth 2.1 PKCE as per `specs/client-server.md`.
