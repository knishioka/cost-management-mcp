import OpenAI from 'openai';
import type {
  ProviderClient,
  CostQueryParams,
  UnifiedCostData,
  Provider,
} from '../../common/types';
import { AuthenticationError, ProviderError, isRetryableError } from '../../common/errors';
import { retry, logger } from '../../common/utils';
import { getCacheOrDefault } from '../../common/cache';
import { transformOpenAIUsageResponse, formatOpenAIDate } from './transformer';
import type { OpenAIProviderConfig, OpenAIUsageResponse } from './types';

export class OpenAICostClient implements ProviderClient {
  private client: OpenAI;
  private cache = getCacheOrDefault();

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

    // Try to get from cache if available
    try {
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
    } catch (cacheError) {
      logger.debug('OpenAI: Cache not available or error', { error: cacheError });
    }

    logger.info('OpenAI: Fetching usage data', { params });

    try {
      const response = await retry(() => this.fetchUsageData(params), {
        maxAttempts: 3,
        shouldRetry: (error) => isRetryableError(error),
      });

      const transformed = transformOpenAIUsageResponse(response, {
        start: params.startDate,
        end: params.endDate,
      });

      // Cache the result if cache is available
      try {
        await this.cache.setCostData('openai', cacheKey, transformed);
      } catch (cacheError) {
        logger.warn('OpenAI: Failed to cache data', { error: cacheError });
      }

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

      throw new ProviderError('openai', 'Failed to fetch usage data', 'OPENAI_API_ERROR', error);
    }
  }

  private async fetchUsageData(params: CostQueryParams): Promise<OpenAIUsageResponse> {
    // OpenAI's usage API uses single date parameter, not date ranges
    // We need to aggregate data across multiple days
    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);
    const allData: any[] = [];

    // Iterate through each day in the range
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateStr = formatOpenAIDate(date);
      const url = `https://api.openai.com/v1/usage?date=${dateStr}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.client.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
      }

      const dayData = (await response.json()) as any;
      if (dayData.data && Array.isArray(dayData.data)) {
        allData.push(...dayData.data);
      }
    }

    return {
      object: 'list',
      data: allData,
      has_more: false,
    } as OpenAIUsageResponse;
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
