import type { ReactNode } from "react";

/** Scrolling single-panel page with the dot-grid canvas. */
export function Page({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <main className="view" id="main" tabIndex={-1} aria-label={label}>
      <div className="page">
        <div className="page-inner">{children}</div>
      </div>
    </main>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="page-head-copy">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </header>
  );
}
