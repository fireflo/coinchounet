import { Router } from 'express';
import { authController } from '../controllers/authController';
import { validateRequest } from '../middleware/validateRequest';
import { oauthTokenSchema } from '../schemas/authSchemas';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/oauth/token', validateRequest(oauthTokenSchema), asyncHandler(authController.exchangeToken));

export const authRouter = router;
