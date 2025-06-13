import { z } from 'zod';
import type { ProviderClient, ToolResponse } from '../common/types';
import { parseDate, logger } from '../common/utils';
import { ValidationError } from '../common/errors';

const GetAWSCostsSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  granularity: z.enum(['daily', 'monthly', 'total']).optional().default('daily'),
  groupBy: z.enum(['SERVICE', 'REGION', 'INSTANCE_TYPE', 'LINKED_ACCOUNT']).array().optional(),
  service: z.string().optional(),
  includeForecast: z.boolean().optional().default(false),
});

export async function getAWSCostsTool(
  args: unknown,
  providers: Map<string, ProviderClient>,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const validation = GetAWSCostsSchema.safeParse(args);
  if (!validation.success) {
    throw new ValidationError('Invalid parameters', validation.error.errors);
  }

  const params = validation.data;
  const startDate = parseDate(params.startDate);
  const endDate = parseDate(params.endDate);

  if (startDate > endDate) {
    throw new ValidationError('Start date must be before end date');
  }

  const provider = providers.get('aws');
  if (!provider) {
    throw new ValidationError('AWS provider not configured');
  }

  try {
    logger.debug('Fetching AWS costs', params);

    const costData = await provider.getCosts({
      startDate,
      endDate,
      granularity: params.granularity,
      groupBy: params.groupBy,
    });

    // Filter by service if specified
    if (params.service) {
      costData.costs.breakdown = costData.costs.breakdown.filter((item) =>
        item.service.toLowerCase().includes(params.service!.toLowerCase()),
      );
      costData.costs.total = costData.costs.breakdown.reduce((sum, item) => sum + item.amount, 0);
    }

    // AWS specific response formatting
    const response: ToolResponse = {
      success: true,
      data: {
        ...costData,
        summary: {
          totalCost: costData.costs.total,
          currency: costData.costs.currency,
          topServices: costData.costs.breakdown
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5)
            .map((item) => ({
              service: item.service,
              cost: item.amount,
              percentage: ((item.amount / costData.costs.total) * 100).toFixed(2) + '%',
            })),
          servicesCount: costData.costs.breakdown.length,
        },
        costOptimizationTips: generateAWSCostTips(costData.costs.breakdown),
        warnings: [
          costData.costs.total > 1000 ? '⚠️ High monthly spend detected' : null,
          costData.costs.breakdown.some((s) => s.service === 'Amazon EC2' && s.amount > 500)
            ? '💡 Consider Reserved Instances or Savings Plans for EC2'
            : null,
        ].filter(Boolean),
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to fetch AWS costs', error);
    throw error;
  }
}

function generateAWSCostTips(breakdown: Array<{ service: string; amount: number }>): string[] {
  const tips: string[] = [];

  const ec2Cost = breakdown.find((s) => s.service === 'Amazon EC2')?.amount || 0;
  const s3Cost = breakdown.find((s) => s.service === 'Amazon Simple Storage Service')?.amount || 0;
  const rdsCost =
    breakdown.find((s) => s.service === 'Amazon Relational Database Service')?.amount || 0;

  if (ec2Cost > 100) {
    tips.push('Review EC2 instance utilization and right-size underutilized instances');
    tips.push('Consider using Spot Instances for fault-tolerant workloads');
  }

  if (s3Cost > 50) {
    tips.push('Enable S3 Lifecycle policies to move old data to cheaper storage classes');
    tips.push('Review and delete unused S3 buckets and objects');
  }

  if (rdsCost > 100) {
    tips.push('Consider Aurora Serverless for variable workloads');
    tips.push('Enable RDS instance stopping for development databases');
  }

  return tips;
}
