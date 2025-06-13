export interface GCPBillingAccount {
  name: string;
  open: boolean;
  displayName: string;
  masterBillingAccount?: string;
}

export interface GCPService {
  name: string;
  serviceId: string;
  displayName: string;
  businessEntityName: string;
}

export interface GCPSku {
  name: string;
  skuId: string;
  description: string;
  category: {
    serviceDisplayName: string;
    resourceFamily: string;
    resourceGroup: string;
    usageType: string;
  };
  serviceRegions: string[];
  pricingInfo: Array<{
    summary: string;
    pricingExpression: {
      usageUnit: string;
      displayQuantity: number;
      tieredRates: Array<{
        startUsageAmount: number;
        unitPrice: {
          currencyCode: string;
          units: string;
          nanos: number;
        };
      }>;
    };
    currencyConversionRate: number;
    effectiveTime: string;
  }>;
  serviceProviderName: string;
}

export interface GCPCostEstimateResponse {
  costEstimation: {
    segmentCostEstimates: Array<{
      segmentStartTime: string;
      segmentTotalCostEstimate: {
        currencyCode: string;
        units: string;
        nanos: number;
      };
      workloadCostEstimates: Array<{
        name: string;
        skuCostEstimates: Array<{
          sku: string;
          usageAmount: number;
          usageUnit: string;
          costEstimate: {
            currencyCode: string;
            units: string;
            nanos: number;
          };
        }>;
      }>;
    }>;
  };
}

export interface GCPProviderConfig {
  keyFilename: string;
  billingAccountId: string;
}