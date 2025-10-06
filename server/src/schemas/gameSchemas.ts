import { z } from 'zod';

export const moveSubmissionSchema = z.object({
  clientMoveId: z.string().uuid(),
  moveType: z.string().min(1),
  payload: z.object({
    card: z.string().min(1),
  }),
  stateVersion: z.number().int().nonnegative(),
});
