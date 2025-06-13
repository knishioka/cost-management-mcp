import { formatDate, parseDate, groupBy, sumBy, sleep, retry } from '../../src/common/utils';

describe('Utils', () => {
  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      expect(formatDate(date)).toBe('2024-01-15');
    });
  });

  describe('parseDate', () => {
    it('should parse valid date string', () => {
      const date = parseDate('2024-01-15');
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0); // January
      expect(date.getDate()).toBe(15);
    });

    it('should throw on invalid date', () => {
      expect(() => parseDate('invalid')).toThrow('Invalid date: invalid');
    });
  });

  describe('groupBy', () => {
    it('should group items by key function', () => {
      const items = [
        { name: 'a', type: 'x' },
        { name: 'b', type: 'y' },
        { name: 'c', type: 'x' },
      ];
      const grouped = groupBy(items, item => item.type);
      expect(grouped).toEqual({
        x: [{ name: 'a', type: 'x' }, { name: 'c', type: 'x' }],
        y: [{ name: 'b', type: 'y' }],
      });
    });
  });

  describe('sumBy', () => {
    it('should sum values correctly', () => {
      const items = [{ value: 10 }, { value: 20 }, { value: 30 }];
      expect(sumBy(items, item => item.value)).toBe(60);
    });
  });

  describe('sleep', () => {
    it('should delay execution', async () => {
      const start = Date.now();
      await sleep(100);
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(90);
      expect(duration).toBeLessThan(200);
    });
  });

  describe('retry', () => {
    it('should retry on failure', async () => {
      let attempts = 0;
      const fn = jest.fn(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Fail');
        }
        return 'success';
      });

      const result = await retry(fn, { initialDelay: 10 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts', async () => {
      const fn = jest.fn(async () => {
        throw new Error('Always fail');
      });

      await expect(retry(fn, { maxAttempts: 2, initialDelay: 10 }))
        .rejects.toThrow('Always fail');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});