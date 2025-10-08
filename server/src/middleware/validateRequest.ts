import type { RequestHandler } from 'express';
import type { AnyZodObject, ZodEffects } from 'zod';
import { HttpError } from '../errors.js';

export type Schema<T> = AnyZodObject | ZodEffects<AnyZodObject, T>;

type Source = 'body' | 'query' | 'params';

type InferData<S extends Schema<unknown>> = S extends {
  parse: (input: any) => infer Output;
}
  ? Output
  : unknown;

export const validateRequest = <S extends Schema<unknown>>(schema: S, source: Source = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(
        new HttpError(400, 'invalid_payload', 'Invalid request payload', {
          details: { issues: result.error.issues },
        }),
      );
      return;
    }
    // FIXME why unknown ? explain if necessary
    (req as unknown as Record<Source, InferData<S>>)[source] = result.data as InferData<S>;
    next();
  };
