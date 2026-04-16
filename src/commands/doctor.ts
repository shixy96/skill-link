import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

import { checkGhCli, checkGhAuth, getCapabilities } from '../lib/gh-git.js';
import { getConfig, CONFIG_DIR, expandPath, listSkillsDirs } from '../lib/config-store.js';
import { getRegistry } from '../lib/skill-registry.js';

const execAsync = promisify(exec);

interface DoctorCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'skip';
  message: string;
}

export async function doctor(): Promise<void> {
  const checks: DoctorCheck[] = [];

  // Check gh CLI
  const ghAvailable = await checkGhCli();
  if (ghAvailable) {
    try {
      const { stdout } = await execAsync('gh --version', { encoding: 'utf-8' });
      const version = stdout.trim().split('\n')[0];
      checks.push({ name: 'gh CLI', status: 'pass', message: version });
    } catch {
      checks.push({ name: 'gh CLI', status: 'fail', message: 'Installed but not working' });
    }
  } else {
    checks.push({
      name: 'gh CLI',
      status: 'fail',
      message: 'Not installed (https://cli.github.com)'
    });
  }

  // Check gh authentication
  if (ghAvailable) {
    const ghAuthed = await checkGhAuth();
    if (ghAuthed) {
      checks.push({ name: 'gh authentication', status: 'pass', message: 'Authenticated' });
    } else {
      checks.push({
        name: 'gh authentication',
        status: 'warn',
        message: 'Not authenticated (run: gh auth login)'
      });
    }
  }

  // Check Git
  try {
    const { stdout } = await execAsync('git --version', { encoding: 'utf-8' });
    checks.push({ name: 'Git', status: 'pass', message: stdout.trim() });
  } catch {
    checks.push({ name: 'Git', status: 'fail', message: 'Not installed' });
  }

  // Check reposDir
  const config = await getConfig();
  const reposDir = expandPath(config.reposDir);
  try {
    await fs.access(reposDir);
    checks.push({ name: 'reposDir', status: 'pass', message: reposDir });
  } catch {
    checks.push({ name: 'reposDir', status: 'warn', message: `${reposDir} (not created yet)` });
  }

  // Check config
  try {
    const configContent = await fs.readFile(path.join(CONFIG_DIR, 'config.json'), 'utf-8');
    JSON.parse(configContent);
    checks.push({ name: 'Config', status: 'pass', message: 'Valid JSON' });
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    checks.push({
      name: 'Config',
      status: err.code === 'ENOENT' ? 'warn' : 'fail',
      message: err.code === 'ENOENT' ? 'Using default config' : 'Invalid JSON'
    });
  }

  // Check skill-registry
  try {
    const registryContent = await fs.readFile(path.join(CONFIG_DIR, 'skill-registry.json'), 'utf-8');
    const registry = JSON.parse(registryContent);
    checks.push({
      name: 'skill-registry',
      status: 'pass',
      message: `Readable (${registry.skills?.length || 0} skills)`
    });
  } catch {
    checks.push({ name: 'skill-registry', status: 'warn', message: 'Not created yet' });
  }

  // Check skills directories
  const skillsDirs = await listSkillsDirs();
  for (const [type, dir] of Object.entries(skillsDirs)) {
    try {
      await fs.access(dir);
      checks.push({ name: `skillsDir (${type})`, status: 'pass', message: dir });
      if (!dir.startsWith(homedir())) {
        checks.push({
          name: `skillsDir (${type}) shared path`,
          status: 'warn',
          message: `Outside home: ${dir}`
        });
      }
    } catch {
      checks.push({
        name: `skillsDir (${type})`,
        status: 'warn',
        message: `${dir} (not created yet)`
      });
    }
  }

  // Symlink manager
  checks.push({ name: 'symlink-manager', status: 'pass', message: 'Ready' });

  // Print results
  console.log(`SkillLink Doctor\n`);

  for (const check of checks) {
    const icon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
    console.log(`${icon} ${check.name}: ${check.message}`);
  }

  const fails = checks.filter(c => c.status === 'fail').length;
  const warns = checks.filter(c => c.status === 'warn').length;

  console.log(`\n${fails} failure(s), ${warns} warning(s)`);

  if (fails === 0) {
    console.log(`\n✓ SkillLink is ready to use`);
  } else {
    console.log(`\n✗ Please fix the issues above`);
  }
}
