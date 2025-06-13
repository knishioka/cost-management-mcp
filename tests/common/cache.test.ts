import { MemoryCache, CacheManager } from '../../src/common/cache';
import type { CacheConfig } from '../../src/common/types';

describe('Cache', () => {
  describe('MemoryCache', () => {
    let cache: MemoryCache;
    const config: CacheConfig = {
      type: 'memory',
      ttl: 60, // 1 minute
    };

    beforeEach(() => {
      cache = new MemoryCache(config);
    });

    it('should store and retrieve values', async () => {
      await cache.set('test-key', { value: 'test-data' });
      const result = await cache.get('test-key');
      expect(result).toEqual({ value: 'test-data' });
    });

    it('should return undefined for non-existent keys', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeUndefined();
    });

    it('should delete keys', async () => {
      await cache.set('test-key', 'test-value');
      await cache.delete('test-key');
      const result = await cache.get('test-key');
      expect(result).toBeUndefined();
    });

    it('should check if key exists', async () => {
      await cache.set('test-key', 'test-value');
      expect(await cache.has('test-key')).toBe(true);
      expect(await cache.has('non-existent')).toBe(false);
    });

    it('should clear all keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.clear();
      expect(await cache.has('key1')).toBe(false);
      expect(await cache.has('key2')).toBe(false);
    });
  });

  describe('CacheManager', () => {
    let cacheManager: CacheManager;
    const config: CacheConfig = {
      type: 'memory',
      ttl: 60,
    };

    beforeEach(() => {
      cacheManager = new CacheManager(config);
    });

    it('should build consistent cache keys', async () => {
      const params = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        granularity: 'daily',
      };

      await cacheManager.setCostData('aws', params, { test: 'data' });
      const result = await cacheManager.getCostData('aws', params);
      expect(result).toEqual({ test: 'data' });
    });

    it('should build same key for same params in different order', async () => {
      const params1 = { a: '1', b: '2' };
      const params2 = { b: '2', a: '1' };

      await cacheManager.setCostData('aws', params1, { test: 'data' });
      const result = await cacheManager.getCostData('aws', params2);
      expect(result).toEqual({ test: 'data' });
    });

    it('should invalidate provider cache', async () => {
      await cacheManager.setCostData('aws', { key: '1' }, { data: 'aws1' });
      await cacheManager.setCostData('aws', { key: '2' }, { data: 'aws2' });
      await cacheManager.setCostData('gcp', { key: '1' }, { data: 'gcp1' });

      await cacheManager.invalidateProvider('aws');

      expect(await cacheManager.getCostData('aws', { key: '1' })).toBeUndefined();
      expect(await cacheManager.getCostData('aws', { key: '2' })).toBeUndefined();
      expect(await cacheManager.getCostData('gcp', { key: '1' })).toEqual({ data: 'gcp1' });
    });
  });
});