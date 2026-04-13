import fs from 'fs/promises';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { withTempHome } from '../helpers/temp-home.js';

describe('skill-registry', () => {
  it('replaces stale repo skills while preserving IDs and symlinks for unchanged paths', async () => {
    await withTempHome(async (homeDir) => {
      const registryDir = path.join(homeDir, '.skilllink');
      await fs.mkdir(registryDir, { recursive: true });

      const registryPath = path.join(registryDir, 'skill-registry.json');
      await fs.writeFile(
        registryPath,
        JSON.stringify(
          {
            skills: [
              {
                id: 'keep-id',
                name: 'keep-skill',
                repo: 'acme/skills',
                path: '/repo/keep',
                hasSKILLMd: true,
                symlinks: [
                  {
                    target: '/Users/me/.claude/skills/keep-skill',
                    createdAt: '2026-04-02T00:00:00.000Z',
                    status: 'active'
                  }
                ]
              },
              {
                id: 'drop-id',
                name: 'drop-skill',
                repo: 'acme/skills',
                path: '/repo/drop',
                hasSKILLMd: true,
                symlinks: []
              },
              {
                id: 'other-id',
                name: 'other-repo-skill',
                repo: 'other/skills',
                path: '/repo/other',
                hasSKILLMd: true,
                symlinks: []
              }
            ]
          },
          null,
          2
        ),
        'utf-8'
      );

      const { replaceSkillsForRepo, getRegistry } = await import('../../../src/lib/skill-registry.js');

      const nextSkills = await replaceSkillsForRepo('acme/skills', [
        {
          name: 'keep-skill',
          repo: 'acme/skills',
          path: '/repo/keep',
          hasSKILLMd: true
        },
        {
          name: 'new-skill',
          repo: 'acme/skills',
          path: '/repo/new',
          hasSKILLMd: true
        }
      ]);

      expect(nextSkills).toHaveLength(2);
      expect(nextSkills[0]).toMatchObject({
        id: 'keep-id',
        name: 'keep-skill',
        path: '/repo/keep',
        symlinks: [
          {
            target: '/Users/me/.claude/skills/keep-skill',
            createdAt: '2026-04-02T00:00:00.000Z',
            status: 'active'
          }
        ]
      });
      expect(nextSkills[1].id).toBeDefined();
      expect(nextSkills[1].symlinks).toEqual([]);

      const registry = await getRegistry();
      expect(registry.skills).toHaveLength(3);
      expect(registry.skills.map((skill) => skill.name)).toEqual([
        'other-repo-skill',
        'keep-skill',
        'new-skill'
      ]);
      expect(registry.skills.find((skill) => skill.name === 'drop-skill')).toBeUndefined();
      expect(registry.skills.find((skill) => skill.name === 'other-repo-skill')?.id).toBe('other-id');
    });
  });
});
