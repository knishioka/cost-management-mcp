import { transformAWSResponse } from '../../../src/providers/aws/transformer';
import type { GetCostAndUsageResponse } from '@aws-sdk/client-cost-explorer';

describe('AWS Transformer', () => {
  const mockPeriod = {
    start: new Date('2024-01-01'),
    end: new Date('2024-01-31'),
  };

  it('should transform AWS response with grouped costs', () => {
    const mockResponse: GetCostAndUsageResponse = {
      ResultsByTime: [
        {
          TimePeriod: {
            Start: '2024-01-01',
            End: '2024-01-31',
          },
          Groups: [
            {
              Keys: ['Amazon EC2'],
              Metrics: {
                UnblendedCost: {
                  Amount: '100.50',
                  Unit: 'USD',
                },
                UsageQuantity: {
                  Amount: '720',
                  Unit: 'Hours',
                },
              },
            },
            {
              Keys: ['Amazon S3'],
              Metrics: {
                UnblendedCost: {
                  Amount: '25.75',
                  Unit: 'USD',
                },
              },
            },
          ],
        },
      ],
    };

    const result = transformAWSResponse(mockResponse, mockPeriod);

    expect(result.provider).toBe('aws');
    expect(result.costs.total).toBe(126.25);
    expect(result.costs.currency).toBe('USD');
    expect(result.costs.breakdown).toHaveLength(2);
    expect(result.costs.breakdown[0]).toEqual({
      service: 'Amazon EC2',
      amount: 100.50,
      usage: {
        quantity: 720,
        unit: 'Hours',
      },
    });
    expect(result.costs.breakdown[1]).toEqual({
      service: 'Amazon S3',
      amount: 25.75,
      usage: undefined,
    });
  });

  it('should handle empty response', () => {
    const mockResponse: GetCostAndUsageResponse = {
      ResultsByTime: [],
    };

    const result = transformAWSResponse(mockResponse, mockPeriod);

    expect(result.costs.total).toBe(0);
    expect(result.costs.breakdown).toHaveLength(0);
  });

  it('should handle response with total only', () => {
    const mockResponse: GetCostAndUsageResponse = {
      ResultsByTime: [
        {
          TimePeriod: {
            Start: '2024-01-01',
            End: '2024-01-31',
          },
          Total: {
            UnblendedCost: {
              Amount: '150.00',
              Unit: 'USD',
            },
          },
        },
      ],
    };

    const result = transformAWSResponse(mockResponse, mockPeriod);

    expect(result.costs.total).toBe(150.00);
    expect(result.costs.breakdown).toHaveLength(1);
    expect(result.costs.breakdown[0].service).toBe('Total');
  });
});