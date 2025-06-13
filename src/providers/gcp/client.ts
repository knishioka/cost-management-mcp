import { CloudBillingClient } from '@google-cloud/billing';
import type { ProviderClient, CostQueryParams, UnifiedCostData, Provider } from '../../common/types';
import { AuthenticationError, ProviderError, isRetryableError } from '../../common/errors';
import { retry, logger } from '../../common/utils';
import { getCache } from '../../common/cache';
import { transformGCPResponse, formatGCPDate } from './transformer';
import type { GCPProviderConfig } from './types';

export class GCPCostClient implements ProviderClient {
  private client: CloudBillingClient;
  private billingAccountId: string;
  private cache = getCache();

  constructor(config: GCPProviderConfig) {
    this.client = new CloudBillingClient({
      keyFilename: config.keyFilename,
    });
    this.billingAccountId = config.billingAccountId;
  }

  async getCosts(params: CostQueryParams): Promise<UnifiedCostData> {
    const cacheKey = {
      startDate: formatGCPDate(params.startDate),
      endDate: formatGCPDate(params.endDate),
      granularity: params.granularity,
      groupBy: params.groupBy,
    };

    const cached = await this.cache.getCostData<UnifiedCostData>('gcp', cacheKey);
    if (cached) {
      logger.debug('GCP: Cache hit', { cacheKey });
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          source: 'cache',
        },
      };
    }

    logger.info('GCP: Fetching cost data', { params });

    try {
      // Note: GCP Billing API v1 doesn't have a direct cost retrieval endpoint
      // We need to use BigQuery Export or Cloud Billing Budget API
      // For now, we'll use a placeholder that could be replaced with actual implementation
      
      const response = await retry(
        () => this.fetchCostData(params),
        {
          maxAttempts: 3,
          shouldRetry: (error) => isRetryableError(error),
        },
      );

      const transformed = transformGCPResponse(response, {
        start: params.startDate,
        end: params.endDate,
      });

      await this.cache.setCostData('gcp', cacheKey, transformed);
      
      logger.info('GCP: Successfully fetched cost data', {
        total: transformed.costs.total,
        services: transformed.costs.breakdown.length,
      });

      return transformed;
    } catch (error) {
      logger.error('GCP: Failed to fetch cost data', error);
      
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Unauthenticated')) {
          throw new AuthenticationError('gcp', 'Invalid credentials or permissions');
        }
        if (error.message.includes('403')) {
          throw new AuthenticationError('gcp', 'Insufficient permissions for billing data');
        }
      }
      
      throw new ProviderError(
        'gcp',
        'Failed to fetch cost data',
        'GCP_API_ERROR',
        error,
      );
    }
  }

  private async fetchCostData(_params: CostQueryParams): Promise<any> {
    // In a real implementation, you would:
    // 1. Use BigQuery to query exported billing data
    // 2. Or use Cloud Billing Budgets API to get budget information
    // 3. Or use Cost Estimation API (beta)
    
    // For now, we'll throw a not implemented error
    throw new ProviderError(
      'gcp',
      'GCP cost retrieval requires BigQuery export setup. Please refer to the documentation.',
      'NOT_IMPLEMENTED',
    );
  }

  async validateCredentials(): Promise<boolean> {
    try {
      // Test credentials by getting billing account info
      const [account] = await this.client.getBillingAccount({
        name: `billingAccounts/${this.billingAccountId}`,
      });
      
      return account.open === true;
    } catch (error) {
      logger.error('GCP: Credential validation failed', error);
      return false;
    }
  }

  getProviderName(): Provider {
    return 'gcp';
  }
}