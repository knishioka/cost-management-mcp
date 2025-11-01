import { z } from 'zod';
import type { ProviderClient, ToolResponse, CostBreakdown } from '../common/types';
import { parseDate, logger } from '../common/utils';
import { ValidationError } from '../common/errors';

const GetAnthropicCostsSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  groupByModel: z.boolean().optional().default(false),
  includeTokenUsage: z.boolean().optional().default(true),
  useUsageReport: z.boolean().optional().default(false),
});

export async function getAnthropicCostsTool(
  args: unknown,
  providers: Map<string, ProviderClient>,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const validation = GetAnthropicCostsSchema.safeParse(args);
  if (!validation.success) {
    throw new ValidationError('Invalid parameters', validation.error.errors);
  }

  const params = validation.data;
  const startDate = parseDate(params.startDate);
  const endDate = parseDate(params.endDate);

  if (startDate > endDate) {
    throw new ValidationError('Start date must be before end date');
  }

  const provider = providers.get('anthropic');
  if (!provider) {
    throw new ValidationError('Anthropic provider not configured');
  }

  try {
    logger.debug('Fetching Anthropic costs', params);

    // Use cost report API for actual billing data, or usage report for token-level details
    let costData;
    if (params.useUsageReport && 'getUsageData' in provider) {
      // Type assertion since ProviderClient interface doesn't include getUsageData
      const anthropicProvider = provider as any;
      costData = await anthropicProvider.getUsageData({
        startDate,
        endDate,
        granularity: 'daily',
        groupBy: params.groupByModel ? ['model'] : undefined,
      });
    } else {
      costData = await provider.getCosts({
        startDate,
        endDate,
        granularity: 'daily',
        groupBy: params.groupByModel ? ['workspace_id', 'description'] : undefined,
      });
    }

    // Anthropic specific response formatting
    const response: ToolResponse = {
      success: true,
      data: {
        ...costData,
        summary: {
          totalCost: costData.costs.total,
          currency: costData.costs.currency,
          totalTokens: params.includeTokenUsage
            ? costData.costs.breakdown.reduce((sum: number, item: CostBreakdown) => {
                return sum + (item.usage?.quantity || 0);
              }, 0)
            : undefined,
          breakdown: params.groupByModel
            ? costData.costs.breakdown.map((item: CostBreakdown) => ({
                service: item.service,
                cost: item.amount,
                tokens: item.usage?.quantity || 0,
              }))
            : undefined,
        },
        tips: [
          costData.costs.total > 100
            ? 'Consider using Claude 3.5 Haiku for simpler tasks to reduce costs'
            : null,
          'Enable prompt caching for frequently used prompts (90% cost reduction)',
          'Use batching API for non-urgent requests when available',
          params.useUsageReport
            ? 'Cost data calculated from usage report using current pricing'
            : 'Cost data from Anthropic billing report (actual charges)',
        ].filter(Boolean),
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
  } catch (error) {
    logger.error('Failed to fetch Anthropic costs', error);
    throw error;
  }
}
