import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { Errors, type ErrorDetail } from '../lib/app-error';

interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

type Location = keyof RequestSchemas;

/**
 * Validates and replaces req.body / req.query / req.params with the parsed
 * (trimmed, coerced, defaulted) values. All failures across all locations are
 * reported together as one 400 VALIDATION_ERROR.
 */
export const validate =
  (schemas: RequestSchemas): RequestHandler =>
  (req, _res, next) => {
    const details: ErrorDetail[] = [];
    const parsed: Partial<Record<Location, unknown>> = {};

    for (const location of ['params', 'query', 'body'] as const) {
      const schema = schemas[location];
      if (!schema) continue;
      // Express 5 leaves req.body undefined when no JSON was sent; validate it as {}
      // so the client gets field-level errors ("email: required") instead of "expected object".
      const result = schema.safeParse(req[location] ?? {});
      if (result.success) {
        parsed[location] = result.data;
      } else {
        for (const issue of result.error.issues) {
          details.push({
            path: [location, ...issue.path.map(String)].join('.'),
            message: issue.message,
          });
        }
      }
    }

    if (details.length > 0) throw Errors.validation(details);

    if (parsed.params) req.params = parsed.params as typeof req.params;
    if (parsed.body) req.body = parsed.body;
    if (parsed.query) {
      // req.query is a getter in Express 5, so shadow it with an own property.
      Object.defineProperty(req, 'query', { value: parsed.query, writable: true, enumerable: true });
    }
    next();
  };
