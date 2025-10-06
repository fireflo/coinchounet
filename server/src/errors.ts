export type ErrorCode =
  | 'invalid_payload'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'illegal_move'
  | 'version_conflict'
  | 'unprocessable_entity'
  | 'invalid_provider'
  | 'server_error';

export class HttpError extends Error {
  public readonly status: number;
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly correlationId?: string;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    options?: { details?: Record<string, unknown>; correlationId?: string },
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = options?.details;
    this.correlationId = options?.correlationId;
  }
}

export const isHttpError = (error: unknown): error is HttpError => error instanceof HttpError;

export interface HttpResult<T> {
  status: number;
  body: T;
}
