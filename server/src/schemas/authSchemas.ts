import { z } from 'zod';

export const oauthTokenSchema = z.object({
  provider: z.enum(['google', 'facebook']),
  authorizationCode: z.string().min(1),
  pkceVerifier: z.string().min(1),
});
