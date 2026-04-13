import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import type { Capability } from '../types.js';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export interface GhResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}

async function execGh(args: string[]): Promise<GhResult> {
  try {
    const { stdout, stderr } = await execFileAsync('gh', args, {
      encoding: 'utf-8'
    });
    return { success: true, stdout, stderr };
  } catch (error: unknown) {
    const err = error as { stderr?: string; message?: string; stdout?: string };
    return {
      success: false,
      stdout: err.stdout || '',
      stderr: err.stderr || err.message || ''
    };
  }
}

async function execGit(args: string[], cwd?: string): Promise<GhResult> {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd,
      encoding: 'utf-8'
    });
    return { success: true, stdout, stderr };
  } catch (error: unknown) {
    const err = error as { stderr?: string; message?: string; stdout?: string };
    return {
      success: false,
      stdout: err.stdout || '',
      stderr: err.stderr || err.message || '',
      error: err.message || ''
    };
  }
}

export async function checkGhCli(): Promise<boolean> {
  try {
    await execAsync('which gh', { encoding: 'utf-8' });
    return true;
  } catch {
    return false;
  }
}

export async function checkGhAuth(): Promise<boolean> {
  const result = await execGh(['auth', 'status']);
  return result.success;
}

export async function getCapabilities(): Promise<Capability> {
  const ghAvailable = await checkGhCli();
  const ghAuthed = ghAvailable && await checkGhAuth();

  return {
    canClone: ghAuthed,
    canFetch: ghAuthed,
    canPush: ghAuthed,
    canManageSymlinks: true,
    canDiscoverSkills: true
  };
}

export async function cloneRepo(repo: string, targetPath: string, fallbackUrl?: string): Promise<GhResult> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const ghResult = await execGh(['repo', 'clone', repo, targetPath]);
  if (ghResult.success || !fallbackUrl) {
    return ghResult;
  }

  return execGit(['clone', fallbackUrl, targetPath]);
}

export async function fetchRepo(repoPath: string): Promise<GhResult> {
  return execGit(['fetch', '--all'], repoPath);
}

export async function pullRepo(repoPath: string): Promise<GhResult> {
  return execGit(['pull', '--ff-only'], repoPath);
}

export async function pushRepo(repoPath: string): Promise<GhResult> {
  return execGit(['push'], repoPath);
}

export async function listBranches(repoPath: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync('git branch -a', {
      cwd: repoPath,
      encoding: 'utf-8'
    });
    return stdout.split('\n').map(b => b.trim()).filter(b => b);
  } catch {
    return [];
  }
}

export async function switchBranch(repoPath: string, branchName: string): Promise<GhResult> {
  return execGit(['checkout', branchName], repoPath);
}

export async function createBranch(repoPath: string, branchName: string): Promise<GhResult> {
  return execGit(['checkout', '-b', branchName], repoPath);
}

export async function getCurrentBranch(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync('git branch --show-current', {
      cwd: repoPath,
      encoding: 'utf-8'
    });
    return stdout.trim();
  } catch {
    return '';
  }
}

export function isOfflineError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const msg = (error as { message?: string }).message || '';
    return msg.includes('network') || msg.includes('offline') || msg.includes('ENOTFOUND');
  }
  return false;
}
