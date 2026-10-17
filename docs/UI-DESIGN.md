# FlowForge UI design system

FlowForge uses a shadcn/ui-inspired visual language: neutral surfaces, thin semantic borders, accessible focus rings, compact controls, and a restrained pastel-purple accent. The implementation is local CSS and React so the desktop application remains usable offline and does not depend on a third-party stylesheet CDN at runtime.

## Principles

- **Neutral first:** near-black/white surfaces, clear type hierarchy, and borders that define structure without boxing every control.
- **Pastel purple as signal:** reserved for primary actions, selection, keyboard focus, and important active states.
- **Motion with purpose:** short hover feedback and subtle brand animation; all nonessential animation is disabled for `prefers-reduced-motion`.
- **Resizable workspace:** the workflow list and run-status panel retain drag resizers and collapse controls.
- **Keyboard and accessibility:** visible focus states, accessible labels on icon-only controls, and semantic status labels.
- **RTL-aware:** logical CSS properties and existing Persian direction handling are retained.

## Why not load shadcn/ui from a CDN?

shadcn/ui is a set of component source files, not a hosted UI runtime or official CSS CDN. Loading an arbitrary third-party stylesheet would make the Electron app network-dependent and could conflict with its content security policy. This redesign adopts the design conventions locally without adding a runtime network dependency.
