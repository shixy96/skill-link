import React, { useEffect, useState } from 'react';
import type { ListedSymlink, Skill } from '../../types.js';

interface SymlinkPanelProps {
  skill: Skill | null;
  visible: boolean;
  refreshKey: number;
  onCreateLink: (skillRef: string, skill?: Skill) => void;
  onRemoveLink: (skill: Skill, targetPath: string) => void;
  onUpdateLink: (skill: Skill, oldTarget: string) => void;
}

export function SymlinkPanel({
  skill,
  visible,
  refreshKey,
  onCreateLink,
  onRemoveLink,
  onUpdateLink
}: SymlinkPanelProps) {
  const [symlinks, setSymlinks] = useState<ListedSymlink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (skill && visible) {
      void loadSymlinks();
    }
  }, [skill?.id, visible, refreshKey]);

  async function loadSymlinks() {
    if (!skill) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextSymlinks = await window.skilllink?.linkList(skill.id);
      setSymlinks(nextSymlinks ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load symlinks.');
      setSymlinks([]);
    } finally {
      setLoading(false);
    }
  }

  if (!visible || !skill) {
    return null;
  }

  return (
    <aside className="symlink-panel">
      <div className="pane-header">
        <div>
          <h2>{skill.name}</h2>
          <div className="muted">Symlinks</div>
        </div>
        <button onClick={() => onCreateLink(skill.id, skill)}>Add</button>
      </div>

      {loading ? (
        <div className="empty-state">Loading symlinks...</div>
      ) : error ? (
        <div className="empty-state">{error}</div>
      ) : symlinks.length === 0 ? (
        <div className="empty-state">
          No symlinks for this skill.
        </div>
      ) : (
        <div className="symlink-list">
          {symlinks.map((symlink) => (
            <article key={symlink.target} className="symlink-item">
              <div className="badge-row">
                <span className={`badge ${symlink.status === 'broken' ? 'badge-danger' : ''}`}>
                  {symlink.status}
                </span>
              </div>
              <div className="path-text" title={symlink.target}>{symlink.target}</div>
              <div className="muted">
                Created {new Date(symlink.createdAt).toLocaleDateString()}
              </div>
              <div className="panel-actions">
                <button onClick={() => onUpdateLink(skill, symlink.target)}>Update</button>
                <button onClick={() => onRemoveLink(skill, symlink.target)}>Remove</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </aside>
  );
}
