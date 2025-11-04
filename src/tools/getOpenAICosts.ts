import { z } from 'zod';
import type { ProviderClient, ToolResponse } from '../common/types';
import { parseDate, logger } from '../common/utils';
import { ValidationError } from '../common/errors';

const GetOpenAICostsSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  groupByModel: z.boolean().optional().default(false),
  includeTokenUsage: z.boolean().optional().default(true),
});

export async function getOpenAICostsTool(
  args: unknown,
  providers: Map<string, ProviderClient>,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const validation = GetOpenAICostsSchema.safeParse(args);
  if (!validation.success) {
    throw new ValidationError('Invalid parameters', validation.error.issues);
  }

  const params = validation.data;
  const startDate = parseDate(params.startDate);
  const endDate = parseDate(params.endDate);

  if (startDate > endDate) {
    throw new ValidationError('Start date must be before end date');
  }

  const provider = providers.get('openai');
  if (!provider) {
    throw new ValidationError('OpenAI provider not configured');
  }

  try {
    logger.debug('Fetching OpenAI costs', params);

    const costData = await provider.getCosts({
      startDate,
      endDate,
      granularity: 'daily',
      groupBy: params.groupByModel ? ['MODEL'] : undefined,
    });

    // OpenAI specific response formatting
    const response: ToolResponse = {
      success: true,
      data: {
        ...costData,
        summary: {
          totalCost: costData.costs.total,
          currency: costData.costs.currency,
          totalTokens: costData.costs.breakdown.reduce((sum, item) => {
            return sum + (item.usage?.quantity || 0);
          }, 0),
          modelBreakdown: params.groupByModel
            ? costData.costs.breakdown.map((item) => ({
                model: item.service,
                cost: item.amount,
                tokens: item.usage?.quantity || 0,
              }))
            : undefined,
        },
        tips: [
          costData.costs.total > 100
            ? 'Consider using GPT-3.5 Turbo for non-critical tasks to reduce costs'
            : null,
          'Use shorter prompts and system messages where possible',
          'Implement caching for repeated queries',
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
    logger.error('Failed to fetch OpenAI costs', error);
    throw error;
  }
}
