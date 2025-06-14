import { CostManagementMCPServer } from '../src/server';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { getConfig } from '../src/common/config';
import { initializeCache } from '../src/common/cache';

// Mock dependencies
jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../src/common/config');
jest.mock('../src/common/cache');
jest.mock('../src/providers/aws', () => ({
  AWSCostClient: jest.fn().mockImplementation(() => ({
    getCosts: jest.fn(),
    validateCredentials: jest.fn().mockResolvedValue(true),
    getProviderName: jest.fn().mockReturnValue('aws'),
  })),
}));

describe('CostManagementMCPServer', () => {
  let server: CostManagementMCPServer;
  let mockConfig: jest.Mocked<ReturnType<typeof getConfig>>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      getProviderConfig: jest.fn(),
      getCacheConfig: jest.fn().mockReturnValue({ type: 'memory', ttl: 3600 }),
      getLogConfig: jest.fn().mockReturnValue({ level: 'info', format: 'json' }),
      getServerPort: jest.fn().mockReturnValue(3000),
      getEnabledProviders: jest.fn().mockReturnValue(['aws']),
    } as any;

    (getConfig as jest.Mock).mockReturnValue(mockConfig);
    (initializeCache as jest.Mock).mockReturnValue({});

    // Mock Server constructor
    (Server as jest.Mock).mockImplementation(() => ({
      setRequestHandler: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
    }));
  });

  describe('constructor', () => {
    it('should initialize server with correct configuration', () => {
      server = new CostManagementMCPServer();

      expect(Server).toHaveBeenCalledWith(
        {
          name: 'cost-management-mcp',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );
    });

    it('should initialize enabled providers', async () => {
      mockConfig.getProviderConfig.mockReturnValue({
        enabled: true,
        credentials: { accessKeyId: 'test', secretAccessKey: 'test', region: 'us-east-1' },
      });

      server = new CostManagementMCPServer();
      await server.start();

      expect(mockConfig.getEnabledProviders).toHaveBeenCalled();
      expect(mockConfig.getProviderConfig).toHaveBeenCalledWith('aws');
    });

    it('should skip disabled providers', async () => {
      mockConfig.getEnabledProviders.mockReturnValue(['aws', 'openai']);
      mockConfig.getProviderConfig
        .mockReturnValueOnce({ enabled: true, credentials: {} })
        .mockReturnValueOnce({ enabled: false, credentials: {} });

      server = new CostManagementMCPServer();
      await server.start();

      expect(mockConfig.getProviderConfig).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTools', () => {
    it('should return all available tools', () => {
      mockConfig.getProviderConfig.mockReturnValue({
        enabled: true,
        credentials: { apiKey: 'test-key' },
      });

      server = new CostManagementMCPServer();
      const tools = (server as any).getTools();

      expect(tools).toHaveLength(9);
      expect(tools.map((t: any) => t.name)).toEqual([
        'cost_get',
        'provider_list',
        'provider_balance',
        'openai_costs',
        'aws_costs',
        'provider_compare',
        'cost_trends',
        'cost_breakdown',
        'cost_periods',
      ]);

      const costGetTool = tools.find((t: any) => t.name === 'cost_get');
      expect(costGetTool).toBeDefined();
      expect(costGetTool.description).toContain('Get cost data');
      expect(costGetTool.inputSchema.properties).toHaveProperty('provider');
      expect(costGetTool.inputSchema.properties).toHaveProperty('startDate');
      expect(costGetTool.inputSchema.properties).toHaveProperty('endDate');
      expect(costGetTool.inputSchema.required).toEqual(['startDate', 'endDate']);
    });
  });

  describe('start', () => {
    it('should start server successfully', async () => {
      mockConfig.getProviderConfig.mockReturnValue({
        enabled: true,
        credentials: { accessKeyId: 'test', secretAccessKey: 'test', region: 'us-east-1' },
      });

      server = new CostManagementMCPServer();
      await server.start();

      expect(initializeCache).toHaveBeenCalledWith({ type: 'memory', ttl: 3600 });
      const mockServer = (server as any).server;
      expect(mockServer.connect).toHaveBeenCalled();
    });
  });

  describe('request handlers', () => {
    it('should set up request handlers', () => {
      mockConfig.getProviderConfig.mockReturnValue({
        enabled: true,
        credentials: { accessKeyId: 'test', secretAccessKey: 'test', region: 'us-east-1' },
      });

      server = new CostManagementMCPServer();
      const mockServer = (server as any).server;

      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        expect.anything(), // ListToolsRequestSchema
        expect.any(Function),
      );
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        expect.anything(), // CallToolRequestSchema
        expect.any(Function),
      );
    });
  });
});
