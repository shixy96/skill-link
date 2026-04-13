# Security Policy

## Supported Versions

The MVP currently supports the latest commit on the default branch.

## Reporting a Vulnerability

Please do not open a public issue for a security vulnerability.

If the project has a GitHub Security Advisory page, use that. Otherwise, contact the maintainers privately through the repository owner channel and include:

- Affected version or commit.
- Reproduction steps.
- Impact and affected files.
- Any known mitigations.

## Scope

Security-sensitive areas include:

- Symlink creation and removal.
- File browser path validation.
- Repository clone and sync operations.
- Local config and registry parsing.
- Electron IPC boundaries.
