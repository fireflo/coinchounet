import type { Request, Response } from 'express';
import { authService } from '../services/authService.js';

export const authController = {
  exchangeToken: async (req: Request, res: Response) => {
    const { provider, authorizationCode, pkceVerifier } = req.body as {
      provider: 'google' | 'facebook';
      authorizationCode: string;
      pkceVerifier: string;
    };

    const tokens = await authService.exchangeOAuthToken(provider, authorizationCode, pkceVerifier);
    res.json(tokens);
  },
};
