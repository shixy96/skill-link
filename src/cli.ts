#!/usr/bin/env node

import { parseArgs } from 'util';
import { repoAdd, repoList, repoRemove, repoSync } from './commands/repo.js';
import { gitFetch, gitPush } from './commands/git.js';
import { branchList, branchSwitch, branchCreate } from './commands/branch.js';
import { skillList, skillDiscover } from './commands/skill.js';
import { linkCreate, linkRemove, linkList, linkSync, linkUpdate } from './commands/link.js';
import { configGet, configSet, configList } from './commands/config.js';
import { doctor } from './commands/doctor.js';

const commands: Record<string, string[]> = {
  'repo': ['add', 'list', 'remove', 'sync'],
  'git': ['fetch', 'push'],
  'branch': ['list', 'switch', 'create'],
  'skill': ['list', 'discover'],
  'link': ['create', 'remove', 'list', 'sync', 'update'],
  'config': ['get', 'set', 'list-skills-dirs'],
  'doctor': []
};

function printHelp() {
  console.log(`
SkillLink - Skill Management CLI

Usage: skilllink <command> [options]

Commands:
  repo add <url>              Clone a GitHub repo
  repo list                  List managed repos
  repo remove <name>         Remove a repo
  repo sync                  Fetch & pull all repos

  git fetch [repo]            Fetch remotes
  git push [repo]            Push current branch

  branch list [repo]         List branches
  branch switch <name>       Switch to branch
  branch create <name>       Create branch

  skill list                 List all skills
  skill discover             Rescan repos for skills

  link create <skill> [target] [--target <path>]  Create symlink
  link remove <skill>       Remove symlinks
  link list                 List all symlinks
  link sync                  Reconcile registry with filesystem
  link update <skill> --target <new-path>  Update symlink target

  config get <key>           Get config value
  config set <key> <value>   Set config value
  config list-skills-dirs   List skills directories

  doctor                     Diagnose issues

Options:
  --help, -h                 Show this help
  --version, -v              Show version
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    return;
  }

  if (args[0] === '--version' || args[0] === '-v') {
    console.log('skilllink v0.1.0');
    return;
  }

  const [command, subcommand, ...rest] = args;

  switch (command) {
    case 'repo':
      switch (subcommand) {
        case 'add':
          if (rest[0]) {
            await repoAdd(rest[0]);
          } else {
            console.error('Usage: skilllink repo add <url>');
          }
          break;
        case 'list':
          await repoList();
          break;
        case 'remove':
          if (rest[0]) {
            await repoRemove(rest[0], rest.includes('--delete'));
          } else {
            console.error('Usage: skilllink repo remove <name>');
          }
          break;
        case 'sync':
          await repoSync();
          break;
        default:
          console.error(`Unknown subcommand: ${subcommand}`);
          console.error(`Valid subcommands: ${commands.repo.join(', ')}`);
      }
      break;

    case 'git':
      switch (subcommand) {
        case 'fetch':
          await gitFetch(rest[0]);
          break;
        case 'push':
          await gitPush(rest[0]);
          break;
        default:
          console.error(`Unknown subcommand: ${subcommand}`);
          console.error(`Valid subcommands: ${commands.git.join(', ')}`);
      }
      break;

    case 'branch':
      switch (subcommand) {
        case 'list':
          await branchList(rest[0]);
          break;
        case 'switch':
          if (rest[0]) {
            await branchSwitch(rest[0], rest[1]);
          } else {
            console.error('Usage: skilllink branch switch <name> [repo]');
          }
          break;
        case 'create':
          if (rest[0]) {
            await branchCreate(rest[0], rest[1]);
          } else {
            console.error('Usage: skilllink branch create <name> [repo]');
          }
          break;
        default:
          console.error(`Unknown subcommand: ${subcommand}`);
          console.error(`Valid subcommands: ${commands.branch.join(', ')}`);
      }
      break;

    case 'skill':
      switch (subcommand) {
        case 'list':
          await skillList();
          break;
        case 'discover':
          await skillDiscover();
          break;
        default:
          console.error(`Unknown subcommand: ${subcommand}`);
          console.error(`Valid subcommands: ${commands.skill.join(', ')}`);
      }
      break;

    case 'link':
      switch (subcommand) {
        case 'create':
          if (rest[0]) {
            const targetIndex = rest.indexOf('--target');
            const skillPath = rest[0];
            const target = targetIndex !== -1 ? rest[targetIndex + 1] : rest[1];
            await linkCreate(skillPath, target);
          } else {
            console.error('Usage: skilllink link create <skill> [--target <path>]');
          }
          break;
        case 'remove':
          if (rest[0]) {
            await linkRemove(rest[0]);
          } else {
            console.error('Usage: skilllink link remove <skill>');
          }
          break;
        case 'list':
          await linkList();
          break;
        case 'sync':
          await linkSync();
          break;
        case 'update':
          if (rest[0]) {
            const targetIndex = rest.indexOf('--target');
            const skillName = rest[0];
            const newTarget = targetIndex !== -1 ? rest[targetIndex + 1] : undefined;
            if (newTarget) {
              await linkUpdate(skillName, newTarget);
            } else {
              console.error('Usage: skilllink link update <skill> --target <new-path>');
            }
          } else {
            console.error('Usage: skilllink link update <skill> --target <new-path>');
          }
          break;
        default:
          console.error(`Unknown subcommand: ${subcommand}`);
          console.error(`Valid subcommands: ${commands.link.join(', ')}`);
      }
      break;

    case 'config':
      switch (subcommand) {
        case 'get':
          if (rest[0]) {
            await configGet(rest[0]);
          } else {
            console.error('Usage: skilllink config get <key>');
          }
          break;
        case 'set':
          if (rest[0] && rest[1]) {
            await configSet(rest[0], rest[1]);
          } else {
            console.error('Usage: skilllink config set <key> <value>');
          }
          break;
        case 'list-skills-dirs':
          await configList();
          break;
        default:
          await configList();
      }
      break;

    case 'doctor':
      await doctor();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
  }
}

main().catch(console.error);
