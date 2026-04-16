export interface RepoMetadata {
  name: string;
  owner: string;
  path: string;
  branches: string[];
  currentBranch: string;
}

export interface Skill {
  id: string;
  name: string;
  repo: string;
  path: string;
  hasSKILLMd: boolean;
  symlinks: Array<{
    target: string;
    createdAt: string;
    status: 'active' | 'broken';
  }>;
}

export interface ListedSymlink {
  skillId: string;
  skillName: string;
  repo: string;
  target: string;
  createdAt: string;
  status: 'active' | 'broken';
}

export interface FileBrowserEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  hasSKILLMd: boolean;
  skillName?: string;
  skillPath?: string;
}

export interface OperationError {
  code: string;
  message: string;
  action?: string;
}

export type OperationResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: OperationError };

export interface ConfigData {
  reposDir: string;
  skillsDirs: {
    claude: string;
    openclaw: string;
    agent: string;
  };
  resolvedSkillsDirs: Record<string, string>;
  defaultSkillsDir: 'claude' | 'openclaw' | 'agent';
  ghAuthToken: string;
}
