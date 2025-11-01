import {
  transformAnthropicCostResponse,
  transformAnthropicUsageResponse,
  formatAnthropicDate,
} from '../../../src/providers/anthropic/transformer';
import type {
  AnthropicCostResponse,
  AnthropicUsageResponse,
} from '../../../src/providers/anthropic/types';

describe('Anthropic Transformer', () => {
  describe('formatAnthropicDate', () => {
    it('should format date as ISO 8601', () => {
      const date = new Date('2024-01-15T12:30:00Z');
      const formatted = formatAnthropicDate(date);
      expect(formatted).toBe('2024-01-15T12:30:00.000Z');
    });
  });

  describe('transformAnthropicCostResponse', () => {
    it('should transform cost response correctly', () => {
      const mockResponse: AnthropicCostResponse = {
        object: 'list',
        data: [
          {
            bucket_start_time: '2024-01-01T00:00:00Z',
            bucket_end_time: '2024-01-02T00:00:00Z',
            costs: [
              {
                workspace_name: 'Production',
                description: 'Production API Usage',
                cost_usd: '12345', // $123.45
              },
              {
                workspace_name: 'Development',
                description: 'Development API Usage',
                cost_usd: '6789', // $67.89
              },
            ],
          },
        ],
        has_more: false,
      };

      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      const result = transformAnthropicCostResponse(mockResponse, period);

      expect(result.provider).toBe('anthropic');
      expect(result.period).toEqual(period);
      expect(result.costs.currency).toBe('USD');
      expect(result.costs.total).toBeCloseTo(191.34, 2); // $123.45 + $67.89
      expect(result.costs.breakdown).toHaveLength(2);
      expect(result.costs.breakdown[0].service).toBe('Production API Usage');
    });

    it('should aggregate costs across multiple buckets', () => {
      const mockResponse: AnthropicCostResponse = {
        object: 'list',
        data: [
          {
            bucket_start_time: '2024-01-01T00:00:00Z',
            bucket_end_time: '2024-01-02T00:00:00Z',
            costs: [
              {
                description: 'Service A',
                cost_usd: '10000', // $100.00
              },
            ],
          },
          {
            bucket_start_time: '2024-01-02T00:00:00Z',
            bucket_end_time: '2024-01-03T00:00:00Z',
            costs: [
              {
                description: 'Service A',
                cost_usd: '5000', // $50.00
              },
            ],
          },
        ],
        has_more: false,
      };

      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-03'),
      };

      const result = transformAnthropicCostResponse(mockResponse, period);

      expect(result.costs.total).toBeCloseTo(150.0, 2);
      expect(result.costs.breakdown).toHaveLength(1);
      expect(result.costs.breakdown[0].service).toBe('Service A');
      expect(result.costs.breakdown[0].amount).toBeCloseTo(150.0, 2);
    });
  });

  describe('transformAnthropicUsageResponse', () => {
    it('should transform usage response with cost calculation', () => {
      const mockResponse: AnthropicUsageResponse = {
        object: 'list',
        data: [
          {
            bucket_start_time: '2024-01-01T00:00:00Z',
            bucket_end_time: '2024-01-02T00:00:00Z',
            usage: [
              {
                model: 'claude-3-5-sonnet-20241022',
                input_tokens: 1000000, // 1M tokens
                output_tokens: 500000, // 0.5M tokens
                cache_creation_input_tokens: 0,
                cache_read_input_tokens: 0,
              },
              {
                model: 'claude-3-5-haiku-20241022',
                input_tokens: 2000000, // 2M tokens
                output_tokens: 1000000, // 1M tokens
                cache_creation_input_tokens: 0,
                cache_read_input_tokens: 0,
              },
            ],
          },
        ],
        has_more: false,
      };

      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      const result = transformAnthropicUsageResponse(mockResponse, period);

      expect(result.provider).toBe('anthropic');
      expect(result.costs.currency).toBe('USD');

      // Claude 3.5 Sonnet: 1M * $3 + 0.5M * $15 = $3 + $7.5 = $10.5
      // Claude 3.5 Haiku: 2M * $1 + 1M * $5 = $2 + $5 = $7
      // Total: $17.5
      expect(result.costs.total).toBeCloseTo(17.5, 2);
      expect(result.costs.breakdown).toHaveLength(2);
    });

    it('should include cache costs in calculation', () => {
      const mockResponse: AnthropicUsageResponse = {
        object: 'list',
        data: [
          {
            bucket_start_time: '2024-01-01T00:00:00Z',
            bucket_end_time: '2024-01-02T00:00:00Z',
            usage: [
              {
                model: 'claude-3-5-sonnet-20241022',
                input_tokens: 1000000, // 1M tokens
                output_tokens: 500000, // 0.5M tokens
                cache_creation_input_tokens: 1000000, // 1M cache write
                cache_read_input_tokens: 2000000, // 2M cache read
              },
            ],
          },
        ],
        has_more: false,
      };

      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      const result = transformAnthropicUsageResponse(mockResponse, period);

      // Regular: 1M * $3 + 0.5M * $15 = $10.5
      // Cache write: 1M * $3.75 = $3.75
      // Cache read: 2M * $0.3 = $0.6
      // Total: $14.85
      expect(result.costs.total).toBeCloseTo(14.85, 2);
    });

    it('should aggregate usage across multiple buckets', () => {
      const mockResponse: AnthropicUsageResponse = {
        object: 'list',
        data: [
          {
            bucket_start_time: '2024-01-01T00:00:00Z',
            bucket_end_time: '2024-01-02T00:00:00Z',
            usage: [
              {
                model: 'claude-3-5-haiku-20241022',
                input_tokens: 1000000,
                output_tokens: 500000,
              },
            ],
          },
          {
            bucket_start_time: '2024-01-02T00:00:00Z',
            bucket_end_time: '2024-01-03T00:00:00Z',
            usage: [
              {
                model: 'claude-3-5-haiku-20241022',
                input_tokens: 1000000,
                output_tokens: 500000,
              },
            ],
          },
        ],
        has_more: false,
      };

      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-03'),
      };

      const result = transformAnthropicUsageResponse(mockResponse, period);

      // 2 * (1M * $1 + 0.5M * $5) = 2 * $3.5 = $7
      expect(result.costs.total).toBeCloseTo(7.0, 2);
      expect(result.costs.breakdown).toHaveLength(1);
      expect(result.costs.breakdown[0].usage?.quantity).toBe(3000000); // 1.5M * 2
    });

    it('should handle unknown models gracefully', () => {
      const mockResponse: AnthropicUsageResponse = {
        object: 'list',
        data: [
          {
            bucket_start_time: '2024-01-01T00:00:00Z',
            bucket_end_time: '2024-01-02T00:00:00Z',
            usage: [
              {
                model: 'unknown-model',
                input_tokens: 1000000,
                output_tokens: 500000,
              },
            ],
          },
        ],
        has_more: false,
      };

      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      const result = transformAnthropicUsageResponse(mockResponse, period);

      // Unknown model should have 0 cost
      expect(result.costs.total).toBe(0);
      expect(result.costs.breakdown).toHaveLength(0);
    });
  });
});
