import type { UnifiedCostData, CostBreakdown, DateRange } from '../../common/types';
import type { AnthropicCostResponse, AnthropicUsageResponse, AnthropicCost } from './types';
import { ANTHROPIC_MODEL_PRICING, ANTHROPIC_CACHE_PRICING } from './types';

export function transformAnthropicCostResponse(
  response: AnthropicCostResponse,
  period: DateRange,
): UnifiedCostData {
  const costBreakdown: CostBreakdown[] = [];
  const serviceCosts = new Map<string, number>();

  // Aggregate costs across all buckets
  for (const bucket of response.data) {
    for (const cost of bucket.costs) {
      const serviceName = getServiceName(cost);
      const costUsd = parseCostUsd(cost.cost_usd);

      const existing = serviceCosts.get(serviceName) || 0;
      serviceCosts.set(serviceName, existing + costUsd);
    }
  }

  // Convert to breakdown format
  for (const [service, cost] of serviceCosts) {
    if (cost > 0) {
      costBreakdown.push({
        service,
        amount: cost,
      });
    }
  }

  const totalCost = costBreakdown.reduce((sum, item) => sum + item.amount, 0);

  return {
    provider: 'anthropic',
    period,
    costs: {
      total: totalCost,
      currency: 'USD',
      breakdown: costBreakdown.sort((a, b) => b.amount - a.amount),
    },
    metadata: {
      lastUpdated: new Date(),
      source: 'api',
    },
  };
}

export function transformAnthropicUsageResponse(
  response: AnthropicUsageResponse,
  period: DateRange,
): UnifiedCostData {
  const costBreakdown: CostBreakdown[] = [];
  const modelCosts = new Map<string, { cost: number; inputTokens: number; outputTokens: number }>();

  // Aggregate usage by model across all buckets
  for (const bucket of response.data) {
    for (const usage of bucket.usage) {
      const model = usage.model || 'unknown';
      const inputTokens = usage.input_tokens || 0;
      const cacheCreationTokens = usage.cache_creation_input_tokens || 0;
      const cacheReadTokens = usage.cache_read_input_tokens || 0;
      const outputTokens = usage.output_tokens || 0;

      // Calculate cost based on model pricing
      const pricing = ANTHROPIC_MODEL_PRICING[model as keyof typeof ANTHROPIC_MODEL_PRICING];
      let cost = 0;

      if (pricing) {
        // Regular token costs (per 1M tokens)
        cost += (inputTokens * pricing.input) / 1_000_000;
        cost += (outputTokens * pricing.output) / 1_000_000;

        // Cache costs
        cost += (cacheCreationTokens * ANTHROPIC_CACHE_PRICING.write) / 1_000_000;
        cost += (cacheReadTokens * ANTHROPIC_CACHE_PRICING.read) / 1_000_000;
      }

      const existing = modelCosts.get(model) || {
        cost: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
      modelCosts.set(model, {
        cost: existing.cost + cost,
        inputTokens: existing.inputTokens + inputTokens + cacheCreationTokens + cacheReadTokens,
        outputTokens: existing.outputTokens + outputTokens,
      });
    }
  }

  // Convert to breakdown format
  for (const [model, data] of modelCosts) {
    if (data.cost > 0) {
      costBreakdown.push({
        service: model,
        amount: data.cost,
        usage: {
          quantity: data.inputTokens + data.outputTokens,
          unit: 'tokens',
        },
      });
    }
  }

  const totalCost = costBreakdown.reduce((sum, item) => sum + item.amount, 0);

  return {
    provider: 'anthropic',
    period,
    costs: {
      total: totalCost,
      currency: 'USD',
      breakdown: costBreakdown.sort((a, b) => b.amount - a.amount),
    },
    metadata: {
      lastUpdated: new Date(),
      source: 'api',
    },
  };
}

/**
 * Get service name from cost data
 */
function getServiceName(cost: AnthropicCost): string {
  if (cost.description) {
    return cost.description;
  }
  if (cost.workspace_name) {
    return `Workspace: ${cost.workspace_name}`;
  }
  if (cost.workspace_id) {
    return `Workspace: ${cost.workspace_id}`;
  }
  return 'Unknown Service';
}

/**
 * Parse cost from Anthropic's decimal string format (in cents)
 * Example: "123.45" => $1.2345
 */
function parseCostUsd(costStr: string): number {
  const cents = parseFloat(costStr);
  return cents / 100;
}

/**
 * Format date for Anthropic API (ISO 8601)
 */
export function formatAnthropicDate(date: Date): string {
  return date.toISOString();
}
