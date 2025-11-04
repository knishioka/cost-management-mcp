import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import { ConfigurationError } from './errors';
import type { CacheConfig, LogConfig, ProviderConfig } from './types';
import { SUPPORTED_PROVIDERS } from './providers';

dotenvConfig();

const EnvSchema = z.object({
  // AWS
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().optional(),

  // Cache (optional)
  CACHE_TTL: z.coerce.number().optional(),
  CACHE_TYPE: z.enum(['memory', 'redis']).optional(),
  REDIS_URL: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // MCP Server
  MCP_SERVER_PORT: z.coerce.number().default(3000),
});

export class Config {
  private env: z.infer<typeof EnvSchema>;

  constructor() {
    const result = EnvSchema.safeParse(process.env);
    if (!result.success) {
      throw new ConfigurationError('Invalid environment configuration', result.error.issues);
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

      case 'openai':
        return {
          enabled: !!this.env.OPENAI_API_KEY,
          credentials: {
            apiKey: this.env.OPENAI_API_KEY || '',
          },
        };

      case 'anthropic':
        return {
          enabled: !!this.env.ANTHROPIC_API_KEY,
          credentials: {
            apiKey: this.env.ANTHROPIC_API_KEY || '',
          },
        };

      default:
        throw new ConfigurationError(`Unknown provider: ${provider}`);
    }
  }

  getCacheConfig(): CacheConfig | null {
    if (!this.env.CACHE_TYPE) {
      return null;
    }
    return {
      type: this.env.CACHE_TYPE,
      ttl: this.env.CACHE_TTL || 3600,
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
    return SUPPORTED_PROVIDERS.filter((provider) => {
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
