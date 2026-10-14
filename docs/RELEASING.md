# Windows release checklist

## Automatic release flow

Pushing a commit to `main` or `master` starts the **Automatic Windows Release** workflow. It:

1. Finds the highest existing stable `vMAJOR.MINOR.PATCH` tag and the version in `package.json`.
2. Increments the larger version's patch number for this release run (for example, `v0.3.0` to `v0.3.1`).
3. Installs dependencies, runs release configuration checks, TypeScript, and tests.
4. Builds the Windows NSIS installer, generates SHA-256 checksums, and uploads an Actions artifact.
5. Creates a published GitHub Release with generated release notes and the installer/checksum files.

The version bump is applied to the workflow's temporary checkout for packaging. It does not commit a version change back to the branch. The next release version is derived from the latest published/tagged version, so successive successful runs increment the patch version. Failed verification/builds do not publish a release.

You can also use **Actions → Automatic Windows Release → Run workflow** from `main` or `master`. Manual runs from other branches are skipped. The repository's `Windows Release` workflow remains available for manually pushed `v*` tags.

## Manual tag-based release

If you prefer to control the version yourself, update `package.json`, commit and push, then push a matching tag:

```powershell
# Example only: replace 0.4.0 with the version you reviewed
git tag v0.4.0
git push origin v0.4.0
```

The tag-based workflow installs dependencies, verifies release configuration, runs TypeScript and unit tests, builds the NSIS installer, generates SHA-256 checksums, and attaches the files to a GitHub Release. A manually dispatched tag workflow uploads an Actions artifact but only publishes a release when running on a `v*` tag.

## Trust and signing

The current installer is **not code-signed**. Windows SmartScreen may show an unknown-publisher warning. Configure a trusted code-signing certificate and protect its credentials in GitHub Actions secrets before distributing broadly. Do not store signing keys, browser profiles, session snapshots, or credentials in the repository.

## Dependency lockfile

This project currently has no committed `package-lock.json`. CI therefore uses `npm install` and cannot guarantee byte-for-byte dependency resolution across runs. Commit a lockfile generated and reviewed on a network-enabled development machine, then change CI to `npm ci` and enable the setup-node npm cache.
