import { compareProvidersTool } from '../../src/tools/compareProviders';
import type { ProviderClient } from '../../src/common/types';

describe('compareProvidersTool', () => {
  let mockProviders: Map<string, ProviderClient>;
  let mockAWSProvider: jest.Mocked<ProviderClient>;
  let mockOpenAIProvider: jest.Mocked<ProviderClient>;

  beforeEach(() => {
    mockAWSProvider = {
      getCosts: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<ProviderClient>;

    mockOpenAIProvider = {
      getCosts: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<ProviderClient>;

    mockProviders = new Map([
      ['aws', mockAWSProvider],
      ['openai', mockOpenAIProvider],
    ]);
  });

  it('should compare costs across all providers', async () => {
    mockAWSProvider.getCosts.mockResolvedValue({
      provider: 'aws' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
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
    });

    mockOpenAIProvider.getCosts.mockResolvedValue({
      provider: 'openai' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 300.0,
        currency: 'USD',
        breakdown: [],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    });

    const result = await compareProvidersTool(
      {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        includeChart: false,
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.data.summary.totalCost).toBe(1800.0);
    expect(response.data.summary.providersAnalyzed).toBe(2);
    expect(response.data.summary.successfulQueries).toBe(2);
    expect(response.data.providers).toHaveLength(2);
    expect(response.data.insights).toContain('AWS is your highest cost provider at $1500.00');
  });

  it('should generate ASCII chart when requested', async () => {
    mockAWSProvider.getCosts.mockResolvedValue({
      provider: 'aws' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 1000.0,
        currency: 'USD',
        breakdown: [],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    });

    mockOpenAIProvider.getCosts.mockResolvedValue({
      provider: 'openai' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 500.0,
        currency: 'USD',
        breakdown: [],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    });

    const result = await compareProvidersTool(
      {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        includeChart: true,
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.data.chart).toBeDefined();
    expect(response.data.chart).toContain('Cost Comparison Chart');
    expect(response.data.chart).toContain('aws');
    expect(response.data.chart).toContain('openai');
  });

  it('should handle provider errors gracefully', async () => {
    mockAWSProvider.getCosts.mockResolvedValue({
      provider: 'aws' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 1000.0,
        currency: 'USD',
        breakdown: [],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    });

    mockOpenAIProvider.getCosts.mockRejectedValue(new Error('API rate limit'));

    const result = await compareProvidersTool(
      {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.data.summary.successfulQueries).toBe(1);
    expect(response.data.providers).toHaveLength(2);

    const openaiProvider = response.data.providers.find((p: any) => p.provider === 'openai');
    expect(openaiProvider.status).toBe('error');
    expect(openaiProvider.error).toBe('API rate limit');
  });

  it('should validate date parameters', async () => {
    await expect(
      compareProvidersTool(
        {
          startDate: '2024-01-31',
          endDate: '2024-01-01',
        },
        mockProviders,
      ),
    ).rejects.toThrow('Start date must be before end date');
  });

  it('should generate vendor lock-in insights', async () => {
    mockAWSProvider.getCosts.mockResolvedValue({
      provider: 'aws' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 9000.0,
        currency: 'USD',
        breakdown: [],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    });

    mockOpenAIProvider.getCosts.mockResolvedValue({
      provider: 'openai' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 1000.0,
        currency: 'USD',
        breakdown: [],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    });

    const result = await compareProvidersTool(
      {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.data.insights).toContain(
      'Consider diversifying your cloud usage to avoid vendor lock-in',
    );
  });
});
