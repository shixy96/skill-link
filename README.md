# SkillLink

SkillLink is an Electron desktop app and Node.js CLI for managing skill repositories and installing skills into local agent directories with symlinks.

## Status

This project is an MVP. It supports the core repository, skill discovery, and symlink workflows described in `docs/superpowers/specs/2026-04-02-skill-ops-mvp-design.md`.

## Features

- Manage GitHub skill repositories through `gh` and `git`.
- Discover `SKILL.md` files in managed repositories.
- Track discovered skills in a local registry.
- Create, update, remove, list, and sync symlinks.
- Use a desktop UI for repository browsing, branch switching, skill discovery, and symlink management.

## Requirements

- Node.js 20 or newer.
- npm 11 or newer.
- Git.
- GitHub CLI (`gh`) for GitHub-backed clone, sync, fetch, and push operations.

## Install

```bash
npm install
```

## Development

```bash
npm run typecheck
npm test -- --run
npm run electron:dev
```

`npm run electron:dev` builds the CLI and Electron main process, starts Vite for the renderer, and launches Electron.

## Build

```bash
npm run electron:pack
npm run electron:build
```

`electron:pack` creates local build artifacts under `dist/` and `dist-electron/`. `electron:build` creates the macOS release archive under `release/`.

## Release

```bash
npm run release:check
npm run release:build
```

See [RELEASING.md](./RELEASING.md) for versioning, tag, and GitHub Release steps.

## CLI

```bash
node dist/cli.js --help
node dist/cli.js repo add <owner/repo>
node dist/cli.js skill discover
node dist/cli.js link create <skill> --target claude
node dist/cli.js link sync
```

After publishing or global installation, use `skilllink` instead of `node dist/cli.js`.

## Local Data

SkillLink stores user data under `~/.skilllink`:

- `config.json`
- `skill-registry.json`
- `repos.json`

Managed repositories default to `~/skilllink/repos`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Security

See [SECURITY.md](./SECURITY.md).

## License

MIT. See [LICENSE](./LICENSE).
