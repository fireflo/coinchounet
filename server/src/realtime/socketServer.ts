import type { Server as HttpServer } from 'node:http';
import type { Socket } from 'socket.io';
import { Server } from 'socket.io';
import { gameStore } from '../stores/gameStore.js';
import { roomStore } from '../stores/roomStore.js';

export interface SocketUser {
  userId: string;
  roles: string[];
}

interface ClientToServerEvents {
  join: (payload: { channel: string }, callback: (response: { ok: boolean; error?: string }) => void) => void;
  leave: (payload: { channel: string }, callback: (response: { ok: boolean; error?: string }) => void) => void;
  'room:join': (roomId: string, callback: (response: { ok: boolean; error?: string }) => void) => void;
  'room:leave': (roomId: string, callback: (response: { ok: boolean; error?: string }) => void) => void;
  'game:join': (gameId: string, callback: (response: { ok: boolean; error?: string }) => void) => void;
  'game:leave': (gameId: string, callback: (response: { ok: boolean; error?: string }) => void) => void;
}

interface ServerToClientEvents {
  'room:updated': (data: { roomId: string; timestamp: string }) => void;
  'room:player_joined': (data: { roomId: string; playerId: string }) => void;
  'room:player_left': (data: { roomId: string; playerId: string }) => void;
  'room:game_started': (data: { roomId: string; gameId: string }) => void;
  'game:state_changed': (data: { gameId: string; stateVersion: number; eventType: string }) => void;
  'game:turn_changed': (data: { gameId: string; turnId: string; activePlayerId: string }) => void;
  'game:move_accepted': (data: { gameId: string; moveId: string; playerId: string; stateVersion: number }) => void;
  'game:hand_updated': (data: { gameId: string; playerId: string; handVersion: number }) => void;
  'system:heartbeat': (data: { timestamp: string }) => void;
}

interface InterServerEvents {
  ping: () => void;
}

interface SocketData {
  user: SocketUser;
}

export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Create and configure Socket.IO server
 */
export const createSocketServer = (httpServer: HttpServer): TypedServer => {
  const io: TypedServer = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use((socket: TypedSocket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    
    if (!token) {
      // Allow anonymous connections for dev
      socket.data.user = {
        userId: 'anonymous',
        roles: ['spectator'],
      };
      return next();
    }

    // Dev token parsing (same as REST auth)
    if (token.startsWith('dev-user-')) {
      const userId = token.slice('dev-user-'.length);
      socket.data.user = {
        userId,
        roles: ['player', 'host', 'spectator', 'admin'],
      };
      return next();
    }

    // TODO: Validate JWT token in production
    socket.data.user = {
      userId: 'user_dev',
      roles: ['player', 'host', 'spectator', 'admin'],
    };
    next();
  });

  // Connection handler
  io.on('connection', (socket: TypedSocket) => {
    const userId = socket.data.user.userId;
    console.log(`Socket connected: ${socket.id} (user: ${userId})`);

    // Generic join handler (for frontend socket client)
    socket.on('join', (payload: { channel: string }, callback) => {
      const { channel } = payload;
      socket.join(channel);
      console.log(`User ${userId} joined channel ${channel}`);
      if (typeof callback === 'function') {
        callback({ ok: true });
      }
    });

    // Generic leave handler (for frontend socket client)
    socket.on('leave', (payload: { channel: string }, callback) => {
      const { channel } = payload;
      socket.leave(channel);
      console.log(`User ${userId} left channel ${channel}`);
      if (typeof callback === 'function') {
        callback({ ok: true });
      }
    });

    // Room join handler
    socket.on('room:join', (roomId, callback) => {
      const room = roomStore.findById(roomId);
      if (!room) {
        callback({ ok: false, error: 'Room not found' });
        return;
      }

      socket.join(`room:${roomId}`);
      console.log(`User ${userId} joined room ${roomId}`);
      
      // Notify others in the room
      socket.to(`room:${roomId}`).emit('room:player_joined', {
        roomId,
        playerId: userId,
      });

      callback({ ok: true });
    });

    // Room leave handler
    socket.on('room:leave', (roomId, callback) => {
      socket.leave(`room:${roomId}`);
      console.log(`User ${userId} left room ${roomId}`);
      
      // Notify others in the room
      socket.to(`room:${roomId}`).emit('room:player_left', {
        roomId,
        playerId: userId,
      });

      callback({ ok: true });
    });

    // Game join handler
    socket.on('game:join', (gameId, callback) => {
      const game = gameStore.findById(gameId);
      if (!game) {
        callback({ ok: false, error: 'Game not found' });
        return;
      }

      // Join public game channel
      socket.join(`game:${gameId}:public`);
      
      // Join private channel if player is in the game
      if (game.hands[userId]) {
        socket.join(`game:${gameId}:private:${userId}`);
      }

      console.log(`User ${userId} joined game ${gameId}`);
      callback({ ok: true });
    });

    // Game leave handler
    socket.on('game:leave', (gameId, callback) => {
      socket.leave(`game:${gameId}:public`);
      socket.leave(`game:${gameId}:private:${userId}`);
      console.log(`User ${userId} left game ${gameId}`);
      callback({ ok: true });
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id} (user: ${userId})`);
    });
  });

  // Heartbeat every 15 seconds
  setInterval(() => {
    io.emit('system:heartbeat', { timestamp: new Date().toISOString() });
  }, 15000);

  return io;
};

/**
 * Broadcast room update to all clients in the room
 */
export const broadcastRoomUpdate = (io: TypedServer, roomId: string) => {
  io.to(`room:${roomId}`).emit('room:updated', {
    roomId,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Broadcast game state change to all clients in the game
 */
export const broadcastGameStateChange = (
  io: TypedServer,
  gameId: string,
  eventType: string,
  stateVersion: number,
) => {
  io.to(`game:${gameId}:public`).emit('game:state_changed', {
    gameId,
    stateVersion,
    eventType,
  });
};

/**
 * Broadcast turn change to all clients in the game
 */
export const broadcastTurnChange = (
  io: TypedServer,
  gameId: string,
  turnId: string,
  activePlayerId: string,
) => {
  io.to(`game:${gameId}:public`).emit('game:turn_changed', {
    gameId,
    turnId,
    activePlayerId,
  });
};

/**
 * Broadcast move acceptance to all clients in the game
 */
export const broadcastMoveAccepted = (
  io: TypedServer,
  gameId: string,
  moveId: string,
  playerId: string,
  stateVersion: number,
) => {
  io.to(`game:${gameId}:public`).emit('game:move_accepted', {
    gameId,
    moveId,
    playerId,
    stateVersion,
  });
};

/**
 * Send private hand update to a specific player
 */
export const sendPrivateHandUpdate = (
  io: TypedServer,
  gameId: string,
  playerId: string,
  handVersion: number,
) => {
  io.to(`game:${gameId}:private:${playerId}`).emit('game:hand_updated', {
    gameId,
    playerId,
    handVersion,
  });
};
