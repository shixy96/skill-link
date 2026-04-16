import { discoverSkillsInRepo } from '../lib/skill-parser.js';
import { getRegistry, listManagedRepos, replaceSkillsForRepo } from '../lib/skill-registry.js';
import path from 'path';
import type { OperationResult, Skill } from '../types.js';
import { ok } from '../types.js';

export async function listSkillsData(): Promise<Skill[]> {
  const registry = await getRegistry();
  return registry.skills.sort((a, b) => a.name.localeCompare(b.name));
}

export async function skillList(): Promise<void> {
  const skills = await listSkillsData();

  if (skills.length === 0) {
    console.log('No skills discovered yet.');
    console.log('  Run: skilllink skill discover');
    return;
  }

  console.log(`Skills (${skills.length}):\n`);

  for (const skill of skills) {
    console.log(`  ${skill.name}`);
    console.log(`    Repo: ${skill.repo}`);
    console.log(`    Path: ${skill.path}`);
    console.log(`    Symlinks: ${skill.symlinks.length}`);
    if (skill.symlinks.length > 0) {
      const active = skill.symlinks.filter(s => s.status === 'active').length;
      const broken = skill.symlinks.filter(s => s.status === 'broken').length;
      console.log(`      ${active} active, ${broken} broken`);
    }
    console.log();
  }
}

export interface SkillDiscoverResult {
  totalSkills: number;
  repos: Array<{
    repo: string;
    count: number;
  }>;
}

export async function skillDiscoverData(): Promise<OperationResult<SkillDiscoverResult>> {
  const repos = await listManagedRepos();

  if (repos.length === 0) {
    return ok({
      totalSkills: 0,
      repos: []
    }, 'No repositories to scan.');
  }

  let totalSkills = 0;
  const scannedRepos: SkillDiscoverResult['repos'] = [];

  for (const repo of repos) {
    const skills = await discoverSkillsInRepo(repo.path);
    const repoName = `${repo.owner}/${repo.name}`;

    await replaceSkillsForRepo(
      repoName,
      skills.map((skill) => ({
        name: skill.name,
        repo: repoName,
        path: path.relative(repo.path, skill.path) || '.',
        hasSKILLMd: true
      }))
    );

    totalSkills += skills.length;
    scannedRepos.push({
      repo: repoName,
      count: skills.length
    });
  }

  return ok({
    totalSkills,
    repos: scannedRepos
  }, `Done. ${totalSkills} skills total.`);
}

export async function skillDiscover(): Promise<void> {
  const repos = await listManagedRepos();

  if (repos.length === 0) {
    console.log('No repositories to scan.');
    console.log('  Run: skilllink repo add <url> first');
    return;
  }

  console.log(`Scanning ${repos.length} repo(s)...\n`);

  const result = await skillDiscoverData();
  if (!result.ok) {
    console.error(`[${result.error.code}] ${result.error.message}`);
    if (result.error.action) {
      console.error(`  → ${result.error.action}`);
    }
    return;
  }

  for (const repo of result.data.repos) {
    console.log(`  ${repo.repo}: found ${repo.count} skills`);
  }

  console.log(`\nUpdating registry...`);
  console.log(result.message);
}
