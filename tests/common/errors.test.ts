import {
  BaseError,
  ProviderError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  isRetryableError,
  handleError,
} from '../../src/common/errors';

describe('Errors', () => {
  describe('BaseError', () => {
    it('should create error with all properties', () => {
      const error = new BaseError('Test message', 'TEST_CODE', 500, { detail: 'test' });
      
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.name).toBe('BaseError');
    });

    it('should serialize to JSON', () => {
      const error = new BaseError('Test message', 'TEST_CODE', 500, { detail: 'test' });
      const json = error.toJSON();
      
      expect(json).toEqual({
        name: 'BaseError',
        message: 'Test message',
        code: 'TEST_CODE',
        statusCode: 500,
        details: { detail: 'test' },
      });
    });
  });

  describe('ProviderError', () => {
    it('should prefix message with provider name', () => {
      const error = new ProviderError('aws', 'Connection failed');
      expect(error.message).toBe('[aws] Connection failed');
      expect(error.provider).toBe('aws');
    });
  });

  describe('AuthenticationError', () => {
    it('should have 401 status code', () => {
      const error = new AuthenticationError('openai');
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('[openai] Authentication failed');
    });
  });

  describe('RateLimitError', () => {
    it('should have 429 status code and retry after', () => {
      const error = new RateLimitError('gcp', 60);
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
      expect(error.details).toEqual({ retryAfter: 60 });
    });
  });

  describe('isRetryableError', () => {
    it('should return true for rate limit errors', () => {
      const error = new RateLimitError('aws');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for retryable provider errors', () => {
      const timeoutError = new ProviderError('aws', 'Timeout', 'TIMEOUT');
      const networkError = new ProviderError('aws', 'Network', 'NETWORK_ERROR');
      const serverError = new ProviderError('aws', 'Server', 'SERVER_ERROR');
      
      expect(isRetryableError(timeoutError)).toBe(true);
      expect(isRetryableError(networkError)).toBe(true);
      expect(isRetryableError(serverError)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const authError = new AuthenticationError('aws');
      const validationError = new ValidationError('Invalid input');
      
      expect(isRetryableError(authError)).toBe(false);
      expect(isRetryableError(validationError)).toBe(false);
    });
  });

  describe('handleError', () => {
    it('should return BaseError as is', () => {
      const error = new ValidationError('Test');
      expect(handleError(error)).toBe(error);
    });

    it('should wrap Error in BaseError', () => {
      const error = new Error('Test error');
      const result = handleError(error);
      
      expect(result).toBeInstanceOf(BaseError);
      expect(result.message).toBe('Test error');
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.details).toEqual({ originalError: 'Error' });
    });

    it('should handle non-Error objects', () => {
      const result = handleError('string error');
      
      expect(result).toBeInstanceOf(BaseError);
      expect(result.message).toBe('An unknown error occurred');
      expect(result.details).toEqual({ error: 'string error' });
    });
  });
});