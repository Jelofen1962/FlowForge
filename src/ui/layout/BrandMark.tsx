/** FlowForge mark: two nodes joined by an elbow — a flow, forged. */
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="brand-mark">
      <rect x="1.5" y="1.5" width="21" height="21" rx="6.5" fill="hsl(var(--primary))" />
      <path d="M8 10.4v1.3a2.8 2.8 0 0 0 2.8 2.8H15" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="8" cy="8" r="2.1" fill="hsl(var(--primary-foreground))" />
      <circle cx="16.4" cy="14.5" r="2.1" fill="hsl(var(--primary-foreground))" />
    </svg>
  );
}
