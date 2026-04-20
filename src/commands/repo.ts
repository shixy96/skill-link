import { cloneRepo, fetchRepo, getCapabilities, getCurrentBranch, listBranches, pullRepo } from '../lib/gh-git.js';
import { getConfig, expandPath } from '../lib/config-store.js';
import {
  saveRepoMetadata,
  upsertManagedRepo,
  listManagedRepos,
  removeManagedRepo,
  removeSkillsForRepo
} from '../lib/skill-registry.js';
import { discoverSkillsInRepo } from '../lib/skill-parser.js';
import { replaceSkillsForRepo } from '../lib/skill-registry.js';
import fs from 'fs/promises';
import path from 'path';
import type { OperationResult, RepoMetadata } from '../types.js';
import { fail, ok } from '../types.js';

function isSafePathComponent(value: string): boolean {
  return !value.includes('..') && !value.includes('/') && value.length > 0;
}

export function parseRepoRef(input: string): { owner: string; repoName: string; cloneRef: string; cloneUrl: string } | undefined {
  const urlMatch = input.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (urlMatch) {
    const [, owner, repoName] = urlMatch;
    if (!isSafePathComponent(owner) || !isSafePathComponent(repoName)) {
      return undefined;
    }
    return { owner, repoName, cloneRef: `${owner}/${repoName}`, cloneUrl: `https://github.com/${owner}/${repoName}.git` };
  }

  const repoMatch = input.match(/^([^/]+)\/([^/]+)$/);
  if (repoMatch) {
    const [, owner, repoName] = repoMatch;
    if (!isSafePathComponent(owner) || !isSafePathComponent(repoName)) {
      return undefined;
    }
    return { owner, repoName, cloneRef: `${owner}/${repoName}`, cloneUrl: `https://github.com/${owner}/${repoName}.git` };
  }

  return undefined;
}

async function buildRepoMetadata(repoPath: string, owner: string, repoName: string): Promise<RepoMetadata> {
  const branches = await listBranches(repoPath);
  const currentBranch = (await getCurrentBranch(repoPath)) || 'main';

  return {
    name: repoName,
    owner,
    path: repoPath,
    branches,
    currentBranch
  };
}

export async function listReposData(): Promise<RepoMetadata[]> {
  return listManagedRepos();
}

export interface RepoAddResult {
  repo: RepoMetadata;
  discoveredSkills: number;
}

export async function repoAddData(url: string): Promise<OperationResult<RepoAddResult>> {
  const repoRef = parseRepoRef(url);
  if (!repoRef) {
    return fail({
      code: 'CLONE_FAILED',
      message: `Invalid GitHub URL: ${url}`,
      action: 'Check network or repo URL'
    });
  }

  const config = await getConfig();
  const repoPath = path.join(expandPath(config.reposDir), repoRef.owner, repoRef.repoName);
  const result = await cloneRepo(repoRef.cloneRef, repoPath, repoRef.cloneUrl);

  if (!result.success) {
    return fail({
      code: 'CLONE_FAILED',
      message: result.stderr || result.error || 'Failed to clone repository',
      action: 'Check network or repo URL'
    });
  }

  const metadata = await buildRepoMetadata(repoPath, repoRef.owner, repoRef.repoName);
  await saveRepoMetadata(repoPath, metadata);
  await upsertManagedRepo(metadata);

  const repoFullName = `${metadata.owner}/${metadata.name}`;
  const skills = await discoverSkillsInRepo(metadata.path);
  await replaceSkillsForRepo(
    repoFullName,
    skills.map((skill) => ({
      name: skill.name,
      repo: repoFullName,
      path: path.relative(metadata.path, skill.path) || '.',
      hasSKILLMd: true
    }))
  );

  return ok({
    repo: metadata,
    discoveredSkills: skills.length
  }, 'Repository cloned successfully');
}

export async function repoAdd(url: string): Promise<void> {
  console.log(`Cloning ${url}...`);

  const result = await repoAddData(url);
  if (!result.ok) {
    console.error(`[${result.error.code}] ${result.error.message}`);
    if (result.error.action) {
      console.error(`  → ${result.error.action}`);
    }
    return;
  }

  console.log(`✓ Repository cloned successfully`);
  console.log(`  Path: ${result.data.repo.path}`);
  console.log(`  Branch: ${result.data.repo.currentBranch}`);
  console.log(`  Skills: ${result.data.discoveredSkills}`);
}

export async function repoList(): Promise<void> {
  const repos = await listReposData();

  if (repos.length === 0) {
    console.log('No repositories managed yet.');
    console.log('  Run: skilllink repo add <github-url>');
    return;
  }

  console.log(`Managed repositories (${repos.length}):\n`);

  for (const repo of repos) {
    console.log(`  ${repo.owner}/${repo.name}`);
    console.log(`    Path: ${repo.path}`);
    console.log(`    Branch: ${repo.currentBranch}`);
    console.log(`    Branches: ${repo.branches.length}`);
    console.log();
  }
}

export async function repoRemoveData(name: string, deleteFiles = false): Promise<OperationResult<RepoMetadata>> {
  const removal = await removeManagedRepo(name);
  if (removal.ambiguousRepos && removal.ambiguousRepos.length > 1) {
    const matches = removal.ambiguousRepos
      .map((repo) => `${repo.owner}/${repo.name}`)
      .join(', ');
    return fail({
      code: 'REPO_AMBIGUOUS',
      message: `Multiple repositories named ${name}: ${matches}. Use owner/name.`,
      action: 'Run skilllink repo list'
    });
  }

  const repo = removal.repo;
  if (!repo) {
    return fail({
      code: 'REPO_NOT_FOUND',
      message: `Repository not found: ${name}`,
      action: 'Add repo: skilllink repo add <url>'
    });
  }

  await removeSkillsForRepo(`${repo.owner}/${repo.name}`);

  if (deleteFiles) {
    const config = await getConfig();
    const reposDir = path.resolve(expandPath(config.reposDir));
    const repoAbs = path.resolve(repo.path);
    const rel = path.relative(reposDir, repoAbs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return fail({
        code: 'REPO_NOT_FOUND',
        message: 'Repo path is outside configured reposDir',
        action: 'Check repos.json'
      });
    }
    await fs.rm(repoAbs, { recursive: true, force: true });
  } else {
    await fs.rm(path.join(repo.path, '.skilllink.json'), { force: true });
  }

  return ok(repo, 'Repository removed from registry');
}

export async function repoRemove(name: string, deleteFiles = false): Promise<void> {
  const result = await repoRemoveData(name, deleteFiles);
  if (!result.ok) {
    console.error(`[${result.error.code}] ${result.error.message}`);
    if (result.error.action) {
      console.error(`  → ${result.error.action}`);
    }
    return;
  }

  if (deleteFiles) {
    console.log(`✓ Repository deleted: ${result.data.path}`);
  } else {
    console.log(`Repository files kept at: ${result.data.path}`);
    console.log(`  (files kept, repository removed from managed list)`);
  }
  console.log(`✓ Repository removed from registry`);
}

export interface RepoSyncResult {
  repos: Array<{
    repo: RepoMetadata;
    ok: boolean;
    message: string;
  }>;
}

export async function repoSyncData(): Promise<OperationResult<RepoSyncResult>> {
  const capabilities = await getCapabilities();
  if (!capabilities.canFetch) {
    return fail({
      code: 'GH_NOT_AUTHED',
      message: 'GitHub authentication required for repo sync',
      action: 'Run gh auth login'
    });
  }

  const repos = await listReposData();

  if (repos.length === 0) {
    return ok({ repos: [] }, 'No repositories to sync.');
  }

  const results: RepoSyncResult['repos'] = [];

  for (const repo of repos) {
    const fetchResult = await fetchRepo(repo.path);
    const pullResult = fetchResult.success ? await pullRepo(repo.path) : fetchResult;

    if (fetchResult.success && pullResult.success) {
      const metadata = await buildRepoMetadata(repo.path, repo.owner, repo.name);
      await saveRepoMetadata(repo.path, metadata);
      await upsertManagedRepo(metadata);
      results.push({
        repo: metadata,
        ok: true,
        message: 'Synced successfully'
      });
    } else {
      results.push({
        repo,
        ok: false,
        message: pullResult.stderr || pullResult.error || 'Sync failed'
      });
    }
  }

  return ok({ repos: results }, 'Sync complete');
}

export async function repoSync(): Promise<void> {
  const repos = await listReposData();

  if (repos.length === 0) {
    console.log('No repositories to sync.');
    return;
  }

  console.log(`Syncing ${repos.length} repository(s)...\n`);

  const result = await repoSyncData();
  if (!result.ok) {
    console.error(`[${result.error.code}] ${result.error.message}`);
    if (result.error.action) {
      console.error(`  → ${result.error.action}`);
    }
    return;
  }

  for (const entry of result.data.repos) {
    console.log(`  ${entry.repo.owner}/${entry.repo.name}...`);
    if (entry.ok) {
      console.log(`    ✓ ${entry.message}`);
    } else {
      console.log(`    ✗ Sync failed: ${entry.message}`);
    }
  }

  console.log(`\n✓ Sync complete`);
}
