import { z } from 'zod';

export const createRoomSchema = z.object({
  gameType: z.literal('coinche'),
  maxSeats: z.number().int().min(2).max(6),
  visibility: z.enum(['public', 'private']).default('public'),
  rulesetVersion: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const joinRoomSchema = z.object({
  seatIndex: z.number().int().min(0).max(5).optional(),
  asSpectator: z.boolean().default(false),
});

export const toggleReadySchema = z.object({
  ready: z.boolean(),
});
