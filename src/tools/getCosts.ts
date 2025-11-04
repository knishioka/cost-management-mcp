import { z } from 'zod';
import type { ProviderClient, UnifiedCostData, ToolResponse } from '../common/types';
import { parseDate, logger } from '../common/utils';
import { ValidationError } from '../common/errors';

const GetCostSchema = z.object({
  provider: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  granularity: z.enum(['daily', 'monthly', 'total']).optional().default('total'),
  groupBy: z.array(z.string()).optional(),
});

export async function getCostTool(
  args: unknown,
  providers: Map<string, ProviderClient>,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const validation = GetCostSchema.safeParse(args);
  if (!validation.success) {
    throw new ValidationError('Invalid parameters', validation.error.issues);
  }

  const params = validation.data;
  const startDate = parseDate(params.startDate);
  const endDate = parseDate(params.endDate);

  if (startDate > endDate) {
    throw new ValidationError('Start date must be before end date');
  }

  if (params.provider) {
    const provider = providers.get(params.provider);
    if (!provider) {
      throw new ValidationError(`Provider ${params.provider} not configured`);
    }

    const costData = await provider.getCosts({
      startDate,
      endDate,
      granularity: params.granularity,
      groupBy: params.groupBy,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              data: costData,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  const allCosts: UnifiedCostData[] = [];
  const errors: Array<{ provider: string; error: string }> = [];

  for (const [providerName, provider] of providers) {
    try {
      logger.debug(`Fetching costs for ${providerName}`);
      const costData = await provider.getCosts({
        startDate,
        endDate,
        granularity: params.granularity,
        groupBy: params.groupBy,
      });
      allCosts.push(costData);
    } catch (error) {
      logger.error(`Failed to fetch costs for ${providerName}`, error);
      errors.push({
        provider: providerName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const totalCost = allCosts.reduce((sum, data) => sum + data.costs.total, 0);

  const response: ToolResponse = {
    success: true,
    data: {
      total: totalCost,
      currency: 'USD',
      providers: allCosts,
      errors: errors.length > 0 ? errors : undefined,
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
