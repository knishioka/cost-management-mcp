import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getConfig } from './common/config';
import { initializeCache } from './common/cache';
import { logger } from './common/utils';
import { handleError } from './common/errors';
import type { ProviderClient } from './common/types';
import { getCostTool } from './tools/getCosts';
import { listProvidersTool } from './tools/listProviders';
import { checkBalanceTool } from './tools/checkBalance';
import { getOpenAICostsTool } from './tools/getOpenAICosts';
import { getAWSCostsTool } from './tools/getAWSCosts';
import { compareProvidersTool } from './tools/compareProviders';
import { getCostTrendsTool } from './tools/getCostTrends';
import { getCostBreakdownTool } from './tools/getCostBreakdown';
import { getCostPeriodsTool } from './tools/getCostPeriods';
import { AWSCostClient } from './providers/aws';
import { GCPCostClient } from './providers/gcp';
import { OpenAICostClient } from './providers/openai';

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
        return new AWSCostClient(providerConfig.credentials as any);

      case 'gcp':
        return new GCPCostClient(providerConfig.credentials as any);

      case 'openai':
        return new OpenAICostClient(providerConfig.credentials as any);

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
          case 'cost_get':
            return await getCostTool(args, this.providers);

          case 'provider_list':
            return await listProvidersTool(this.providers);

          case 'provider_balance':
            return await checkBalanceTool(args, this.providers);

          case 'openai_costs':
            return await getOpenAICostsTool(args, this.providers);

          case 'aws_costs':
            return await getAWSCostsTool(args, this.providers);

          case 'provider_compare':
            return await compareProvidersTool(args, this.providers);

          case 'cost_trends':
            return await getCostTrendsTool(args, this.providers);

          case 'cost_breakdown':
            return await getCostBreakdownTool(args, this.providers);

          case 'cost_periods':
            return await getCostPeriodsTool(args, this.providers);

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
              text: JSON.stringify(
                {
                  success: false,
                  error: {
                    code: handledError.code,
                    message: handledError.message,
                    details: handledError.details,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      }
    });
  }

  private getTools(): Tool[] {
    return [
      {
        name: 'cost_get',
        description: 'Get cost data for a specific provider and time period',
        inputSchema: {
          type: 'object',
          properties: {
            provider: {
              type: 'string',
              enum: ['aws', 'gcp', 'openai'],
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
        name: 'provider_list',
        description: 'List all configured providers and their status',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'provider_balance',
        description: 'Check remaining balance or credits for a provider',
        inputSchema: {
          type: 'object',
          properties: {
            provider: {
              type: 'string',
              enum: ['aws', 'gcp', 'openai'],
              description: 'The provider to check balance for',
            },
          },
          required: ['provider'],
        },
      },
      {
        name: 'openai_costs',
        description: 'Get detailed OpenAI costs with model breakdown and token usage',
        inputSchema: {
          type: 'object',
          properties: {
            startDate: {
              type: 'string',
              description: 'Start date in YYYY-MM-DD format',
            },
            endDate: {
              type: 'string',
              description: 'End date in YYYY-MM-DD format',
            },
            groupByModel: {
              type: 'boolean',
              description: 'Group costs by model',
              default: false,
            },
            includeTokenUsage: {
              type: 'boolean',
              description: 'Include token usage statistics',
              default: true,
            },
          },
          required: ['startDate', 'endDate'],
        },
      },
      {
        name: 'aws_costs',
        description: 'Get detailed AWS costs with service breakdown and optimization tips',
        inputSchema: {
          type: 'object',
          properties: {
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
              default: 'daily',
            },
            groupBy: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['SERVICE', 'REGION', 'INSTANCE_TYPE', 'LINKED_ACCOUNT'],
              },
              description: 'Dimensions to group costs by',
            },
            service: {
              type: 'string',
              description: 'Filter by specific AWS service',
            },
            includeForecast: {
              type: 'boolean',
              description: 'Include cost forecast',
              default: false,
            },
          },
          required: ['startDate', 'endDate'],
        },
      },
      {
        name: 'provider_compare',
        description: 'Compare costs across all configured providers',
        inputSchema: {
          type: 'object',
          properties: {
            startDate: {
              type: 'string',
              description: 'Start date in YYYY-MM-DD format',
            },
            endDate: {
              type: 'string',
              description: 'End date in YYYY-MM-DD format',
            },
            includeChart: {
              type: 'boolean',
              description: 'Include ASCII chart visualization',
              default: false,
            },
          },
          required: ['startDate', 'endDate'],
        },
      },
      {
        name: 'cost_trends',
        description: 'Analyze cost trends over time with insights',
        inputSchema: {
          type: 'object',
          properties: {
            provider: {
              type: 'string',
              enum: ['aws', 'gcp', 'openai'],
              description: 'Specific provider to analyze (optional)',
            },
            period: {
              type: 'string',
              enum: ['30d', '60d', '90d', '6m', '1y'],
              description: 'Time period to analyze',
              default: '30d',
            },
            granularity: {
              type: 'string',
              enum: ['daily', 'weekly', 'monthly'],
              description: 'Data granularity',
              default: 'daily',
            },
          },
        },
      },
      {
        name: 'cost_breakdown',
        description: 'Get detailed cost breakdown by multiple dimensions',
        inputSchema: {
          type: 'object',
          properties: {
            provider: {
              type: 'string',
              enum: ['aws', 'gcp', 'openai'],
              description: 'Specific provider to analyze (optional)',
            },
            startDate: {
              type: 'string',
              description: 'Start date in YYYY-MM-DD format',
            },
            endDate: {
              type: 'string',
              description: 'End date in YYYY-MM-DD format',
            },
            dimensions: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['service', 'region', 'date', 'tag'],
              },
              description: 'Dimensions to break down costs by',
              default: ['service'],
            },
            topN: {
              type: 'number',
              description: 'Number of top items to show',
              default: 10,
            },
            threshold: {
              type: 'number',
              description: 'Minimum percentage threshold to include',
            },
          },
          required: ['startDate', 'endDate'],
        },
      },
      {
        name: 'cost_periods',
        description: 'Compare costs between two time periods',
        inputSchema: {
          type: 'object',
          properties: {
            provider: {
              type: 'string',
              enum: ['aws', 'gcp', 'openai'],
              description: 'Specific provider to analyze (optional)',
            },
            period1: {
              type: 'object',
              properties: {
                startDate: { type: 'string' },
                endDate: { type: 'string' },
              },
              required: ['startDate', 'endDate'],
            },
            period2: {
              type: 'object',
              properties: {
                startDate: { type: 'string' },
                endDate: { type: 'string' },
              },
              required: ['startDate', 'endDate'],
            },
            comparisonType: {
              type: 'string',
              enum: ['absolute', 'percentage', 'both'],
              default: 'both',
            },
            breakdown: {
              type: 'boolean',
              description: 'Include service-level breakdown',
              default: true,
            },
          },
          required: ['period1', 'period2'],
        },
      },
    ];
  }

  async start(): Promise<void> {
    const config = getConfig();

    // Initialize cache if configured
    try {
      const cacheConfig = config.getCacheConfig();
      if (cacheConfig) {
        initializeCache(cacheConfig);
        logger.info('Cache initialized', { type: cacheConfig.type, ttl: cacheConfig.ttl });
      } else {
        logger.info('Running without cache');
      }
    } catch (error) {
      logger.warn('Failed to initialize cache, continuing without cache', { error });
    }

    // Initialize providers
    this.initializeProviders();

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
