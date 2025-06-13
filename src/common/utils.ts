import { BaseError } from './errors';

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  shouldRetry?: (error: Error) => boolean;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
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
      
      const delay = Math.min(
        initialDelay * Math.pow(factor, attempt - 1),
        maxDelay,
      );
      
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

export function groupBy<T>(
  items: T[],
  keyFn: (item: T) => string,
): Record<string, T[]> {
  return items.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

export function sumBy<T>(
  items: T[],
  valueFn: (item: T) => number,
): number {
  return items.reduce((sum, item) => sum + valueFn(item), 0);
}

export function sanitizeForLog(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sensitiveKeys = [
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

  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeForLog(sanitized[key]);
    }
  }

  return sanitized;
}

export class Logger {
  private level: string;

  constructor(level: string = 'info') {
    this.level = level;
  }

  private shouldLog(msgLevel: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.level);
    const msgLevelIndex = levels.indexOf(msgLevel);
    return msgLevelIndex >= currentLevelIndex;
  }

  private log(level: string, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const sanitizedData = data ? sanitizeForLog(data) : undefined;
    
    const logEntry = {
      timestamp,
      level,
      message,
      ...(sanitizedData && { data: sanitizedData }),
    };

    console.log(JSON.stringify(logEntry));
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error | BaseError | any): void {
    const errorData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error instanceof BaseError && {
        code: error.code,
        details: error.details,
      }),
    } : error;
    
    this.log('error', message, errorData);
  }
}

export const logger = new Logger(process.env.LOG_LEVEL || 'info');