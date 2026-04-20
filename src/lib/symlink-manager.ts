import fs from 'fs/promises';
import path from 'path';
import { expandPath } from './config-store.js';
import type { SkillLinkError, SymlinkEntry } from '../types.js';

export interface SymlinkResult {
  success: boolean;
  error?: SkillLinkError;
}

async function checkCreateTarget(targetPath: string): Promise<SymlinkResult> {
  try {
    const stats = await fs.lstat(targetPath);

    if (stats.isSymbolicLink()) {
      return {
        success: false,
        error: {
          code: 'SYMLINK_EXISTS',
          path: targetPath,
          action: 'Remove existing symlink first: skilllink link remove <name>'
        }
      };
    }

    return {
      success: false,
      error: {
        code: 'SYMLINK_NOT_SYMLINK',
        path: targetPath,
        action: 'Remove or backup existing file: rm <path>'
      }
    };
  } catch {
    return { success: true };
  }
}

export async function createSymlink(skillPath: string, targetPath: string): Promise<SymlinkResult> {
  const resolvedSkill = expandPath(skillPath);
  const resolvedTarget = expandPath(targetPath);
  const targetCheck = await checkCreateTarget(resolvedTarget);

  if (!targetCheck.success) {
    return targetCheck;
  }

  // Ensure parent directory exists
  const parentDir = path.dirname(resolvedTarget);
  await fs.mkdir(parentDir, { recursive: true });

  try {
    await fs.symlink(resolvedSkill, resolvedTarget);
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: 'SYMLINK_EXISTS',
        path: resolvedTarget,
        action: 'Remove existing symlink first: skilllink link remove <name>'
      }
    };
  }
}

export async function removeSymlink(targetPath: string): Promise<SymlinkResult> {
  const resolvedTarget = expandPath(targetPath);

  try {
    const stats = await fs.lstat(resolvedTarget);
    if (!stats.isSymbolicLink()) {
      return {
        success: false,
        error: {
          code: 'SYMLINK_NOT_SYMLINK',
          path: resolvedTarget,
          action: 'Remove or backup existing file: rm <path>'
        }
      };
    }

    await fs.unlink(resolvedTarget);
    return { success: true };
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return { success: true };
    }

    return {
      success: false,
      error: {
        code: 'SYMLINK_BROKEN',
        path: resolvedTarget,
        action: 'Run skilllink link sync to update registry'
      }
    };
  }
}

export async function isSymlink(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.lstat(filePath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

export async function checkSymlinkStatus(targetPath: string): Promise<'active' | 'broken'> {
  const resolvedTarget = expandPath(targetPath);

  try {
    const isLink = await isSymlink(resolvedTarget);
    if (!isLink) {
      return 'broken';
    }

    // Try to access the target to see if it's valid
    await fs.stat(resolvedTarget);
    return 'active';
  } catch {
    return 'broken';
  }
}

export async function updateSymlink(skillPath: string, oldTarget: string, newTarget: string): Promise<SymlinkResult> {
  const resolvedOldTarget = expandPath(oldTarget);
  const resolvedNewTarget = expandPath(newTarget);

  if (resolvedOldTarget === resolvedNewTarget) {
    return { success: true };
  }

  const targetCheck = await checkCreateTarget(resolvedNewTarget);
  if (!targetCheck.success) {
    return targetCheck;
  }

  const removeResult = await removeSymlink(oldTarget);
  if (!removeResult.success) {
    return removeResult;
  }

  const createResult = await createSymlink(skillPath, newTarget);
  if (createResult.success) {
    return createResult;
  }

  const rollbackResult = await createSymlink(skillPath, oldTarget);
  if (!rollbackResult.success) {
    return {
      success: false,
      error: {
        code: 'SYMLINK_BROKEN',
        path: resolvedOldTarget,
        action: 'Rollback failed. Run skilllink link sync to reconcile.'
      } as unknown as import('../types.js').SkillLinkError
    };
  }

  return createResult;
}

export async function syncSymlink(entry: SymlinkEntry): Promise<SymlinkEntry> {
  const status = await checkSymlinkStatus(entry.target);
  return {
    ...entry,
    status
  };
}
