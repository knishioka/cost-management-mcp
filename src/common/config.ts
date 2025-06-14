import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import { ConfigurationError } from './errors';
import type { CacheConfig, LogConfig, ProviderConfig } from './types';

dotenvConfig();

const EnvSchema = z.object({
  // AWS
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),

  // GCP
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  GCP_BILLING_ACCOUNT_ID: z.string().optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),

  // Cache
  CACHE_TTL: z.string().transform(Number).default('3600'),
  CACHE_TYPE: z.enum(['memory', 'redis']).default('memory'),
  REDIS_URL: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // MCP Server
  MCP_SERVER_PORT: z.string().transform(Number).default('3000'),
});

export class Config {
  private env: z.infer<typeof EnvSchema>;

  constructor() {
    const result = EnvSchema.safeParse(process.env);
    if (!result.success) {
      throw new ConfigurationError('Invalid environment configuration', result.error.errors);
    }
    this.env = result.data;
  }

  getProviderConfig(provider: string): ProviderConfig {
    switch (provider) {
      case 'aws':
        return {
          enabled: !!(this.env.AWS_ACCESS_KEY_ID && this.env.AWS_SECRET_ACCESS_KEY),
          credentials: {
            accessKeyId: this.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: this.env.AWS_SECRET_ACCESS_KEY || '',
            region: this.env.AWS_REGION,
          },
        };

      case 'gcp':
        return {
          enabled: !!(this.env.GOOGLE_APPLICATION_CREDENTIALS && this.env.GCP_BILLING_ACCOUNT_ID),
          credentials: {
            keyFilename: this.env.GOOGLE_APPLICATION_CREDENTIALS || '',
            billingAccountId: this.env.GCP_BILLING_ACCOUNT_ID || '',
          },
        };

      case 'openai':
        return {
          enabled: !!this.env.OPENAI_API_KEY,
          credentials: {
            apiKey: this.env.OPENAI_API_KEY || '',
          },
        };

      default:
        throw new ConfigurationError(`Unknown provider: ${provider}`);
    }
  }

  getCacheConfig(): CacheConfig {
    return {
      type: this.env.CACHE_TYPE,
      ttl: this.env.CACHE_TTL,
      redisUrl: this.env.REDIS_URL,
    };
  }

  getLogConfig(): LogConfig {
    return {
      level: this.env.LOG_LEVEL,
      format: 'json',
    };
  }

  getServerPort(): number {
    return this.env.MCP_SERVER_PORT;
  }

  getEnabledProviders(): string[] {
    const providers = ['aws', 'gcp', 'openai'];
    return providers.filter((provider) => {
      const config = this.getProviderConfig(provider);
      return config.enabled;
    });
  }
}

let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = new Config();
  }
  return configInstance;
}
