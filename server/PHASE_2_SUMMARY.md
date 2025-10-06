# Phase 2 Implementation Summary: Socket.IO & Full Coinche Rules

## Overview

Successfully completed Phase 2 of the server implementation, adding:
1. **Socket.IO real-time server** with WebSocket support
2. **Full coinche rule validation** according to specs/rules.md

All 17 existing tests continue to pass ✓

## What Was Implemented

### 1. Full Coinche Rule Validator (`src/rules/coinche.ts`)

Implemented complete rule validation according to `specs/rules.md`:

#### Card Ranking
- **Trump suit**: J (20), 9 (14), A (11), 10 (10), K (4), Q (3), 8 (0), 7 (0)
- **Non-trump suits**: A (11), 10 (10), K (4), Q (3), J (2), 9 (0), 8 (0), 7 (0)
- **All-trump**: Every suit uses trump ranking
- **No-trump**: All suits use non-trump ranking

#### Following Suit Rules
1. **Must follow suit if possible** - Players must play the suit that was led if they have it
2. **Must trump if can't follow** - If unable to follow suit, must play trump if available
3. **Must overtrump if possible** - When trumping, must play a higher trump than already played
4. **Partner winning exception** - If partner is currently winning the trick, can discard any card

#### Trick Winner Determination
- Highest trump wins if any trumps played
- Otherwise, highest card of led suit wins
- Correctly handles all trump/no-trump contracts

#### Functions Exported
- `validateMove(playerId, card, context)` - Validates if a card play is legal
- `determineTrickWinner(trick, context)` - Determines who won the trick
- `getCardValue(card, context)` - Returns point value of a card

### 2. Socket.IO Real-time Server (`src/realtime/socketServer.ts`)

Full WebSocket server with typed events and channels:

#### Channels
- `room:{roomId}` - Room updates (player joins/leaves, ready states)
- `game:{gameId}:public` - Public game state (all players and spectators)
- `game:{gameId}:private:{playerId}` - Private player data (hand updates)

#### Server-to-Client Events
- `room:updated` - Room state changed
- `room:player_joined` - Player joined room
- `room:player_left` - Player left room
- `room:game_started` - Game started from room
- `game:state_changed` - Game state updated
- `game:move_accepted` - Move was accepted
- `game:turn_changed` - Turn changed (trick completed)
- `game:hand_updated` - Private hand updated (sent only to specific player)
- `system:heartbeat` - Keepalive every 15 seconds

#### Client-to-Server Events
- `room:join` - Join room channel
- `room:leave` - Leave room channel
- `game:join` - Join game channel (public + private if player)
- `game:leave` - Leave game channel

#### Authentication
- Same auth as REST endpoints
- Supports dev tokens: `dev-user-{userId}`
- Token passed in handshake: `auth: { token: 'dev-user-player1' }`

#### Features
- TypeScript typed events for type safety
- Acknowledgement callbacks for all client events
- Automatic heartbeat every 15 seconds
- Graceful shutdown handling
- CORS enabled for cross-origin connections

### 3. Game Service Integration

Updated `src/services/gameService.ts` to:
- Use full coinche rule validator for move validation
- Broadcast events via Socket.IO when moves accepted
- Broadcast turn changes when tricks complete
- Broadcast game start events

### 4. Server Integration

Updated `src/server.ts` to:
- Create HTTP server with Socket.IO attached
- Initialize Socket.IO on server startup
- Graceful shutdown for both HTTP and Socket.IO
- Global io instance for service access (temporary, should use DI in production)

### 5. Documentation

Created comprehensive documentation:
- **SOCKET_IO_GUIDE.md** - Complete Socket.IO integration guide with examples
- Updated **docs/architecture.md** - Added real-time integration section
- Updated **README.md** - Added Socket.IO quick start examples

## Technical Details

### Dependencies Added
```json
{
  "socket.io": "^4.x",
  "@types/socket.io": "^3.x"
}
```

Installed with `--legacy-peer-deps` due to ESLint version conflicts.

### Type Safety

Full TypeScript typing for Socket.IO:

```typescript
interface ClientToServerEvents {
  'room:join': (roomId: string, callback: (response: { ok: boolean; error?: string }) => void) => void;
  // ...
}

interface ServerToClientEvents {
  'room:updated': (data: { roomId: string; timestamp: string }) => void;
  // ...
}

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
```

### Rule Validation Flow

```
1. Player submits move via REST POST /games/{gameId}/turns/current/move
2. Game service validates move using coinche.validateMove()
3. If invalid, returns 422 with violations array
4. If valid, applies move and broadcasts via Socket.IO
5. All connected clients receive game:move_accepted event
6. Clients fetch updated state via REST or use event data
```

### Event Broadcasting

```typescript
// In game service
const io = getSocketIO();
if (io) {
  io.to(`game:${gameId}:public`).emit('game:move_accepted', {
    gameId,
    moveId: result.moveId,
    playerId: context.playerId,
    stateVersion: game.state.stateVersion,
  });
}
```

## Testing

### Existing Tests
All 17 existing integration tests continue to pass:
- ✓ Health check
- ✓ OAuth token exchange (3 tests)
- ✓ Room lifecycle (7 tests)
- ✓ Game flow (6 tests)

### Manual Testing

Socket.IO can be tested with:

```javascript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3001', {
  auth: { token: 'dev-user-player1' }
});

socket.on('connect', () => console.log('Connected'));
socket.emit('room:join', 'room_123', (res) => console.log(res));
socket.on('room:updated', (data) => console.log('Room updated:', data));
```

## What's Still Pending

### Coinche Game Features
1. **Bidding Phase** - Currently skipped, need to implement:
   - Minimum bid of 80 points
   - Trump selection (clubs, diamonds, hearts, spades, no-trump, all-trump)
   - Coinche/Surcoinche (doubling/redoubling)
   - Passing and auction end logic

2. **Belote/Rebelote** - King and Queen of trump announcement:
   - Track when K♠ and Q♠ played (if spades is trump)
   - Award 20 bonus points
   - Must announce at moment of play

3. **Scoring Calculation**:
   - Contract fulfillment checking
   - Failed contract penalties (160 points to defenders)
   - Capot (all tricks) - 250 points
   - Dix de der (last trick) - 10 bonus points
   - Coinche multipliers (x2 for coinche, x4 for surcoinche)
   - Rounding to nearest 10

4. **Game End Conditions**:
   - Track cumulative scores across deals
   - Detect when team reaches 1000 points
   - Handle redeal conditions (four 7s or four 8s)

### Infrastructure
1. **Production OAuth** - Replace mock tokens with real Google/Facebook OAuth
2. **Database Integration** - Replace in-memory stores with PostgreSQL/MongoDB
3. **Socket.IO Tests** - Add integration tests for WebSocket events
4. **Rate Limiting** - Add rate limiting for Socket.IO events
5. **Metrics** - Add Prometheus metrics for Socket.IO connections

## Running the Server

```bash
# Install dependencies
npm install

# Run tests (all 17 pass)
npm test

# Start development server
npm run dev

# Server starts on:
# - HTTP: http://localhost:3001
# - Socket.IO: ws://localhost:3001/socket.io/
```

## Example Usage

### Complete Game Flow with Socket.IO

```javascript
// 1. Connect
const socket = io('ws://localhost:3001', {
  auth: { token: 'dev-user-player1' }
});

// 2. Create room via REST
const room = await fetch('/rooms', {
  method: 'POST',
  body: JSON.stringify({
    gameType: 'coinche',
    maxSeats: 4,
    visibility: 'public',
    rulesetVersion: '2024.09'
  })
}).then(r => r.json());

// 3. Join room channel
socket.emit('room:join', room.roomId, (res) => {
  console.log('Joined room:', res.ok);
});

// 4. Listen for updates
socket.on('room:updated', async (data) => {
  const updated = await fetch(`/rooms/${data.roomId}`).then(r => r.json());
  console.log('Room state:', updated);
});

// 5. Listen for game start
socket.on('room:game_started', (data) => {
  console.log('Game started:', data.gameId);
  socket.emit('game:join', data.gameId);
});

// 6. Listen for moves
socket.on('game:move_accepted', (data) => {
  console.log('Move by', data.playerId, 'version', data.stateVersion);
});

// 7. Listen for turn changes
socket.on('game:turn_changed', (data) => {
  console.log('Now playing:', data.activePlayerId);
});
```

## Architecture Improvements

### Type Safety
- Full TypeScript typing for Socket.IO events
- Prevents runtime errors from incorrect event payloads
- IDE autocomplete for all events

### Separation of Concerns
- Rules module (`src/rules/coinche.ts`) - Pure game logic
- Socket server (`src/realtime/socketServer.ts`) - WebSocket handling
- Game service (`src/services/gameService.ts`) - Business logic + broadcasting

### Scalability
- Socket.IO supports multiple server instances with Redis adapter
- Channels allow efficient event routing
- Private channels ensure data privacy

## Next Steps

1. **Implement Bidding Phase** - Add bidding logic before card play
2. **Add Scoring System** - Calculate and track scores
3. **Socket.IO Tests** - Add integration tests for WebSocket events
4. **Production OAuth** - Integrate real OAuth providers
5. **Database Layer** - Add PostgreSQL for persistence
6. **Horizontal Scaling** - Add Redis adapter for Socket.IO

## Summary

Phase 2 successfully adds:
- ✅ Full coinche rule validation (following suit, trumping, overtrumping)
- ✅ Socket.IO real-time server with typed events
- ✅ WebSocket channels for rooms and games
- ✅ Event broadcasting for all game actions
- ✅ Comprehensive documentation
- ✅ All 17 tests still passing

The server now provides a complete real-time multiplayer card game platform with proper rule enforcement, ready for frontend integration.
