/**
 * src/utils/errors.ts
 *
 * Centralised error primitives.
 *
 * AppError is thrown by route handlers and services.
 * The global error handler in app.ts catches it and serialises it as:
 *   { error: string, code: string }
 *
 * Usage:
 *   throw badRequest('email is required')
 *   throw unauthorized('Invalid token')
 *   throw forbidden('Insufficient role')
 */

// ---------------------------------------------------------------------------
// AppError class
// ---------------------------------------------------------------------------

export class AppError extends Error {
  public readonly statusCode: number
  public readonly code: string

  constructor(message: string, statusCode: number, code: string) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code

    // Maintains proper prototype chain in TypeScript
    Object.setPrototypeOf(this, AppError.prototype)
  }
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

export function badRequest(message: string, code = 'BAD_REQUEST'): AppError {
  return new AppError(message, 400, code)
}

export function unauthorized(
  message = 'Authentication required',
  code = 'UNAUTHORIZED',
): AppError {
  return new AppError(message, 401, code)
}

export function forbidden(
  message = 'Insufficient permissions',
  code = 'FORBIDDEN',
): AppError {
  return new AppError(message, 403, code)
}

export function notFound(resource = 'Resource', code = 'NOT_FOUND'): AppError {
  return new AppError(`${resource} not found`, 404, code)
}

export function conflict(message: string, code = 'CONFLICT'): AppError {
  return new AppError(message, 409, code)
}

export function tooManyRequests(
  message = 'Too many requests',
  code = 'RATE_LIMITED',
): AppError {
  return new AppError(message, 429, code)
}

export function internal(
  message = 'Internal server error',
  code = 'INTERNAL_ERROR',
): AppError {
  return new AppError(message, 500, code)
}
