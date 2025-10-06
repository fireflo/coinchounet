# Socket.IO Integration Guide

## Overview

The server includes a fully functional Socket.IO server for real-time communication. Clients can connect via WebSocket (preferred) or long-polling fallback.

## Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3001', {
  path: '/socket.io/',
  transports: ['websocket', 'polling'],
  auth: {
    token: 'dev-user-player1' // Use dev token format for testing
  }
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});
```

## Authentication

The Socket.IO server uses the same authentication as REST endpoints:

- **Dev tokens**: `dev-user-{userId}` for testing with multiple users
- **Production**: JWT tokens (to be implemented)
- **Anonymous**: Connections without token get spectator role

## Channels

### Room Channels

Format: `room:{roomId}`

Clients join room channels to receive updates about room state changes.

```javascript
// Join a room channel
socket.emit('room:join', 'room_123', (response) => {
  if (response.ok) {
    console.log('Joined room');
  } else {
    console.error('Failed to join:', response.error);
  }
});

// Leave a room channel
socket.emit('room:leave', 'room_123', (response) => {
  console.log('Left room');
});
```

### Game Channels

Format: 
- `game:{gameId}:public` - Public game state (all players and spectators)
- `game:{gameId}:private:{playerId}` - Private player data (hand updates)

```javascript
// Join a game channel
socket.emit('game:join', 'game_456', (response) => {
  if (response.ok) {
    console.log('Joined game');
    // Automatically joined both public and private channels if player
  }
});

// Leave a game channel
socket.emit('game:leave', 'game_456', (response) => {
  console.log('Left game');
});
```

## Server-to-Client Events

### Room Events

#### `room:updated`
Emitted when room state changes (player joins, ready state, etc.)

```javascript
socket.on('room:updated', (data) => {
  console.log('Room updated:', data);
  // { roomId: 'room_123', timestamp: '2025-10-06T09:00:00.000Z' }
  
  // Fetch updated room state via REST
  fetch(`/rooms/${data.roomId}`).then(/* ... */);
});
```

#### `room:player_joined`
Emitted when a player joins the room

```javascript
socket.on('room:player_joined', (data) => {
  console.log('Player joined:', data);
  // { roomId: 'room_123', playerId: 'player2' }
});
```

#### `room:player_left`
Emitted when a player leaves the room

```javascript
socket.on('room:player_left', (data) => {
  console.log('Player left:', data);
  // { roomId: 'room_123', playerId: 'player2' }
});
```

#### `room:game_started`
Emitted when a game starts from the room

```javascript
socket.on('room:game_started', (data) => {
  console.log('Game started:', data);
  // { roomId: 'room_123', gameId: 'game_456' }
  
  // Join the game channel
  socket.emit('game:join', data.gameId);
});
```

### Game Events

#### `game:state_changed`
Emitted when game state changes

```javascript
socket.on('game:state_changed', (data) => {
  console.log('Game state changed:', data);
  // { gameId: 'game_456', stateVersion: 5, eventType: 'game.started' }
  
  // Fetch updated game state via REST
  fetch(`/games/${data.gameId}`).then(/* ... */);
});
```

#### `game:move_accepted`
Emitted when a move is accepted

```javascript
socket.on('game:move_accepted', (data) => {
  console.log('Move accepted:', data);
  // { 
  //   gameId: 'game_456', 
  //   moveId: 'move_789', 
  //   playerId: 'player1',
  //   stateVersion: 6 
  // }
});
```

#### `game:turn_changed`
Emitted when the turn changes (trick completed)

```javascript
socket.on('game:turn_changed', (data) => {
  console.log('Turn changed:', data);
  // { 
  //   gameId: 'game_456', 
  //   turnId: 'turn_42', 
  //   activePlayerId: 'player2' 
  // }
});
```

#### `game:hand_updated` (Private)
Emitted to specific player when their hand changes

```javascript
socket.on('game:hand_updated', (data) => {
  console.log('Hand updated:', data);
  // { gameId: 'game_456', playerId: 'player1', handVersion: 2 }
  
  // Fetch updated hand via REST
  fetch(`/games/${data.gameId}/me/hand`).then(/* ... */);
});
```

### System Events

#### `system:heartbeat`
Emitted every 15 seconds to keep connection alive

```javascript
socket.on('system:heartbeat', (data) => {
  console.log('Heartbeat:', data.timestamp);
});
```

## Client-to-Server Events

All client-to-server events use acknowledgement callbacks:

```javascript
socket.emit('room:join', roomId, (response) => {
  if (response.ok) {
    // Success
  } else {
    // Error: response.error contains error message
  }
});
```

### Available Events

- `room:join` - Join a room channel
- `room:leave` - Leave a room channel
- `game:join` - Join a game channel
- `game:leave` - Leave a game channel

## Error Handling

```javascript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

## Reconnection

Socket.IO handles reconnection automatically:

```javascript
socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
  
  // Rejoin channels
  socket.emit('room:join', currentRoomId);
  socket.emit('game:join', currentGameId);
});
```

## Best Practices

1. **Join channels on connect/reconnect**: Always rejoin channels after reconnection
2. **Use REST for initial state**: Fetch initial state via REST, then use Socket.IO for updates
3. **Handle disconnections gracefully**: Show connection status to users
4. **Implement exponential backoff**: For reconnection attempts
5. **Use acknowledgements**: Always check acknowledgement responses for errors

## Example: Complete Game Flow

```javascript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3001', {
  auth: { token: 'dev-user-player1' }
});

let currentRoomId = null;
let currentGameId = null;

// Create and join room
async function createAndJoinRoom() {
  const response = await fetch('/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gameType: 'coinche',
      maxSeats: 4,
      visibility: 'public',
      rulesetVersion: '2024.09'
    })
  });
  
  const room = await response.json();
  currentRoomId = room.roomId;
  
  // Join Socket.IO channel
  socket.emit('room:join', currentRoomId, (res) => {
    console.log('Joined room channel:', res.ok);
  });
}

// Listen for room updates
socket.on('room:updated', async (data) => {
  console.log('Room updated');
  const response = await fetch(`/rooms/${data.roomId}`);
  const room = await response.json();
  updateUI(room);
});

// Listen for game start
socket.on('room:game_started', (data) => {
  console.log('Game started:', data.gameId);
  currentGameId = data.gameId;
  
  // Join game channel
  socket.emit('game:join', currentGameId, (res) => {
    console.log('Joined game channel:', res.ok);
  });
});

// Listen for moves
socket.on('game:move_accepted', async (data) => {
  console.log('Move by', data.playerId);
  const response = await fetch(`/games/${data.gameId}`);
  const game = await response.json();
  updateGameUI(game);
});

// Listen for turn changes
socket.on('game:turn_changed', (data) => {
  console.log('Now playing:', data.activePlayerId);
  updateTurnIndicator(data.activePlayerId);
});

// Start the flow
createAndJoinRoom();
```

## Testing with Multiple Clients

```javascript
// Client 1
const socket1 = io('ws://localhost:3001', {
  auth: { token: 'dev-user-player1' }
});

// Client 2
const socket2 = io('ws://localhost:3001', {
  auth: { token: 'dev-user-player2' }
});

// Both clients join the same room
socket1.emit('room:join', 'room_123');
socket2.emit('room:join', 'room_123');

// Client 1 makes a move
socket1.on('game:move_accepted', (data) => {
  console.log('Client 1 sees move');
});

// Client 2 also receives the event
socket2.on('game:move_accepted', (data) => {
  console.log('Client 2 sees move');
});
```
