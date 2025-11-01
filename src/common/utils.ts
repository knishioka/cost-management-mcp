import { BaseError } from './errors';
import type { ProviderClient } from './types';

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  shouldRetry?: (error: Error) => boolean;
}

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    shouldRetry = () => true,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts || !shouldRetry(lastError)) {
        throw lastError;
      }

      const delay = Math.min(initialDelay * Math.pow(factor, attempt - 1), maxDelay);

      await sleep(delay);
    }
  }

  throw lastError || new Error('Retry failed');
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function parseDate(dateStr: string): Date {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return date;
}

export function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return items.reduce(
    (groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    },
    {} as Record<string, T[]>,
  );
}

export function sumBy<T>(items: T[], valueFn: (item: T) => number): number {
  return items.reduce((sum, item) => sum + valueFn(item), 0);
}

const SENSITIVE_KEYS = [
  'password',
  'secret',
  'token',
  'key',
  'authorization',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'private_key',
  'client_secret',
];

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function sanitizeForLog<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return obj.toISOString() as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLog(item)) as unknown as T;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeForLog(value);
    }
  }

  return sanitized as unknown as T;
}

export class Logger {
  private level: LogLevel;

  constructor(level: string = 'info') {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    this.level = levels.includes(level as LogLevel) ? (level as LogLevel) : 'info';
  }

  private shouldLog(msgLevel: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.level);
    const msgLevelIndex = levels.indexOf(msgLevel);
    return msgLevelIndex >= currentLevelIndex;
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const sanitizedData = data !== undefined ? sanitizeForLog(data) : undefined;

    const logEntry: Record<string, unknown> = {
      timestamp,
      level,
      message,
    };

    if (sanitizedData !== undefined) {
      logEntry.data = sanitizedData;
    }

    console.log(JSON.stringify(logEntry));
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: unknown): void {
    let errorData: unknown = error;

    if (error instanceof Error) {
      errorData = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error instanceof BaseError && {
          code: error.code,
          details: error.details,
        }),
      };
    }

    this.log('error', message, errorData);
  }
}

export function resolveProviderName(provider: ProviderClient): string {
  const providerLike = provider as Partial<ProviderClient> & { name?: string };

  if (typeof providerLike.getProviderName === 'function') {
    try {
      const name = providerLike.getProviderName();
      if (name) {
        return name;
      }
    } catch (error) {
      // Fall back to other strategies if calling getProviderName fails
      logger.debug('Failed to read provider name via getProviderName', { error });
    }
  }

  return providerLike.name ?? 'unknown';
}

export const logger = new Logger(process.env.LOG_LEVEL || 'info');
