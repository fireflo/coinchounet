import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import type { Express } from 'express';

describe('Room Lifecycle', () => {
  let app: Express;

  beforeEach(() => {
    app = createApp();
  });

  describe('POST /rooms', () => {
    it('should create a new room', async () => {
      const response = await request(app)
        .post('/rooms')
        .send({
          gameType: 'coinche',
          maxSeats: 4,
          visibility: 'public',
          rulesetVersion: '2024.09',
          metadata: { language: 'fr-FR' },
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        gameType: 'coinche',
        maxSeats: 4,
        visibility: 'public',
        status: 'lobby',
      });
      expect(response.body.roomId).toBeDefined();
      expect(response.body.hostId).toBeDefined();
      expect(response.body.seats).toHaveLength(4);
    });

    it('should reject invalid payload', async () => {
      const response = await request(app).post('/rooms').send({
        gameType: 'invalid',
        maxSeats: 4,
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('invalid_payload');
    });
  });

  describe('GET /rooms', () => {
    it('should list rooms', async () => {
      // Create a room first
      await request(app).post('/rooms').send({
        gameType: 'coinche',
        maxSeats: 4,
        visibility: 'public',
        rulesetVersion: '2024.09',
      });

      const response = await request(app).get('/rooms');

      expect(response.status).toBe(200);
      expect(response.body.items).toBeDefined();
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.page).toBe(1);
      expect(response.body.total).toBeGreaterThan(0);
    });

    it('should filter rooms by gameType', async () => {
      const response = await request(app).get('/rooms?gameType=coinche');

      expect(response.status).toBe(200);
      expect(response.body.items).toBeDefined();
    });
  });

  describe('POST /rooms/:roomId/join', () => {
    it('should allow player to join room', async () => {
      // Create room
      const createResponse = await request(app).post('/rooms').send({
        gameType: 'coinche',
        maxSeats: 4,
        visibility: 'public',
        rulesetVersion: '2024.09',
      });

      const roomId = createResponse.body.roomId;

      // Join room
      const joinResponse = await request(app)
        .post(`/rooms/${roomId}/join`)
        .send({ seatIndex: 1 });

      expect(joinResponse.status).toBe(200);
      expect(joinResponse.body.seats[1].playerId).toBeDefined();
    });
  });

  describe('POST /rooms/:roomId/ready', () => {
    it('should toggle player ready state', async () => {
      // Create and join room
      const createResponse = await request(app).post('/rooms').send({
        gameType: 'coinche',
        maxSeats: 4,
        visibility: 'public',
        rulesetVersion: '2024.09',
      });

      const roomId = createResponse.body.roomId;

      // Toggle ready
      const readyResponse = await request(app)
        .post(`/rooms/${roomId}/ready`)
        .send({ ready: true });

      expect(readyResponse.status).toBe(200);
      expect(readyResponse.body.seats[0].ready).toBe(true);
    });
  });

  describe('POST /rooms/:roomId/start', () => {
    it('should start game when all players ready', async () => {
      // Create room with player 1
      const createResponse = await request(app)
        .post('/rooms')
        .set('Authorization', 'Bearer dev-user-player1')
        .send({
          gameType: 'coinche',
          maxSeats: 4,
          visibility: 'public',
          rulesetVersion: '2024.09',
        });

      const roomId = createResponse.body.roomId;

      // Fill seats with different players
      await request(app)
        .post(`/rooms/${roomId}/join`)
        .set('Authorization', 'Bearer dev-user-player2')
        .send({ seatIndex: 1 });

      await request(app)
        .post(`/rooms/${roomId}/join`)
        .set('Authorization', 'Bearer dev-user-player3')
        .send({ seatIndex: 2 });

      await request(app)
        .post(`/rooms/${roomId}/join`)
        .set('Authorization', 'Bearer dev-user-player4')
        .send({ seatIndex: 3 });

      // Mark all players ready
      await request(app)
        .post(`/rooms/${roomId}/ready`)
        .set('Authorization', 'Bearer dev-user-player1')
        .send({ ready: true });

      await request(app)
        .post(`/rooms/${roomId}/ready`)
        .set('Authorization', 'Bearer dev-user-player2')
        .send({ ready: true });

      await request(app)
        .post(`/rooms/${roomId}/ready`)
        .set('Authorization', 'Bearer dev-user-player3')
        .send({ ready: true });

      await request(app)
        .post(`/rooms/${roomId}/ready`)
        .set('Authorization', 'Bearer dev-user-player4')
        .send({ ready: true });

      // Start game
      const startResponse = await request(app)
        .post(`/rooms/${roomId}/start`)
        .set('Authorization', 'Bearer dev-user-player1');

      expect(startResponse.status).toBe(201);
      expect(startResponse.body.gameId).toBeDefined();
      expect(startResponse.body.status).toBe('in_progress');
    });
  });
});
