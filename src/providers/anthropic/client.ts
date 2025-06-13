import type { ProviderClient, CostQueryParams, UnifiedCostData, Provider } from '../../common/types';
import { logger } from '../../common/utils';
import { createPlaceholderResponse } from './transformer';
import type { AnthropicProviderConfig } from './types';

export class AnthropicCostClient implements ProviderClient {
  constructor(private config: AnthropicProviderConfig) {
    logger.warn('Anthropic: No billing API available. Using placeholder implementation.');
  }

  async getCosts(params: CostQueryParams): Promise<UnifiedCostData> {
    logger.info('Anthropic: No API available for cost data', { params });
    
    // Return a placeholder response
    const response = createPlaceholderResponse({
      start: params.startDate,
      end: params.endDate,
    });

    logger.info(
      'Anthropic: Please check the Anthropic Console for actual usage data: https://console.anthropic.com/usage',
    );

    return response;
  }

  async validateCredentials(): Promise<boolean> {
    // Since there's no billing API, we can't validate credentials for billing purposes
    // In a real implementation, you might test the API key with a small request
    return this.config.apiKey.length > 0;
  }

  getProviderName(): Provider {
    return 'anthropic';
  }
}