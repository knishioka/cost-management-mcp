import { z } from 'zod';
import type { ProviderClient } from '../common/types';
import { ValidationError, NotImplementedError } from '../common/errors';

const CheckBalanceSchema = z.object({
  provider: z.string(),
});

export async function checkBalanceTool(
  args: unknown,
  providers: Map<string, ProviderClient>,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const validation = CheckBalanceSchema.safeParse(args);
  if (!validation.success) {
    throw new ValidationError('Invalid parameters', validation.error.issues);
  }

  const { provider: providerName } = validation.data;
  const provider = providers.get(providerName);

  if (!provider) {
    throw new ValidationError(`Provider ${providerName} not configured`);
  }

  throw new NotImplementedError(`Balance check for ${providerName}`);
}
