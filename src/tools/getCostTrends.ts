import { z } from 'zod';
import type { ProviderClient, UnifiedCostData } from '../common/types';
import { logger, resolveProviderName } from '../common/utils';
import { ValidationError } from '../common/errors';

const GetCostTrendsSchema = z.object({
  provider: z.enum(['aws', 'gcp', 'openai']).optional(),
  period: z.enum(['30d', '60d', '90d', '6m', '1y']).default('30d'),
  granularity: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
});

interface TrendData {
  date: Date;
  cost: number;
  changeFromPrevious: number;
  changePercentage: number;
}

interface TrendAnalysis {
  provider: string;
  period: string;
  trends: TrendData[];
  summary: {
    totalCost: number;
    averageDailyCost: number;
    highestCost: { date: Date; amount: number };
    lowestCost: { date: Date; amount: number };
    trend: 'increasing' | 'decreasing' | 'stable';
    volatility: 'high' | 'medium' | 'low';
  };
  insights: string[];
}

export async function getCostTrendsTool(
  args: unknown,
  providers: Map<string, ProviderClient>,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const params = GetCostTrendsSchema.parse(args);

  // Calculate date range based on period
  const endDate = new Date();
  const startDate = new Date();
  switch (params.period) {
    case '30d':
      startDate.setDate(endDate.getDate() - 30);
      break;
    case '60d':
      startDate.setDate(endDate.getDate() - 60);
      break;
    case '90d':
      startDate.setDate(endDate.getDate() - 90);
      break;
    case '6m':
      startDate.setMonth(endDate.getMonth() - 6);
      break;
    case '1y':
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
  }

  // If specific provider requested
  if (params.provider) {
    const provider = providers.get(params.provider);
    if (!provider) {
      throw new ValidationError(`Provider ${params.provider} not configured`);
    }

    const trendAnalysis = await analyzeTrends(provider, startDate, endDate, params.granularity);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              data: trendAnalysis,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  // Analyze trends for all providers
  const allTrends: TrendAnalysis[] = [];

  for (const [name, provider] of providers) {
    try {
      const trendAnalysis = await analyzeTrends(provider, startDate, endDate, params.granularity);
      allTrends.push(trendAnalysis);
    } catch (error) {
      logger.error(`Failed to analyze trends for ${name}`, error);
    }
  }

  const combinedInsights = generateCombinedInsights(allTrends);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: true,
            data: {
              providers: allTrends,
              insights: combinedInsights,
            },
          },
          null,
          2,
        ),
      },
    ],
  };
}

async function analyzeTrends(
  provider: ProviderClient,
  startDate: Date,
  endDate: Date,
  granularity: 'daily' | 'weekly' | 'monthly',
): Promise<TrendAnalysis> {
  const costData = await provider.getCosts({
    startDate,
    endDate,
    granularity: granularity === 'weekly' ? 'daily' : granularity,
  });

  const trends = calculateTrends(costData, granularity);
  const summary = calculateSummary(trends, costData);
  const providerName = resolveProviderName(provider);
  const insights = generateInsights(trends, summary, providerName);

  return {
    provider: providerName,
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    trends,
    summary,
    insights,
  };
}

function calculateTrends(costData: UnifiedCostData, _granularity: string): TrendData[] {
  const trends: TrendData[] = [];
  const sortedBreakdown = [...costData.costs.breakdown].sort(
    (a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0),
  );

  let previousCost = 0;
  for (const item of sortedBreakdown) {
    const itemDate = item.date;
    if (!itemDate) continue;

    const changeFromPrevious = item.amount - previousCost;
    const changePercentage = previousCost > 0 ? (changeFromPrevious / previousCost) * 100 : 0;

    trends.push({
      date: itemDate,
      cost: item.amount,
      changeFromPrevious,
      changePercentage,
    });

    previousCost = item.amount;
  }

  return trends;
}

function calculateSummary(
  trends: TrendData[],
  costData: UnifiedCostData,
): TrendAnalysis['summary'] {
  const costs = trends.map((t) => t.cost);
  const totalCost = costData.costs.total;
  const averageDailyCost = trends.length > 0 ? totalCost / trends.length : 0;

  const highestCostDay =
    trends.length > 0
      ? trends.reduce((max, t) => (t.cost > max.cost ? t : max))
      : { date: new Date(), cost: 0 };
  const lowestCostDay =
    trends.length > 0
      ? trends.reduce((min, t) => (t.cost < min.cost ? t : min))
      : { date: new Date(), cost: 0 };

  // Calculate trend direction
  const firstHalf = costs.slice(0, Math.floor(costs.length / 2));
  const secondHalf = costs.slice(Math.floor(costs.length / 2));
  const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  let trend: 'increasing' | 'decreasing' | 'stable';
  if (secondHalfAvg > firstHalfAvg * 1.1) {
    trend = 'increasing';
  } else if (secondHalfAvg < firstHalfAvg * 0.9) {
    trend = 'decreasing';
  } else {
    trend = 'stable';
  }

  // Calculate volatility
  const mean = costs.reduce((a, b) => a + b, 0) / costs.length;
  const variance = costs.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) / costs.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = (stdDev / mean) * 100;

  let volatility: 'high' | 'medium' | 'low';
  if (coefficientOfVariation > 50) {
    volatility = 'high';
  } else if (coefficientOfVariation > 20) {
    volatility = 'medium';
  } else {
    volatility = 'low';
  }

  return {
    totalCost,
    averageDailyCost,
    highestCost: { date: highestCostDay.date, amount: highestCostDay.cost },
    lowestCost: { date: lowestCostDay.date, amount: lowestCostDay.cost },
    trend,
    volatility,
  };
}

function generateInsights(
  trends: TrendData[],
  summary: TrendAnalysis['summary'],
  provider: string,
): string[] {
  const insights: string[] = [];

  // Trend insights
  if (summary.trend === 'increasing' && trends.length > 0) {
    const lastTrend = trends[trends.length - 1];
    insights.push(
      `📈 ${provider} costs are trending upward, latest: $${lastTrend.cost.toFixed(2)}`,
    );
  } else if (summary.trend === 'decreasing') {
    insights.push(`📉 Good news! ${provider} costs are decreasing`);
  }

  // Volatility insights
  if (summary.volatility === 'high') {
    insights.push('⚠️ High cost volatility detected - consider investigating spikes');
  }

  // Spike detection
  const spikes = trends.filter((t) => t.changePercentage > 50);
  if (spikes.length > 0) {
    insights.push(`🚨 ${spikes.length} cost spike(s) detected (>50% increase)`);
  }

  // Cost range
  const range = summary.highestCost.amount - summary.lowestCost.amount;
  const rangePercentage = (range / summary.averageDailyCost) * 100;
  if (rangePercentage > 200) {
    insights.push(
      `📊 Wide cost range: $${summary.lowestCost.amount.toFixed(2)} - $${summary.highestCost.amount.toFixed(2)}`,
    );
  }

  return insights;
}

function generateCombinedInsights(trends: TrendAnalysis[]): string[] {
  const insights: string[] = [];

  // Total across all providers
  const totalCost = trends.reduce((sum, t) => sum + t.summary.totalCost, 0);
  insights.push(`💰 Total cost across all providers: $${totalCost.toFixed(2)}`);

  // Identify highest growing provider
  const increasingProviders = trends.filter((t) => t.summary.trend === 'increasing');
  if (increasingProviders.length > 0) {
    const providers = increasingProviders.map((t) => t.provider).join(', ');
    insights.push(`📈 Increasing costs detected for: ${providers}`);
  }

  // Volatility warning
  const highVolatilityProviders = trends.filter((t) => t.summary.volatility === 'high');
  if (highVolatilityProviders.length > 0) {
    insights.push(
      `⚠️ High volatility providers: ${highVolatilityProviders.map((t) => t.provider).join(', ')}`,
    );
  }

  return insights;
}
