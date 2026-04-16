import { listBranches, switchBranch, createBranch, getCurrentBranch } from '../lib/gh-git.js';
import { listManagedRepos, getRepoMetadata, saveRepoMetadata } from '../lib/skill-registry.js';
import path from 'path';
import type { OperationResult, RepoMetadata } from '../types.js';
import { fail, ok } from '../types.js';

async function resolveRepo(repoName?: string): Promise<OperationResult<RepoMetadata>> {
  const repos = await listManagedRepos();

  if (repoName) {
    const repo = repos.find(r => r.name === repoName || `${r.owner}/${r.name}` === repoName);
    if (!repo) {
      return fail({
        code: 'REPO_NOT_FOUND',
        message: `Repository not found: ${repoName}`,
        action: 'Add repo: skilllink repo add <url>'
      });
    }

    return ok(repo);
  }

  const cwdRepo = repos.find((repo) => {
    const relative = path.relative(repo.path, process.cwd());
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  });
  if (cwdRepo) {
    return ok(cwdRepo);
  }

  if (repos.length === 1) {
    return ok(repos[0]);
  }

  return fail({
    code: 'REPO_NOT_FOUND',
    message: 'No repository specified.',
    action: 'Use: skilllink branch list <owner/repo>'
  });
}

function cleanBranchName(branch: string): string {
  return branch.replace(/^\* /, '').replace(/^remotes\//, '').trim();
}

export interface BranchListResult {
  repo: RepoMetadata;
  branches: string[];
  currentBranch: string;
}

export async function branchListData(repoName?: string): Promise<OperationResult<BranchListResult>> {
  const repoResult = await resolveRepo(repoName);
  if (!repoResult.ok) {
    return repoResult;
  }

  const branches = await listBranches(repoResult.data.path);
  const current = await getCurrentBranch(repoResult.data.path);

  return ok({
    repo: repoResult.data,
    branches: branches.map(cleanBranchName).filter(Boolean),
    currentBranch: current
  });
}

export async function branchList(repoName?: string): Promise<void> {
  const result = await branchListData(repoName);
  if (!result.ok) {
    console.error(`[${result.error.code}] ${result.error.message}`);
    if (result.error.action) {
      console.error(`  → ${result.error.action}`);
    }
    return;
  }

  console.log(`Branches in ${repoName || path.basename(result.data.repo.path)}:\n`);

  for (const branch of result.data.branches) {
    const displayName = branch === result.data.currentBranch ? `* ${branch}` : branch;
    console.log(`  ${displayName}`);
  }
}

export async function branchSwitchData(branchName: string, repoName?: string): Promise<OperationResult<RepoMetadata>> {
  const repoResult = await resolveRepo(repoName);
  if (!repoResult.ok) {
    return repoResult;
  }

  const repoPath = repoResult.data.path;
  const branches = (await listBranches(repoPath)).map(cleanBranchName);
  const normalizedBranch = branchName.replace(/^origin\//, '');

  if (!branches.some(b => b === normalizedBranch || b === `origin/${normalizedBranch}`)) {
    return fail({
      code: 'BRANCH_NOT_FOUND',
      message: `Branch not found: ${branchName}`,
      action: 'List branches: skilllink branch list'
    });
  }

  const result = await switchBranch(repoPath, branchName);

  if (result.success) {
    const meta = await getRepoMetadata(repoPath);
    if (meta) {
      meta.currentBranch = branchName;
      await saveRepoMetadata(repoPath, meta);
      return ok(meta, `Switched to branch: ${branchName}`);
    }

    return ok({ ...repoResult.data, currentBranch: branchName }, `Switched to branch: ${branchName}`);
  }

  return fail({
    code: 'BRANCH_NOT_FOUND',
    message: result.error || result.stderr || `Failed to switch branch: ${branchName}`,
    action: 'List branches: skilllink branch list'
  });
}

export async function branchSwitch(branchName: string, repoName?: string): Promise<void> {
  const result = await branchSwitchData(branchName, repoName);
  if (result.ok) {
    console.log(`✓ ${result.message}`);
  } else {
    console.error(`[${result.error.code}] ${result.error.message}`);
    if (result.error.action) {
      console.error(`  → ${result.error.action}`);
    }
  }
}

export async function branchCreateData(branchName: string, repoName?: string): Promise<OperationResult<RepoMetadata>> {
  const repoResult = await resolveRepo(repoName);
  if (!repoResult.ok) {
    return repoResult;
  }

  const repoPath = repoResult.data.path;
  const result = await createBranch(repoPath, branchName);

  if (result.success) {
    const meta = await getRepoMetadata(repoPath);
    if (meta) {
      meta.currentBranch = branchName;
      if (!meta.branches.includes(branchName)) {
        meta.branches.push(branchName);
      }
      await saveRepoMetadata(repoPath, meta);
      return ok(meta, `Created and switched to branch: ${branchName}`);
    }

    return ok({ ...repoResult.data, currentBranch: branchName }, `Created and switched to branch: ${branchName}`);
  }

  return fail({
    code: 'BRANCH_NOT_FOUND',
    message: result.error || result.stderr || `Failed to create branch: ${branchName}`,
    action: 'List branches: skilllink branch list'
  });
}

export async function branchCreate(branchName: string, repoName?: string): Promise<void> {
  const result = await branchCreateData(branchName, repoName);
  if (result.ok) {
    console.log(`✓ ${result.message}`);
  } else {
    console.error(`[${result.error.code}] ${result.error.message}`);
    if (result.error.action) {
      console.error(`  → ${result.error.action}`);
    }
  }
}
