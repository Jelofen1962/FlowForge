# Security baseline

- Never evaluate Python expressions from workflow values.
- Workflow YAML will use safe parsing only.
- Credentials must not be stored in workflow YAML by default.
- Logs should redact passwords, tokens, cookies, and sensitive form values.
- Destructive or irreversible browser actions require explicit user intent.
- Browser automation runs with the user's active permissions and can affect real accounts/data.
- Keep downloaded artifacts in documented locations and prevent project-relative path traversal.
