# Typecheck cleanup

- Removed unused imports: `Copy`, `Trash2`, `Pencil`, `Ungroup`, `parseJson`, `parseCsv`, and `parseTextLines`.
- Removed the unused `contextMenu` state declaration.
- No workflow behavior changed.

Verification: full typecheck could not run in this workspace because dependencies are not installed (`vite/client` and `vitest/globals` type definitions are unavailable).
