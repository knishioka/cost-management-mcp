import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getConfig } from './common/config';
import { initializeCache } from './common/cache';
import { logger } from './common/utils';
import { handleError } from './common/errors';
import type { ProviderClient } from './common/types';
import { toolDefinitions, type ToolDefinition } from './tools/registry';
import { AWSCostClient } from './providers/aws';
import { OpenAICostClient } from './providers/openai';
import { AnthropicCostClient } from './providers/anthropic';

export class CostManagementMCPServer {
  private server: Server;
  private providers: Map<string, ProviderClient> = new Map();
  private toolRegistry: Map<string, ToolDefinition>;

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

    this.toolRegistry = new Map(
      toolDefinitions.map((definition) => [definition.metadata.name, definition]),
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

      case 'openai':
        return new OpenAICostClient(providerConfig.credentials as any);

      case 'anthropic':
        return new AnthropicCostClient(providerConfig.credentials as any);

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

        const definition = this.toolRegistry.get(name);
        if (!definition) {
          throw new Error(`Unknown tool: ${name}`);
        }

        return await definition.handler(args, this.providers);
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
    return toolDefinitions.map((definition) => definition.metadata);
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
