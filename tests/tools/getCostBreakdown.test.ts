import { getCostBreakdownTool } from '../../src/tools/getCostBreakdown';
import type { ProviderClient } from '../../src/common/types';

describe('getCostBreakdownTool', () => {
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

  it('should analyze cost breakdown by service', async () => {
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
          { amount: 500.0, service: 'Amazon EC2' },
          { amount: 300.0, service: 'Amazon S3' },
          { amount: 150.0, service: 'Amazon RDS' },
          { amount: 50.0, service: 'Amazon CloudWatch' },
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAWSProvider.getCosts.mockResolvedValue(mockCostData);

    const result = await getCostBreakdownTool(
      {
        provider: 'aws',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        dimensions: ['service'],
        topN: 10,
      },
      mockProviders,
    );

    expect(mockAWSProvider.getCosts).toHaveBeenCalledWith({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      granularity: 'total',
      groupBy: ['SERVICE'],
    });

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.data.totalCost).toBe(1000.0);
    expect(response.data.breakdown).toHaveLength(4);
    expect(response.data.breakdown[0]).toEqual({
      key: 'Amazon EC2',
      value: 500.0,
      percentage: 50.0,
    });
    expect(response.data.insights).toContain('🎯 Top cost driver: Amazon EC2 ($500.00, 50.0%)');
  });

  it('should filter by threshold percentage', async () => {
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
          { amount: 600.0, service: 'Amazon EC2' },
          { amount: 200.0, service: 'Amazon S3' },
          { amount: 100.0, service: 'Amazon RDS' },
          { amount: 50.0, service: 'Amazon CloudWatch' },
          { amount: 30.0, service: 'Amazon Lambda' },
          { amount: 20.0, service: 'Amazon SNS' },
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAWSProvider.getCosts.mockResolvedValue(mockCostData);

    const result = await getCostBreakdownTool(
      {
        provider: 'aws',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        dimensions: ['service'],
        threshold: 10, // Only items >= 10%
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.data.breakdown).toHaveLength(3); // Only EC2, S3, and RDS
    expect(response.data.breakdown.every((item: any) => item.percentage >= 10)).toBe(true);
  });

  it('should detect high concentration', async () => {
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
          { amount: 700.0, service: 'Amazon EC2' },
          { amount: 150.0, service: 'Amazon S3' },
          { amount: 100.0, service: 'Amazon RDS' },
          { amount: 50.0, service: 'Others' },
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAWSProvider.getCosts.mockResolvedValue(mockCostData);

    const result = await getCostBreakdownTool(
      {
        provider: 'aws',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.data.insights).toContain(
      '📊 High concentration: Top 3 items account for 95.0% of costs',
    );
  });

  it('should analyze breakdown by region', async () => {
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
          { amount: 400.0, service: 'EC2', metadata: { region: 'us-east-1' } },
          { amount: 300.0, service: 'EC2', metadata: { region: 'eu-west-1' } },
          { amount: 200.0, service: 'S3', metadata: { region: 'us-east-1' } },
          { amount: 100.0, service: 'S3', metadata: {} }, // Global
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAWSProvider.getCosts.mockResolvedValue(mockCostData);

    const result = await getCostBreakdownTool(
      {
        provider: 'aws',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        dimensions: ['region'],
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.data.breakdown[0].key).toBe('us-east-1');
    expect(response.data.breakdown[0].value).toBe(600.0);
    expect(response.data.breakdown.find((item: any) => item.key === 'Global')).toBeDefined();
  });

  it('should provide AWS-specific insights', async () => {
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
          { amount: 800.0, service: 'Amazon EC2' },
          { amount: 200.0, service: 'Others' },
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAWSProvider.getCosts.mockResolvedValue(mockCostData);

    const result = await getCostBreakdownTool(
      {
        provider: 'aws',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.data.insights).toContain(
      '💡 EC2 is your largest cost - consider Reserved Instances',
    );
  });

  it('should handle multiple providers', async () => {
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

    const openaiCostData = {
      provider: 'openai' as const,
      period: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      costs: {
        total: 500.0,
        currency: 'USD',
        breakdown: [
          { amount: 400.0, service: 'gpt-4' },
          { amount: 100.0, service: 'gpt-3.5-turbo' },
        ],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api' as const,
      },
    };

    mockAWSProvider.getCosts.mockResolvedValue(awsCostData);
    mockOpenAIProvider.getCosts.mockResolvedValue(openaiCostData);

    const result = await getCostBreakdownTool(
      {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
      mockProviders,
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.data.providers).toHaveLength(2);
    expect(response.data.insights).toContain('💰 Total cost across all providers: $1500.00');
  });

  it('should validate date parameters', async () => {
    await expect(
      getCostBreakdownTool(
        {
          provider: 'aws',
          startDate: '2024-01-31',
          endDate: '2024-01-01',
        },
        mockProviders,
      ),
    ).rejects.toThrow('Start date must be before end date');
  });
});
