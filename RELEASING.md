# Releasing

SkillLink uses SemVer and Conventional Commit style.

## Version Rules

- Patch: backward-compatible fixes, for example `0.1.1`.
- Minor: backward-compatible features, for example `0.2.0`.
- Major: breaking changes, for example `1.0.0`.
- Pre-release: use SemVer pre-release suffixes, for example `0.2.0-beta.1`.

Git tags use a `v` prefix:

```bash
v0.1.0
v0.2.0-beta.1
```

## Local Release Check

```bash
npm run release:check
```

This validates the version, typechecks the project, runs all tests, and builds the local Electron artifacts.

## Local Release Build

```bash
npm run release:build
```

This runs `release:check` and then creates the macOS release archive under `release/`.

## Manual GitHub Release

1. Update `package.json` version and `CHANGELOG.md`.
2. Run:

   ```bash
   npm install --package-lock-only
   npm run release:build
   ```

3. Commit with Conventional Commit style:

   ```bash
   git commit -m "chore: release v0.1.0"
   ```

4. Tag the commit:

   ```bash
   git tag v0.1.0
   git push origin main --tags
   ```

5. In GitHub Actions, run the `Release` workflow manually and enter the same version without the `v` prefix.
6. Use the generated macOS archive artifact when drafting the GitHub Release.

## Notes

- The current macOS build is unsigned unless a valid Developer ID certificate is configured for electron-builder.
- The MVP release target is a macOS zip archive. Add DMG packaging after signing and icon configuration are ready.
- Do not commit `dist/`, `dist-electron/`, `release/`, or `node_modules/`.
