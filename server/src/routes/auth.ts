import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { oauthTokenSchema } from '../schemas/authSchemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/oauth/token', validateRequest(oauthTokenSchema), asyncHandler(authController.exchangeToken));

export const authRouter = router;
