export interface ErrorDetail {
  path: string;
  message: string;
}

/**
 * An expected, client-facing error. Anything thrown that is NOT an AppError is
 * treated as a bug: logged server-side and returned as a generic 500.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  validation: (details: ErrorDetail[], message = 'Request validation failed') =>
    new AppError(400, 'VALIDATION_ERROR', message, details),
  invalidId: (message = 'Malformed id') => new AppError(400, 'INVALID_ID', message),
  unauthenticated: (message = 'Please log in to continue') =>
    new AppError(401, 'UNAUTHENTICATED', message),
  invalidCredentials: () => new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'),
  forbidden: (message = 'You do not have permission to perform this action') =>
    new AppError(403, 'FORBIDDEN', message),
  notFound: (resource = 'Resource') => new AppError(404, 'NOT_FOUND', `${resource} not found`),
  conflict: (message = 'Resource already exists') => new AppError(409, 'CONFLICT', message),
  ticketClosed: () =>
    new AppError(
      409,
      'TICKET_CLOSED',
      'This ticket is closed. Please raise a new ticket if you need more help.',
    ),
};
