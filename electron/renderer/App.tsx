import React, { useState } from 'react';
import { RepoSidebar } from './components/RepoSidebar.js';
import { FileBrowser } from './components/FileBrowser.js';
import { SkillCards } from './components/SkillCards.js';
import { SymlinkPanel } from './components/SymlinkPanel.js';
import type { OperationResult, RepoMetadata, Skill } from '../types.js';
import './App.css';

type View = 'repos' | 'skills';

type Notice = {
  kind: 'info' | 'success' | 'error';
  message: string;
};

function resultMessage(result: OperationResult, fallback: string): Notice {
  if (result.ok) {
    return {
      kind: 'success',
      message: result.message || fallback
    };
  }

  return {
    kind: 'error',
    message: result.error.action
      ? `${result.error.message} ${result.error.action}`
      : result.error.message
  };
}

export function App() {
  const [currentView, setCurrentView] = useState<View>('skills');
  const [selectedRepo, setSelectedRepo] = useState<RepoMetadata | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<Notice>({
    kind: 'info',
    message: 'Add a repository, discover skills, then link them into a target directory.'
  });
  const [busyLabel, setBusyLabel] = useState<string | null>(null);

  function refreshData() {
    setRefreshKey((value) => value + 1);
  }

  async function runOperation(label: string, operation: () => Promise<OperationResult>, successMessage: string) {
    setBusyLabel(label);
    try {
      const result = await operation();
      setNotice(resultMessage(result, successMessage));
      if (result.ok) {
        refreshData();
      }
    } catch (error) {
      setNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Operation failed.'
      });
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleAddRepo() {
    const repoUrl = window.prompt('GitHub repository, for example vercel-labs/skills');
    if (!repoUrl) {
      return;
    }

    await runOperation(
      'Adding repository',
      () => window.skilllink!.repoAdd(repoUrl),
      'Repository added.'
    );
    setCurrentView('repos');
  }

  async function handleDiscoverSkills() {
    await runOperation(
      'Discovering skills',
      () => window.skilllink!.skillDiscover(),
      'Skill registry updated.'
    );
  }

  async function handleSyncRepos() {
    await runOperation(
      'Syncing repositories',
      () => window.skilllink!.repoSync(),
      'Repositories synced.'
    );
  }

  async function handleSyncLinks() {
    await runOperation(
      'Syncing symlinks',
      () => window.skilllink!.linkSync(),
      'Symlink registry updated.'
    );
  }

  async function handleCreateLink(skillRef: string, skill?: Skill) {
    const target = window.prompt('Target alias or path. Leave empty for the default target.');
    await runOperation(
      'Creating link',
      () => window.skilllink!.linkCreate(skillRef, target || undefined),
      'Symlink created.'
    );
    if (skill) {
      setSelectedSkill(skill);
    }
    setCurrentView('skills');
  }

  async function handleRemoveLink(skill: Skill, targetPath: string) {
    const confirmed = window.confirm(`Remove symlink at ${targetPath}?`);
    if (!confirmed) {
      return;
    }

    await runOperation(
      'Removing link',
      () => window.skilllink!.linkRemove(skill.id, targetPath),
      'Symlink removed.'
    );
  }

  async function handleUpdateLink(skill: Skill, oldTarget: string) {
    const target = window.prompt('New target alias or path', oldTarget);
    if (!target) {
      return;
    }

    await runOperation(
      'Updating link',
      () => window.skilllink!.linkUpdate(skill.id, target, oldTarget),
      'Symlink updated.'
    );
  }

  async function handleBranchSwitch(repo: RepoMetadata, branchName: string) {
    await runOperation(
      'Switching branch',
      () => window.skilllink!.branchSwitch(branchName, `${repo.owner}/${repo.name}`),
      'Branch switched.'
    );
  }

  async function handleBranchCreate(repo: RepoMetadata) {
    const branchName = window.prompt('New branch name');
    if (!branchName) {
      return;
    }

    await runOperation(
      'Creating branch',
      () => window.skilllink!.branchCreate(branchName, `${repo.owner}/${repo.name}`),
      'Branch created.'
    );
  }

  async function handleRemoveRepo(repo: RepoMetadata) {
    const confirmed = window.confirm(`Remove ${repo.owner}/${repo.name} from SkillLink? Repository files will be kept.`);
    if (!confirmed) {
      return;
    }

    await runOperation(
      'Removing repository',
      () => window.skilllink!.repoRemove(`${repo.owner}/${repo.name}`, false),
      'Repository removed.'
    );
    if (selectedRepo?.path === repo.path) {
      setSelectedRepo(null);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>SkillLink</h1>
          <p>Manage skill repositories and symlinks.</p>
        </div>
        <nav className="view-switcher" aria-label="Primary view">
          <button className={currentView === 'skills' ? 'is-active' : ''} onClick={() => setCurrentView('skills')}>
            Skills
          </button>
          <button className={currentView === 'repos' ? 'is-active' : ''} onClick={() => setCurrentView('repos')}>
            Repositories
          </button>
        </nav>
        <div className="topbar-actions">
          <button onClick={() => void handleAddRepo()}>Add Repo</button>
          <button onClick={() => void handleDiscoverSkills()}>Discover</button>
          <button onClick={() => void handleSyncRepos()}>Sync Repos</button>
          <button onClick={() => void handleSyncLinks()}>Sync Links</button>
        </div>
      </header>

      <div className={`notice notice-${notice.kind}`} role="status">
        <span>{busyLabel ? `${busyLabel}...` : notice.message}</span>
      </div>

      <main className="workspace">
        <RepoSidebar
          selectedRepo={selectedRepo}
          visible={currentView === 'repos'}
          refreshKey={refreshKey}
          onSelectRepo={setSelectedRepo}
          onBranchSwitch={handleBranchSwitch}
          onBranchCreate={handleBranchCreate}
          onRemoveRepo={handleRemoveRepo}
        />

        <section className="content-pane">
          {currentView === 'skills' ? (
            <SkillCards
              onSelectSkill={setSelectedSkill}
              selectedSkill={selectedSkill}
              refreshKey={refreshKey}
              onCreateLink={handleCreateLink}
            />
          ) : (
            <FileBrowser
              repo={selectedRepo}
              onCreateSymlink={handleCreateLink}
            />
          )}
        </section>

        <SymlinkPanel
          skill={selectedSkill}
          visible={currentView === 'skills' && selectedSkill !== null}
          refreshKey={refreshKey}
          onCreateLink={handleCreateLink}
          onRemoveLink={handleRemoveLink}
          onUpdateLink={handleUpdateLink}
        />
      </main>
    </div>
  );
}
