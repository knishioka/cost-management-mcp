import { z } from 'zod';
import type { CostBreakdown, ProviderClient, UnifiedCostData } from '../common/types';
import { parseDate, logger, resolveProviderName } from '../common/utils';
import { ValidationError } from '../common/errors';

const GetCostBreakdownSchema = z.object({
  provider: z.enum(['aws', 'gcp', 'openai']).optional(),
  startDate: z.string(),
  endDate: z.string(),
  dimensions: z.array(z.enum(['service', 'region', 'date', 'tag'])).default(['service']),
  topN: z.number().min(1).max(100).default(10),
  threshold: z.number().min(0).max(100).optional(),
});

interface BreakdownItem {
  key: string;
  value: number;
  percentage: number;
  subBreakdown?: BreakdownItem[];
}

interface BreakdownAnalysis {
  provider: string;
  period: { start: Date; end: Date };
  totalCost: number;
  currency: string;
  breakdown: BreakdownItem[];
  insights: string[];
  metadata: {
    dimensionsAnalyzed: string[];
    itemsIncluded: number;
    coveragePercentage: number;
  };
}

export async function getCostBreakdownTool(
  args: unknown,
  providers: Map<string, ProviderClient>,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const params = GetCostBreakdownSchema.parse(args);
  const startDate = parseDate(params.startDate);
  const endDate = parseDate(params.endDate);

  if (startDate >= endDate) {
    throw new ValidationError('Start date must be before end date');
  }

  // If specific provider requested
  if (params.provider) {
    const provider = providers.get(params.provider);
    if (!provider) {
      throw new ValidationError(`Provider ${params.provider} not configured`);
    }

    const analysis = await analyzeBreakdown(
      provider,
      startDate,
      endDate,
      params.dimensions,
      params.topN,
      params.threshold,
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              data: analysis,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  // Analyze breakdown for all providers
  const allAnalyses: BreakdownAnalysis[] = [];

  for (const [name, provider] of providers) {
    try {
      const analysis = await analyzeBreakdown(
        provider,
        startDate,
        endDate,
        params.dimensions,
        params.topN,
        params.threshold,
      );
      allAnalyses.push(analysis);
    } catch (error) {
      logger.error(`Failed to analyze breakdown for ${name}`, error);
    }
  }

  const crossProviderInsights = generateCrossProviderInsights(allAnalyses);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: true,
            data: {
              providers: allAnalyses,
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

async function analyzeBreakdown(
  provider: ProviderClient,
  startDate: Date,
  endDate: Date,
  dimensions: string[],
  topN: number,
  threshold?: number,
): Promise<BreakdownAnalysis> {
  // For AWS, we can request specific groupBy dimensions
  const groupBy = dimensions.includes('service')
    ? ['SERVICE']
    : dimensions.includes('region')
      ? ['REGION']
      : undefined;

  const costData = await provider.getCosts({
    startDate,
    endDate,
    granularity: 'total',
    groupBy,
  });

  const breakdown = calculateBreakdown(costData, dimensions, topN, threshold);
  const providerName = resolveProviderName(provider);
  const insights = generateBreakdownInsights(breakdown, costData, providerName);

  const includedCost = breakdown.reduce((sum, item) => sum + item.value, 0);
  const coveragePercentage = (includedCost / costData.costs.total) * 100;

  return {
    provider: providerName,
    period: { start: startDate, end: endDate },
    totalCost: costData.costs.total,
    currency: costData.costs.currency,
    breakdown,
    insights,
    metadata: {
      dimensionsAnalyzed: dimensions,
      itemsIncluded: breakdown.length,
      coveragePercentage,
    },
  };
}

function calculateBreakdown(
  costData: UnifiedCostData,
  dimensions: string[],
  topN: number,
  threshold?: number,
): BreakdownItem[] {
  // Group costs by the first dimension
  const primaryDimension = dimensions[0];
  const grouped = new Map<string, number>();

  for (const item of costData.costs.breakdown) {
    let key: string;

    switch (primaryDimension) {
      case 'service':
        key = item.service || 'Unknown Service';
        break;
      case 'region':
        key = item.metadata?.region || 'Global';
        break;
      case 'date':
        key = item.date?.toISOString().split('T')[0] || 'Unknown Date';
        break;
      case 'tag':
        key = item.metadata?.tags?.project || 'Untagged';
        break;
      default:
        key = 'Unknown';
    }

    grouped.set(key, (grouped.get(key) || 0) + item.amount);
  }

  // Convert to array and sort by value
  let items: BreakdownItem[] = Array.from(grouped.entries())
    .map(([key, value]) => ({
      key,
      value,
      percentage: (value / costData.costs.total) * 100,
    }))
    .sort((a, b) => b.value - a.value);

  // Apply threshold filter if specified
  if (threshold !== undefined) {
    items = items.filter((item) => item.percentage >= threshold);
  }

  // Apply topN limit
  items = items.slice(0, topN);

  // If we have multiple dimensions, recursively calculate sub-breakdowns
  if (dimensions.length > 1) {
    for (const item of items) {
      // Filter cost data for this item and calculate sub-breakdown
      const filteredData = filterCostData(costData, primaryDimension, item.key);
      if (filteredData.costs.breakdown.length > 0) {
        item.subBreakdown = calculateBreakdown(
          filteredData,
          dimensions.slice(1),
          5, // Limit sub-breakdowns to top 5
          undefined,
        );
      }
    }
  }

  return items;
}

function filterCostData(
  costData: UnifiedCostData,
  dimension: string,
  value: string,
): UnifiedCostData {
  const filtered = costData.costs.breakdown.filter((item: CostBreakdown) => {
    switch (dimension) {
      case 'service':
        return (item.service || 'Unknown Service') === value;
      case 'region':
        return (item.metadata?.region || 'Global') === value;
      case 'date':
        return item.date?.toISOString().split('T')[0] === value;
      case 'tag':
        return (item.metadata?.tags?.project || 'Untagged') === value;
      default:
        return false;
    }
  });

  const total = filtered.reduce((sum, item) => sum + item.amount, 0);

  return {
    ...costData,
    costs: {
      ...costData.costs,
      total,
      breakdown: filtered,
    },
  };
}

function generateBreakdownInsights(
  breakdown: BreakdownItem[],
  costData: UnifiedCostData,
  provider: string,
): string[] {
  const insights: string[] = [];

  // Top cost driver
  if (breakdown.length > 0) {
    const topItem = breakdown[0];
    insights.push(
      `🎯 Top cost driver: ${topItem.key} ($${topItem.value.toFixed(2)}, ${topItem.percentage.toFixed(1)}%)`,
    );
  }

  // Concentration analysis
  const top3Percentage = breakdown.slice(0, 3).reduce((sum, item) => sum + item.percentage, 0);
  if (top3Percentage > 80) {
    insights.push(
      `📊 High concentration: Top 3 items account for ${top3Percentage.toFixed(1)}% of costs`,
    );
  }

  // Long tail analysis
  const itemsUnder5Percent = breakdown.filter((item) => item.percentage < 5).length;
  if (itemsUnder5Percent > 5) {
    insights.push(`🏷️ Long tail: ${itemsUnder5Percent} items each contribute <5% of total cost`);
  }

  // Cost distribution
  if (breakdown.length > 1) {
    const variance = calculateVariance(breakdown.map((item) => item.value));
    const mean = costData.costs.total / breakdown.length;
    const cv = (Math.sqrt(variance) / mean) * 100;

    if (cv > 100) {
      insights.push('⚠️ Highly uneven cost distribution across items');
    } else if (cv < 30) {
      insights.push('✅ Relatively even cost distribution');
    }
  }

  // Service-specific insights
  if (provider === 'aws' && breakdown[0]?.key.includes('EC2')) {
    insights.push('💡 EC2 is your largest cost - consider Reserved Instances');
  } else if (provider === 'openai' && breakdown[0]?.key.includes('gpt-4')) {
    insights.push('💡 GPT-4 usage is high - consider GPT-3.5 for suitable tasks');
  }

  return insights;
}

function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
}

function generateCrossProviderInsights(analyses: BreakdownAnalysis[]): string[] {
  const insights: string[] = [];

  // Total cost across providers
  const totalCost = analyses.reduce((sum, a) => sum + a.totalCost, 0);
  insights.push(`💰 Total cost across all providers: $${totalCost.toFixed(2)}`);

  // Find common top services across providers
  const topServices = new Map<string, number>();
  for (const analysis of analyses) {
    if (analysis.metadata.dimensionsAnalyzed.includes('service')) {
      for (const item of analysis.breakdown.slice(0, 3)) {
        topServices.set(item.key, (topServices.get(item.key) || 0) + 1);
      }
    }
  }

  const commonServices = Array.from(topServices.entries())
    .filter(([_, count]) => count > 1)
    .map(([service]) => service);

  if (commonServices.length > 0) {
    insights.push(`🔄 Common high-cost services: ${commonServices.join(', ')}`);
  }

  return insights;
}
