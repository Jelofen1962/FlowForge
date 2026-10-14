# Security policy

## Reporting a vulnerability

Do not publish active session snapshots, cookies, passwords, access tokens, profile directories, or unredacted logs in a public issue. Until a private security contact is configured for this repository, report suspected issues to the repository owner through a private channel.

## Sensitive data

- Treat session snapshot JSON as a credential: it may contain live cookies and local/session storage.
- Use dedicated browser profiles for automation, not your everyday browser profile.
- Keep exported sessions, screenshots, workflow files containing personal data, and diagnostic logs out of version control.
- Do not place passwords or access tokens in workflow variables. Secret vault integration and encrypted session export are not included in this version.

## Supported use

Only automate websites and accounts you are authorized to access. Keep Chrome/Edge and Node/Electron dependencies updated, review dependency advisories, and verify releases before distributing installers.
