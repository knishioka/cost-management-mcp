import { CostManagementMCPServer } from '../src/server';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getConfig } from '../src/common/config';
import { initializeCache } from '../src/common/cache';
import { toolDefinitions, type ToolDefinition } from '../src/tools/registry';
import * as errors from '../src/common/errors';

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
      handlers: [] as Array<{ schema: unknown; handler: (...args: unknown[]) => unknown }>,
      setRequestHandler: jest.fn(function (this: any, schema, handler) {
        this.handlers.push({ schema, handler });
      }),
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

      expect(tools).toHaveLength(toolDefinitions.length);
      expect(tools.map((t: any) => t.name)).toEqual(
        toolDefinitions.map((definition) => definition.metadata.name),
      );

      const costGetTool = tools.find((t: any) => t.name === 'cost_get');
      expect(costGetTool).toBeDefined();
      expect(costGetTool.description).toContain('Get cost data');
      expect(costGetTool.inputSchema.properties).toHaveProperty('provider');
      expect(costGetTool.inputSchema.properties).toHaveProperty('startDate');
      expect(costGetTool.inputSchema.properties).toHaveProperty('endDate');
      expect(costGetTool.inputSchema.required).toEqual(['startDate', 'endDate']);
    });
  });

  describe('MCP protocol handlers', () => {
    const getRegisteredHandler = (mockServer: any, schema: unknown) => {
      const match = mockServer.setRequestHandler.mock.calls.find(
        ([registeredSchema]: [unknown]) => registeredSchema === schema,
      );

      expect(match).toBeDefined();
      return match![1] as (...args: any[]) => Promise<any>;
    };

    it('should respond with available tools via ListTools handler', async () => {
      mockConfig.getProviderConfig.mockReturnValue({
        enabled: true,
        credentials: { apiKey: 'test-key' },
      });

      server = new CostManagementMCPServer();

      const mockServer = (server as any).server;
      const listHandler = getRegisteredHandler(mockServer, ListToolsRequestSchema);
      const response = await listHandler({ params: {} });

      expect(response.tools).toEqual(toolDefinitions.map((definition) => definition.metadata));
    });

    it('should execute tool handlers when receiving CallTool requests', async () => {
      mockConfig.getProviderConfig.mockReturnValue({
        enabled: true,
        credentials: { apiKey: 'test-key' },
      });

      server = new CostManagementMCPServer();

      const mockServer = (server as any).server;
      const callHandler = getRegisteredHandler(mockServer, CallToolRequestSchema);
      const toolRegistry = (server as any).toolRegistry as Map<string, ToolDefinition>;
      const definition = toolRegistry.get('provider_list');
      expect(definition).toBeDefined();

      const mockResponse = { content: [{ type: 'text', text: 'ok' }] };
      const originalHandler = definition!.handler;
      const mockHandler = jest.fn().mockResolvedValue(mockResponse);
      definition!.handler = mockHandler;

      const args = { includeInactive: true };
      const result = await callHandler({
        params: {
          name: 'provider_list',
          arguments: args,
        },
      });

      expect(mockHandler).toHaveBeenCalledWith(args, (server as any).providers);
      expect(result).toBe(mockResponse);

      definition!.handler = originalHandler;
    });

    it('should return structured MCP errors when tool execution fails', async () => {
      mockConfig.getProviderConfig.mockReturnValue({
        enabled: true,
        credentials: { apiKey: 'test-key' },
      });

      server = new CostManagementMCPServer();

      const mockServer = (server as any).server;
      const callHandler = getRegisteredHandler(mockServer, CallToolRequestSchema);
      const toolRegistry = (server as any).toolRegistry as Map<string, ToolDefinition>;
      const definition = toolRegistry.get('provider_list');
      expect(definition).toBeDefined();

      const originalHandler = definition!.handler;
      const thrownError = new Error('boom');
      definition!.handler = jest.fn(() => {
        throw thrownError;
      });

      const handleErrorSpy = jest.spyOn(errors, 'handleError');
      const result = await callHandler({
        params: {
          name: 'provider_list',
          arguments: {},
        },
      });

      expect(handleErrorSpy).toHaveBeenCalledWith(thrownError);
      expect(result.content).toHaveLength(1);

      const payload = JSON.parse(result.content[0].text);
      expect(payload.success).toBe(false);
      expect(payload.error).toEqual(
        expect.objectContaining({
          code: expect.any(String),
          message: expect.any(String),
        }),
      );

      handleErrorSpy.mockRestore();
      definition!.handler = originalHandler;
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
