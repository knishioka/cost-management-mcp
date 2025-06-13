import { z } from 'zod';
import type { ProviderClient, ToolResponse } from '../common/types';
import { parseDate } from '../common/utils';
import { ValidationError } from '../common/errors';

const GetAnthropicUsageSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  estimatedUsage: z
    .object({
      claude3Opus: z.number().optional(),
      claude3Sonnet: z.number().optional(),
      claude3Haiku: z.number().optional(),
      claude2: z.number().optional(),
    })
    .optional(),
});

// Anthropic pricing per 1M tokens (as of 2024)
const ANTHROPIC_PRICING = {
  'claude-3-opus': { input: 15, output: 75 },
  'claude-3-sonnet': { input: 3, output: 15 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-2': { input: 8, output: 24 },
};

export async function getAnthropicUsageTool(
  args: unknown,
  _providers: Map<string, ProviderClient>,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const validation = GetAnthropicUsageSchema.safeParse(args);
  if (!validation.success) {
    throw new ValidationError('Invalid parameters', validation.error.errors);
  }

  const params = validation.data;
  const startDate = parseDate(params.startDate);
  const endDate = parseDate(params.endDate);

  if (startDate > endDate) {
    throw new ValidationError('Start date must be before end date');
  }

  // Since Anthropic doesn't have an API, we'll provide estimation tools
  const estimatedCosts = params.estimatedUsage
    ? calculateEstimatedCosts(params.estimatedUsage)
    : null;

  const response: ToolResponse = {
    success: true,
    data: {
      provider: 'anthropic',
      period: {
        start: startDate,
        end: endDate,
      },
      message:
        'Anthropic does not provide a billing API. Please check your usage at https://console.anthropic.com/usage',
      consoleUrl: 'https://console.anthropic.com/usage',
      estimatedCosts: estimatedCosts,
      pricingInfo: {
        note: 'Prices per 1M tokens (input/output)',
        models: Object.entries(ANTHROPIC_PRICING).map(([model, pricing]) => ({
          model,
          inputPrice: `$${pricing.input}`,
          outputPrice: `$${pricing.output}`,
        })),
      },
      tips: [
        "Use Claude 3 Haiku for tasks that don't require advanced reasoning",
        'Implement prompt caching to reduce repeated API calls',
        'Consider batching requests to optimize token usage',
        'Monitor your usage regularly in the Anthropic Console',
      ],
    },
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

interface EstimatedUsage {
  claude3Opus?: number;
  claude3Sonnet?: number;
  claude3Haiku?: number;
  claude2?: number;
}

interface EstimatedCosts {
  total: number;
  breakdown: Array<{
    model: string;
    tokens: number;
    estimatedCost: number;
  }>;
  currency: string;
  note: string;
}

function calculateEstimatedCosts(usage: EstimatedUsage): EstimatedCosts {
  const costs: EstimatedCosts = {
    total: 0,
    breakdown: [],
    currency: 'USD',
    note: 'This is an estimation based on average input/output token ratio',
  };

  if (usage.claude3Opus) {
    const cost =
      (usage.claude3Opus / 1_000_000) *
      ((ANTHROPIC_PRICING['claude-3-opus'].input + ANTHROPIC_PRICING['claude-3-opus'].output) / 2);
    costs.breakdown.push({
      model: 'Claude 3 Opus',
      tokens: usage.claude3Opus,
      estimatedCost: cost,
    });
    costs.total += cost;
  }

  if (usage.claude3Sonnet) {
    const cost =
      (usage.claude3Sonnet / 1_000_000) *
      ((ANTHROPIC_PRICING['claude-3-sonnet'].input + ANTHROPIC_PRICING['claude-3-sonnet'].output) /
        2);
    costs.breakdown.push({
      model: 'Claude 3 Sonnet',
      tokens: usage.claude3Sonnet,
      estimatedCost: cost,
    });
    costs.total += cost;
  }

  if (usage.claude3Haiku) {
    const cost =
      (usage.claude3Haiku / 1_000_000) *
      ((ANTHROPIC_PRICING['claude-3-haiku'].input + ANTHROPIC_PRICING['claude-3-haiku'].output) /
        2);
    costs.breakdown.push({
      model: 'Claude 3 Haiku',
      tokens: usage.claude3Haiku,
      estimatedCost: cost,
    });
    costs.total += cost;
  }

  if (usage.claude2) {
    const cost =
      (usage.claude2 / 1_000_000) *
      ((ANTHROPIC_PRICING['claude-2'].input + ANTHROPIC_PRICING['claude-2'].output) / 2);
    costs.breakdown.push({ model: 'Claude 2', tokens: usage.claude2, estimatedCost: cost });
    costs.total += cost;
  }

  return costs;
}
