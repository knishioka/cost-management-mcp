import { getCostTool } from '../../src/tools/getCosts';
import type { ProviderClient, UnifiedCostData } from '../../src/common/types';

describe('getCostTool', () => {
  let mockProviders: Map<string, ProviderClient>;
  let mockAWSClient: jest.Mocked<ProviderClient>;
  let mockOpenAIClient: jest.Mocked<ProviderClient>;

  beforeEach(() => {
    mockAWSClient = {
      getCosts: jest.fn(),
      validateCredentials: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('aws'),
    };

    mockOpenAIClient = {
      getCosts: jest.fn(),
      validateCredentials: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('openai'),
    };

    mockProviders = new Map([
      ['aws', mockAWSClient],
      ['openai', mockOpenAIClient],
    ]);
  });

  it('should get costs for a specific provider', async () => {
    const mockCostData: UnifiedCostData = {
      provider: 'aws',
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 1234.56,
        currency: 'USD',
        breakdown: [
          {
            service: 'EC2',
            amount: 1000,
          },
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api',
      },
    };

    mockAWSClient.getCosts.mockResolvedValue(mockCostData);

    const result = await getCostTool(
      {
        provider: 'aws',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
      mockProviders,
    );

    expect(result.content[0].type).toBe('text');
    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.data.provider).toBe(mockCostData.provider);
    expect(response.data.costs).toEqual(mockCostData.costs);
    expect(response.data.metadata.source).toBe('api');
    expect(mockAWSClient.getCosts).toHaveBeenCalledWith({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      granularity: 'total',
      groupBy: undefined,
    });
  });

  it('should get costs from all providers when no provider specified', async () => {
    const mockAWSData: UnifiedCostData = {
      provider: 'aws',
      period: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
      costs: { total: 100, currency: 'USD', breakdown: [] },
      metadata: { lastUpdated: new Date(), source: 'api' },
    };

    const mockOpenAIData: UnifiedCostData = {
      provider: 'openai',
      period: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
      costs: { total: 50, currency: 'USD', breakdown: [] },
      metadata: { lastUpdated: new Date(), source: 'api' },
    };

    mockAWSClient.getCosts.mockResolvedValue(mockAWSData);
    mockOpenAIClient.getCosts.mockResolvedValue(mockOpenAIData);

    const result = await getCostTool(
      {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.data.total).toBe(150); // 100 + 50
    expect(response.data.providers).toHaveLength(2);
  });

  it('should handle provider errors gracefully', async () => {
    mockAWSClient.getCosts.mockRejectedValue(new Error('AWS API Error'));
    mockOpenAIClient.getCosts.mockResolvedValue({
      provider: 'openai',
      period: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
      costs: { total: 50, currency: 'USD', breakdown: [] },
      metadata: { lastUpdated: new Date(), source: 'api' },
    });

    const result = await getCostTool(
      {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.data.total).toBe(50);
    expect(response.data.errors).toHaveLength(1);
    expect(response.data.errors[0]).toEqual({
      provider: 'aws',
      error: 'AWS API Error',
    });
  });

  it('should validate date parameters', async () => {
    await expect(
      getCostTool(
        {
          startDate: 'invalid-date',
          endDate: '2024-01-31',
        },
        mockProviders,
      ),
    ).rejects.toThrow('Invalid date');
  });

  it('should validate start date is before end date', async () => {
    await expect(
      getCostTool(
        {
          startDate: '2024-01-31',
          endDate: '2024-01-01',
        },
        mockProviders,
      ),
    ).rejects.toThrow('Start date must be before end date');
  });

  it('should throw error for non-configured provider', async () => {
    await expect(
      getCostTool(
        {
          provider: 'unknown',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        mockProviders,
      ),
    ).rejects.toThrow('Provider unknown not configured');
  });
});
