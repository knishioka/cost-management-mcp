import { z } from 'zod';
import type { ProviderClient, ToolResponse } from '../common/types';
import { parseDate, logger } from '../common/utils';
import { ValidationError } from '../common/errors';

const CompareProvidersSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  includeChart: z.boolean().optional().default(false),
});

export async function compareProvidersTool(
  args: unknown,
  providers: Map<string, ProviderClient>,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const validation = CompareProvidersSchema.safeParse(args);
  if (!validation.success) {
    throw new ValidationError('Invalid parameters', validation.error.issues);
  }

  const params = validation.data;
  const startDate = parseDate(params.startDate);
  const endDate = parseDate(params.endDate);

  if (startDate > endDate) {
    throw new ValidationError('Start date must be before end date');
  }

  const providerCosts: Array<{
    provider: string;
    cost: number;
    status: 'success' | 'error';
    error?: string;
  }> = [];

  // Fetch costs from all providers
  for (const [providerName, provider] of providers) {
    try {
      logger.debug(`Fetching costs for ${providerName} for comparison`);
      const costData = await provider.getCosts({
        startDate,
        endDate,
        granularity: 'total',
      });

      providerCosts.push({
        provider: providerName,
        cost: costData.costs.total,
        status: 'success',
      });
    } catch (error) {
      logger.error(`Failed to fetch costs for ${providerName}`, error);
      providerCosts.push({
        provider: providerName,
        cost: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const successfulProviders = providerCosts.filter((p) => p.status === 'success');
  const totalCost = successfulProviders.reduce((sum, p) => sum + p.cost, 0);

  // Generate ASCII chart if requested
  const chart = params.includeChart ? generateASCIIChart(successfulProviders) : null;

  const response: ToolResponse = {
    success: true,
    data: {
      period: {
        start: startDate,
        end: endDate,
      },
      summary: {
        totalCost,
        currency: 'USD',
        providersAnalyzed: providers.size,
        successfulQueries: successfulProviders.length,
      },
      providers: providerCosts.map((p) => ({
        ...p,
        percentage: totalCost > 0 ? ((p.cost / totalCost) * 100).toFixed(2) + '%' : '0%',
      })),
      insights: generateInsights(providerCosts, totalCost),
      chart: chart,
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

function generateASCIIChart(providers: Array<{ provider: string; cost: number }>): string {
  if (providers.length === 0) return 'No data to display';

  const maxCost = Math.max(...providers.map((p) => p.cost));
  const maxBarLength = 40;

  let chart = '\nCost Comparison Chart:\n';
  chart += '═'.repeat(60) + '\n\n';

  providers
    .sort((a, b) => b.cost - a.cost)
    .forEach((p) => {
      const barLength = maxCost > 0 ? Math.round((p.cost / maxCost) * maxBarLength) : 0;
      const bar = '█'.repeat(barLength);
      const padding = ' '.repeat(12 - p.provider.length);
      chart += `${p.provider}${padding} │ ${bar} $${p.cost.toFixed(2)}\n`;
    });

  chart += '\n' + '═'.repeat(60);
  return chart;
}

function generateInsights(
  providerCosts: Array<{ provider: string; cost: number; status: string }>,
  totalCost: number,
): string[] {
  const insights: string[] = [];

  // Find highest cost provider
  const highestCost = providerCosts
    .filter((p) => p.status === 'success')
    .sort((a, b) => b.cost - a.cost)[0];

  if (highestCost && highestCost.cost > 0) {
    insights.push(
      `${highestCost.provider.toUpperCase()} is your highest cost provider at $${highestCost.cost.toFixed(2)}`,
    );
  }

  // Check for significant cost imbalances
  const costDistribution = providerCosts
    .filter((p) => p.status === 'success' && p.cost > 0)
    .map((p) => (p.cost / totalCost) * 100);

  if (costDistribution.some((percentage) => percentage > 70)) {
    insights.push('Consider diversifying your cloud usage to avoid vendor lock-in');
  }

  // AWS specific insights
  const awsCost = providerCosts.find((p) => p.provider === 'aws')?.cost || 0;
  if (awsCost > 500) {
    insights.push('Your AWS costs are significant - consider Reserved Instances or Savings Plans');
  }

  // OpenAI specific insights
  const openaiCost = providerCosts.find((p) => p.provider === 'openai')?.cost || 0;
  if (openaiCost > 100) {
    insights.push('Consider using GPT-3.5 Turbo instead of GPT-4 for non-critical tasks');
  }

  return insights;
}
