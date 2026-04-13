import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { vi } from 'vitest';

export async function withTempHome<T>(fn: (homeDir: string) => Promise<T>): Promise<T> {
  const homeDir = await fs.mkdtemp(path.join(tmpdir(), 'skilllink-home-'));
  let result: T;

  vi.resetModules();
  vi.doMock('os', () => ({
    homedir: () => homeDir
  }));

  try {
    result = await fn(homeDir);
  } finally {
    vi.doUnmock('os');
    vi.resetModules();
  }

  return result;
}
