import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import type { Express } from 'express';

describe('Health Check', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  it('GET /health should return ok status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
