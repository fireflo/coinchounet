import type { RequestHandler } from 'express';
import morgan from 'morgan';

export const requestLogger = (logLevel: string): RequestHandler => {
  if (logLevel === 'silent') {
    return (_req, _res, next) => next();
  }
  return morgan(logLevel === 'debug' ? 'dev' : 'combined');
};
