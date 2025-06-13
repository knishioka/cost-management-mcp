import type { UnifiedCostData, CostBreakdown, DateRange } from '../../common/types';
import type { GCPCostEstimateResponse } from './types';

export function transformGCPResponse(
  response: GCPCostEstimateResponse,
  period: DateRange,
): UnifiedCostData {
  const costBreakdown: CostBreakdown[] = [];
  const serviceCosts = new Map<string, { amount: number; usage?: { quantity: number; unit: string } }>();

  // Aggregate costs by service
  if (response.costEstimation?.segmentCostEstimates) {
    for (const segment of response.costEstimation.segmentCostEstimates) {
      for (const workload of segment.workloadCostEstimates || []) {
        for (const skuEstimate of workload.skuCostEstimates || []) {
          // Parse the SKU to get service name
          const serviceName = parseServiceFromSku(skuEstimate.sku);
          
          // Convert cost from units + nanos to decimal
          const cost = parseGCPMoney(skuEstimate.costEstimate);
          
          const existing = serviceCosts.get(serviceName) || { amount: 0 };
          serviceCosts.set(serviceName, {
            amount: existing.amount + cost,
            usage: skuEstimate.usageAmount > 0 ? {
              quantity: skuEstimate.usageAmount,
              unit: skuEstimate.usageUnit,
            } : existing.usage,
          });
        }
      }
    }
  }

  // Convert to breakdown format
  for (const [service, data] of serviceCosts) {
    if (data.amount > 0) {
      costBreakdown.push({
        service,
        amount: data.amount,
        usage: data.usage,
      });
    }
  }

  const totalCost = costBreakdown.reduce((sum, item) => sum + item.amount, 0);

  return {
    provider: 'gcp',
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

function parseGCPMoney(money: { units?: string; nanos?: number }): number {
  const units = parseInt(money.units || '0', 10);
  const nanos = money.nanos || 0;
  return units + (nanos / 1_000_000_000);
}

function parseServiceFromSku(sku: string): string {
  // GCP SKU format: services/{service}/skus/{skuId}
  const match = sku.match(/services\/([^/]+)/);
  if (match) {
    // Convert service ID to readable name
    return match[1]
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  return 'Unknown Service';
}

export function formatGCPDate(date: Date): string {
  return date.toISOString();
}