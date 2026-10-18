import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "./Icon";
import { cx } from "./cx";

type Tone = "neutral" | "primary" | "solid" | "danger" | "warning" | "outline";
export function Badge({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cx("badge", tone !== "neutral" && `badge-${tone}`, className)}>
      {icon && <Icon icon={icon} size={11} />}
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function StatusDot({ tone = "idle" }: { tone?: "idle" | "live" | "busy" | "danger" }) {
  return <span aria-hidden="true" className={cx("dot", tone === "live" && "dot-live", tone === "busy" && "dot-busy", tone === "danger" && "dot-danger")} />;
}

export function Note({ tone = "neutral", icon, children, className }: { tone?: "neutral" | "warn" | "danger" | "primary"; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <div className={cx("note", tone !== "neutral" && `note-${tone}`, className)} role={tone === "danger" ? "alert" : undefined}>
      {icon && <Icon icon={icon} size={15} />}
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: LucideIcon; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon icon={icon} size={20} anim="pop" />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  block,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: ReactNode; icon?: LucideIcon }>;
  label: string;
  block?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className={cx("seg", block && "seg-block")}>
      {options.map(option => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          {option.icon && <Icon icon={option.icon} size={14} />}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const p = Math.max(0, Math.min(1, value));
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)}>
      <i style={{ ["--p" as string]: p }} />
    </div>
  );
}
