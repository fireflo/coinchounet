import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../src/app';
import { createSocketServer } from '../src/realtime/socketServer';
import type { Server as HttpServer } from 'node:http';
import type { TypedServer } from '../src/realtime/socketServer';

describe('Socket.IO Integration', () => {
  let httpServer: HttpServer;
  let io: TypedServer;
  let port: number;
  let clientSocket1: ClientSocket;
  let clientSocket2: ClientSocket;

  beforeEach((done) => {
    const app = createApp();
    httpServer = createServer(app);
    io = createSocketServer(httpServer);

    httpServer.listen(0, () => {
      const address = httpServer.address();
      port = typeof address === 'object' && address ? address.port : 3001;
      done();
    });
  });

  afterEach(() => {
    if (clientSocket1?.connected) clientSocket1.disconnect();
    if (clientSocket2?.connected) clientSocket2.disconnect();
    io.close();
    httpServer.close();
  });

  describe('Connection', () => {
    it('should connect with dev token', (done) => {
      clientSocket1 = ioClient(`http://localhost:${port}`, {
        auth: { token: 'dev-user-player1' },
      });

      clientSocket1.on('connect', () => {
        expect(clientSocket1.connected).toBe(true);
        done();
      });
    });

    it('should connect without token (anonymous)', (done) => {
      clientSocket1 = ioClient(`http://localhost:${port}`);

      clientSocket1.on('connect', () => {
        expect(clientSocket1.connected).toBe(true);
        done();
      });
    });

    it('should receive heartbeat', (done) => {
      clientSocket1 = ioClient(`http://localhost:${port}`, {
        auth: { token: 'dev-user-player1' },
      });

      clientSocket1.on('system:heartbeat', (data) => {
        expect(data.timestamp).toBeDefined();
        done();
      });
    }, 20000); // Heartbeat is every 15s
  });

  describe('Room Channels', () => {
    it('should join room channel', (done) => {
      clientSocket1 = ioClient(`http://localhost:${port}`, {
        auth: { token: 'dev-user-player1' },
      });

      clientSocket1.on('connect', () => {
        clientSocket1.emit('room:join', 'room_test', (response) => {
          expect(response.ok).toBe(true);
          done();
        });
      });
    });

    it('should receive room:player_joined event', (done) => {
      clientSocket1 = ioClient(`http://localhost:${port}`, {
        auth: { token: 'dev-user-player1' },
      });

      clientSocket2 = ioClient(`http://localhost:${port}`, {
        auth: { token: 'dev-user-player2' },
      });

      let socket1Ready = false;
      let socket2Ready = false;

      const checkBothReady = () => {
        if (socket1Ready && socket2Ready) {
          // Socket 1 joins first
          clientSocket1.emit('room:join', 'room_test', (response) => {
            expect(response.ok).toBe(true);

            // Socket 2 should receive the event when socket 2 joins
            clientSocket2.on('room:player_joined', (data) => {
              expect(data.roomId).toBe('room_test');
              expect(data.playerId).toBe('player2');
              done();
            });

            // Socket 2 joins
            clientSocket2.emit('room:join', 'room_test');
          });
        }
      };

      clientSocket1.on('connect', () => {
        socket1Ready = true;
        checkBothReady();
      });

      clientSocket2.on('connect', () => {
        socket2Ready = true;
        checkBothReady();
      });
    });

    it('should receive room:player_left event', (done) => {
      clientSocket1 = ioClient(`http://localhost:${port}`, {
        auth: { token: 'dev-user-player1' },
      });

      clientSocket2 = ioClient(`http://localhost:${port}`, {
        auth: { token: 'dev-user-player2' },
      });

      let socket1Ready = false;
      let socket2Ready = false;

      const checkBothReady = () => {
        if (socket1Ready && socket2Ready) {
          // Both join
          clientSocket1.emit('room:join', 'room_test');
          clientSocket2.emit('room:join', 'room_test', () => {
            // Socket 1 listens for leave event
            clientSocket1.on('room:player_left', (data) => {
              expect(data.roomId).toBe('room_test');
              expect(data.playerId).toBe('player2');
              done();
            });

            // Socket 2 leaves
            clientSocket2.emit('room:leave', 'room_test');
          });
        }
      };

      clientSocket1.on('connect', () => {
        socket1Ready = true;
        checkBothReady();
      });

      clientSocket2.on('connect', () => {
        socket2Ready = true;
        checkBothReady();
      });
    });
  });

  describe('Game Channels', () => {
    it('should join game channel', (done) => {
      clientSocket1 = ioClient(`http://localhost:${port}`, {
        auth: { token: 'dev-user-player1' },
      });

      clientSocket1.on('connect', () => {
        clientSocket1.emit('game:join', 'game_test', (response) => {
          expect(response.ok).toBe(true);
          done();
        });
      });
    });

    it('should leave game channel', (done) => {
      clientSocket1 = ioClient(`http://localhost:${port}`, {
        auth: { token: 'dev-user-player1' },
      });

      clientSocket1.on('connect', () => {
        clientSocket1.emit('game:join', 'game_test', () => {
          clientSocket1.emit('game:leave', 'game_test', (response) => {
            expect(response.ok).toBe(true);
            done();
          });
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should return error for non-existent room', (done) => {
      clientSocket1 = ioClient(`http://localhost:${port}`, {
        auth: { token: 'dev-user-player1' },
      });

      clientSocket1.on('connect', () => {
        clientSocket1.emit('room:join', 'non_existent_room', (response) => {
          expect(response.ok).toBe(false);
          expect(response.error).toBe('Room not found');
          done();
        });
      });
    });

    it('should return error for non-existent game', (done) => {
      clientSocket1 = ioClient(`http://localhost:${port}`, {
        auth: { token: 'dev-user-player1' },
      });

      clientSocket1.on('connect', () => {
        clientSocket1.emit('game:join', 'non_existent_game', (response) => {
          expect(response.ok).toBe(false);
          expect(response.error).toBe('Game not found');
          done();
        });
      });
    });
  });
});
