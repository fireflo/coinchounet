import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { requestLogger } from './logger';
import { sendError } from './utils/responses';
import { isHttpError, HttpError } from './errors';
import { createCorrelationId } from './utils/correlation';
import { apiRouter } from './routes';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(requestLogger(config.logLevel));

  app.use((req, _res, next) => {
    req.correlationId = createCorrelationId();
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(apiRouter);

  app.use((_req, _res, next) => {
    next(new HttpError(404, 'not_found', 'Resource not found'));
  });

  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (isHttpError(err)) {
      sendError(res, err);
      return;
    }
    // eslint-disable-next-line no-console
    console.error('Unhandled error', { err, correlationId: req.correlationId });
    sendError(res, new HttpError(500, 'server_error', 'Unexpected server error', { correlationId: req.correlationId }));
  });

  return app;
};
