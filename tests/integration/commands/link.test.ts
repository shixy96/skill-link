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

  it('rejects ambiguous relative skill paths and accepts owner/repo/path references', async () => {
    await withTempHome(async (homeDir) => {
      const aliceRepoDir = await fs.mkdtemp(path.join(tmpdir(), 'skilllink-alice-repo-'));
      const bobRepoDir = await fs.mkdtemp(path.join(tmpdir(), 'skilllink-bob-repo-'));
      const targetDir = await fs.mkdtemp(path.join(tmpdir(), 'skilllink-target-'));
      const aliceSkillDir = path.join(aliceRepoDir, 'skills', 'common');
      const bobSkillDir = path.join(bobRepoDir, 'skills', 'common');

      for (const skillDir of [aliceSkillDir, bobSkillDir]) {
        await fs.mkdir(skillDir, { recursive: true });
        await fs.writeFile(
          path.join(skillDir, 'SKILL.md'),
          [
            '---',
            'name: common',
            'description: Shared skill name',
            '---',
            '',
            'Body'
          ].join('\n'),
          'utf-8'
        );
      }

      const skilllinkDir = path.join(homeDir, '.skilllink');
      await fs.mkdir(skilllinkDir, { recursive: true });
      await fs.writeFile(
        path.join(skilllinkDir, 'repos.json'),
        JSON.stringify([
          {
            name: 'skills',
            owner: 'alice',
            path: aliceRepoDir,
            branches: ['main'],
            currentBranch: 'main'
          },
          {
            name: 'skills',
            owner: 'bob',
            path: bobRepoDir,
            branches: ['main'],
            currentBranch: 'main'
          }
        ]),
        'utf-8'
      );
      await fs.writeFile(
        path.join(skilllinkDir, 'skill-registry.json'),
        JSON.stringify({
          skills: [
            {
              id: 'alice-common',
              name: 'common',
              repo: 'alice/skills',
              path: 'skills/common',
              hasSKILLMd: true,
              symlinks: []
            },
            {
              id: 'bob-common',
              name: 'common',
              repo: 'bob/skills',
              path: 'skills/common',
              hasSKILLMd: true,
              symlinks: []
            }
          ]
        }),
        'utf-8'
      );

      const { linkCreateData } = await import('../../../src/commands/link.js');

      const ambiguous = await linkCreateData('skills/common', targetDir);
      expect(ambiguous.ok).toBe(false);
      expect(ambiguous.ok ? undefined : ambiguous.error.code).toBe('SKILL_AMBIGUOUS');

      const exact = await linkCreateData('alice/skills/skills/common', targetDir);
      expect(exact.ok).toBe(true);
      expect((await fs.lstat(path.join(targetDir, 'common'))).isSymbolicLink()).toBe(true);
    });
  });

  it('restricts Electron-driven symlink targets to configured skills directories', async () => {
    await withTempHome(async (homeDir) => {
      const repoDir = await fs.mkdtemp(path.join(tmpdir(), 'skilllink-repo-'));
      const outsideTargetDir = await fs.mkdtemp(path.join(tmpdir(), 'skilllink-outside-target-'));
      const skillDir = path.join(repoDir, 'skills', 'safe-skill');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        [
          '---',
          'name: safe-skill',
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
      await fs.writeFile(
        path.join(skilllinkDir, 'skill-registry.json'),
        JSON.stringify({
          skills: [
            {
              id: 'safe-skill',
              name: 'safe-skill',
              repo: 'acme/skills',
              path: 'skills/safe-skill',
              hasSKILLMd: true,
              symlinks: []
            }
          ]
        }),
        'utf-8'
      );

      const { linkCreateData } = await import('../../../src/commands/link.js');

      const blocked = await linkCreateData('safe-skill', outsideTargetDir, { restrictTargetToSkillsDirs: true });
      expect(blocked.ok).toBe(false);
      expect(blocked.ok ? undefined : blocked.error.code).toBe('INVALID_TARGET_PATH');

      const allowed = await linkCreateData('safe-skill', 'claude', { restrictTargetToSkillsDirs: true });
      expect(allowed.ok).toBe(true);
      expect((await fs.lstat(path.join(homeDir, '.claude', 'skills', 'safe-skill'))).isSymbolicLink()).toBe(true);
    });
  });
});
