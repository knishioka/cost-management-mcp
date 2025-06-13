import type { UnifiedCostData, DateRange } from '../../common/types';

export function createPlaceholderResponse(period: DateRange): UnifiedCostData {
  return {
    provider: 'anthropic',
    period,
    costs: {
      total: 0,
      currency: 'USD',
      breakdown: [],
    },
    metadata: {
      lastUpdated: new Date(),
      source: 'manual',
    },
  };
}