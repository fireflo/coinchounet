import type { RequestHandler, Response } from 'express';
import type { HttpResult } from '../errors.js';
import { idempotencyStore } from '../stores/idempotencyStore.js';

const respond = (res: Response, result: HttpResult<unknown>) => {
  res.status(result.status).json(result.body);
};
export const withIdempotency = (scope: string): RequestHandler => {
  return async (req, res, next) => {
    const key = req.header('Idempotency-Key');

    if (!key) {
      next();
      return;
    }

    const cached = idempotencyStore.get(scope, key, req.user?.userId);
    if (cached) {
      respond(res, cached);
      return;
    }

    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);

    let statusCode = res.statusCode;

    res.status = ((code: number) => {
      statusCode = code;
      return originalStatus(code);
    }) as Response['status'];

    res.json = (body: unknown) => {
      idempotencyStore.set(scope, key, req.user?.userId, statusCode, body);
      return originalJson(body);
    };

    next();
  };
};
