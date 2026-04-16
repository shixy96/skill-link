import React, { useEffect, useState } from 'react';
import type { RepoMetadata } from '../../types.js';

interface RepoSidebarProps {
  onSelectRepo: (repo: RepoMetadata | null) => void;
  onBranchSwitch: (repo: RepoMetadata, branchName: string) => Promise<void>;
  onBranchCreate: (repo: RepoMetadata) => Promise<void>;
  onRemoveRepo: (repo: RepoMetadata) => Promise<void>;
  selectedRepo: RepoMetadata | null;
  visible: boolean;
  refreshKey: number;
}

function cleanBranchName(branch: string): string {
  return branch.replace(/^\* /, '').replace(/^remotes\//, '').trim();
}

export function RepoSidebar({
  onSelectRepo,
  onBranchSwitch,
  onBranchCreate,
  onRemoveRepo,
  selectedRepo,
  visible,
  refreshKey
}: RepoSidebarProps) {
  const [repos, setRepos] = useState<RepoMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      void loadRepos();
    }
  }, [visible, refreshKey]);

  async function loadRepos() {
    setLoading(true);
    setError(null);
    try {
      const reposData = await window.skilllink?.repoList();
      setRepos(reposData ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load repositories.');
      setRepos([]);
    } finally {
      setLoading(false);
    }
  }

  if (!visible) {
    return null;
  }

  return (
    <aside className="sidebar">
      <div className="pane-header">
        <div>
          <h2>Repositories</h2>
          <div className="muted">{repos.length} managed</div>
        </div>
        <button onClick={() => void loadRepos()}>Refresh</button>
      </div>

      {loading ? (
        <div className="empty-state">Loading repositories...</div>
      ) : error ? (
        <div className="empty-state">{error}</div>
      ) : repos.length === 0 ? (
        <div className="empty-state">No repositories yet.</div>
      ) : (
        <ul className="list-reset">
          {repos.map((repo) => {
            const repoLabel = `${repo.owner}/${repo.name}`;
            const branches = Array.from(new Set(repo.branches.map(cleanBranchName).filter(Boolean)));
            if (repo.currentBranch && !branches.includes(repo.currentBranch)) {
              branches.unshift(repo.currentBranch);
            }

            return (
              <li
                key={repo.path}
                className={`repo-item ${selectedRepo?.path === repo.path ? 'is-selected' : ''}`}
              >
                <button className="repo-button" onClick={() => onSelectRepo(repo)}>
                  <div className="repo-name">{repoLabel}</div>
                  <div className="muted">{repo.path}</div>
                </button>

                <select
                  className="branch-select"
                  value={repo.currentBranch}
                  onChange={(event) => void onBranchSwitch(repo, event.target.value)}
                  aria-label={`Branch for ${repoLabel}`}
                >
                  {branches.length === 0 ? (
                    <option value={repo.currentBranch}>{repo.currentBranch || 'No branch'}</option>
                  ) : (
                    branches.map((branch) => (
                      <option key={branch} value={branch}>
                        {branch}
                      </option>
                    ))
                  )}
                </select>

                <div className="repo-toolbar">
                  <button onClick={() => void onBranchCreate(repo)}>New Branch</button>
                  <button onClick={() => void onRemoveRepo(repo)}>Remove</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
