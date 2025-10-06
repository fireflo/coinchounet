import { Router } from 'express';

const router = Router();

// Placeholder for event streaming endpoint
// This will be implemented when Socket.IO integration is added
router.get('/', (_req, res) => {
  res.json({ message: 'Event streaming endpoint - Socket.IO integration pending' });
});

export const eventsRouter = router;
