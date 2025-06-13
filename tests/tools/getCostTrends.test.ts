import { getCostTrendsTool } from '../../src/tools/getCostTrends';
import type { ProviderClient } from '../../src/common/types';

describe('getCostTrendsTool', () => {
  let mockProviders: Map<string, ProviderClient>;
  let mockAWSProvider: jest.Mocked<ProviderClient>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-31'));

    mockAWSProvider = {
      name: 'aws',
      getCosts: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<ProviderClient>;

    mockProviders = new Map([['aws', mockAWSProvider]]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should analyze cost trends for 30 days', async () => {
    const mockCostData = {
      provider: 'aws' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 3000.0,
        currency: 'USD',
        breakdown: [
          { date: new Date('2024-01-01'), amount: 80.0, service: 'EC2' },
          { date: new Date('2024-01-02'), amount: 85.0, service: 'EC2' },
          { date: new Date('2024-01-03'), amount: 90.0, service: 'EC2' },
          { date: new Date('2024-01-04'), amount: 100.0, service: 'EC2' },
          { date: new Date('2024-01-05'), amount: 120.0, service: 'EC2' },
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAWSProvider.getCosts.mockResolvedValue(mockCostData);

    const result = await getCostTrendsTool(
      {
        provider: 'aws',
        period: '30d',
        granularity: 'daily',
      },
      mockProviders,
    );

    expect(mockAWSProvider.getCosts).toHaveBeenCalledWith({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      granularity: 'daily',
    });

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.data.provider).toBe('aws');
    expect(response.data.trends).toHaveLength(5);
    expect(response.data.trends[0].changePercentage).toBe(0); // First day has no previous
    expect(response.data.trends[1].changeFromPrevious).toBe(5); // 85 - 80
    expect(response.data.summary.trend).toBe('increasing');
    expect(response.data.insights).toContain('📈 aws costs are trending upward, latest: $120.00');
  });

  it('should detect high volatility', async () => {
    const mockCostData = {
      provider: 'aws' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 1000.0,
        currency: 'USD',
        breakdown: [
          { date: new Date('2024-01-01'), amount: 10.0, service: 'EC2' },
          { date: new Date('2024-01-02'), amount: 100.0, service: 'EC2' },
          { date: new Date('2024-01-03'), amount: 20.0, service: 'EC2' },
          { date: new Date('2024-01-04'), amount: 150.0, service: 'EC2' },
          { date: new Date('2024-01-05'), amount: 30.0, service: 'EC2' },
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAWSProvider.getCosts.mockResolvedValue(mockCostData);

    const result = await getCostTrendsTool(
      {
        provider: 'aws',
        period: '30d',
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.data.summary.volatility).toBe('high');
    expect(response.data.insights).toContain(
      '⚠️ High cost volatility detected - consider investigating spikes',
    );
  });

  it('should detect cost spikes', async () => {
    const mockCostData = {
      provider: 'aws' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 500.0,
        currency: 'USD',
        breakdown: [
          { date: new Date('2024-01-01'), amount: 50.0, service: 'EC2' },
          { date: new Date('2024-01-02'), amount: 55.0, service: 'EC2' },
          { date: new Date('2024-01-03'), amount: 100.0, service: 'EC2' }, // 81% spike
          { date: new Date('2024-01-04'), amount: 60.0, service: 'EC2' },
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAWSProvider.getCosts.mockResolvedValue(mockCostData);

    const result = await getCostTrendsTool(
      {
        provider: 'aws',
        period: '30d',
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    const spikes = response.data.trends.filter((t: any) => t.changePercentage > 50);
    expect(spikes.length).toBeGreaterThan(0);
    expect(response.data.insights).toContain('🚨 1 cost spike(s) detected (>50% increase)');
  });

  it('should analyze trends for all providers when no specific provider given', async () => {
    const mockOpenAIProvider = {
      name: 'openai',
      getCosts: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<ProviderClient>;

    mockProviders.set('openai', mockOpenAIProvider);

    const awsCostData = {
      provider: 'aws' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 1000.0,
        currency: 'USD',
        breakdown: [{ date: new Date('2024-01-01'), amount: 100.0, service: 'EC2' }],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    const openaiCostData = {
      provider: 'openai' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 500.0,
        currency: 'USD',
        breakdown: [{ date: new Date('2024-01-01'), amount: 50.0, service: 'gpt-4' }],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAWSProvider.getCosts.mockResolvedValue(awsCostData);
    mockOpenAIProvider.getCosts.mockResolvedValue(openaiCostData);

    const result = await getCostTrendsTool(
      {
        period: '30d',
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.data.providers).toHaveLength(2);
    expect(response.data.insights).toContain('💰 Total cost across all providers: $1500.00');
  });

  it('should support different time periods', async () => {
    const mockCostData = {
      provider: 'aws' as const,
      period: {
        start: new Date('2023-01-31'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 12000.0,
        currency: 'USD',
        breakdown: [],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAWSProvider.getCosts.mockResolvedValue(mockCostData);

    await getCostTrendsTool(
      {
        provider: 'aws',
        period: '1y',
      },
      mockProviders,
    );

    expect(mockAWSProvider.getCosts).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: new Date('2023-01-31'),
        endDate: new Date('2024-01-31'),
      }),
    );
  });

  it('should handle provider not configured error', async () => {
    await expect(
      getCostTrendsTool(
        {
          provider: 'gcp',
          period: '30d',
        },
        mockProviders,
      ),
    ).rejects.toThrow('Provider gcp not configured');
  });
});
