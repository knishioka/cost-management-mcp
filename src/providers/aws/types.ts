import type { Dimension, Granularity, Metric } from '@aws-sdk/client-cost-explorer';

export interface AWSCostData {
  TimePeriod: {
    Start: string;
    End: string;
  };
  Total: Record<string, {
    Amount: string;
    Unit: string;
  }>;
  Groups?: Array<{
    Keys: string[];
    Metrics: Record<string, {
      Amount: string;
      Unit: string;
    }>;
  }>;
}

export interface AWSQueryParams {
  TimePeriod: {
    Start: string;
    End: string;
  };
  Granularity: Granularity;
  Metrics: Metric[];
  GroupBy?: Dimension[];
}

export interface AWSProviderConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}