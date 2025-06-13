import type { GetCostAndUsageResponse } from '@aws-sdk/client-cost-explorer';
import type { UnifiedCostData, CostBreakdown, DateRange } from '../../common/types';

export function transformAWSResponse(
  response: GetCostAndUsageResponse,
  period: DateRange,
): UnifiedCostData {
  const costBreakdown: CostBreakdown[] = [];
  let totalCost = 0;

  if (!response.ResultsByTime || response.ResultsByTime.length === 0) {
    return {
      provider: 'aws',
      period,
      costs: {
        total: 0,
        currency: 'USD',
        breakdown: [],
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'api',
      },
    };
  }

  for (const result of response.ResultsByTime) {
    if (result.Groups && result.Groups.length > 0) {
      for (const group of result.Groups) {
        const serviceName = group.Keys?.[0] || 'Unknown Service';
        const amount = parseFloat(
          group.Metrics?.['UnblendedCost']?.Amount || '0',
        );
        
        if (amount > 0) {
          const existingBreakdown = costBreakdown.find(
            item => item.service === serviceName,
          );
          
          if (existingBreakdown) {
            existingBreakdown.amount += amount;
          } else {
            costBreakdown.push({
              service: serviceName,
              amount,
              usage: group.Metrics?.['UsageQuantity'] && group.Metrics['UsageQuantity'].Unit ? {
                quantity: parseFloat(group.Metrics['UsageQuantity'].Amount || '0'),
                unit: group.Metrics['UsageQuantity'].Unit,
              } : undefined,
            });
          }
        }
      }
    } else if (result.Total) {
      const serviceName = 'Total';
      const amount = parseFloat(
        result.Total['UnblendedCost']?.Amount || '0',
      );
      
      if (amount > 0) {
        costBreakdown.push({
          service: serviceName,
          amount,
        });
      }
    }
  }

  totalCost = costBreakdown.reduce((sum, item) => sum + item.amount, 0);

  return {
    provider: 'aws',
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

export function formatAWSDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function getAWSGranularity(granularity?: string): 'DAILY' | 'MONTHLY' | 'HOURLY' {
  switch (granularity) {
    case 'daily':
      return 'DAILY';
    case 'monthly':
      return 'MONTHLY';
    default:
      return 'DAILY';
  }
}