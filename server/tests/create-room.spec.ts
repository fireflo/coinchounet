import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import type { Express } from 'express';

describe('Create Room - Frontend API Integration', () => {
  let app: Express;

  beforeEach(() => {
    app = createApp();
  });

  it('should create a room with object body (correct usage)', async () => {
    // This is how apiFetch should be used: pass object, it stringifies internally
    const response = await request(app)
      .post('/rooms')
      .set('Authorization', 'Bearer dev-user-player1')
      .send({
        gameType: 'coinche',
        maxSeats: 4,
        visibility: 'public',
        rulesetVersion: '2024.09',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('roomId');
    expect(response.body.gameType).toBe('coinche');
    expect(response.body.maxSeats).toBe(4);
  });

  it('should document the double-stringify bug that was fixed', async () => {
    // BUG: Frontend was doing JSON.stringify(body) before passing to apiFetch
    // apiFetch then did JSON.stringify again, resulting in double-stringified JSON
    // 
    // BEFORE (broken):
    // apiFetch('/rooms', { 
    //   method: 'POST', 
    //   body: JSON.stringify({ gameType: 'coinche', ... })  // ❌ Wrong!
    // })
    //
    // AFTER (fixed):
    // apiFetch('/rooms', { 
    //   method: 'POST', 
    //   body: { gameType: 'coinche', ... }  // ✅ Correct!
    // })
    //
    // This test verifies the correct usage works
    const response = await request(app)
      .post('/rooms')
      .set('Authorization', 'Bearer dev-user-player1')
      .send({
        gameType: 'coinche',
        maxSeats: 4,
        visibility: 'public',
        rulesetVersion: '2024.09',
      });

    expect(response.status).toBe(201);
  });
});
