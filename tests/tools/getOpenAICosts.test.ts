import { getOpenAICostsTool } from '../../src/tools/getOpenAICosts';
import type { ProviderClient } from '../../src/common/types';

describe('getOpenAICostsTool', () => {
  let mockProviders: Map<string, ProviderClient>;
  let mockOpenAIProvider: jest.Mocked<ProviderClient>;

  beforeEach(() => {
    mockOpenAIProvider = {
      getCosts: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<ProviderClient>;

    mockProviders = new Map([['openai', mockOpenAIProvider]]);
  });

  it('should fetch OpenAI costs successfully', async () => {
    const mockCostData = {
      provider: 'openai' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 150.0,
        currency: 'USD',
        breakdown: [
          {
            date: new Date('2024-01-15'),
            amount: 150.0,
            service: 'gpt-4',
            usage: { quantity: 500000, unit: 'tokens' },
          },
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockOpenAIProvider.getCosts.mockResolvedValue(mockCostData);

    const result = await getOpenAICostsTool(
      {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        groupByModel: true,
        includeTokenUsage: true,
      },
      mockProviders,
    );

    expect(mockOpenAIProvider.getCosts).toHaveBeenCalledWith({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      granularity: 'daily',
      groupBy: ['MODEL'],
    });

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.data.summary.totalCost).toBe(150.0);
    expect(response.data.summary.totalTokens).toBe(500000);
    expect(response.data.summary.modelBreakdown).toHaveLength(1);
  });

  it('should handle missing OpenAI provider', async () => {
    const emptyProviders = new Map();

    await expect(
      getOpenAICostsTool(
        {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        emptyProviders,
      ),
    ).rejects.toThrow('OpenAI provider not configured');
  });

  it('should validate date parameters', async () => {
    await expect(
      getOpenAICostsTool(
        {
          startDate: '2024-01-31',
          endDate: '2024-01-01',
        },
        mockProviders,
      ),
    ).rejects.toThrow('Start date must be before end date');
  });

  it('should handle provider errors', async () => {
    mockOpenAIProvider.getCosts.mockRejectedValue(new Error('API rate limit exceeded'));

    await expect(
      getOpenAICostsTool(
        {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        mockProviders,
      ),
    ).rejects.toThrow('API rate limit exceeded');
  });
});
