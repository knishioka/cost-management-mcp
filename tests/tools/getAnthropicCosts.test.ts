import { getAnthropicCostsTool } from '../../src/tools/getAnthropicCosts';
import type { ProviderClient } from '../../src/common/types';

describe('getAnthropicCostsTool', () => {
  let mockProviders: Map<string, ProviderClient>;
  let mockAnthropicProvider: jest.Mocked<ProviderClient>;

  beforeEach(() => {
    mockAnthropicProvider = {
      getCosts: jest.fn(),
      validateCredentials: jest.fn().mockResolvedValue(true),
      getProviderName: jest.fn().mockReturnValue('anthropic'),
      getUsageData: jest.fn(),
    } as unknown as jest.Mocked<ProviderClient>;

    mockProviders = new Map([['anthropic', mockAnthropicProvider]]);
  });

  it('should fetch Anthropic costs successfully', async () => {
    const mockCostData = {
      provider: 'anthropic' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 250.0,
        currency: 'USD',
        breakdown: [
          {
            service: 'claude-3-5-sonnet-20241022',
            amount: 150.0,
            usage: { quantity: 10000000, unit: 'tokens' },
          },
          {
            service: 'claude-3-5-haiku-20241022',
            amount: 100.0,
            usage: { quantity: 20000000, unit: 'tokens' },
          },
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAnthropicProvider.getCosts.mockResolvedValue(mockCostData);

    const result = await getAnthropicCostsTool(
      {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        groupByModel: true,
        includeTokenUsage: true,
      },
      mockProviders,
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.data.costs.total).toBe(250.0);
    expect(response.data.summary.totalTokens).toBe(30000000);
  });

  it('should use usage report when requested', async () => {
    const mockUsageData = {
      provider: 'anthropic' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 275.0,
        currency: 'USD',
        breakdown: [
          {
            service: 'claude-3-5-sonnet-20241022',
            amount: 175.0,
            usage: { quantity: 12000000, unit: 'tokens' },
          },
          {
            service: 'claude-3-5-haiku-20241022',
            amount: 100.0,
            usage: { quantity: 20000000, unit: 'tokens' },
          },
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    (mockAnthropicProvider as any).getUsageData.mockResolvedValue(mockUsageData);

    const result = await getAnthropicCostsTool(
      {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        useUsageReport: true,
      },
      mockProviders,
    );

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.data.costs.total).toBe(275.0);
  });

  it('should throw error when Anthropic provider is not configured', async () => {
    const emptyProviders = new Map<string, ProviderClient>();

    await expect(
      getAnthropicCostsTool(
        {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        emptyProviders,
      ),
    ).rejects.toThrow('Anthropic provider not configured');
  });

  it('should throw error when startDate is after endDate', async () => {
    await expect(
      getAnthropicCostsTool(
        {
          startDate: '2024-01-31',
          endDate: '2024-01-01',
        },
        mockProviders,
      ),
    ).rejects.toThrow('Start date must be before end date');
  });

  it('should include cost optimization tips for high costs', async () => {
    const mockCostData = {
      provider: 'anthropic' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 150.0,
        currency: 'USD',
        breakdown: [
          {
            service: 'claude-3-opus-20240229',
            amount: 150.0,
            usage: { quantity: 2000000, unit: 'tokens' },
          },
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAnthropicProvider.getCosts.mockResolvedValue(mockCostData);

    const result = await getAnthropicCostsTool(
      {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.data.tips).toContain(
      'Consider using Claude 3.5 Haiku for simpler tasks to reduce costs',
    );
  });
});
