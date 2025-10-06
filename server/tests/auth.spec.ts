import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import type { Express } from 'express';

describe('Authentication', () => {
  let app: Express;

  beforeEach(() => {
    app = createApp();
  });

  describe('POST /auth/oauth/token', () => {
    it('should exchange OAuth code for tokens', async () => {
      const response = await request(app).post('/auth/oauth/token').send({
        provider: 'google',
        authorizationCode: 'test_auth_code_12345',
        pkceVerifier: 'test_verifier_67890',
      });

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.expiresIn).toBe(900);
    });

    it('should reject invalid provider', async () => {
      const response = await request(app).post('/auth/oauth/token').send({
        provider: 'invalid',
        authorizationCode: 'test_code',
        pkceVerifier: 'test_verifier',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('invalid_payload');
    });

    it('should reject missing fields', async () => {
      const response = await request(app).post('/auth/oauth/token').send({
        provider: 'google',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('invalid_payload');
    });
  });
});
