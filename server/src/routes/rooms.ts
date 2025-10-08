import { Router } from 'express';
import { roomController } from '../controllers/roomController.js';
import { requireAuth } from '../middleware/auth.js';
import { withIdempotency } from '../middleware/idempotency.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { createRoomSchema, joinRoomSchema, toggleReadySchema } from '../schemas/roomSchemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post(
  '/',
  requireAuth(['player', 'host']),
  withIdempotency('room:create'),
  validateRequest(createRoomSchema),
  asyncHandler(roomController.create),
);

router.get('/', requireAuth(['player', 'host']), asyncHandler(roomController.list));

router.get('/:roomId', requireAuth(['player', 'host', 'spectator']), asyncHandler(roomController.get));

router.post(
  '/:roomId/join',
  requireAuth(['player']),
  validateRequest(joinRoomSchema),
  asyncHandler(roomController.join),
);

router.post('/:roomId/leave', requireAuth(['player']), asyncHandler(roomController.leave));

router.post('/:roomId/seats/:playerId/remove', requireAuth(['host']), asyncHandler(roomController.remove));

router.post(
  '/:roomId/ready',
  requireAuth(['player']),
  validateRequest(toggleReadySchema),
  asyncHandler(roomController.toggleReady),
);

router.post('/:roomId/lock', requireAuth(['host']), asyncHandler(roomController.lock));

router.post('/:roomId/unlock', requireAuth(['host']), asyncHandler(roomController.unlock));

router.post('/:roomId/start', requireAuth(['host']), asyncHandler(roomController.startGame));

router.post('/:roomId/fill-bots', requireAuth(['host']), asyncHandler(roomController.fillWithBots));

export const roomsRouter = router;
