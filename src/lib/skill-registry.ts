import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CONFIG_DIR, expandPath } from './config-store.js';
import type { SkillRegistry, Skill, RepoMetadata, SymlinkEntry, ParsedSkill } from '../types.js';

const REGISTRY_PATH = path.join(CONFIG_DIR, 'skill-registry.json');
const REPOS_PATH = path.join(CONFIG_DIR, 'repos.json');

export interface RemoveManagedRepoResult {
  repo?: RepoMetadata;
  ambiguousRepos?: RepoMetadata[];
}

async function ensureRegistryDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

export async function getRegistry(): Promise<SkillRegistry> {
  return readJsonFile(REGISTRY_PATH, { skills: [] });
}

export async function saveRegistry(registry: SkillRegistry): Promise<void> {
  await ensureRegistryDir();
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
}

export async function getSkillByName(name: string): Promise<Skill | undefined> {
  const registry = await getRegistry();
  return registry.skills.find(s => s.name === name);
}

export async function getSkillById(id: string): Promise<Skill | undefined> {
  const registry = await getRegistry();
  return registry.skills.find(s => s.id === id);
}

export async function addSkill(skill: Omit<Skill, 'id' | 'symlinks'>): Promise<Skill> {
  const registry = await getRegistry();

  const existing = registry.skills.find(
    s => s.repo === skill.repo && s.path === skill.path
  );

  if (existing) {
    return existing;
  }

  const newSkill: Skill = {
    ...skill,
    id: uuidv4(),
    symlinks: []
  };

  registry.skills.push(newSkill);
  await saveRegistry(registry);

  return newSkill;
}

export async function replaceSkillsForRepo(
  repo: string,
  parsedSkills: Array<Omit<Skill, 'id' | 'symlinks'>>
): Promise<Skill[]> {
  const registry = await getRegistry();
  const existingByPath = new Map(
    registry.skills
      .filter((skill) => skill.repo === repo)
      .map((skill) => [skill.path, skill])
  );

  const nextSkills = parsedSkills.map((skill) => {
    const existing = existingByPath.get(skill.path);
    return {
      ...skill,
      id: existing?.id ?? uuidv4(),
      symlinks: existing?.symlinks ?? []
    };
  });

  registry.skills = registry.skills
    .filter((skill) => skill.repo !== repo)
    .concat(nextSkills);

  await saveRegistry(registry);
  return nextSkills;
}

export async function updateSkill(id: string, updates: Partial<Skill>): Promise<Skill | undefined> {
  const registry = await getRegistry();
  const index = registry.skills.findIndex(s => s.id === id);

  if (index === -1) {
    return undefined;
  }

  registry.skills[index] = { ...registry.skills[index], ...updates };
  await saveRegistry(registry);

  return registry.skills[index];
}

export async function addSymlinkToSkill(skillId: string, symlink: SymlinkEntry): Promise<void> {
  const registry = await getRegistry();
  const skill = registry.skills.find(s => s.id === skillId);

  if (!skill) {
    return;
  }

  // Check if symlink already exists
  const existingIndex = skill.symlinks.findIndex(s => s.target === symlink.target);
  if (existingIndex >= 0) {
    skill.symlinks[existingIndex] = symlink;
  } else {
    skill.symlinks.push(symlink);
  }

  await saveRegistry(registry);
}

export async function removeSymlinkFromSkill(skillId: string, target: string): Promise<void> {
  const registry = await getRegistry();
  const skill = registry.skills.find(s => s.id === skillId);

  if (!skill) {
    return;
  }

  skill.symlinks = skill.symlinks.filter(s => s.target !== target);
  await saveRegistry(registry);
}

export async function removeSkill(id: string): Promise<void> {
  const registry = await getRegistry();
  registry.skills = registry.skills.filter(s => s.id !== id);
  await saveRegistry(registry);
}

export async function removeSkillsForRepo(repo: string): Promise<void> {
  const registry = await getRegistry();
  registry.skills = registry.skills.filter((skill) => skill.repo !== repo);
  await saveRegistry(registry);
}

// Repo metadata management
export async function getRepoMetadata(repoPath: string): Promise<RepoMetadata | undefined> {
  const metaPath = path.join(repoPath, '.skilllink.json');

  try {
    const content = await fs.readFile(metaPath, 'utf-8');
    return JSON.parse(content) as RepoMetadata;
  } catch {
    return undefined;
  }
}

export async function saveRepoMetadata(repoPath: string, metadata: RepoMetadata): Promise<void> {
  const metaPath = path.join(repoPath, '.skilllink.json');
  await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
}

export async function getManagedReposRegistry(): Promise<RepoMetadata[]> {
  return readJsonFile(REPOS_PATH, []);
}

export async function saveManagedReposRegistry(repos: RepoMetadata[]): Promise<void> {
  await ensureRegistryDir();
  await fs.writeFile(REPOS_PATH, JSON.stringify(repos, null, 2), 'utf-8');
}

export async function upsertManagedRepo(repo: RepoMetadata): Promise<void> {
  const repos = await getManagedReposRegistry();
  const nextRepos = repos.filter((entry) => entry.path !== repo.path);
  nextRepos.push(repo);
  nextRepos.sort((a, b) => `${a.owner}/${a.name}`.localeCompare(`${b.owner}/${b.name}`));
  await saveManagedReposRegistry(nextRepos);
}

function managedRepoName(repo: RepoMetadata): string {
  return `${repo.owner}/${repo.name}`;
}

export async function removeManagedRepo(name: string): Promise<RemoveManagedRepoResult> {
  const repos = await getManagedReposRegistry();
  const exactMatch = repos.find((entry) => managedRepoName(entry) === name);
  const shortNameMatches = name.includes('/')
    ? []
    : repos.filter((entry) => entry.name === name);
  const repo = exactMatch ?? shortNameMatches[0];

  if (!repo) {
    return {};
  }

  if (!exactMatch && shortNameMatches.length > 1) {
    return { ambiguousRepos: shortNameMatches };
  }

  await saveManagedReposRegistry(
    repos.filter((entry) => entry.path !== repo.path)
  );

  return { repo };
}

export async function getReposDir(): Promise<string> {
  const configPath = path.join(CONFIG_DIR, 'config.json');
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    return expandPath(config.reposDir);
  } catch {
    return expandPath('~/skilllink/repos');
  }
}

export async function listManagedRepos(): Promise<RepoMetadata[]> {
  const repos = await getManagedReposRegistry();
  const refreshed: RepoMetadata[] = [];

  for (const repo of repos) {
    const fromDisk = await getRepoMetadata(repo.path);
    refreshed.push(fromDisk ?? repo);
  }

  return refreshed;
}
