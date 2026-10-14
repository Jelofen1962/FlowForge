# Workflow YAML schema v1

CobWeb workflows are YAML documents validated into typed domain models. The YAML file is the source
of truth. Cache data is derived and disposable.

## Required top-level fields

- `schema_version`: integer; currently `1`.
- `id`: stable workflow identifier.
- `name`: human-readable workflow name.
- `steps`: ordered list of steps (may be empty).

Optional fields are `description`, `settings`, `variables`, and `metadata`. Unknown fields are rejected
to catch typos rather than silently ignore them.

## Step fields

Each step requires a unique stable `id` and supported `action`. Supported initial action names are
`navigate`, `click`, `fill`, `type_text`, `select_option`, `check`, `uncheck`, `press`, `hover`, `wait`,
`wait_for`, `screenshot`, `extract_text`, `assert_text`, `assert_visible`, `assert_url`, `scroll`,
`go_back`, and `reload`. Target-requiring actions require `target`. `navigate` requires `url`.
`fill`, `type_text`, `select_option`, and `press` require `value`.

Locator forms:

```yaml
target:
  by: role
  role: button
  name: Continue
```

or `by: label | placeholder | text | test_id | css | xpath` with a non-empty `value`. `index`, when
present, must be non-negative and is explicit disambiguation, not an automatic first-match fallback.

Timeout fields use milliseconds and must be positive. Variables are data only; arbitrary Python
expressions are never evaluated. Secrets should be referenced indirectly, not embedded in YAML.

## Cache behavior

The in-memory and optional disk caches are keyed by canonical path and a fingerprint including source
content SHA-256, modification time, size, schema version, and cache format version. Only successfully
validated workflows are cached. Cache errors fall back to YAML parsing. Cache writes are atomic.
