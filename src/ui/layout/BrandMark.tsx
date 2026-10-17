export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="brand-mark">
      <rect x="2" y="2" width="20" height="20" rx="6" fill="hsl(var(--primary))" />
      <path d="M7.5 9.5v2a3 3 0 0 0 3 3H16.5" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinecap="round" />
      <circle cx="7.5" cy="8" r="2.2" fill="hsl(var(--primary-foreground))" />
      <circle cx="16.5" cy="14.5" r="2.2" fill="hsl(var(--primary-foreground))" />
    </svg>
  );
}
