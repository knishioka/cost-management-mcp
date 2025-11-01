import type { ProviderClient, ToolResponse } from '../common/types';
import { logger } from '../common/utils';
import { SUPPORTED_PROVIDERS } from '../common/providers';

export async function listProvidersTool(
  providers: Map<string, ProviderClient>,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const providerList = [];

  const remainingProviders = new Set<string>(SUPPORTED_PROVIDERS);

  for (const [name, provider] of providers) {
    if (!remainingProviders.has(name)) {
      logger.warn(`Provider ${name} is not recognized as a supported provider`);
    }

    remainingProviders.delete(name);

    try {
      const isValid = await provider.validateCredentials();
      providerList.push({
        name,
        status: isValid ? 'active' : 'invalid_credentials',
        configured: true,
      });
    } catch (error) {
      logger.error(`Failed to validate ${name} credentials`, error);
      providerList.push({
        name,
        status: 'error',
        configured: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  for (const name of remainingProviders) {
    providerList.push({
      name,
      status: 'not_configured',
      configured: false,
    });
  }

  const response: ToolResponse = {
    success: true,
    data: {
      providers: providerList,
      configured: providerList.filter((p) => p.configured).length,
      total: providerList.length,
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
}
