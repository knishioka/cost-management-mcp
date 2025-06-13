import { z } from 'zod';

export type Provider = 'aws' | 'gcp' | 'openai' | 'anthropic';

export const ProviderSchema = z.enum(['aws', 'gcp', 'openai', 'anthropic']);

export const DateRangeSchema = z.object({
  start: z.date(),
  end: z.date(),
});

export interface DateRange {
  start: Date;
  end: Date;
}

export const CostBreakdownSchema = z.object({
  service: z.string(),
  amount: z.number(),
  usage: z.optional(z.object({
    quantity: z.number(),
    unit: z.string(),
  })),
});

export interface CostBreakdown {
  service: string;
  amount: number;
  usage?: {
    quantity: number;
    unit: string;
  };
}

export const UnifiedCostDataSchema = z.object({
  provider: ProviderSchema,
  period: DateRangeSchema,
  costs: z.object({
    total: z.number(),
    currency: z.string(),
    breakdown: z.array(CostBreakdownSchema),
  }),
  metadata: z.object({
    lastUpdated: z.date(),
    source: z.enum(['api', 'cache', 'manual']),
  }),
});

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

export const CostQueryParamsSchema = z.object({
  provider: ProviderSchema.optional(),
  startDate: z.date(),
  endDate: z.date(),
  granularity: z.enum(['daily', 'monthly', 'total']).optional().default('total'),
  groupBy: z.array(z.string()).optional(),
});

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

export const ToolResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
});

export interface ToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
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