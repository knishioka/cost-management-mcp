import OpenAI from 'openai';
import type { ProviderClient, CostQueryParams, UnifiedCostData, Provider } from '../../common/types';
import { AuthenticationError, ProviderError, isRetryableError } from '../../common/errors';
import { retry, logger } from '../../common/utils';
import { getCache } from '../../common/cache';
import { transformOpenAIUsageResponse, formatOpenAIDate } from './transformer';
import type { OpenAIProviderConfig, OpenAIUsageResponse } from './types';

export class OpenAICostClient implements ProviderClient {
  private client: OpenAI;
  private cache = getCache();

  constructor(config: OpenAIProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
  }

  async getCosts(params: CostQueryParams): Promise<UnifiedCostData> {
    const cacheKey = {
      startDate: formatOpenAIDate(params.startDate),
      endDate: formatOpenAIDate(params.endDate),
      granularity: params.granularity,
    };

    const cached = await this.cache.getCostData<UnifiedCostData>('openai', cacheKey);
    if (cached) {
      logger.debug('OpenAI: Cache hit', { cacheKey });
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          source: 'cache',
        },
      };
    }

    logger.info('OpenAI: Fetching usage data', { params });

    try {
      const response = await retry(
        () => this.fetchUsageData(params),
        {
          maxAttempts: 3,
          shouldRetry: (error) => isRetryableError(error),
        },
      );

      const transformed = transformOpenAIUsageResponse(response, {
        start: params.startDate,
        end: params.endDate,
      });

      await this.cache.setCostData('openai', cacheKey, transformed);
      
      logger.info('OpenAI: Successfully fetched usage data', {
        total: transformed.costs.total,
        models: transformed.costs.breakdown.length,
      });

      return transformed;
    } catch (error) {
      logger.error('OpenAI: Failed to fetch usage data', error);
      
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          throw new AuthenticationError('openai', 'Invalid API key');
        }
        if (error.message.includes('404')) {
          throw new ProviderError(
            'openai',
            'Usage API not available. This may require a paid account.',
            'API_NOT_AVAILABLE',
          );
        }
      }
      
      throw new ProviderError(
        'openai',
        'Failed to fetch usage data',
        'OPENAI_API_ERROR',
        error,
      );
    }
  }

  private async fetchUsageData(params: CostQueryParams): Promise<OpenAIUsageResponse> {
    // OpenAI's usage API endpoint structure
    const startDate = formatOpenAIDate(params.startDate);
    const endDate = formatOpenAIDate(params.endDate);
    
    // Note: The actual endpoint might be different as the API is new
    // This is based on typical OpenAI API patterns
    const url = `https://api.openai.com/v1/usage?start_date=${startDate}&end_date=${endDate}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.client.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    return response.json() as Promise<OpenAIUsageResponse>;
  }

  async validateCredentials(): Promise<boolean> {
    try {
      // Test the API key with a simple models request
      await this.client.models.list();
      return true;
    } catch (error) {
      logger.error('OpenAI: Credential validation failed', error);
      return false;
    }
  }

  getProviderName(): Provider {
    return 'openai';
  }
}