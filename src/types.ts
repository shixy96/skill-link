// SkillLink Error Types
export type SkillLinkError =
  | { code: 'GH_NOT_INSTALLED'; message?: string; action: 'Install gh CLI: https://cli.github.com' }
  | { code: 'GH_AUTH_FAILED'; message?: string; action: 'Run gh auth login' }
  | { code: 'GH_NOT_AUTHED'; message?: string; action: 'Run gh auth login' }
  | { code: 'CLONE_FAILED'; repo: string; message: string; action: 'Check network or repo URL' }
  | { code: 'FETCH_FAILED'; repo: string; message?: string; action: 'Check network and repo remote' }
  | { code: 'PUSH_FAILED'; repo: string; message?: string; action: 'Check write permissions' }
  | { code: 'SYMLINK_EXISTS'; path: string; message?: string; action: 'Remove existing symlink first: skilllink link remove <name>' }
  | { code: 'SYMLINK_BROKEN'; path: string; message?: string; action: 'Run skilllink link sync to update registry' }
  | { code: 'SYMLINK_NOT_SYMLINK'; path: string; message?: string; action: 'Remove or backup existing file: rm <path>' }
  | { code: 'INVALID_SKILL_PATH'; path: string; message?: string; action: 'Verify skill path' }
  | { code: 'SKILLS_DIR_NOT_FOUND'; path: string; message?: string; action: 'Create directory or update config' }
  | { code: 'SKILL_NOT_FOUND'; name: string; message?: string; action: 'Check skill list: skilllink skill list' }
  | { code: 'REPO_NOT_FOUND'; name: string; message?: string; action: 'Add repo: skilllink repo add <url>' }
  | { code: 'BRANCH_NOT_FOUND'; name: string; message?: string; action: 'List branches: skilllink branch list' }
  | { code: 'PARSE_SKILL_MD_FAILED'; path: string; message?: string; action: 'Verify SKILL.md format' }
  | { code: 'CONFIG_INVALID'; key: string; message?: string; action: 'Check config syntax' };

export function getErrorMessage(err: SkillLinkError): string {
  if ('message' in err && err.message) {
    return err.message;
  }
  if ('repo' in err) {
    return `Operation failed for ${err.repo}`;
  }
  if ('path' in err) {
    return `Operation failed for ${err.path}`;
  }
  if ('name' in err) {
    return `Operation failed for ${err.name}`;
  }
  if ('key' in err) {
    return `Config error for ${err.key}`;
  }
  return 'Unknown error';
}

export function formatError(err: SkillLinkError): string {
  return `[${err.code}] ${getErrorMessage(err)}\n  → ${err.action}`;
}

export interface OperationError {
  code: string;
  message: string;
  action?: string;
}

export type OperationResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: OperationError };

export function toOperationError(err: SkillLinkError): OperationError {
  return {
    code: err.code,
    message: getErrorMessage(err),
    action: err.action
  };
}

export function ok<T>(data: T, message?: string): OperationResult<T> {
  return { ok: true, data, message };
}

export function fail(error: OperationError | SkillLinkError): OperationResult<never> {
  if ('message' in error && typeof error.message === 'string') {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        action: error.action
      }
    };
  }

  return { ok: false, error: toOperationError(error as SkillLinkError) };
}

// Config types
export interface Config {
  reposDir: string;
  skillsDirs: {
    claude: string;
    openclaw: string;
    agent: string;
  };
  defaultSkillsDir: 'claude' | 'openclaw' | 'agent';
  ghAuthToken: string;
}

// Skill Registry types
export interface SymlinkEntry {
  target: string;
  createdAt: string;
  status: 'active' | 'broken';
}

export interface Skill {
  id: string;
  name: string;
  repo: string;
  path: string;
  hasSKILLMd: boolean;
  symlinks: SymlinkEntry[];
}

export interface SkillRegistry {
  skills: Skill[];
}

// Repo Metadata types
export interface RepoMetadata {
  name: string;
  owner: string;
  path: string;
  branches: string[];
  currentBranch: string;
}

// Capability types
export interface Capability {
  canClone: boolean;
  canFetch: boolean;
  canPush: boolean;
  canManageSymlinks: boolean;
  canDiscoverSkills: boolean;
}

// Skill parsed from SKILL.md
export interface ParsedSkill {
  name: string;
  description?: string;
  version?: string;
  path: string;
}

export interface FileBrowserEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  hasSKILLMd: boolean;
  skillName?: string;
}

export interface ListedSymlink {
  skillId: string;
  skillName: string;
  repo: string;
  target: string;
  createdAt: string;
  status: 'active' | 'broken';
}
