import NodeCache from 'node-cache';
import { CacheError } from './errors';
import type { CacheConfig } from './types';

export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

export class MemoryCache implements Cache {
  private cache: NodeCache;
  private defaultTTL: number;

  constructor(config: CacheConfig) {
    this.defaultTTL = config.ttl;
    this.cache = new NodeCache({
      stdTTL: this.defaultTTL,
      checkperiod: Math.floor(this.defaultTTL * 0.2),
      useClones: true,
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      return this.cache.get<T>(key);
    } catch (error) {
      throw new CacheError(`Failed to get cache key: ${key}`, { error });
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      this.cache.set(key, value, ttl || this.defaultTTL);
    } catch (error) {
      throw new CacheError(`Failed to set cache key: ${key}`, { error });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      this.cache.del(key);
    } catch (error) {
      throw new CacheError(`Failed to delete cache key: ${key}`, { error });
    }
  }

  async clear(): Promise<void> {
    try {
      this.cache.flushAll();
    } catch (error) {
      throw new CacheError('Failed to clear cache', { error });
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      return this.cache.has(key);
    } catch (error) {
      throw new CacheError(`Failed to check cache key: ${key}`, { error });
    }
  }
}

export class CacheManager {
  private cache: Cache;
  private keyPrefix: string = 'cost-mgmt';

  constructor(config: CacheConfig) {
    if (config.type === 'memory') {
      this.cache = new MemoryCache(config);
    } else {
      throw new CacheError('Redis cache not implemented yet');
    }
  }

  private buildKey(provider: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${params[key]}`)
      .join(':');
    return `${this.keyPrefix}:${provider}:${sortedParams}`;
  }

  async getCostData<T>(provider: string, params: Record<string, any>): Promise<T | undefined> {
    const key = this.buildKey(provider, params);
    return this.cache.get<T>(key);
  }

  async setCostData<T>(
    provider: string,
    params: Record<string, any>,
    data: T,
    ttl?: number,
  ): Promise<void> {
    const key = this.buildKey(provider, params);
    await this.cache.set(key, data, ttl);
  }

  async invalidateProvider(provider: string): Promise<void> {
    const prefix = `${this.keyPrefix}:${provider}:`;
    if (this.cache instanceof MemoryCache) {
      const keys = (this.cache as any).cache.keys();
      for (const key of keys) {
        if (key.startsWith(prefix)) {
          await this.cache.delete(key);
        }
      }
    }
  }

  async clearAll(): Promise<void> {
    await this.cache.clear();
  }
}

let cacheManager: CacheManager | null = null;

export function initializeCache(config: CacheConfig): CacheManager {
  cacheManager = new CacheManager(config);
  return cacheManager;
}

export function getCache(): CacheManager | null {
  return cacheManager;
}

export function getCacheOrDefault(): CacheManager | NoOpCacheManager {
  if (!cacheManager) {
    // Return a no-op cache manager if not initialized
    return new NoOpCacheManager();
  }
  return cacheManager;
}

// No-op cache implementation that doesn't actually cache anything
export class NoOpCache implements Cache {
  async get<T>(_key: string): Promise<T | undefined> {
    return undefined;
  }

  async set<T>(_key: string, _value: T, _ttl?: number): Promise<void> {
    // Do nothing
  }

  async delete(_key: string): Promise<void> {
    // Do nothing
  }

  async clear(): Promise<void> {
    // Do nothing
  }

  async has(_key: string): Promise<boolean> {
    return false;
  }
}

export class NoOpCacheManager {
  async getCostData<T>(_provider: string, _params: Record<string, any>): Promise<T | undefined> {
    return undefined;
  }

  async setCostData<T>(
    _provider: string,
    _params: Record<string, any>,
    _data: T,
    _ttl?: number,
  ): Promise<void> {
    // No-op
  }

  async invalidateProvider(_provider: string): Promise<void> {
    // No-op
  }

  async clearAll(): Promise<void> {
    // No-op
  }
}
