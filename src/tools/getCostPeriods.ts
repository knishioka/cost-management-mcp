import { z } from 'zod';
import type { ProviderClient, UnifiedCostData } from '../common/types';
import { parseDate, logger } from '../common/utils';
import { ValidationError } from '../common/errors';

const GetCostPeriodsSchema = z.object({
  provider: z.enum(['aws', 'gcp', 'openai']).optional(),
  period1: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
  period2: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
  comparisonType: z.enum(['absolute', 'percentage', 'both']).default('both'),
  breakdown: z.boolean().default(true),
});

interface PeriodComparison {
  period1: {
    dates: { start: Date; end: Date };
    cost: number;
    days: number;
    dailyAverage: number;
  };
  period2: {
    dates: { start: Date; end: Date };
    cost: number;
    days: number;
    dailyAverage: number;
  };
  comparison: {
    absoluteDifference: number;
    percentageChange: number;
    dailyAverageDifference: number;
    trend: 'increase' | 'decrease' | 'stable';
  };
  breakdown?: Array<{
    service: string;
    period1Cost: number;
    period2Cost: number;
    difference: number;
    percentageChange: number;
  }>;
  insights: string[];
}

export async function getCostPeriodsTool(
  args: unknown,
  providers: Map<string, ProviderClient>,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const params = GetCostPeriodsSchema.parse(args);

  const period1Start = parseDate(params.period1.startDate);
  const period1End = parseDate(params.period1.endDate);
  const period2Start = parseDate(params.period2.startDate);
  const period2End = parseDate(params.period2.endDate);

  // Validate periods
  if (period1Start >= period1End || period2Start >= period2End) {
    throw new ValidationError('Start date must be before end date for each period');
  }

  // If specific provider requested
  if (params.provider) {
    const provider = providers.get(params.provider);
    if (!provider) {
      throw new ValidationError(`Provider ${params.provider} not configured`);
    }

    const comparison = await comparePeriods(
      provider,
      { start: period1Start, end: period1End },
      { start: period2Start, end: period2End },
      params.comparisonType,
      params.breakdown,
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              provider: params.provider,
              data: comparison,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  // Compare periods for all providers
  const allComparisons: { provider: string; comparison: PeriodComparison }[] = [];

  for (const [name, provider] of providers) {
    try {
      const comparison = await comparePeriods(
        provider,
        { start: period1Start, end: period1End },
        { start: period2Start, end: period2End },
        params.comparisonType,
        params.breakdown,
      );
      allComparisons.push({ provider: name, comparison });
    } catch (error) {
      logger.error(`Failed to compare periods for ${name}`, error);
    }
  }

  const crossProviderInsights = generateCrossProviderInsights(allComparisons);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: true,
            data: {
              comparisons: allComparisons,
              insights: crossProviderInsights,
            },
          },
          null,
          2,
        ),
      },
    ],
  };
}

async function comparePeriods(
  provider: ProviderClient,
  period1: { start: Date; end: Date },
  period2: { start: Date; end: Date },
  _comparisonType: string,
  includeBreakdown: boolean,
): Promise<PeriodComparison> {
  // Fetch costs for both periods
  const [costs1, costs2] = await Promise.all([
    provider.getCosts({
      startDate: period1.start,
      endDate: period1.end,
      granularity: 'total',
      groupBy: includeBreakdown ? ['SERVICE'] : undefined,
    }),
    provider.getCosts({
      startDate: period2.start,
      endDate: period2.end,
      granularity: 'total',
      groupBy: includeBreakdown ? ['SERVICE'] : undefined,
    }),
  ]);

  // Calculate period lengths
  const days1 = Math.ceil(
    (period1.end.getTime() - period1.start.getTime()) / (1000 * 60 * 60 * 24),
  );
  const days2 = Math.ceil(
    (period2.end.getTime() - period2.start.getTime()) / (1000 * 60 * 60 * 24),
  );

  const dailyAvg1 = costs1.costs.total / days1;
  const dailyAvg2 = costs2.costs.total / days2;

  // Calculate comparison metrics
  const absoluteDiff = costs2.costs.total - costs1.costs.total;
  const percentageChange =
    costs1.costs.total > 0
      ? ((costs2.costs.total - costs1.costs.total) / costs1.costs.total) * 100
      : 0;
  const dailyAvgDiff = dailyAvg2 - dailyAvg1;

  let trend: 'increase' | 'decrease' | 'stable';
  if (percentageChange > 5) {
    trend = 'increase';
  } else if (percentageChange < -5) {
    trend = 'decrease';
  } else {
    trend = 'stable';
  }

  // Calculate breakdown if requested
  let breakdown: PeriodComparison['breakdown'];
  if (includeBreakdown) {
    breakdown = calculateBreakdownComparison(costs1, costs2);
  }

  // Generate insights
  const insights = generatePeriodInsights(
    { costs: costs1, days: days1, dailyAvg: dailyAvg1 },
    { costs: costs2, days: days2, dailyAvg: dailyAvg2 },
    absoluteDiff,
    percentageChange,
    breakdown,
    (provider as any).name || 'unknown',
  );

  return {
    period1: {
      dates: period1,
      cost: costs1.costs.total,
      days: days1,
      dailyAverage: dailyAvg1,
    },
    period2: {
      dates: period2,
      cost: costs2.costs.total,
      days: days2,
      dailyAverage: dailyAvg2,
    },
    comparison: {
      absoluteDifference: absoluteDiff,
      percentageChange,
      dailyAverageDifference: dailyAvgDiff,
      trend,
    },
    breakdown,
    insights,
  };
}

function calculateBreakdownComparison(
  costs1: UnifiedCostData,
  costs2: UnifiedCostData,
): PeriodComparison['breakdown'] {
  const services = new Map<string, { period1: number; period2: number }>();

  // Aggregate period 1 costs by service
  for (const item of costs1.costs.breakdown) {
    const service = item.service || 'Unknown';
    const existing = services.get(service) || { period1: 0, period2: 0 };
    existing.period1 += item.amount;
    services.set(service, existing);
  }

  // Aggregate period 2 costs by service
  for (const item of costs2.costs.breakdown) {
    const service = item.service || 'Unknown';
    const existing = services.get(service) || { period1: 0, period2: 0 };
    existing.period2 += item.amount;
    services.set(service, existing);
  }

  // Convert to breakdown array
  const breakdown = Array.from(services.entries())
    .map(([service, costs]) => ({
      service,
      period1Cost: costs.period1,
      period2Cost: costs.period2,
      difference: costs.period2 - costs.period1,
      percentageChange:
        costs.period1 > 0
          ? ((costs.period2 - costs.period1) / costs.period1) * 100
          : costs.period2 > 0
            ? 100
            : 0,
    }))
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

  return breakdown;
}

function generatePeriodInsights(
  period1Data: { costs: UnifiedCostData; days: number; dailyAvg: number },
  period2Data: { costs: UnifiedCostData; days: number; dailyAvg: number },
  absoluteDiff: number,
  percentageChange: number,
  breakdown: PeriodComparison['breakdown'] | undefined,
  provider: string,
): string[] {
  const insights: string[] = [];

  // Overall change insight
  if (absoluteDiff > 0) {
    insights.push(
      `📈 Costs increased by $${absoluteDiff.toFixed(2)} (${percentageChange.toFixed(1)}%)`,
    );
  } else if (absoluteDiff < 0) {
    insights.push(
      `📉 Costs decreased by $${Math.abs(absoluteDiff).toFixed(2)} (${Math.abs(percentageChange).toFixed(1)}%)`,
    );
  } else {
    insights.push('➡️ Costs remained stable between periods');
  }

  // Daily average comparison
  if (period1Data.days !== period2Data.days) {
    if (period2Data.dailyAvg > period1Data.dailyAvg * 1.1) {
      insights.push(
        `⚠️ Daily average increased from $${period1Data.dailyAvg.toFixed(2)} to $${period2Data.dailyAvg.toFixed(2)}`,
      );
    } else if (period2Data.dailyAvg < period1Data.dailyAvg * 0.9) {
      insights.push(
        `✅ Daily average decreased from $${period1Data.dailyAvg.toFixed(2)} to $${period2Data.dailyAvg.toFixed(2)}`,
      );
    }
  }

  // Breakdown insights
  if (breakdown && breakdown.length > 0) {
    // Biggest increase
    const biggestIncrease = breakdown.find((b) => b.difference > 0);
    if (biggestIncrease && biggestIncrease.percentageChange > 20) {
      insights.push(
        `🔺 Largest increase: ${biggestIncrease.service} (+${biggestIncrease.percentageChange.toFixed(1)}%)`,
      );
    }

    // Biggest decrease
    const biggestDecrease = breakdown.find((b) => b.difference < 0);
    if (biggestDecrease && Math.abs(biggestDecrease.percentageChange) > 20) {
      insights.push(
        `🔻 Largest decrease: ${biggestDecrease.service} (${biggestDecrease.percentageChange.toFixed(1)}%)`,
      );
    }

    // New services
    const newServices = breakdown.filter((b) => b.period1Cost === 0 && b.period2Cost > 0);
    if (newServices.length > 0) {
      insights.push(`🆕 New services in period 2: ${newServices.map((s) => s.service).join(', ')}`);
    }

    // Discontinued services
    const discontinuedServices = breakdown.filter((b) => b.period1Cost > 0 && b.period2Cost === 0);
    if (discontinuedServices.length > 0) {
      insights.push(
        `🚫 Services discontinued: ${discontinuedServices.map((s) => s.service).join(', ')}`,
      );
    }
  }

  // Provider-specific insights
  if (provider === 'aws' && percentageChange > 30) {
    insights.push('💡 Consider AWS cost optimization review due to significant increase');
  } else if (provider === 'openai' && absoluteDiff > 100) {
    insights.push('💡 Review API usage patterns for potential optimization');
  }

  return insights;
}

function generateCrossProviderInsights(
  comparisons: { provider: string; comparison: PeriodComparison }[],
): string[] {
  const insights: string[] = [];

  // Total change across all providers
  const totalPeriod1 = comparisons.reduce((sum, c) => sum + c.comparison.period1.cost, 0);
  const totalPeriod2 = comparisons.reduce((sum, c) => sum + c.comparison.period2.cost, 0);
  const totalChange = totalPeriod2 - totalPeriod1;
  const totalPercentChange = totalPeriod1 > 0 ? (totalChange / totalPeriod1) * 100 : 0;

  insights.push(
    `💰 Overall change: $${totalPeriod1.toFixed(2)} → $${totalPeriod2.toFixed(2)} (${totalPercentChange > 0 ? '+' : ''}${totalPercentChange.toFixed(1)}%)`,
  );

  // Providers with significant changes
  const increasingProviders = comparisons
    .filter((c) => c.comparison.comparison.percentageChange > 10)
    .map((c) => c.provider);

  if (increasingProviders.length > 0) {
    insights.push(`📈 Significant increases: ${increasingProviders.join(', ')}`);
  }

  const decreasingProviders = comparisons
    .filter((c) => c.comparison.comparison.percentageChange < -10)
    .map((c) => c.provider);

  if (decreasingProviders.length > 0) {
    insights.push(`📉 Significant decreases: ${decreasingProviders.join(', ')}`);
  }

  return insights;
}
