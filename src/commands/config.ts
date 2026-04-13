import { getConfig, setConfig, getConfigValue, listSkillsDirs } from '../lib/config-store.js';
import type { Config } from '../types.js';

export async function configGet(key: string): Promise<void> {
  const value = await getConfigValue(key);

  if (value === undefined) {
    console.log(`Config key not found: ${key}`);
    return;
  }

  console.log(value);
}

export async function configData(): Promise<Config & { resolvedSkillsDirs: Record<string, string> }> {
  const config = await getConfig();
  const resolvedSkillsDirs = await listSkillsDirs();
  return {
    ...config,
    resolvedSkillsDirs
  };
}

export async function configSet(key: string, value: string): Promise<void> {
  // Try to parse as JSON if it looks like an object/array
  let parsedValue: unknown = value;

  if (value.startsWith('{') || value.startsWith('[')) {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      // Keep as string
    }
  }

  await setConfig(key, parsedValue);
  console.log(`✓ Config updated: ${key} = ${value}`);
}

export async function configList(): Promise<void> {
  const config = await getConfig();

  console.log(`SkillLink Configuration:\n`);
  console.log(`  reposDir: ${config.reposDir}`);
  console.log(`  defaultSkillsDir: ${config.defaultSkillsDir}`);
  console.log(`\n  Skills Directories:`);

  const dirs = await listSkillsDirs();
  for (const [type, dir] of Object.entries(dirs)) {
    const isDefault = type === config.defaultSkillsDir ? ' (default)' : '';
    console.log(`    ${type}${isDefault}: ${dir}`);
  }
}
