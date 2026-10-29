# Phase 2: Responsive UI foundation

## Scope delivered

- Removed browser zoom as a global sizing mechanism; typography and spacing now use actual CSS dimensions.
- Removed the fixed 1000px body minimum width so the desktop renderer can shrink with the window.
- Preserved the three-panel desktop editor at wider widths.
- At widths up to 1100px, the canvas becomes the main workspace and side panels open as overlay drawers from explicit Actions and Inspector controls.
- At widths up to 700px, the top bar, mode navigation, editor toolbar, status bar, home dialog, and data dialog adapt to narrow screens.
- Added visible keyboard focus styles and reduced-motion handling.

## Design intent

- Keep the workflow canvas as the primary focal area.
- Do not squeeze the action library and inspector into unusable columns on compact windows.
- Keep the current theme and product structure; this is an incremental layout pass, not a rebrand or a new component framework.
- Keep browser/runtime behavior unchanged in this pass.

## Manual acceptance checklist

- [ ] Wide desktop: three-column workspace remains usable and the canvas receives remaining width.
- [ ] 1100px and below: Actions and Inspector open independently as drawers; the canvas remains visible.
- [ ] 700px and below: no forced 1000px page width; toolbar actions can scroll horizontally without pushing the canvas off-screen.
- [ ] Keyboard users can see focus on buttons, inputs, selects, and other focusable controls.
- [ ] Reduced-motion preference suppresses nonessential animation.
- [ ] Home and data-processing dialogs fit within the viewport and remain scrollable.
- [ ] Run workflow, save/open workflow, recorder, and node configuration remain behaviorally unchanged.

## Verification status

- TypeScript syntax transpilation: pass, 19 source/test files, zero diagnostics.
- Full TypeScript typecheck, ESLint, Vitest, Vite build, and Electron rendering: not verified because dependencies are not installed in this workspace.
- Responsive visual inspection: pending a dependency-backed app launch/browser environment.

## Visual refinement pass

- Consolidated radii, type sizes, focus-ring styling, and panel shadow values into shared CSS tokens.
- Refined node-card hierarchy, selected/hover/run states, action-row sizing, and input focus treatment.
- Made the app shell's minimum height flexible and added short-window layout adjustments to avoid forcing a 700px-tall renderer into short windows.
- Added thin, theme-aware scrollbar styling and small-screen node sizing.
- No component library or new dependency added; existing CSS and React Flow styling remain the implementation.

### Additional manual checks
- [ ] Window height below 620px: top bars and canvas remain usable without the app shell imposing a 700px minimum.
- [ ] Selected, running, successful, failed, and skipped node states are distinguishable.
- [ ] Focus rings remain visible in dark and light themes.
- [ ] Hover/selected styling does not obscure conditional or loop connection handles.


### Refinement-pass static checks

- TypeScript/TSX syntax transpilation: pass, 19 files, zero diagnostics.
- CSS brace-balance check: pass.
- `package.json` JSON parse: pass.
- Full dependency-backed checks and visual inspection: still pending.
