import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import type { Express } from 'express';

describe('Game Flow', () => {
  let app: Express;

  beforeEach(() => {
    app = createApp();
  });

  const createAndStartGame = async () => {
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

    // Mark all ready
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

    return startResponse.body.gameId;
  };

  describe('GET /games/:gameId', () => {
    it('should return game state', async () => {
      const gameId = await createAndStartGame();

      const response = await request(app).get(`/games/${gameId}`);

      expect(response.status).toBe(200);
      expect(response.body.gameId).toBe(gameId);
      expect(response.body.status).toBe('in_progress');
      expect(response.body.turnOrder).toHaveLength(4);
    });
  });

  describe('GET /games/:gameId/turns/current', () => {
    it('should return current turn metadata', async () => {
      const gameId = await createAndStartGame();

      const response = await request(app).get(`/games/${gameId}/turns/current`);

      expect(response.status).toBe(200);
      expect(response.body.turnId).toBeDefined();
      expect(response.body.activePlayerId).toBeDefined();
      expect(response.body.legalMoveTypes).toBeDefined();
    });
  });

  describe('GET /games/:gameId/me/hand', () => {
    it('should return private hand for player', async () => {
      const gameId = await createAndStartGame();

      const response = await request(app)
        .get(`/games/${gameId}/me/hand`)
        .set('Authorization', 'Bearer dev-user-player1');

      expect(response.status).toBe(200);
      expect(response.body.playerId).toBe('player1');
      expect(response.body.cards).toBeDefined();
      expect(Array.isArray(response.body.cards)).toBe(true);
      expect(response.body.handVersion).toBeDefined();
    });
  });

  describe('POST /games/:gameId/turns/current/move', () => {
    it('should accept valid move', async () => {
      const gameId = await createAndStartGame();

      // Get current state
      const stateResponse = await request(app).get(`/games/${gameId}`);
      const stateVersion = stateResponse.body.stateVersion;

      // Get hand for player1 (who has the first turn)
      const handResponse = await request(app)
        .get(`/games/${gameId}/me/hand`)
        .set('Authorization', 'Bearer dev-user-player1');
      const firstCard = handResponse.body.cards[0];

      // Submit move as player1
      const moveResponse = await request(app)
        .post(`/games/${gameId}/turns/current/move`)
        .set('Authorization', 'Bearer dev-user-player1')
        .send({
          clientMoveId: '550e8400-e29b-41d4-a716-446655440000',
          moveType: 'play_card',
          payload: { card: firstCard },
          stateVersion,
        });

      expect(moveResponse.status).toBe(200);
      expect(moveResponse.body.moveId).toBeDefined();
      expect(moveResponse.body.validationStatus).toBe('accepted');
      expect(moveResponse.body.stateVersion).toBeGreaterThan(stateVersion);
    });

    it('should reject move with stale version', async () => {
      const gameId = await createAndStartGame();

      const response = await request(app)
        .post(`/games/${gameId}/turns/current/move`)
        .set('Authorization', 'Bearer dev-user-player1')
        .send({
          clientMoveId: '550e8400-e29b-41d4-a716-446655440001',
          moveType: 'play_card',
          payload: { card: 'J♠' },
          stateVersion: 999,
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('version_conflict');
    });
  });

  describe('GET /games/:gameId/events', () => {
    it('should return event history', async () => {
      const gameId = await createAndStartGame();

      const response = await request(app).get(`/games/${gameId}/events`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].eventId).toBeDefined();
      expect(response.body[0].eventType).toBeDefined();
    });
  });
});
