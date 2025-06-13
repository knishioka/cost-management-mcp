import type { UnifiedCostData, CostBreakdown, DateRange } from '../../common/types';
import type { OpenAIUsageResponse, OpenAICostResponse } from './types';
import { OPENAI_MODEL_PRICING } from './types';

export function transformOpenAIUsageResponse(
  response: OpenAIUsageResponse,
  period: DateRange,
): UnifiedCostData {
  const costBreakdown: CostBreakdown[] = [];
  const modelCosts = new Map<string, { cost: number; tokens: number }>();

  // Aggregate usage by model
  for (const data of response.data) {
    for (const usage of data.usage) {
      const model = usage.model;
      const inputTokens = usage.n_context_tokens;
      const outputTokens = usage.n_generated_tokens;
      
      // Calculate cost based on model pricing
      const pricing = OPENAI_MODEL_PRICING[model as keyof typeof OPENAI_MODEL_PRICING];
      let cost = 0;
      
      if (pricing && typeof pricing === 'object' && 'input' in pricing) {
        // Text models - charge per 1K tokens
        cost = (inputTokens * pricing.input / 1000) + (outputTokens * pricing.output / 1000);
      }
      
      const existing = modelCosts.get(model) || { cost: 0, tokens: 0 };
      modelCosts.set(model, {
        cost: existing.cost + cost,
        tokens: existing.tokens + inputTokens + outputTokens,
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
          quantity: data.tokens,
          unit: 'tokens',
        },
      });
    }
  }

  const totalCost = costBreakdown.reduce((sum, item) => sum + item.amount, 0);

  return {
    provider: 'openai',
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

export function transformOpenAICostResponse(
  response: OpenAICostResponse,
  period: DateRange,
): UnifiedCostData {
  const costBreakdown: CostBreakdown[] = [];
  const serviceCosts = new Map<string, number>();

  // Aggregate costs by line item
  for (const data of response.data) {
    for (const lineItem of data.line_items) {
      const existing = serviceCosts.get(lineItem.name) || 0;
      serviceCosts.set(lineItem.name, existing + lineItem.cost);
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
    provider: 'openai',
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

export function formatOpenAIDate(date: Date): string {
  return date.toISOString().split('T')[0];
}