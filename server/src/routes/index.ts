import { Router } from 'express';
import { authRouter } from './auth.js';
import { gamesRouter } from './games.js';
import { roomsRouter } from './rooms.js';
import { eventsRouter } from './streaming/events.js';
import { socketRouter } from './streaming/socket.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/rooms', roomsRouter);
router.use('/games', gamesRouter);
router.use('/socket.io', socketRouter);
router.use('/games/:gameId/events', eventsRouter);

export const apiRouter = router;
