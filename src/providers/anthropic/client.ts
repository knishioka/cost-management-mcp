import type {
  ProviderClient,
  CostQueryParams,
  UnifiedCostData,
  Provider,
} from '../../common/types';
import { AuthenticationError, ProviderError, isRetryableError } from '../../common/errors';
import { retry, logger } from '../../common/utils';
import { getCacheOrDefault } from '../../common/cache';
import {
  transformAnthropicCostResponse,
  transformAnthropicUsageResponse,
  formatAnthropicDate,
} from './transformer';
import type {
  AnthropicProviderConfig,
  AnthropicCostResponse,
  AnthropicUsageResponse,
} from './types';

const ANTHROPIC_API_BASE = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';

export class AnthropicCostClient implements ProviderClient {
  private apiKey: string;
  private cache = getCacheOrDefault();

  constructor(config: AnthropicProviderConfig) {
    this.apiKey = config.apiKey;
  }

  async getCosts(params: CostQueryParams): Promise<UnifiedCostData> {
    const cacheKey = {
      startDate: formatAnthropicDate(params.startDate),
      endDate: formatAnthropicDate(params.endDate),
      granularity: params.granularity,
    };

    // Try to get from cache if available
    try {
      const cached = await this.cache.getCostData<UnifiedCostData>('anthropic', cacheKey);
      if (cached) {
        logger.debug('Anthropic: Cache hit', { cacheKey });
        return {
          ...cached,
          metadata: {
            ...cached.metadata,
            source: 'cache',
          },
        };
      }
    } catch (cacheError) {
      logger.debug('Anthropic: Cache not available or error', { error: cacheError });
    }

    logger.info('Anthropic: Fetching cost data', { params });

    try {
      // Use cost report endpoint for actual cost data
      const response = await retry(() => this.fetchCostData(params), {
        maxAttempts: 3,
        shouldRetry: (error) => isRetryableError(error),
      });

      const transformed = transformAnthropicCostResponse(response, {
        start: params.startDate,
        end: params.endDate,
      });

      // Cache the result if cache is available
      try {
        await this.cache.setCostData('anthropic', cacheKey, transformed);
      } catch (cacheError) {
        logger.warn('Anthropic: Failed to cache data', { error: cacheError });
      }

      logger.info('Anthropic: Successfully fetched cost data', {
        total: transformed.costs.total,
        services: transformed.costs.breakdown.length,
      });

      return transformed;
    } catch (error) {
      logger.error('Anthropic: Failed to fetch cost data', error);

      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          throw new AuthenticationError('anthropic', 'Invalid Admin API key');
        }
        if (error.message.includes('403')) {
          throw new ProviderError(
            'anthropic',
            'Admin API access forbidden. Ensure you are using an Admin API key (sk-ant-admin...) and have admin role in your organization.',
            'ADMIN_ACCESS_REQUIRED',
          );
        }
        if (error.message.includes('404')) {
          throw new ProviderError(
            'anthropic',
            'Cost report API not available. This requires an organization with Admin API access.',
            'API_NOT_AVAILABLE',
          );
        }
      }

      throw new ProviderError(
        'anthropic',
        'Failed to fetch cost data',
        'ANTHROPIC_API_ERROR',
        error,
      );
    }
  }

  /**
   * Fetch cost data from Anthropic's Cost Report API
   */
  private async fetchCostData(params: CostQueryParams): Promise<AnthropicCostResponse> {
    const startDate = formatAnthropicDate(params.startDate);
    const endDate = formatAnthropicDate(params.endDate);

    // Build URL with query parameters
    const url = new URL(`${ANTHROPIC_API_BASE}/v1/organizations/cost_report`);
    url.searchParams.append('starting_at', startDate);
    url.searchParams.append('ending_at', endDate);

    // Add grouping (workspace and description for detailed breakdown)
    url.searchParams.append('group_by[]', 'workspace_id');
    url.searchParams.append('group_by[]', 'description');

    const allData: AnthropicCostResponse = {
      object: 'list',
      data: [],
      has_more: false,
    };

    let nextPage: string | undefined;

    // Handle pagination
    do {
      const requestUrl = nextPage || url.toString();

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
      }

      const pageData = (await response.json()) as AnthropicCostResponse;

      allData.data.push(...pageData.data);
      allData.has_more = pageData.has_more;
      nextPage = pageData.next_page;
    } while (allData.has_more && nextPage);

    return allData;
  }

  /**
   * Fetch usage data from Anthropic's Usage Report API
   * This provides token-level details with calculated costs
   */
  async getUsageData(params: CostQueryParams): Promise<UnifiedCostData> {
    const cacheKey = {
      type: 'usage',
      startDate: formatAnthropicDate(params.startDate),
      endDate: formatAnthropicDate(params.endDate),
      granularity: params.granularity,
    };

    // Try to get from cache
    try {
      const cached = await this.cache.getCostData<UnifiedCostData>('anthropic', cacheKey);
      if (cached) {
        logger.debug('Anthropic: Usage cache hit', { cacheKey });
        return {
          ...cached,
          metadata: {
            ...cached.metadata,
            source: 'cache',
          },
        };
      }
    } catch (cacheError) {
      logger.debug('Anthropic: Usage cache not available', { error: cacheError });
    }

    logger.info('Anthropic: Fetching usage data', { params });

    try {
      const response = await retry(() => this.fetchUsageReport(params), {
        maxAttempts: 3,
        shouldRetry: (error) => isRetryableError(error),
      });

      const transformed = transformAnthropicUsageResponse(response, {
        start: params.startDate,
        end: params.endDate,
      });

      // Cache the result
      try {
        await this.cache.setCostData('anthropic', cacheKey, transformed);
      } catch (cacheError) {
        logger.warn('Anthropic: Failed to cache usage data', { error: cacheError });
      }

      logger.info('Anthropic: Successfully fetched usage data', {
        total: transformed.costs.total,
        models: transformed.costs.breakdown.length,
      });

      return transformed;
    } catch (error) {
      logger.error('Anthropic: Failed to fetch usage data', error);
      throw new ProviderError(
        'anthropic',
        'Failed to fetch usage data',
        'ANTHROPIC_USAGE_ERROR',
        error,
      );
    }
  }

  /**
   * Fetch usage report from Anthropic's Usage Report API
   */
  private async fetchUsageReport(params: CostQueryParams): Promise<AnthropicUsageResponse> {
    const startDate = formatAnthropicDate(params.startDate);
    const endDate = formatAnthropicDate(params.endDate);

    // Determine bucket width based on granularity
    const bucketWidth = params.granularity === 'monthly' ? '1d' : '1d'; // API only supports daily

    const url = new URL(`${ANTHROPIC_API_BASE}/v1/organizations/usage_report/messages`);
    url.searchParams.append('starting_at', startDate);
    url.searchParams.append('ending_at', endDate);
    url.searchParams.append('bucket_width', bucketWidth);

    // Add grouping for detailed breakdown
    url.searchParams.append('group_by[]', 'model');
    url.searchParams.append('group_by[]', 'workspace_id');

    const allData: AnthropicUsageResponse = {
      object: 'list',
      data: [],
      has_more: false,
    };

    let nextPage: string | undefined;

    // Handle pagination
    do {
      const requestUrl = nextPage || url.toString();

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
      }

      const pageData = (await response.json()) as AnthropicUsageResponse;

      allData.data.push(...pageData.data);
      allData.has_more = pageData.has_more;
      nextPage = pageData.next_page;
    } while (allData.has_more && nextPage);

    return allData;
  }

  async validateCredentials(): Promise<boolean> {
    try {
      // Test the API key with a minimal cost report request (last 24 hours)
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

      const url = new URL(`${ANTHROPIC_API_BASE}/v1/organizations/cost_report`);
      url.searchParams.append('starting_at', formatAnthropicDate(startDate));
      url.searchParams.append('ending_at', formatAnthropicDate(endDate));

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      logger.error('Anthropic: Credential validation failed', error);
      return false;
    }
  }

  getProviderName(): Provider {
    return 'anthropic';
  }
}
