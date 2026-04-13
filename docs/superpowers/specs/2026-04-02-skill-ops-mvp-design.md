# SkillLink MVP Design

## Context

The user wants a visual skill management tool with these core capabilities:
1. Manage skill repositories through GitHub CLI (`gh`) operations: clone, sync, fetch, and push
2. Provide a desktop app experience similar to GitHub Desktop
3. Include file manager capabilities for linking folders from a repo into target locations via symlinks
4. Support multiple skill placement conventions, including the agent skill specification, Claude Code, and OpenClaw
5. Borrow proven practices from GitHub Desktop and vercel-labs/skills

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Desktop App (Electron)                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  Repo List  │  │ Skill Cards │  │  File Browser   │ │
│  │  + Branches │  │  + Symlinks │  │  + Symlink Ctrl │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
│                           │                             │
│                    ┌──────┴──────┐                      │
│                    │  IPC Bridge │                      │
│                    └──────┬──────┘                      │
└───────────────────────────┼─────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────┐
│                    CLI Core (Node.js)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ gh-git    │  │ skill-   │  │ symlink-manager     │  │
│  │ (gh proxy)│  │ parser   │  │ (create/remove/link)│  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ config   │  │ repo-    │  │ skill-registry      │  │
│  │ (stores) │  │ manager  │  │ (tracks all skills) │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

- **CLI**: Node.js/TypeScript
- **Desktop**: Electron, following GitHub Desktop architecture patterns
- **Git Operations**: `gh` CLI as the proxy
- **State**: Config files at `~/.skilllink/config.json` and `~/.skilllink/skill-registry.json`

## Data Structures

### Config (`~/.skilllink/config.json`)

```json
{
  "reposDir": "~/skilllink/repos",
  "skillsDirs": {
    "claude": "~/.claude/skills",
    "openclaw": "~/.openclaw/skills",
    "agent": "~/.agent/skills"
  },
  "defaultSkillsDir": "claude",
  "ghAuthToken": "gh auth token path or empty (use gh directly)"
}
```

**Supported SkillsDir conventions:**
- `claude`: Claude Code global skills (`~/.claude/skills/`)
- `openclaw`: OpenClaw global skills (`~/.openclaw/skills/`)
- `agent`: Agent Skill specification global skills (`~/.agent/skills/`)

### Skill Registry (`~/.skilllink/skill-registry.json`)

```json
{
  "skills": [
    {
      "id": "uuid",
      "name": "find-skills",
      "repo": "vercel-labs/skills",
      "path": "skills/find-skills",
      "hasSKILLMd": true,
      "symlinks": [
        { "target": "~/.claude/skills/find-skills", "createdAt": "...", "status": "active" }
      ]
    }
  ]
}
```

### Repo Metadata (`~/.skilllink/repos/{owner}/{repo}/.skilllink.json`)

```json
{
  "name": "skills",
  "owner": "vercel-labs",
  "path": "/Users/x/skilllink/repos/vercel-labs/skills",
  "branches": ["main", "dev"],
  "currentBranch": "main"
}
```

## Error Handling

### Error Types

```typescript
type SkillLinkError =
  | { code: 'GH_NOT_INSTALLED'; message: 'gh CLI not found'; action: 'Install gh CLI: https://cli.github.com' }
  | { code: 'GH_AUTH_FAILED'; message: 'GitHub authentication failed'; action: 'Run gh auth login' }
  | { code: 'GH_NOT_AUTHED'; message: 'GitHub not authenticated'; action: 'Run gh auth login' }
  | { code: 'CLONE_FAILED'; repo: string; message: string; action: 'Check network or repo URL' }
  | { code: 'FETCH_FAILED'; repo: string; action: 'Check network and repo remote' }
  | { code: 'PUSH_FAILED'; repo: string; action: 'Check write permissions' }
  | { code: 'SYMLINK_EXISTS'; path: string; action: 'Remove existing symlink first: skilllink link remove <name>' }
  | { code: 'SYMLINK_BROKEN'; path: string; action: 'Run skilllink link sync to update registry' }
  | { code: 'SYMLINK_NOT_SYMLINK'; path: string; action: 'Remove or backup existing file: rm <path>' }
  | { code: 'INVALID_SKILL_PATH'; path: string; message: 'Path must contain SKILL.md'; action: 'Verify skill path' }
  | { code: 'SKILLS_DIR_NOT_FOUND'; path: string; action: 'Create directory or update config' }
  | { code: 'SKILL_NOT_FOUND'; name: string; action: 'Check skill list: skilllink skill list' }
  | { code: 'REPO_NOT_FOUND'; name: string; action: 'Add repo: skilllink repo add <url>' }
  | { code: 'BRANCH_NOT_FOUND'; name: string; action: 'List branches: skilllink branch list' }
  | { code: 'PARSE_SKILL_MD_FAILED'; path: string; action: 'Verify SKILL.md format' }
  | { code: 'CONFIG_INVALID'; key: string; action: 'Check config syntax' };
```

### Error Output Format

```typescript
function formatError(err: SkillLinkError): string {
  return `[${err.code}] ${err.message}\n  → ${err.action}`;
}
```

CLI output example:
```
$ skilllink link create invalid/path
[INVALID_SKILL_PATH] Path must contain SKILL.md
  → Verify skill path
```

### Capability Detection

```typescript
interface Capability {
  canClone: boolean;         // gh repo clone
  canFetch: boolean;         // gh fetch
  canPush: boolean;          // gh push
  canManageSymlinks: boolean; // always available
  canDiscoverSkills: boolean; // local scan works offline
}

function getCapabilities(): Capability {
  const ghAvailable = checkGhCli();
  const ghAuthed = ghAvailable && checkGhAuth();
  return {
    canClone: ghAuthed,
    canFetch: ghAuthed,
    canPush: ghAuthed,
    canManageSymlinks: true,
    canDiscoverSkills: true
  };
}
```

## Offline Behavior

### Capability Detection

```typescript
function getCapabilities(): Capability {
  const ghAvailable = checkGhCli();
  const ghAuthed = ghAvailable && checkGhAuth();
  return {
    canClone: ghAuthed,
    canFetch: ghAuthed,
    canPush: ghAuthed,
    canManageSymlinks: true,   // always available offline
    canDiscoverSkills: true     // local scan works offline
  };
}
```

### Command Availability Matrix

| Command | Online Required | Fallback |
|---------|----------------|----------|
| `repo add` | Yes (gh clone) | Error with setup instructions |
| `repo list` | No | Show cached repos from registry |
| `repo remove` | No | Remove local files only |
| `repo sync` | Yes | Error "offline, skipping" |
| `git fetch` | Yes | Error "offline" |
| `git push` | Yes | Error "offline" |
| `branch switch` | No* | Switch local branch only |
| `skill list` | No | Show from registry |
| `skill discover` | No | Local file scan only |
| `link create` | No | Works fully offline |
| `link remove` | No | Works fully offline |
| `link list` | No | Shows cached + stat results |
| `link sync` | No | Filesystem stat only |
| `config get/set` | No | Works fully offline |
| `doctor` | Partial | Runs checks, skips gh-dependent ones |

*Switching to a remote branch requires fetch

### Caching Strategy

- Registry stored locally — always available
- Repo metadata cached in `~/.skilllink/repos/{owner}/{repo}/.skilllink.json`
- Branch list cached, refreshed on `fetch` or `repo sync`

### Offline `doctor` Output

```
$ skilllink doctor
✓ gh CLI installed (v2.51.0)
⚠ gh authentication: OFFLINE (skipped)
✓ Git installed
✓ reposDir exists: ~/skilllink/repos
✓ config valid
✓ skill-registry readable
✓ symlink-manager ready
```

## Core Features (MVP)

### 1. Repo Management

- [ ] `skilllink repo add <url>` - Clone repo via `gh repo clone` or git
- [ ] `skilllink repo list` - List all managed repos
- [ ] `skilllink repo remove <name>` - Remove repo (keep or delete files)
- [ ] `skilllink repo sync` - Fetch + pull for all repos

### 2. Git Operations (via gh)

- [ ] `skilllink git fetch` - Fetch all remotes
- [ ] `skilllink git push` - Push current branch
- [ ] `skilllink branch list` - List branches
- [ ] `skilllink branch switch <name>` - Switch branch
- [ ] `skilllink branch create <name>` - Create new branch

### 3. Skill Discovery

- [ ] Scan repos for SKILL.md files
- [ ] Parse SKILL.md to extract name/description
- [ ] Build skill registry index
- [ ] `skilllink skill list` - List all discovered skills
- [ ] `skilllink skill discover` - Rescan all repos, update registry

#### Discovery Rules

**Scan Behavior:**
- Recursive scan within repo, max depth of 3 levels from repo root
- Only matches `**/SKILL.md` (exact filename, case-insensitive)
- Must have valid frontmatter with `name:` field to be valid skill

**SKILL.md Frontmatter Requirement:**
```yaml
---
name: skill-name        # required
description: ...        # optional
version: "1.0"          # optional
---
```

**Nested Skills:**
```
repo/
├── skills/                          # depth=1 ✓
│   ├── find-skills/                 # depth=2 ✓
│   │   └── SKILL.md                  # valid
│   └── sub-folder/
│       └── SKILL.md                  # depth=3 ✓, valid
├── deeply/nested/SKILL.md            # depth=3 ✓, valid
└── very/deeply/nested/SKILL.md       # depth=4 ✗, skipped
```

**`skill discover` Output:**
```
$ skilllink skill discover
Scanning 3 repos...
  vercel-labs/skills: found 8 skills
  anthropics/claude-code: found 12 skills
  test-org/test-repo: 0 skills
Updating registry...
Done. 20 skills total.
```

### 4. Symlink Management

- [ ] `skilllink link create <skill-path> <target-dir>` - Create symlink
- [ ] `skilllink link remove <skill-id>` - Remove symlink(s)
- [ ] `skilllink link list` - List all symlinks (auto-checks status)
- [ ] `skilllink link sync` - Reconcile registry with filesystem state
- [ ] `skilllink link update <skill> --target <new-path>` - Repoint symlink to new target
- [ ] Track symlink state in registry (active | broken)

#### Symlink Lifecycle

**Broken Symlink Handling:**
- `link list` silently stats each symlink target
- If target doesn't exist → mark as `[BROKEN]`, status = `"broken"` in registry
- Registry not auto-updated until `link sync` runs

**Link Sync Behavior:**
```
$ skilllink link sync
Scanning 12 symlinks...
✓ 10 active
⚠ 2 broken (marked in registry)
Run 'skilllink link list' to see broken symlinks
```

**Collision Handling:**
- If target exists as regular file/directory → error `SYMLINK_NOT_SYMLINK`
- User must manually remove/backup before linking

### 5. Desktop App (Electron)

- [ ] **Repo View** - Sidebar with repo list, branch selector
- [ ] **File Browser** - Navigate repo directories, right-click "Create Symlink"
- [ ] **Skills View** - Card grid of all skills, show symlink status
- [ ] **Symlink Panel** - For selected skill, show/create/remove symlinks

## CLI Commands

```
skilllink repo add <github-url>     Clone a GitHub repo
skilllink repo list                 List managed repos
skilllink repo remove <name>        Remove a repo
skilllink repo sync                 Fetch & pull all repos

skilllink git fetch [repo]          Fetch remotes
skilllink git push [repo]           Push current branch

skilllink branch list [repo]        List branches
skilllink branch switch <name>      Switch to branch
skilllink branch create <name>      Create branch

skilllink skill list               List all skills (from registry)
skilllink skill discover           Rescan repos for skills

skilllink link create <skill> [--target claude|openclaw|agent|<path>] Create symlink
                                       # --target: which skillsDir (default: config.defaultSkillsDir)
skilllink link remove <skill>      Remove symlinks
skilllink link list                List all symlinks (auto-checks status)
skilllink link sync                Reconcile registry with filesystem
skilllink link update <skill> --target <new-path>  Repoint symlink to new target

skilllink config get              Get config value
skilllink config set <key> <val>   Set config value
skilllink config list-skills-dirs  List all configured skills directories
skilllink doctor                   Diagnose common issues
```

## File Layout

```
skilllink/
├── src/
│   ├── cli.ts                 # CLI entry point
│   ├── commands/              # Command implementations
│   │   ├── repo.ts
│   │   ├── git.ts
│   │   ├── branch.ts
│   │   ├── skill.ts
│   │   ├── link.ts
│   │   └── config.ts
│   ├── lib/
│   │   ├── gh-git.ts         # gh CLI wrapper
│   │   ├── skill-parser.ts   # Parse SKILL.md
│   │   ├── symlink-manager.ts
│   │   ├── config-store.ts
│   │   └── skill-registry.ts
│   └── types.ts
├── electron/
│   ├── main.ts                # Electron main
│   ├── preload.ts             # Preload script
│   └── renderer/             # React UI
│       ├── App.tsx
│       ├── components/
│       │   ├── RepoSidebar.tsx
│       │   ├── FileBrowser.tsx
│       │   ├── SkillCards.tsx
│       │   └── SymlinkPanel.tsx
│       └── hooks/
├── package.json
└── tsconfig.json
```

## Installation & Distribution

### CLI Installation

```bash
# npm global install
npm install -g skilllink

# or brew (if published)
brew install skilllink
```

### Electron App

```bash
# Development
npm run electron:dev

# Production build (electron-builder)
npm run electron:build
```

### Prerequisites

1. **gh CLI** - GitHub CLI must be installed and authenticated
   ```bash
   gh auth status  # verify authentication
   ```

2. **Git** - Required for repository operations

### Post-Install Setup

```bash
# First run - guided setup
skilllink doctor

# Configure skills directories (optional, has sensible defaults)
skilllink config set skillsDirs.openclaw ~/.openclaw/skills
skilllink config set skillsDirs.agent ~/.agent/skills
```

## Verification

### CLI Tests

```bash
# Clone a repo
skilllink repo add anthropics/skills

# List repos
skilllink repo list

# List skills
skilllink skill list

# Create symlink
skilllink link create anthropics/skills/skills/frontend-design ~/.claude/skills/frontend-design

# List symlinks
skilllink link list

# Remove symlink
skilllink link remove frontend-design

# Switch branch
skilllink branch switch dev

# Fetch & push
skilllink git fetch
skilllink git push
```

### Desktop App

1. Launch app → see repo list in sidebar
2. Click repo → see file browser with skill folders highlighted
3. Right-click skill folder → "Create Symlink" → select target
4. Switch to Skills view → see card grid with symlink status
5. Click skill card → see symlink details, create/remove symlinks

## Testing Strategy

### Test Structure

```
tests/
├── unit/                    # Jest/Vitest
│   ├── lib/
│   │   ├── gh-git.test.ts       # gh CLI wrapper
│   │   ├── skill-parser.test.ts # SKILL.md parsing
│   │   ├── symlink-manager.test.ts
│   │   ├── config-store.test.ts
│   │   └── skill-registry.test.ts
│   └── commands/
│       └── (command unit tests)
├── integration/              # Real gh CLI
│   ├── commands/
│   │   ├── repo.test.ts
│   │   ├── git.test.ts
│   │   ├── link.test.ts         # symlink lifecycle tests
│   │   └── skill.test.ts       # discovery rules tests
│   └── fixtures/
│       └── (test repos)
└── e2e/                     # Playwright + Electron
    └── desktop.test.ts
```

### Symlink Lifecycle Tests

```typescript
// Broken symlink detection
it('detects broken symlinks on link list')
it('updates registry status to broken when symlink is dangling')
it('does not modify registry until link sync runs')

// Link sync
it('reconciles registry with filesystem state')
it('marks broken symlinks in registry without deleting')
it('reports count of active vs broken symlinks')

// Link update
it('removes old symlink and creates new on update')
it('updates registry entry on successful update')

// Collision handling
it('errors when target path exists as regular file')
it('errors with actionable message for SYMLINK_NOT_SYMLINK')
```

### Skill Discovery Tests

```typescript
// Depth limit
it('finds SKILL.md at depth 3')
it('skips SKILL.md at depth 4')

// Valid frontmatter
it('requires name field in frontmatter')
it('skips SKILL.md without valid name field')

// Nested skills
it('discovers multiple skills in same repo')
it('reports total count after discover')
```

### Offline Behavior Tests

```typescript
// Command availability
it('repo list works offline')
it('link create works offline')
it('repo sync fails with offline error')
it('git fetch fails with offline error')

// Caching
it('skill list uses cached registry when offline')
it('branch list uses cached data when offline')

// Doctor
it('doctor runs successfully offline')
it('doctor skips gh auth check when offline')
```

### Test Fixtures

```typescript
// fixtures/test-repo/.skilllink.json
{
  "skills": [
    {
      "id": "test-skill-1",
      "name": "test-skill",
      "repo": "test-owner/test-repo",
      "path": "skills/test-skill",
      "hasSKILLMd": true,
      "symlinks": []
    }
  ]
}
```

### Mock Strategy

```typescript
// For unit tests, mock gh CLI
vi.mock('gh-git', () => ({
  ghGit: {
    clone: vi.fn().mockResolvedValue({ success: true }),
    fetch: vi.fn().mockResolvedValue({ success: true }),
    // ...
  }
}));
```

## Multi-user & Shared Environments

### Current Assumption

Single-user design with `~/.skilllink` — appropriate for MVP.

### Shared Skills Directories

If `skillsDirs` path is not under user's home directory:

- `doctor` shows warning: `"⚠ skills dir is outside home: <path>"`
- `link create` to shared dir shows confirmation prompt:
  ```
  Linking to shared directory. Other users may be affected. Continue? [y/N]
  ```

### Future Considerations (v2)

- Per-user registry entries with user attribution
- Lock files for concurrent registry access
- Team-shared symlink ownership tracking

## Reference Projects

- [GitHub Desktop](https://github.com/desktop/desktop) - Electron app architecture, git operations UI
- [vercel-labs/skills](https://github.com/vercel-labs/skills) - Skill format (SKILL.md), skill discovery, symlink-based installation
