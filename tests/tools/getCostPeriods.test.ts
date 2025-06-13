import { getCostPeriodsTool } from '../../src/tools/getCostPeriods';
import type { ProviderClient } from '../../src/common/types';

describe('getCostPeriodsTool', () => {
  let mockProviders: Map<string, ProviderClient>;
  let mockAWSProvider: jest.Mocked<ProviderClient>;

  beforeEach(() => {
    mockAWSProvider = {
      name: 'aws',
      getCosts: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<ProviderClient>;

    mockProviders = new Map([['aws', mockAWSProvider]]);
  });

  it('should compare two periods with increase', async () => {
    const period1Data = {
      provider: 'aws' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 1000.0,
        currency: 'USD',
        breakdown: [
          { amount: 600.0, service: 'Amazon EC2' },
          { amount: 400.0, service: 'Amazon S3' },
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    const period2Data = {
      provider: 'aws' as const,
      period: {
        start: new Date('2024-02-01'),
        end: new Date('2024-02-29'),
      },
      costs: {
        total: 1500.0,
        currency: 'USD',
        breakdown: [
          { amount: 900.0, service: 'Amazon EC2' },
          { amount: 500.0, service: 'Amazon S3' },
          { amount: 100.0, service: 'Amazon RDS' },
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAWSProvider.getCosts.mockResolvedValueOnce(period1Data).mockResolvedValueOnce(period2Data);

    const result = await getCostPeriodsTool(
      {
        provider: 'aws',
        period1: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        period2: {
          startDate: '2024-02-01',
          endDate: '2024-02-29',
        },
        comparisonType: 'both',
        breakdown: true,
      },
      mockProviders,
    );

    expect(mockAWSProvider.getCosts).toHaveBeenCalledTimes(2);

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.data.comparison.absoluteDifference).toBe(500.0);
    expect(response.data.comparison.percentageChange).toBe(50.0);
    expect(response.data.comparison.trend).toBe('increase');
    expect(response.data.insights).toContain('📈 Costs increased by $500.00 (50.0%)');
  });

  it('should detect new and discontinued services', async () => {
    const period1Data = {
      provider: 'aws' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 1000.0,
        currency: 'USD',
        breakdown: [
          { amount: 600.0, service: 'Amazon EC2' },
          { amount: 400.0, service: 'Amazon Lambda' }, // Will be discontinued
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    const period2Data = {
      provider: 'aws' as const,
      period: {
        start: new Date('2024-02-01'),
        end: new Date('2024-02-29'),
      },
      costs: {
        total: 1000.0,
        currency: 'USD',
        breakdown: [
          { amount: 700.0, service: 'Amazon EC2' },
          { amount: 300.0, service: 'Amazon RDS' }, // New service
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAWSProvider.getCosts.mockResolvedValueOnce(period1Data).mockResolvedValueOnce(period2Data);

    const result = await getCostPeriodsTool(
      {
        provider: 'aws',
        period1: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        period2: {
          startDate: '2024-02-01',
          endDate: '2024-02-29',
        },
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.data.insights).toContain('🆕 New services in period 2: Amazon RDS');
    expect(response.data.insights).toContain('🚫 Services discontinued: Amazon Lambda');
  });

  it('should compare daily averages for different period lengths', async () => {
    const period1Data = {
      provider: 'aws' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-07'), // 6 days (Jan 1-6)
      },
      costs: {
        total: 600.0, // $100/day for 6 days
        currency: 'USD',
        breakdown: [],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    const period2Data = {
      provider: 'aws' as const,
      period: {
        start: new Date('2024-02-01'),
        end: new Date('2024-02-29'), // 28 days (Feb 1-28)
      },
      costs: {
        total: 4200.0, // $150/day for 28 days
        currency: 'USD',
        breakdown: [],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAWSProvider.getCosts.mockResolvedValueOnce(period1Data).mockResolvedValueOnce(period2Data);

    const result = await getCostPeriodsTool(
      {
        provider: 'aws',
        period1: {
          startDate: '2024-01-01',
          endDate: '2024-01-07',
        },
        period2: {
          startDate: '2024-02-01',
          endDate: '2024-02-29',
        },
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.data.period1.dailyAverage).toBeCloseTo(100.0, 1);
    expect(response.data.period2.dailyAverage).toBeCloseTo(150.0, 1);
    expect(response.data.insights).toContain('⚠️ Daily average increased from $100.00 to $150.00');
  });

  it('should handle cost decrease', async () => {
    const period1Data = {
      provider: 'aws' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 2000.0,
        currency: 'USD',
        breakdown: [],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    const period2Data = {
      provider: 'aws' as const,
      period: {
        start: new Date('2024-02-01'),
        end: new Date('2024-02-29'),
      },
      costs: {
        total: 1500.0,
        currency: 'USD',
        breakdown: [],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAWSProvider.getCosts.mockResolvedValueOnce(period1Data).mockResolvedValueOnce(period2Data);

    const result = await getCostPeriodsTool(
      {
        provider: 'aws',
        period1: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        period2: {
          startDate: '2024-02-01',
          endDate: '2024-02-29',
        },
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.data.comparison.absoluteDifference).toBe(-500.0);
    expect(response.data.comparison.percentageChange).toBe(-25.0);
    expect(response.data.comparison.trend).toBe('decrease');
    expect(response.data.insights).toContain('📉 Costs decreased by $500.00 (25.0%)');
  });

  it('should compare across multiple providers', async () => {
    const mockOpenAIProvider = {
      name: 'openai',
      getCosts: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<ProviderClient>;

    mockProviders.set('openai', mockOpenAIProvider);

    // AWS increases
    mockAWSProvider.getCosts
      .mockResolvedValueOnce({
        provider: 'aws' as const,
        period: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
        costs: { total: 1000.0, currency: 'USD', breakdown: [] },
        metadata: { lastUpdated: new Date(), source: 'api' as const },
      })
      .mockResolvedValueOnce({
        provider: 'aws' as const,
        period: { start: new Date('2024-02-01'), end: new Date('2024-02-29') },
        costs: { total: 1200.0, currency: 'USD', breakdown: [] },
        metadata: { lastUpdated: new Date(), source: 'api' as const },
      });

    // OpenAI decreases
    mockOpenAIProvider.getCosts
      .mockResolvedValueOnce({
        provider: 'openai' as const,
        period: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
        costs: { total: 500.0, currency: 'USD', breakdown: [] },
        metadata: { lastUpdated: new Date(), source: 'api' as const },
      })
      .mockResolvedValueOnce({
        provider: 'openai' as const,
        period: { start: new Date('2024-02-01'), end: new Date('2024-02-29') },
        costs: { total: 300.0, currency: 'USD', breakdown: [] },
        metadata: { lastUpdated: new Date(), source: 'api' as const },
      });

    const result = await getCostPeriodsTool(
      {
        period1: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        period2: {
          startDate: '2024-02-01',
          endDate: '2024-02-29',
        },
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.data.comparisons).toHaveLength(2);
    expect(response.data.insights).toContain('💰 Overall change: $1500.00 → $1500.00 (0.0%)');
    expect(response.data.insights).toContain('📈 Significant increases: aws');
    expect(response.data.insights).toContain('📉 Significant decreases: openai');
  });

  it('should validate period dates', async () => {
    await expect(
      getCostPeriodsTool(
        {
          provider: 'aws',
          period1: {
            startDate: '2024-01-31',
            endDate: '2024-01-01',
          },
          period2: {
            startDate: '2024-02-01',
            endDate: '2024-02-29',
          },
        },
        mockProviders,
      ),
    ).rejects.toThrow('Start date must be before end date for each period');
  });
});
