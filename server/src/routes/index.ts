import { Router } from 'express';
import { authRouter } from './auth';
import { roomsRouter } from './rooms';
import { gamesRouter } from './games';
import { eventsRouter } from './streaming/events';
import { socketRouter } from './streaming/socket';

const router = Router();

router.use('/auth', authRouter);
router.use('/rooms', roomsRouter);
router.use('/games', gamesRouter);
router.use('/socket.io', socketRouter);
router.use('/games/:gameId/events', eventsRouter);

export const apiRouter = router;
