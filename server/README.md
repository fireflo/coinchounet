# Coinchounet API Server

This package hosts the development API for the Coinchounet frontend.

## Requirements

- Node 20 (managed via `mise`).
- `pnpm` v8.

## Setup

```bash
mise install
pnpm install
```

## Available Scripts

```bash
pnpm dev       # Start the HTTP server with auto-reload
pnpm build     # Type-check and emit compiled JavaScript to dist/
pnpm start     # Run the compiled production build
pnpm test      # Execute Vitest test suite
pnpm lint      # Run ESLint
```

## Environment Variables

- `PORT` (default: `3001`)
- `DEV_TOKEN` (default: `dev-token`) – shared secret for local auth bypass.
- `LOG_LEVEL` (default: `info`)

Create a `.env` file alongside this README to override defaults.

## API Contract

The canonical OpenAPI document lives at `../specs/openapi.yaml`. The server consumes these shapes via the TypeScript definitions in `src/types/api.ts`.

### Key Endpoints

- **Health**: `GET /health` - No auth required
- **Auth**: `POST /auth/oauth/token` - OAuth token exchange
- **Rooms**: `POST /rooms`, `GET /rooms`, `POST /rooms/:id/join`, `POST /rooms/:id/start`
- **Games**: `GET /games/:id`, `GET /games/:id/me/hand`, `POST /games/:id/turns/current/move`
- **Events**: `GET /games/:id/events` - Event history replay

## Development

### Testing with Multiple Users

The dev auth middleware supports testing with multiple users via token format `dev-user-{userId}`:

```bash
# User 1
curl -H "Authorization: Bearer dev-user-player1" http://localhost:3001/rooms

# User 2  
curl -H "Authorization: Bearer dev-user-player2" http://localhost:3001/rooms
```

### Test Suite

All 67 tests are passing:
- Health checks (1 test)
- OAuth token exchange (3 tests)
- Room lifecycle (7 tests)
- Game state and turn management (6 tests)
- Socket.IO integration (10 tests)
- Bidding system (30 tests)
- Scoring calculation (20 tests)

## Architecture

See `docs/architecture.md` for a detailed breakdown of layers, middleware, and testing strategy.

## Socket.IO Real-time Events

The server includes a Socket.IO server for real-time updates:

```javascript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3001', {
  auth: { token: 'dev-user-player1' }
});

// Join a room
socket.emit('room:join', 'room_123', (response) => {
  console.log(response); // { ok: true }
});

// Listen for room updates
socket.on('room:updated', (data) => {
  console.log('Room updated:', data);
});

// Join a game
socket.emit('game:join', 'game_456', (response) => {
  console.log(response); // { ok: true }
});

// Listen for game events
socket.on('game:move_accepted', (data) => {
  console.log('Move accepted:', data);
});

socket.on('game:turn_changed', (data) => {
  console.log('Turn changed:', data);
});
```

## Implementation Status

✅ **Completed**: 
- REST API with all endpoints (including bidding)
- Room/game lifecycle management
- **Full coinche rule validation** (following suit, trumping, overtrumping, partner exception)
- **Complete bidding system** (bids, coinche, surcoinche, passing, auction end)
- **Full scoring calculation** (card values, belote, dix de der, capot, penalties, multipliers)
- **Integrated bidding & scoring** into game flow
- **Multi-round games** with cumulative scores up to 1000 points
- **Socket.IO real-time server** with room/game/bidding events (HTTP + WebSocket on port 3001)
- **AI Bot players** with automatic bidding and card play
- **Fill room with bots** endpoint for easy testing
- Event system with REST fallback
- **67 passing tests** (unit + integration + Socket.IO)

🚧 **Pending**: 
- Belote/Rebelote announcement mechanism
- Production OAuth integration
- Database persistence
- Game history and replay

See `BOT_IMPLEMENTATION.md` for bot details and `PHASE_4_SUMMARY.md` for game flow.
