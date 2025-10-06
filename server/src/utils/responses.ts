import type { Response } from 'express';
import { createCorrelationId } from './correlation';
import type { ErrorBody } from '../types/api';
import { HttpError } from '../errors';

export const sendJson = <T>(res: Response, status: number, body: T) => {
  res.status(status).json(body);
};

export const sendError = (res: Response, error: HttpError): void => {
  const correlationId = error.correlationId ?? createCorrelationId();
  const payload: ErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      correlationId,
    },
  };
  res.status(error.status).json(payload);
};
