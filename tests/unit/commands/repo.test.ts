import { describe, expect, it } from 'vitest';

describe('repo command parsing', () => {
  it('accepts dotted repo names in GitHub URLs', async () => {
    const { parseRepoRef } = await import('../../../src/commands/repo.js');

    expect(parseRepoRef('https://github.com/org/my.repo')).toEqual({
      owner: 'org',
      repoName: 'my.repo',
      cloneRef: 'org/my.repo',
      cloneUrl: 'https://github.com/org/my.repo.git'
    });

    expect(parseRepoRef('git@github.com:org/my.repo.git')).toEqual({
      owner: 'org',
      repoName: 'my.repo',
      cloneRef: 'org/my.repo',
      cloneUrl: 'https://github.com/org/my.repo.git'
    });
  });
});
