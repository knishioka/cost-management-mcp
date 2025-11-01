import { z } from 'zod';

export type Provider = 'aws' | 'openai' | 'anthropic';

export const ProviderSchema = z.enum(['aws', 'openai', 'anthropic']);

export interface DateRange {
  start: Date;
  end: Date;
}

export interface CostBreakdownMetadata {
  region?: string;
  tags?: Record<string, string>;
  [key: string]: unknown;
}

export interface CostBreakdown {
  service: string;
  amount: number;
  usage?: {
    quantity: number;
    unit: string;
  };
  date?: Date;
  metadata?: CostBreakdownMetadata;
}

export interface UnifiedCostData {
  provider: Provider;
  period: DateRange;
  costs: {
    total: number;
    currency: string;
    breakdown: CostBreakdown[];
  };
  metadata: {
    lastUpdated: Date;
    source: 'api' | 'cache' | 'manual';
  };
}

export interface CostQueryParams {
  provider?: Provider;
  startDate: Date;
  endDate: Date;
  granularity?: 'daily' | 'monthly' | 'total';
  groupBy?: string[];
}

export interface ProviderConfig {
  enabled: boolean;
  credentials: Record<string, string>;
  options?: Record<string, unknown>;
}

export interface ProviderClient {
  getCosts(params: CostQueryParams): Promise<UnifiedCostData>;
  validateCredentials(): Promise<boolean>;
  getProviderName(): Provider;
}

export interface ToolResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface CacheConfig {
  type: 'memory' | 'redis';
  ttl: number;
  redisUrl?: string;
}

export interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
}
