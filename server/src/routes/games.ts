import { Router } from 'express';
import { gameController } from '../controllers/gameController.js';
import { requireAuth } from '../middleware/auth.js';
import { withIdempotency } from '../middleware/idempotency.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { moveSubmissionSchema } from '../schemas/gameSchemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/:gameId', requireAuth(['player', 'spectator']), asyncHandler(gameController.getState));

router.get('/:gameId/state', requireAuth(['player', 'spectator']), asyncHandler(gameController.getStateSince));

router.get('/:gameId/turns/current', requireAuth(['player', 'spectator']), asyncHandler(gameController.getTurn));

router.get('/:gameId/me/hand', requireAuth(['player']), asyncHandler(gameController.getPrivateHand));

router.post(
  '/:gameId/turns/current/move',
  requireAuth(['player']),
  withIdempotency('game:move'),
  validateRequest(moveSubmissionSchema),
  asyncHandler(gameController.submitMove),
);

router.post(
  '/:gameId/moves/:moveId/invalidate',
  requireAuth(['admin']),
  asyncHandler(gameController.invalidateMove),
);

router.get('/:gameId/events', requireAuth(['player', 'spectator']), asyncHandler(gameController.listEvents));

// Bidding endpoints
router.post(
  '/:gameId/bid',
  requireAuth(['player']),
  asyncHandler(gameController.submitBid),
);

router.post(
  '/:gameId/pass',
  requireAuth(['player']),
  asyncHandler(gameController.submitPass),
);

router.post(
  '/:gameId/coinche',
  requireAuth(['player']),
  asyncHandler(gameController.submitCoinche),
);

router.post(
  '/:gameId/surcoinche',
  requireAuth(['player']),
  asyncHandler(gameController.submitSurcoinche),
);

export const gamesRouter = router;
