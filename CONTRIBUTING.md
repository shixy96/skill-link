# Contributing

Thanks for improving SkillLink.

## Development Setup

```bash
npm install
npm run typecheck
npm test -- --run
npm run electron:pack
```

Use `npm run electron:dev` for the desktop app.

## Pull Requests

- Keep changes focused and small.
- Add or update tests for behavior changes.
- Run `npm run ci` before opening a pull request.
- Use Conventional Commit style for commit messages, for example `fix: preserve symlink on update failure`.
- Use SemVer for releases and `v`-prefixed tags. See [RELEASING.md](./RELEASING.md).
- Do not commit generated artifacts from `dist/`, `dist-electron/`, `release/`, or `node_modules/`.

## Issues

When reporting bugs, include:

- Operating system and architecture.
- Node and npm versions.
- `gh --version` and `gh auth status` output when relevant.
- Reproduction steps.
- Expected and actual behavior.
