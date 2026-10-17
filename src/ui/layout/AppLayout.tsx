import type { CSSProperties, ReactNode } from "react";

export type AppTheme = "dark" | "light";
export type AppLanguage = "en" | "fa";

/** Owns document-level UI configuration and keeps application chrome out of App.tsx. */
export function AppShell({
  theme,
  language,
  children,
}: {
  theme: AppTheme;
  language: AppLanguage;
  children: ReactNode;
}) {
  return (
    <div
      className="app-shell"
      data-theme={theme}
      data-language={language}
      dir={language === "fa" ? "rtl" : "ltr"}
      lang={language}
    >
      {children}
    </div>
  );
}

/** Consistent viewport layout wrapper for the navigation rail and resizable panels. */
export function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <div className="workspace">{children}</div>;
}

/** Inline layout tokens for widget hosts that need to provide their own column sizing. */
export const panelWidthStyle = (width: number): CSSProperties => ({ width, minWidth: width });
