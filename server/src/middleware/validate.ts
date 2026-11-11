import type { Request, RequestHandler, Response } from 'express';
import type { ZodType, z } from 'zod';

export const validateBody =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };

/** Express 5 makes req.query read-only, so parsed queries live on res.locals.query. */
export const validateQuery =
  (schema: ZodType): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(result.error);
    res.locals.query = result.data;
    next();
  };

export const queryOf = <S extends ZodType>(res: Response, _schema: S) => res.locals.query as z.output<S>;
export const bodyOf = <S extends ZodType>(req: Request, _schema: S) => req.body as z.output<S>;
