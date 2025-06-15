import { listProvidersTool } from '../../src/tools/listProviders';
import type { ProviderClient } from '../../src/common/types';

describe('listProvidersTool', () => {
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

  it('should list all providers with their status', async () => {
    mockAWSClient.validateCredentials.mockResolvedValue(true);
    mockOpenAIClient.validateCredentials.mockResolvedValue(false);

    const result = await listProvidersTool(mockProviders);

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.data.providers).toHaveLength(2); // 2 configured
    expect(response.data.configured).toBe(2);
    expect(response.data.total).toBe(2);

    const aws = response.data.providers.find((p: any) => p.name === 'aws');
    expect(aws).toEqual({
      name: 'aws',
      status: 'active',
      configured: true,
    });

    const openai = response.data.providers.find((p: any) => p.name === 'openai');
    expect(openai).toEqual({
      name: 'openai',
      status: 'invalid_credentials',
      configured: true,
    });
  });

  it('should handle validation errors gracefully', async () => {
    mockAWSClient.validateCredentials.mockRejectedValue(new Error('Network error'));
    mockOpenAIClient.validateCredentials.mockResolvedValue(true);

    const result = await listProvidersTool(mockProviders);

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);

    const aws = response.data.providers.find((p: any) => p.name === 'aws');
    expect(aws).toEqual({
      name: 'aws',
      status: 'error',
      configured: true,
      error: 'Network error',
    });
  });

  it('should work with empty provider map', async () => {
    const emptyProviders = new Map<string, ProviderClient>();

    const result = await listProvidersTool(emptyProviders);

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.data.configured).toBe(0);
    expect(response.data.total).toBe(2);
    expect(response.data.providers.every((p: any) => p.status === 'not_configured')).toBe(true);
  });
});
