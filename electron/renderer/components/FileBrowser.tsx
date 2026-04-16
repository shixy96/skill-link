import React, { useEffect, useMemo, useState } from 'react';
import type { FileBrowserEntry, RepoMetadata } from '../../types.js';

interface FileBrowserProps {
  repo: RepoMetadata | null;
  onCreateSymlink: (skillRef: string) => void;
}

function dirname(filePath: string): string {
  // Use the last `/` on all platforms; on Windows the main process
  // normalises to forward slashes before sending paths to the renderer.
  const lastSlash = filePath.lastIndexOf('/');
  const lastBack = filePath.lastIndexOf('\\');
  const lastSep = Math.max(lastSlash, lastBack);

  if (lastSep <= 0) {
    return filePath.slice(0, lastSep + 1) || '/';
  }

  return filePath.slice(0, lastSep);
}

export function FileBrowser({ repo, onCreateSymlink }: FileBrowserProps) {
  const [files, setFiles] = useState<FileBrowserEntry[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atRepoRoot = useMemo(() => Boolean(repo && currentPath === repo.path), [repo, currentPath]);

  useEffect(() => {
    if (repo) {
      setCurrentPath(repo.path);
      void loadDirectory(repo.path);
    } else {
      setFiles([]);
      setCurrentPath('');
    }
  }, [repo?.path]);

  async function loadDirectory(dirPath: string) {
    if (!repo) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextFiles = await window.skilllink?.fileList(`${repo.owner}/${repo.name}`, dirPath);
      setFiles(nextFiles ?? []);
      setCurrentPath(dirPath);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load directory.');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }

  function navigateUp() {
    if (!repo || atRepoRoot) {
      return;
    }

    const parent = dirname(currentPath);
    if (parent.startsWith(repo.path)) {
      void loadDirectory(parent);
    }
  }

  if (!repo) {
    return (
      <div className="empty-state">
        Select a repository to browse.
      </div>
    );
  }

  return (
    <div className="browser-shell">
      <div className="browser-toolbar">
        <button disabled={atRepoRoot} onClick={navigateUp}>
          Back
        </button>
        <div className="path-text" title={currentPath}>{currentPath}</div>
      </div>

      {loading ? (
        <div className="empty-state">Loading files...</div>
      ) : error ? (
        <div className="empty-state">{error}</div>
      ) : files.length === 0 ? (
        <div className="empty-state">No files in this directory.</div>
      ) : (
        <div className="file-list">
          {files.map((file) => (
            <div
              key={file.path}
              className="file-row"
              onContextMenu={(event) => {
                event.preventDefault();
                if (file.hasSKILLMd) {
                  onCreateSymlink(file.skillPath || file.path);
                }
              }}
            >
              <span>{file.isDirectory ? 'dir' : 'file'}</span>
              <button
                className="repo-button"
                disabled={!file.isDirectory}
                onClick={() => file.isDirectory ? void loadDirectory(file.path) : undefined}
                title={file.path}
              >
                <span className="path-text">{file.name}</span>
              </button>
              {file.hasSKILLMd && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onCreateSymlink(file.skillPath || file.path);
                  }}
                >
                  Create Link
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
