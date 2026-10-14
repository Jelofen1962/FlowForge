# Windows release checklist

## Before tagging

1. Run `npm install`, `npm run verify:release`, `npm run typecheck`, `npm test`, and `npm run build:win` on a supported Windows machine.
2. Test the installed app on a clean Windows account with Chrome and/or Edge installed. Verify startup, a simple local or authorized test workflow, stop behavior, screenshots, and session import/export.
3. Review dependency changes and security advisories. Session snapshots can contain live authentication cookies and must not be attached to public issues or releases.
4. Update `package.json` version and user-facing release notes. The tag version should match the package version.
5. Commit the changes and push the branch before tagging.

## Publish

```powershell
# Example only: replace 0.4.0 with the version you reviewed
git tag v0.4.0
git push origin v0.4.0
```

The `Windows Release` workflow installs dependencies on `windows-latest`, verifies release configuration, runs TypeScript and unit tests, builds the NSIS installer, generates SHA-256 checksums, and attaches the files to a GitHub Release for `v*` tags. A manually dispatched workflow uploads an Actions artifact but does not publish a release unless the ref is a version tag.

## Trust and signing

The current installer is **not code-signed**. Windows SmartScreen may show an unknown-publisher warning. Configure a trusted code-signing certificate and protect its credentials in GitHub Actions secrets before distributing broadly. Do not store signing keys, browser profiles, session snapshots, or credentials in the repository.

## Dependency lockfile

This project currently has no committed `package-lock.json`. CI therefore uses `npm install` and cannot guarantee byte-for-byte dependency resolution across runs. Commit a lockfile generated and reviewed on a network-enabled development machine, then change CI to `npm ci` and enable the setup-node npm cache.
