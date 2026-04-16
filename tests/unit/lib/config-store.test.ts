import { describe, expect, it } from 'vitest';

import { withTempHome } from '../helpers/temp-home.js';

describe('config-store', () => {
  it('rejects prototype pollution keys', async () => {
    await withTempHome(async () => {
      const { setConfig } = await import('../../../src/lib/config-store.js');

      await expect(setConfig('__proto__.polluted', true)).rejects.toThrow('Invalid config key');
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
  });
});
