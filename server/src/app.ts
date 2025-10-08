import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { HttpError, isHttpError } from './errors.js';
import { requestLogger } from './logger.js';
import { apiRouter } from './routes/index.js';
import { createCorrelationId } from './utils/correlation.js';
import { sendError } from './utils/responses.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  // Serve client static build if present (expects client built files in dist/public)
  try {
    const clientStaticPath = path.join(__dirname, 'public');
    if (fs.existsSync(clientStaticPath)) {
      app.use(express.static(clientStaticPath));

      // SPA fallback for non-API routes — let API routes take precedence above
      app.get('/*', (req, res, next) => {
        const url = req.originalUrl || req.url;
        if (url.startsWith('/auth') || url.startsWith('/rooms') || url.startsWith('/games') || url.startsWith('/socket.io')) {
          return next();
        }
        res.sendFile(path.join(clientStaticPath, 'index.html'));
      });
    }
  } catch (e) {
    // If anything goes wrong while mounting static assets, don't block the server.
    // eslint-disable-next-line no-console
    console.warn('Could not mount client static assets:', e);
  }

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
