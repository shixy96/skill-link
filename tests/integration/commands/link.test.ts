import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { describe, expect, it } from 'vitest';

import { withTempHome } from '../../unit/helpers/temp-home.js';

describe('link command integration', () => {
  it('creates a link from an absolute skill path inside a managed repo and stores a relative registry path', async () => {
    await withTempHome(async (homeDir) => {
      const repoDir = await fs.mkdtemp(path.join(tmpdir(), 'skilllink-repo-'));
      const targetDir = await fs.mkdtemp(path.join(tmpdir(), 'skilllink-target-'));
      const skillDir = path.join(repoDir, 'skills', 'hello-skill');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        [
          '---',
          'name: hello-skill',
          'description: Test skill',
          '---',
          '',
          'Body'
        ].join('\n'),
        'utf-8'
      );

      const skilllinkDir = path.join(homeDir, '.skilllink');
      await fs.mkdir(skilllinkDir, { recursive: true });
      await fs.writeFile(
        path.join(skilllinkDir, 'repos.json'),
        JSON.stringify([
          {
            name: 'skills',
            owner: 'acme',
            path: repoDir,
            branches: ['main'],
            currentBranch: 'main'
          }
        ]),
        'utf-8'
      );

      const { linkCreateData } = await import('../../../src/commands/link.js');
      const result = await linkCreateData(skillDir, targetDir);

      expect(result.ok).toBe(true);
      expect((await fs.lstat(path.join(targetDir, 'hello-skill'))).isSymbolicLink()).toBe(true);

      const registry = JSON.parse(await fs.readFile(path.join(skilllinkDir, 'skill-registry.json'), 'utf-8'));
      expect(registry.skills[0]).toMatchObject({
        name: 'hello-skill',
        repo: 'acme/skills',
        path: 'skills/hello-skill'
      });
    });
  });
});
