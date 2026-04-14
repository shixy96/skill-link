import fs from 'fs/promises';
import path from 'path';

import { createSymlink, removeSymlink, checkSymlinkStatus, updateSymlink } from '../lib/symlink-manager.js';
import { getConfig, listSkillsDirs, expandPath } from '../lib/config-store.js';
import {
  addSkill,
  addSymlinkToSkill,
  getRegistry,
  getSkillById,
  listManagedRepos,
  removeSymlinkFromSkill,
  updateSkill
} from '../lib/skill-registry.js';
import { parseSkillMd } from '../lib/skill-parser.js';
import { fail, formatError, ok } from '../types.js';
import type { ListedSymlink, OperationResult, RepoMetadata, Skill, SymlinkEntry } from '../types.js';

interface ResolvedSkill {
  skill: Skill;
  sourcePath: string;
}

interface LinkOptions {
  restrictTargetToSkillsDirs?: boolean;
}

export interface LinkCreateResult {
  skill: Skill;
  target: string;
}

export interface LinkRemoveResult {
  skill: Skill;
  removed: string[];
}

export interface LinkSyncResult {
  active: number;
  broken: number;
}

export interface LinkUpdateResult {
  skill: Skill;
  oldTarget: string;
  newTarget: string;
}

function repoName(repo: RepoMetadata): string {
  return `${repo.owner}/${repo.name}`;
}

function formatOperationError(result: OperationResult<unknown>): void {
  if (result.ok) {
    return;
  }

  console.error(`[${result.error.code}] ${result.error.message}`);
  if (result.error.action) {
    console.error(`  → ${result.error.action}`);
  }
}

function relativeInside(parentPath: string, childPath: string): string | undefined {
  const relative = path.relative(parentPath, childPath);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return relative || '.';
  }

  return undefined;
}

async function realpathIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await fs.realpath(filePath);
  } catch {
    return undefined;
  }
}

async function resolveSkillSourcePath(skill: Skill): Promise<string | undefined> {
  const repos = await listManagedRepos();
  const repo = repos.find((entry) => repoName(entry) === skill.repo);
  if (!repo) {
    return undefined;
  }

  const repoRoot = await realpathIfExists(repo.path);
  const sourcePath = await realpathIfExists(
    path.isAbsolute(skill.path) ? skill.path : path.join(repo.path, skill.path)
  );

  if (!repoRoot || !sourcePath || relativeInside(repoRoot, sourcePath) === undefined) {
    return undefined;
  }

  return sourcePath;
}

function formatSkillRefs(skills: Skill[]): string {
  return skills.map((skill) => `${skill.repo}/${skill.path}`).join(', ');
}

async function resolveMatchedSkill(skill: Skill): Promise<OperationResult<ResolvedSkill>> {
  const sourcePath = await resolveSkillSourcePath(skill);
  if (!sourcePath) {
    return fail({
      code: 'REPO_NOT_FOUND',
      message: `Repository not found for ${skill.repo}`,
      action: 'Add repo: skilllink repo add <url>'
    });
  }

  return ok({ skill, sourcePath });
}

async function findManagedRepoForPath(skillDir: string): Promise<{ repo: RepoMetadata; relativePath: string; sourcePath: string } | undefined> {
  const repos = await listManagedRepos();
  const resolvedSkillDir = await realpathIfExists(skillDir);

  if (!resolvedSkillDir) {
    return undefined;
  }

  for (const repo of repos) {
    const repoRoot = await realpathIfExists(repo.path);
    if (!repoRoot) {
      continue;
    }

    const relativePath = relativeInside(repoRoot, resolvedSkillDir);
    if (relativePath !== undefined) {
      return { repo, relativePath, sourcePath: resolvedSkillDir };
    }
  }

  return undefined;
}

async function resolveSkill(skillRef: string): Promise<OperationResult<ResolvedSkill>> {
  const registry = await getRegistry();
  const expandedRef = expandPath(skillRef);

  const idMatch = registry.skills.find((skill) => skill.id === skillRef);
  if (idMatch) {
    return resolveMatchedSkill(idMatch);
  }

  const pathMatches = registry.skills.filter((skill) =>
    skill.path === skillRef ||
    (path.isAbsolute(expandedRef) && skill.path === expandedRef)
  );

  if (pathMatches.length === 1) {
    return resolveMatchedSkill(pathMatches[0]);
  }

  if (pathMatches.length > 1) {
    return fail({
      code: 'SKILL_AMBIGUOUS',
      message: `Multiple skills match ${skillRef}: ${formatSkillRefs(pathMatches)}. Use <owner>/<repo>/<path> or a skill id.`,
      action: 'Check skill list: skilllink skill list'
    });
  }

  const repoPathMatch = skillRef.match(/^([^/]+\/[^/]+)\/(.+)$/);
  if (repoPathMatch) {
    const [, repo, skillPath] = repoPathMatch;
    const match = registry.skills.find((skill) => skill.repo === repo && skill.path === skillPath);
    if (match) {
      return resolveMatchedSkill(match);
    }
  }

  const nameMatches = registry.skills.filter((skill) => skill.name === skillRef);
  if (nameMatches.length === 1) {
    return resolveMatchedSkill(nameMatches[0]);
  }

  if (nameMatches.length > 1) {
    return fail({
      code: 'SKILL_AMBIGUOUS',
      message: `Multiple skills named ${skillRef}: ${formatSkillRefs(nameMatches)}. Use <owner>/<repo>/<path> or a skill id.`,
      action: 'Check skill list: skilllink skill list'
    });
  }

  try {
    const stats = await fs.stat(path.join(expandedRef, 'SKILL.md'));
    if (!stats.isFile()) {
      throw new Error('SKILL.md is not a file');
    }
  } catch {
    return fail({
      code: 'SKILL_NOT_FOUND',
      message: `Skill not found: ${skillRef}`,
      action: 'Check skill list: skilllink skill list'
    });
  }

  const repoMatch = await findManagedRepoForPath(expandedRef);
  if (!repoMatch) {
    return fail({
      code: 'INVALID_SKILL_PATH',
      message: 'Path must be inside a managed repo and contain SKILL.md',
      action: 'Add repo: skilllink repo add <url>'
    });
  }

  const parsed = await parseSkillMd(path.join(expandedRef, 'SKILL.md'));
  if (!parsed.success || !parsed.skill) {
    return fail(parsed.error ?? {
      code: 'PARSE_SKILL_MD_FAILED',
      path: expandedRef,
      action: 'Verify SKILL.md format'
    });
  }

  const skill = await addSkill({
    name: parsed.skill.name,
    repo: repoName(repoMatch.repo),
    path: repoMatch.relativePath,
    hasSKILLMd: true
  });

  return ok({ skill, sourcePath: repoMatch.sourcePath });
}

async function validateTargetPath(targetPath: string, options: LinkOptions): Promise<OperationResult<void>> {
  if (!options.restrictTargetToSkillsDirs) {
    return ok(undefined);
  }

  const resolvedTarget = path.resolve(expandPath(targetPath));
  const skillsDirs = await listSkillsDirs();

  for (const dir of Object.values(skillsDirs)) {
    const resolvedDir = path.resolve(dir);
    if (relativeInside(resolvedDir, resolvedTarget) !== undefined) {
      return ok(undefined);
    }
  }

  return fail({
    code: 'INVALID_TARGET_PATH',
    message: `Target must be inside a configured skills directory: ${targetPath}`,
    path: targetPath,
    action: 'Choose a configured skills directory target'
  });
}

async function resolveTargetPath(skill: Skill, targetDir?: string): Promise<string> {
  if (!targetDir) {
    const config = await getConfig();
    const skillsDirs = await listSkillsDirs();
    const baseDir = skillsDirs[config.defaultSkillsDir] || skillsDirs.claude;
    return path.join(baseDir, skill.name);
  }

  const skillsDirs = await listSkillsDirs();
  const baseDir = skillsDirs[targetDir];
  const rawPath = baseDir
    ? baseDir
    : targetDir.startsWith('~') || targetDir.startsWith('/') || targetDir.startsWith('.')
      ? expandPath(targetDir)
      : expandPath(`~/${targetDir}`);

  return path.basename(rawPath) === skill.name ? rawPath : path.join(rawPath, skill.name);
}

export async function listLinksData(skillName?: string): Promise<ListedSymlink[]> {
  const registry = await getRegistry();
  const links: ListedSymlink[] = [];

  for (const skill of registry.skills) {
    if (skillName && skill.name !== skillName && skill.id !== skillName) {
      continue;
    }

    for (const symlink of skill.symlinks) {
      links.push({
        skillId: skill.id,
        skillName: skill.name,
        repo: skill.repo,
        target: symlink.target,
        createdAt: symlink.createdAt,
        status: await checkSymlinkStatus(symlink.target)
      });
    }
  }

  return links;
}

export async function linkCreateData(skillRef: string, targetDir?: string, options: LinkOptions = {}): Promise<OperationResult<LinkCreateResult>> {
  const resolved = await resolveSkill(skillRef);
  if (!resolved.ok) {
    return resolved;
  }

  const { skill, sourcePath } = resolved.data;
  const targetPath = await resolveTargetPath(skill, targetDir);
  const targetValidation = await validateTargetPath(targetPath, options);
  if (!targetValidation.ok) {
    return targetValidation;
  }

  const result = await createSymlink(sourcePath, targetPath);

  if (!result.success && result.error) {
    return fail(result.error);
  }

  const symlink: SymlinkEntry = {
    target: targetPath,
    createdAt: new Date().toISOString(),
    status: 'active'
  };

  try {
    await addSymlinkToSkill(skill.id, symlink);
  } catch {
    await removeSymlink(targetPath);
    return fail({
      code: 'REGISTRY_WRITE_FAILED',
      message: `Failed to update registry after creating symlink: ${targetPath}`,
      path: targetPath,
      action: 'Run skilllink link sync'
    });
  }

  return ok({ skill, target: targetPath }, 'Symlink created successfully');
}

export async function linkCreate(skillRef: string, targetDir?: string): Promise<void> {
  const result = await linkCreateData(skillRef, targetDir);
  if (!result.ok) {
    formatOperationError(result);
    return;
  }

  console.log(`Creating symlink for ${result.data.skill.name}...`);
  console.log(`  Target: ${result.data.target}`);
  console.log(`✓ ${result.message}`);
}

export async function linkRemoveData(skillRef: string, targetPath?: string): Promise<OperationResult<LinkRemoveResult>> {
  const resolved = await resolveSkill(skillRef);
  if (!resolved.ok) {
    return resolved;
  }

  const { skill } = resolved.data;
  const symlinks = targetPath
    ? skill.symlinks.filter((symlink) => symlink.target === targetPath)
    : skill.symlinks;

  if (symlinks.length === 0) {
    return ok({ skill, removed: [] }, `No symlinks to remove for ${skill.name}.`);
  }

  const removed: string[] = [];
  for (const symlink of symlinks) {
    const result = await removeSymlink(symlink.target);
    if (!result.success && result.error) {
      return fail(result.error);
    }

    await removeSymlinkFromSkill(skill.id, symlink.target);
    removed.push(symlink.target);
  }

  return ok({ skill, removed }, `Removed ${removed.length} symlink(s).`);
}

export async function linkRemove(skillRef: string): Promise<void> {
  const result = await linkRemoveData(skillRef);
  if (!result.ok) {
    formatOperationError(result);
    return;
  }

  if (result.data.removed.length === 0) {
    console.log(result.message);
    return;
  }

  console.log(`Removing ${result.data.removed.length} symlink(s) for ${result.data.skill.name}...\n`);
  for (const target of result.data.removed) {
    console.log(`  ✓ Removed: ${target}`);
  }
  console.log(`\n✓ Done`);
}

export async function linkList(): Promise<void> {
  const allSymlinks = await listLinksData();

  if (allSymlinks.length === 0) {
    console.log('No symlinks managed.');
    console.log('  Run: skilllink link create <skill>');
    return;
  }

  console.log(`Symlinks (${allSymlinks.length}):\n`);

  let activeCount = 0;
  let brokenCount = 0;

  for (const symlink of allSymlinks) {
    const status = symlink.status;
    if (status === 'active') {
      activeCount++;
    } else {
      brokenCount++;
    }

    const statusIcon = status === 'active' ? '✓' : '✗';
    const statusLabel = status === 'active' ? 'active' : 'BROKEN';
    console.log(`  ${statusIcon} ${symlink.skillName} → ${symlink.target} [${statusLabel}]`);
  }

  console.log(`\n  ${activeCount} active, ${brokenCount} broken`);
}

export async function linkSyncData(): Promise<OperationResult<LinkSyncResult>> {
  const registry = await getRegistry();
  const allSymlinks: Array<{ skillId: string; symlink: SymlinkEntry }> = [];

  for (const skill of registry.skills) {
    for (const symlink of skill.symlinks) {
      allSymlinks.push({ skillId: skill.id, symlink });
    }
  }

  let activeCount = 0;
  let brokenCount = 0;

  for (const { skillId, symlink } of allSymlinks) {
    const status = await checkSymlinkStatus(symlink.target);

    if (status !== symlink.status) {
      const currentSkill = await getSkillById(skillId);
      if (!currentSkill) {
        continue;
      }
      await updateSkill(skillId, {
        symlinks: currentSkill.symlinks.map(s =>
          s.target === symlink.target ? { ...s, status } : s
        )
      });
    }

    if (status === 'active') {
      activeCount++;
    } else {
      brokenCount++;
    }
  }

  return ok({
    active: activeCount,
    broken: brokenCount
  }, `Sync complete. ${activeCount} active, ${brokenCount} broken.`);
}

export async function linkSync(): Promise<void> {
  const registry = await getRegistry();
  const total = registry.skills.reduce((count, skill) => count + skill.symlinks.length, 0);

  if (total === 0) {
    console.log('No symlinks to sync.');
    return;
  }

  console.log(`Scanning ${total} symlink(s)...\n`);

  const result = await linkSyncData();
  if (!result.ok) {
    formatOperationError(result);
    return;
  }

  console.log(`  ✓ ${result.data.active} active`);
  if (result.data.broken > 0) {
    console.log(`  ⚠ ${result.data.broken} broken (marked in registry)`);
  }
  console.log(`\nRun 'skilllink link list' to see broken symlinks`);
}

export async function linkUpdateData(
  skillRef: string,
  newTarget: string,
  oldTarget?: string,
  options: LinkOptions = {}
): Promise<OperationResult<LinkUpdateResult>> {
  const resolved = await resolveSkill(skillRef);
  if (!resolved.ok) {
    return resolved;
  }

  const { skill, sourcePath } = resolved.data;
  const oldSymlink = oldTarget
    ? skill.symlinks.find((symlink) => symlink.target === oldTarget)
    : skill.symlinks[0];

  if (!oldSymlink) {
    return fail({
      code: 'SYMLINK_BROKEN',
      message: `No matching symlink exists for ${skill.name}.`,
      action: 'Run skilllink link list'
    });
  }

  if (!oldTarget && skill.symlinks.length > 1) {
    return fail({
      code: 'SYMLINK_EXISTS',
      message: `Multiple symlinks exist for ${skill.name}; choose a symlink target to update.`,
      action: 'Run skilllink link list'
    });
  }

  const resolvedTarget = await resolveTargetPath(skill, newTarget);
  const targetValidation = await validateTargetPath(resolvedTarget, options);
  if (!targetValidation.ok) {
    return targetValidation;
  }

  const result = await updateSymlink(sourcePath, oldSymlink.target, resolvedTarget);

  if (!result.success && result.error) {
    return fail(result.error);
  }

  try {
    await updateSkill(skill.id, {
      symlinks: skill.symlinks.map(s =>
        s.target === oldSymlink.target
          ? { ...s, target: resolvedTarget, status: 'active' }
          : s
      )
    });
  } catch {
    await updateSymlink(sourcePath, resolvedTarget, oldSymlink.target);
    return fail({
      code: 'REGISTRY_WRITE_FAILED',
      message: `Failed to update registry after moving symlink: ${resolvedTarget}`,
      path: resolvedTarget,
      action: 'Run skilllink link sync'
    });
  }

  return ok({
    skill,
    oldTarget: oldSymlink.target,
    newTarget: resolvedTarget
  }, 'Symlink updated successfully');
}

export async function linkUpdate(skillRef: string, newTarget: string): Promise<void> {
  const result = await linkUpdateData(skillRef, newTarget);
  if (!result.ok) {
    formatOperationError(result);
    return;
  }

  console.log(`Updating symlink for ${result.data.skill.name}...`);
  console.log(`  Old: ${result.data.oldTarget}`);
  console.log(`  New: ${result.data.newTarget}`);
  console.log(`✓ ${result.message}`);
}
