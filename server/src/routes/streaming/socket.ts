import { Router } from 'express';

const router = Router();

// Placeholder for Socket.IO handshake endpoint
// This will be implemented when Socket.IO integration is added
router.get('/', (_req, res) => {
  res.json({ message: 'Socket.IO handshake endpoint - integration pending' });
});

export const socketRouter = router;
