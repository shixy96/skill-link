import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import type { ParsedSkill, SkillLinkError } from '../types.js';

const MAX_DEPTH = 3;

interface ParseResult {
  success: boolean;
  skill?: ParsedSkill;
  error?: SkillLinkError;
}

export async function parseSkillMd(filePath: string): Promise<ParseResult> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const { data } = matter(content);

    if (!data.name || typeof data.name !== 'string') {
      return {
        success: false,
        error: {
          code: 'PARSE_SKILL_MD_FAILED',
          path: filePath,
          action: 'Verify SKILL.md format'
        }
      };
    }

    return {
      success: true,
      skill: {
        name: data.name,
        description: data.description,
        version: data.version,
        path: path.dirname(filePath)
      }
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: 'PARSE_SKILL_MD_FAILED',
        path: filePath,
        action: 'Verify SKILL.md format'
      }
    };
  }
}

function getDepthFromRoot(repoPath: string, filePath: string): number {
  const relative = path.relative(repoPath, filePath);
  return relative.split(path.sep).length;
}

async function findSkillMdFiles(dir: string, depth: number = 0): Promise<string[]> {
  if (depth > MAX_DEPTH) {
    return [];
  }

  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.name === 'node_modules') {
        continue;
      }

      if (entry.isDirectory()) {
        const nestedFiles = await findSkillMdFiles(fullPath, depth + 1);
        files.push(...nestedFiles);
      } else if (entry.name.toUpperCase() === 'SKILL.MD') {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory might not exist or be accessible
  }

  return files;
}

export async function discoverSkillsInRepo(repoPath: string): Promise<ParsedSkill[]> {
  const skills: ParsedSkill[] = [];

  try {
    const files = await findSkillMdFiles(repoPath);

    for (const file of files) {
      const depth = getDepthFromRoot(repoPath, file);
      if (depth > MAX_DEPTH) {
        continue;
      }

      const result = await parseSkillMd(file);
      if (result.success && result.skill) {
        skills.push(result.skill);
      }
    }
  } catch {
    // Directory might not exist or be accessible
  }

  return skills;
}

export function buildSkillId(name: string, repo: string): string {
  return `${repo.replace('/', '-')}-${name}`;
}
