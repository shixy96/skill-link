import type { ConfigData, FileBrowserEntry, ListedSymlink, OperationResult, RepoMetadata, Skill } from '../types.js';

declare module '*.css';

declare global {
  interface Window {
    skilllink?: {
      doctor: () => Promise<void>;
      repoList: () => Promise<RepoMetadata[]>;
      repoAdd: (url: string) => Promise<OperationResult>;
      repoRemove: (name: string, deleteFiles?: boolean) => Promise<OperationResult>;
      repoSync: () => Promise<OperationResult>;
      skillList: () => Promise<Skill[]>;
      skillDiscover: () => Promise<OperationResult>;
      linkList: (skillName?: string) => Promise<ListedSymlink[]>;
      linkSync: () => Promise<OperationResult>;
      fileList: (repoName: string, dirPath?: string) => Promise<FileBrowserEntry[]>;
      linkCreate: (skillName: string, targetDir?: string) => Promise<OperationResult>;
      linkRemove: (skillName: string, targetPath?: string) => Promise<OperationResult>;
      linkUpdate: (skillName: string, newTarget: string, oldTarget?: string) => Promise<OperationResult>;
      branchList: (repoName?: string) => Promise<OperationResult>;
      branchSwitch: (branchName: string, repoName?: string) => Promise<OperationResult>;
      branchCreate: (branchName: string, repoName?: string) => Promise<OperationResult>;
      configGet: () => Promise<ConfigData>;
      configSet: (key: string, value: string) => Promise<void>;
    };
  }
}

export {};
