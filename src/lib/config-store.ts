import { homedir } from 'os';
import path from 'path';
import fs from 'fs/promises';
import type { Config } from '../types.js';

const CONFIG_DIR = path.join(homedir(), '.skilllink');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: Config = {
  reposDir: '~/skilllink/repos',
  skillsDirs: {
    claude: '~/.claude/skills',
    openclaw: '~/.openclaw/skills',
    agent: '~/.agent/skills'
  },
  defaultSkillsDir: 'claude',
  ghAuthToken: ''
};

function expandPath(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return path.join(homedir(), p.slice(1));
  }
  return p;
}

function contractPath(p: string): string {
  if (p.startsWith(homedir())) {
    return '~' + p.slice(homedir().length);
  }
  return p;
}

function assertSafeConfigKey(key: string): void {
  const unsafeSegments = new Set(['__proto__', 'constructor', 'prototype']);
  const keys = key.split('.');

  if (keys.some((segment) => !segment || unsafeSegments.has(segment))) {
    throw new Error(`Invalid config key: ${key}`);
  }
}

export async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

export async function getConfig(): Promise<Config> {
  try {
    const content = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(content) as Config;
    return {
      ...DEFAULT_CONFIG,
      ...config,
      skillsDirs: {
        ...DEFAULT_CONFIG.skillsDirs,
        ...config.skillsDirs
      }
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  assertSafeConfigKey(key);
  await ensureConfigDir();
  const config = await getConfig();

  const keys = key.split('.');
  let current: Record<string, unknown> = config as unknown as Record<string, unknown>;

  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!Object.prototype.hasOwnProperty.call(current, k)) {
      current[k] = {};
    }
    current = current[k] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export async function getConfigValue(key: string): Promise<string | undefined> {
  const config = await getConfig();
  const keys = key.split('.');
  let current: unknown = config;

  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = (current as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }

  if (typeof current === 'string') {
    return current;
  }
  return JSON.stringify(current);
}

export async function listSkillsDirs(): Promise<Record<string, string>> {
  const config = await getConfig();
  const result: Record<string, string> = {};

  for (const [key, dir] of Object.entries(config.skillsDirs)) {
    result[key] = expandPath(dir);
  }

  return result;
}

export async function resolveSkillsDir(type: 'claude' | 'openclaw' | 'agent' | string): Promise<string> {
  const dirs = await listSkillsDirs();
  if (Object.hasOwn(dirs, type)) {
    return dirs[type];
  }

  return expandPath(type.startsWith('~') ? type : `~/${type}`);
}

export { expandPath, contractPath, CONFIG_DIR, CONFIG_PATH };
