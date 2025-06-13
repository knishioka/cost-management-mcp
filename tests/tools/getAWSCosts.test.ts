import { getAWSCostsTool } from '../../src/tools/getAWSCosts';
import type { ProviderClient } from '../../src/common/types';

describe('getAWSCostsTool', () => {
  let mockProviders: Map<string, ProviderClient>;
  let mockAWSProvider: jest.Mocked<ProviderClient>;

  beforeEach(() => {
    mockAWSProvider = {
      getCosts: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<ProviderClient>;

    mockProviders = new Map([['aws', mockAWSProvider]]);
  });

  it('should fetch AWS costs with service breakdown', async () => {
    const mockCostData = {
      provider: 'aws' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 1500.0,
        currency: 'USD',
        breakdown: [
          {
            date: new Date('2024-01-15'),
            amount: 800.0,
            service: 'Amazon EC2',
          },
          {
            date: new Date('2024-01-15'),
            amount: 400.0,
            service: 'Amazon Simple Storage Service',
          },
          {
            date: new Date('2024-01-15'),
            amount: 300.0,
            service: 'Amazon Relational Database Service',
          },
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAWSProvider.getCosts.mockResolvedValue(mockCostData);

    const result = await getAWSCostsTool(
      {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        granularity: 'monthly',
        groupBy: ['SERVICE'],
      },
      mockProviders,
    );

    expect(mockAWSProvider.getCosts).toHaveBeenCalledWith({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      granularity: 'monthly',
      groupBy: ['SERVICE'],
    });

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.data.summary.totalCost).toBe(1500.0);
    expect(response.data.summary.topServices).toHaveLength(3);
    expect(response.data.costOptimizationTips).toContain(
      'Review EC2 instance utilization and right-size underutilized instances',
    );
  });

  it('should filter costs by service', async () => {
    const mockCostData = {
      provider: 'aws' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 1200.0,
        currency: 'USD',
        breakdown: [
          {
            date: new Date('2024-01-15'),
            amount: 800.0,
            service: 'Amazon EC2',
          },
          {
            date: new Date('2024-01-15'),
            amount: 400.0,
            service: 'Amazon Simple Storage Service',
          },
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAWSProvider.getCosts.mockResolvedValue(mockCostData);

    const result = await getAWSCostsTool(
      {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        service: 'EC2',
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.data.costs.breakdown).toHaveLength(1);
    expect(response.data.costs.breakdown[0].service).toBe('Amazon EC2');
    expect(response.data.costs.total).toBe(800.0);
  });

  it('should handle missing AWS provider', async () => {
    const emptyProviders = new Map();

    await expect(
      getAWSCostsTool(
        {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        emptyProviders,
      ),
    ).rejects.toThrow('AWS provider not configured');
  });

  it('should generate warnings for high costs', async () => {
    const mockCostData = {
      provider: 'aws' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 2000.0,
        currency: 'USD',
        breakdown: [
          {
            date: new Date('2024-01-15'),
            amount: 1200.0,
            service: 'Amazon EC2',
          },
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAWSProvider.getCosts.mockResolvedValue(mockCostData);

    const result = await getAWSCostsTool(
      {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.data.warnings).toContain('⚠️ High monthly spend detected');
    expect(response.data.warnings).toContain(
      '💡 Consider Reserved Instances or Savings Plans for EC2',
    );
  });
});
