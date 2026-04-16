import fs from 'fs/promises';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { withTempHome } from '../helpers/temp-home.js';

describe('symlink-manager', () => {
  it('detects active and broken symlinks and updates the destination path', async () => {
    await withTempHome(async () => {
      const skillDir = await fs.mkdtemp(path.join('/tmp', 'skilllink-skill-'));
      const linkDir = await fs.mkdtemp(path.join('/tmp', 'skilllink-link-'));

      const { createSymlink, checkSymlinkStatus, updateSymlink, isSymlink } = await import('../../../src/lib/symlink-manager.js');

      const originalLink = path.join(linkDir, 'active-skill');
      const updatedLink = path.join(linkDir, 'updated-skill');

      const createResult = await createSymlink(skillDir, originalLink);
      expect(createResult.success).toBe(true);
      expect(await isSymlink(originalLink)).toBe(true);
      expect(await checkSymlinkStatus(originalLink)).toBe('active');

      await fs.rm(skillDir, { recursive: true, force: true });
      expect(await checkSymlinkStatus(originalLink)).toBe('broken');

      const updateResult = await updateSymlink(skillDir, originalLink, updatedLink);
      expect(updateResult.success).toBe(true);
      expect(await isSymlink(originalLink)).toBe(false);
      expect(await isSymlink(updatedLink)).toBe(true);
      expect(await checkSymlinkStatus(updatedLink)).toBe('broken');
    });
  });

  it('keeps the old symlink when update target collides with an existing directory', async () => {
    await withTempHome(async () => {
      const skillDir = await fs.mkdtemp(path.join('/tmp', 'skilllink-skill-'));
      const linkDir = await fs.mkdtemp(path.join('/tmp', 'skilllink-link-'));

      const { createSymlink, updateSymlink, isSymlink } = await import('../../../src/lib/symlink-manager.js');

      const originalLink = path.join(linkDir, 'active-skill');
      const blockedTarget = path.join(linkDir, 'blocked-skill');
      await fs.mkdir(blockedTarget);

      const createResult = await createSymlink(skillDir, originalLink);
      expect(createResult.success).toBe(true);

      const updateResult = await updateSymlink(skillDir, originalLink, blockedTarget);
      expect(updateResult.success).toBe(false);
      expect(updateResult.error?.code).toBe('SYMLINK_NOT_SYMLINK');
      expect(await isSymlink(originalLink)).toBe(true);
      expect(await isSymlink(blockedTarget)).toBe(false);
    });
  });
});
