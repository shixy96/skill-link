import fs from 'fs/promises';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('skill-parser', () => {
  it('parses skill frontmatter and returns the skill directory path', async () => {
    const repoDir = await fs.mkdtemp(path.join('/tmp', 'skilllink-repo-'));
    const skillDir = path.join(repoDir, 'skills', 'design-system');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: design-system',
        'description: Design system guidance',
        'version: "1.0"',
        '---',
        '',
        '# Design System'
      ].join('\n'),
      'utf-8'
    );

    const { parseSkillMd } = await import('../../../src/lib/skill-parser.js');
    const result = await parseSkillMd(path.join(skillDir, 'SKILL.md'));

    expect(result.success).toBe(true);
    expect(result.skill).toMatchObject({
      name: 'design-system',
      description: 'Design system guidance',
      version: '1.0',
      path: skillDir
    });
  });

  it('discovers SKILL.md files only up to depth 3 and requires name frontmatter', async () => {
    const repoDir = await fs.mkdtemp(path.join('/tmp', 'skilllink-discover-'));
    const validDir = path.join(repoDir, 'skills', 'found');
    const boundaryTooDeepDir = path.join(repoDir, 'very', 'deeply', 'nested');
    const deepDir = path.join(repoDir, 'too', 'deep', 'for', 'mvp');
    const invalidDir = path.join(repoDir, 'skills', 'invalid');

    await fs.mkdir(validDir, { recursive: true });
    await fs.mkdir(boundaryTooDeepDir, { recursive: true });
    await fs.mkdir(deepDir, { recursive: true });
    await fs.mkdir(invalidDir, { recursive: true });

    await fs.writeFile(
      path.join(validDir, 'SKILL.md'),
      [
        '---',
        'name: found-skill',
        'description: Valid skill',
        '---',
        '',
        'Body'
      ].join('\n'),
      'utf-8'
    );

    await fs.writeFile(
      path.join(boundaryTooDeepDir, 'SKILL.md'),
      [
        '---',
        'name: boundary-too-deep',
        '---',
        '',
        'Body'
      ].join('\n'),
      'utf-8'
    );

    await fs.writeFile(
      path.join(deepDir, 'SKILL.md'),
      [
        '---',
        'name: too-deep',
        '---',
        '',
        'Body'
      ].join('\n'),
      'utf-8'
    );

    await fs.writeFile(
      path.join(invalidDir, 'SKILL.md'),
      [
        '---',
        'description: missing name',
        '---',
        '',
        'Body'
      ].join('\n'),
      'utf-8'
    );

    const { discoverSkillsInRepo } = await import('../../../src/lib/skill-parser.js');
    const skills = await discoverSkillsInRepo(repoDir);

    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({
      name: 'found-skill',
      path: validDir
    });
  });
});
