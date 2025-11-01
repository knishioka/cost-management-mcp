export class BaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

export class ProviderError extends BaseError {
  constructor(
    public provider: string,
    message: string,
    code: string = 'PROVIDER_ERROR',
    details?: unknown,
  ) {
    super(`[${provider}] ${message}`, code, 500, details);
  }
}

export class AuthenticationError extends BaseError {
  constructor(provider: string, message: string = 'Authentication failed') {
    super(`[${provider}] ${message}`, 'AUTH_ERROR', 401);
  }
}

export class RateLimitError extends BaseError {
  constructor(
    provider: string,
    public retryAfter?: number,
  ) {
    super(`[${provider}] Rate limit exceeded`, 'RATE_LIMIT_ERROR', 429, { retryAfter });
  }
}

export class ValidationError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class CacheError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, 'CACHE_ERROR', 500, details);
  }
}

export class ConfigurationError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIG_ERROR', 500, details);
  }
}

export class NotImplementedError extends BaseError {
  constructor(feature: string) {
    super(`Feature not implemented: ${feature}`, 'NOT_IMPLEMENTED', 501);
  }
}

export function isRetryableError(error: Error): boolean {
  if (error instanceof RateLimitError) {
    return true;
  }

  if (error instanceof ProviderError) {
    const retryableCodes = ['TIMEOUT', 'NETWORK_ERROR', 'SERVER_ERROR'];
    return retryableCodes.includes(error.code);
  }

  return false;
}

export function handleError(error: unknown): BaseError {
  if (error instanceof BaseError) {
    return error;
  }

  if (error instanceof Error) {
    return new BaseError(error.message, 'UNKNOWN_ERROR', 500, { originalError: error.name });
  }

  return new BaseError('An unknown error occurred', 'UNKNOWN_ERROR', 500, { error: String(error) });
}
