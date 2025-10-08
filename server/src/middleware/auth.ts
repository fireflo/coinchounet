import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { HttpError } from '../errors.js';
import type { Role } from '../types/auth.js';

const DEV_USER_ID = 'user_dev';

export const requireAuth = (roles?: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  const header = req.header('Authorization');

  if (!header) {
    req.user = {
      userId: DEV_USER_ID,
      roles: ['player', 'host', 'spectator', 'admin'],
    };
  } else if (header.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length);
    
    // In dev mode, support tokens in format "dev-user-{userId}" for testing
    if (token.startsWith('dev-user-')) {
      const userId = token.slice('dev-user-'.length);
      req.user = {
        userId,
        roles: ['player', 'host', 'spectator', 'admin'],
      };
    } else if (token === config.devToken) {
      req.user = {
        userId: DEV_USER_ID,
        roles: ['player', 'host', 'spectator', 'admin'],
      };
    } else {
      next(new HttpError(401, 'unauthorized', 'Invalid token'));
      return;
    }
  } else {
    next(new HttpError(401, 'unauthorized', 'Unsupported authorization header'));
    return;
  }

  if (roles && !roles.some((role) => req.user?.roles.includes(role))) {
    next(new HttpError(403, 'forbidden', 'Insufficient role'));
    return;
  }

  next();
};
