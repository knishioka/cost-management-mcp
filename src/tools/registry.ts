import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ProviderClient } from '../common/types';
import { SUPPORTED_PROVIDERS } from '../common/providers';
import { getCostTool } from './getCosts';
import { listProvidersTool } from './listProviders';
import { checkBalanceTool } from './checkBalance';
import { getOpenAICostsTool } from './getOpenAICosts';
import { getAnthropicCostsTool } from './getAnthropicCosts';
import { getAWSCostsTool } from './getAWSCosts';
import { compareProvidersTool } from './compareProviders';
import { getCostTrendsTool } from './getCostTrends';
import { getCostBreakdownTool } from './getCostBreakdown';
import { getCostPeriodsTool } from './getCostPeriods';

export type ToolHandlerResult = Promise<{ content: Array<{ type: string; text: string }> }>;

export type ToolHandler = (
  args: unknown,
  providers: Map<string, ProviderClient>,
) => ToolHandlerResult;

export interface ToolDefinition {
  metadata: Tool;
  handler: ToolHandler;
}

const providerEnum = [...SUPPORTED_PROVIDERS];

export const toolDefinitions: ToolDefinition[] = [
  {
    metadata: {
      name: 'cost_get',
      description: 'Get cost data for a specific provider and time period',
      inputSchema: {
        type: 'object',
        properties: {
          provider: {
            type: 'string',
            enum: providerEnum,
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
    handler: getCostTool,
  },
  {
    metadata: {
      name: 'provider_list',
      description: 'List all configured providers and their status',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    handler: (_, providers) => listProvidersTool(providers),
  },
  {
    metadata: {
      name: 'provider_balance',
      description: 'Check remaining balance or credits for a provider',
      inputSchema: {
        type: 'object',
        properties: {
          provider: {
            type: 'string',
            enum: providerEnum,
            description: 'The provider to check balance for',
          },
        },
        required: ['provider'],
      },
    },
    handler: checkBalanceTool,
  },
  {
    metadata: {
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
    handler: getOpenAICostsTool,
  },
  {
    metadata: {
      name: 'anthropic_costs',
      description: 'Get detailed Anthropic costs with model breakdown and token usage',
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
          useUsageReport: {
            type: 'boolean',
            description:
              'Use usage report API instead of cost report (provides token-level details with calculated costs)',
            default: false,
          },
        },
        required: ['startDate', 'endDate'],
      },
    },
    handler: getAnthropicCostsTool,
  },
  {
    metadata: {
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
    handler: getAWSCostsTool,
  },
  {
    metadata: {
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
    handler: compareProvidersTool,
  },
  {
    metadata: {
      name: 'cost_trends',
      description: 'Analyze cost trends over time with insights',
      inputSchema: {
        type: 'object',
        properties: {
          provider: {
            type: 'string',
            enum: providerEnum,
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
    handler: getCostTrendsTool,
  },
  {
    metadata: {
      name: 'cost_breakdown',
      description: 'Get detailed cost breakdown by multiple dimensions',
      inputSchema: {
        type: 'object',
        properties: {
          provider: {
            type: 'string',
            enum: providerEnum,
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
    handler: getCostBreakdownTool,
  },
  {
    metadata: {
      name: 'cost_periods',
      description: 'Compare costs between two time periods',
      inputSchema: {
        type: 'object',
        properties: {
          provider: {
            type: 'string',
            enum: providerEnum,
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
    handler: getCostPeriodsTool,
  },
];
