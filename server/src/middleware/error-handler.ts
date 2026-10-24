import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../lib/app-error';

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });
};

function isDuplicateKeyError(err: unknown): err is { code: number; keyValue?: Record<string, unknown> } {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}

/** body-parser errors carry a `type` and an HTTP `status`. */
function bodyParserError(err: unknown): { type: string; status: number } | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const { type, status } = err as { type?: unknown; status?: unknown };
  return typeof type === 'string' && typeof status === 'number' ? { type, status } : undefined;
}

/**
 * Single place that turns errors into the `{ error: { code, message, details? } }` envelope.
 * Known errors map to meaningful 4xx responses; anything else is logged and hidden behind a 500.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
    });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: `Invalid value for ${err.path}` } });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details } });
    return;
  }

  if (isDuplicateKeyError(err)) {
    const fields = Object.keys(err.keyValue ?? {}).join(', ') || 'field';
    res.status(409).json({ error: { code: 'CONFLICT', message: `Duplicate value for ${fields}` } });
    return;
  }

  const parserError = bodyParserError(err);
  if (parserError?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
    return;
  }
  if (parserError?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
    return;
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Please try again.' },
  });
};
