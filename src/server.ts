import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { getConfig } from './common/config';
import { initializeCache } from './common/cache';
import { logger } from './common/utils';
import { handleError } from './common/errors';
import type { ProviderClient } from './common/types';
import { getCostTool } from './tools/getCosts';
import { listProvidersTool } from './tools/listProviders';
import { checkBalanceTool } from './tools/checkBalance';

export class CostManagementMCPServer {
  private server: Server;
  private providers: Map<string, ProviderClient> = new Map();

  constructor() {
    this.server = new Server(
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

    this.initializeProviders();
    this.setupHandlers();
  }

  private initializeProviders(): void {
    const config = getConfig();
    const enabledProviders = config.getEnabledProviders();

    for (const providerName of enabledProviders) {
      try {
        const provider = this.createProvider(providerName);
        if (provider) {
          this.providers.set(providerName, provider);
          logger.info(`Provider ${providerName} initialized`);
        }
      } catch (error) {
        logger.error(`Failed to initialize provider ${providerName}`, error);
      }
    }
  }

  private createProvider(providerName: string): ProviderClient | null {
    const config = getConfig();
    const providerConfig = config.getProviderConfig(providerName);

    if (!providerConfig.enabled) {
      return null;
    }

    switch (providerName) {
      case 'aws':
        const { AWSCostClient } = require('./providers/aws');
        return new AWSCostClient(providerConfig.credentials);
      
      case 'gcp':
        const { GCPCostClient } = require('./providers/gcp');
        return new GCPCostClient(providerConfig.credentials);
      
      case 'openai':
        const { OpenAICostClient } = require('./providers/openai');
        return new OpenAICostClient(providerConfig.credentials);
      
      case 'anthropic':
        const { AnthropicCostClient } = require('./providers/anthropic');
        return new AnthropicCostClient(providerConfig.credentials);
      
      default:
        logger.warn(`Provider ${providerName} not implemented yet`);
        return null;
    }
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'cost.get':
            return await getCostTool(args, this.providers);
          
          case 'provider.list':
            return await listProvidersTool(this.providers);
          
          case 'provider.balance':
            return await checkBalanceTool(args, this.providers);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const handledError = handleError(error);
        logger.error('Tool execution failed', handledError);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: handledError.code,
                  message: handledError.message,
                  details: handledError.details,
                },
              }, null, 2),
            },
          ],
        };
      }
    });
  }

  private getTools(): Tool[] {
    return [
      {
        name: 'cost.get',
        description: 'Get cost data for a specific provider and time period',
        inputSchema: {
          type: 'object',
          properties: {
            provider: {
              type: 'string',
              enum: ['aws', 'gcp', 'openai', 'anthropic'],
              description: 'The provider to get costs for (optional, defaults to all)',
            },
            startDate: {
              type: 'string',
              description: 'Start date in YYYY-MM-DD format',
            },
            endDate: {
              type: 'string',
              description: 'End date in YYYY-MM-DD format',
            },
            granularity: {
              type: 'string',
              enum: ['daily', 'monthly', 'total'],
              description: 'Cost aggregation granularity',
              default: 'total',
            },
            groupBy: {
              type: 'array',
              items: { type: 'string' },
              description: 'Dimensions to group costs by (e.g., SERVICE, REGION)',
            },
          },
          required: ['startDate', 'endDate'],
        },
      },
      {
        name: 'provider.list',
        description: 'List all configured providers and their status',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'provider.balance',
        description: 'Check remaining balance or credits for a provider',
        inputSchema: {
          type: 'object',
          properties: {
            provider: {
              type: 'string',
              enum: ['aws', 'gcp', 'openai', 'anthropic'],
              description: 'The provider to check balance for',
            },
          },
          required: ['provider'],
        },
      },
    ];
  }

  async start(): Promise<void> {
    const config = getConfig();
    initializeCache(config.getCacheConfig());
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    logger.info('Cost Management MCP Server started', {
      providers: Array.from(this.providers.keys()),
    });
  }
}

export async function startServer(): Promise<void> {
  try {
    const server = new CostManagementMCPServer();
    await server.start();
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}