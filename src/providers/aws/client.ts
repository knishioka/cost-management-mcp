import type {
  GetCostAndUsageCommandInput,
  CostExplorerClientConfig} from '@aws-sdk/client-cost-explorer';
import {
  CostExplorerClient,
  GetCostAndUsageCommand
} from '@aws-sdk/client-cost-explorer';
import type {
  ProviderClient,
  CostQueryParams,
  UnifiedCostData,
  Provider,
} from '../../common/types';
import { AuthenticationError, ProviderError, isRetryableError } from '../../common/errors';
import { retry, logger } from '../../common/utils';
import { getCacheOrDefault } from '../../common/cache';
import { transformAWSResponse, formatAWSDate, getAWSGranularity } from './transformer';
import type { AWSProviderConfig } from './types';

export class AWSCostClient implements ProviderClient {
  private client: CostExplorerClient;
  private cache = getCacheOrDefault();

  constructor(config: AWSProviderConfig) {
    const clientConfig: CostExplorerClientConfig = {
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    };

    this.client = new CostExplorerClient(clientConfig);
  }

  async getCosts(params: CostQueryParams): Promise<UnifiedCostData> {
    const cacheKey = {
      startDate: formatAWSDate(params.startDate),
      endDate: formatAWSDate(params.endDate),
      granularity: params.granularity,
      groupBy: params.groupBy,
    };

    // Try to get from cache if available
    try {
      const cached = await this.cache.getCostData<UnifiedCostData>('aws', cacheKey);
      if (cached) {
        logger.debug('AWS: Cache hit', { cacheKey });
        return {
          ...cached,
          metadata: {
            ...cached.metadata,
            source: 'cache',
          },
        };
      }
    } catch (cacheError) {
      logger.debug('AWS: Cache not available or error', { error: cacheError });
    }

    logger.info('AWS: Fetching cost data', { params });

    try {
      const response = await retry(() => this.fetchCostData(params), {
        maxAttempts: 3,
        shouldRetry: (error) => isRetryableError(error),
      });

      const transformed = transformAWSResponse(response, {
        start: params.startDate,
        end: params.endDate,
      });

      // Cache the result if cache is available
      try {
        await this.cache.setCostData('aws', cacheKey, transformed);
      } catch (cacheError) {
        logger.warn('AWS: Failed to cache data', { error: cacheError });
      }

      logger.info('AWS: Successfully fetched cost data', {
        total: transformed.costs.total,
        services: transformed.costs.breakdown.length,
      });

      return transformed;
    } catch (error) {
      logger.error('AWS: Failed to fetch cost data', error);

      if (error instanceof Error && error.name === 'UnrecognizedClientException') {
        throw new AuthenticationError('aws', 'Invalid AWS credentials');
      }

      throw new ProviderError('aws', 'Failed to fetch cost data', 'AWS_API_ERROR', error);
    }
  }

  private async fetchCostData(params: CostQueryParams): Promise<any> {
    const input: GetCostAndUsageCommandInput = {
      TimePeriod: {
        Start: formatAWSDate(params.startDate),
        End: formatAWSDate(params.endDate),
      },
      Granularity: getAWSGranularity(params.granularity),
      Metrics: ['UnblendedCost', 'UsageQuantity'],
      GroupBy: params.groupBy?.map((dimension) => ({
        Type: 'DIMENSION',
        Key: dimension.toUpperCase(),
      })) || [
        {
          Type: 'DIMENSION',
          Key: 'SERVICE',
        },
      ],
    };

    const command = new GetCostAndUsageCommand(input);
    return this.client.send(command);
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const testParams: CostQueryParams = {
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(),
        granularity: 'daily',
      };

      await this.fetchCostData(testParams);
      return true;
    } catch (error) {
      logger.error('AWS: Credential validation failed', error);
      return false;
    }
  }

  getProviderName(): Provider {
    return 'aws';
  }
}
