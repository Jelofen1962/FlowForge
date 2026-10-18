# FlowForge UI design system

A black-and-white interface with one pastel-purple accent. Hairline borders, a dot-grid canvas, mono micro-labels, and a "flow line" that connects workflow steps and fills as they succeed.

## Principles

- **Ink & paper, one accent.** Neutral surfaces and type; pastel purple (`--primary`) marks the primary action, selection, focus and progress. Red is reserved for destructive/error states and amber for warnings.
- **shadcn/ui tokens.** Semantic CSS variables (`--background`, `--foreground`, `--card`, `--muted`, `--border`, `--primary`, `--ring`, `--destructive`, `--radius` …) live in `src/ui/styles/tokens.css` for the dark and light themes. Components are written in the shadcn style (small, composable, token-driven) in `src/ui/components`.
- **Lucide, animated.** All icons are Lucide SVGs, wrapped by `<Icon anim="…" />`. Icons animate when their host button/row is hovered or keyboard-focused (`nudge`, `wiggle`, `pop`, `bounce`, `drop`, `swing`, `spin`, `rotate`, `turn`, `pulse`, `draw`), plus `spinning` / `pulsing` loops for state. No emoji.
- **Resizable, hideable windows.** Steps, Run status and Console are panels you can drag to resize, collapse to a rail/header, or hide. Layout persists in `localStorage` (`flowforge.layout.v2`).
- **Accessible by default.** Visible focus rings, `aria-label`s on every icon-only control, separators with `aria-valuenow`, a combobox action picker, focus-trapped dialogs, skip link, `prefers-reduced-motion` support, logical CSS properties for RTL (Persian).

## Layout shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl K` | Command palette |
| `Ctrl B` | Collapse / expand navigation |
| `Ctrl [` | Toggle steps panel |
| `Ctrl ]` | Toggle run status panel |
| `Ctrl J` | Toggle console |
| `Ctrl \` | Focus mode (hide all panels, press again to restore) |

Resize handles: drag, or focus and use `←/→` (`↑/↓` for the console), `Shift` for bigger steps, `Home/End` for min/max, `Enter` or double-click to reset.

## Code map

```
src/ui/
  App.tsx                    composition root (shortcuts, command list, routing between views)
  state/useAppController.ts  all workflow/run/library state and handlers (no JSX)
  state/usePanelLayout.ts    panel sizes + visibility + persistence
  components/                UI kit: Button, Fields, Section, Dialog, ResizeHandle, ActionPicker, Icon…
  layout/                    Topbar, NavSidebar, StatusBar, Panel, Page
  editor/                    EditorView, StepsPanel, Inspector, StepFields, RunPanel, ConsoleDock
  views/                     one file per page (Variables, Library, Outputs, Templates, …)
  dialogs/                   CommandPalette, UserInputDialog, UpdateDialog
  styles/                    tokens · base · components · layout · editor · views · ai
  i18n/translations.ts       Persian strings (single source)
```

## Why shadcn is bundled, not loaded from a CDN

shadcn/ui is not a hosted stylesheet or runtime: it is source you copy into the project. The usual "CDN" workaround (the Tailwind Play CDN script) executes third-party JavaScript inside the Electron renderer, which can start runs and holds the local AI API token, and it needs network access to render at all. FlowForge therefore ships the shadcn token system and components locally. The only remote asset is the font stylesheet (Geist, Geist Mono, Vazirmatn) from Google Fonts, which the existing CSP allows; the UI falls back to system fonts offline. CI (`design-lint`) fails if a third-party `<script>` is added to `index.html`.

## Quality gates

`npm run verify:ui` runs the same checks as the **UI tests** GitHub workflow: design lint (tokens, emoji, hard-coded colours, reduced motion), TypeScript, component/layout/i18n tests with axe-core accessibility checks on every page, and a production-bundle budget.
