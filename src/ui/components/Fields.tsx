import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown, TriangleAlert } from "lucide-react";
import { Icon } from "./Icon";
import { cx } from "./cx";

type FieldProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  action?: ReactNode;
  as?: "label" | "div";
  className?: string;
  children: ReactNode;
};

export function Field({ label, hint, error, action, as = "label", className, children }: FieldProps) {
  const Tag = as;
  return (
    <Tag className={cx("field", className)}>
      {label !== undefined && (
        <span className="field-label">
          <span>{label}</span>
          {action}
        </span>
      )}
      {children}
      {error ? (
        <span className="field-hint field-error" role="alert">
          <Icon icon={TriangleAlert} size={13} />
          <span>{error}</span>
        </span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </Tag>
  );
}

export function Hint({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <p className="field-hint">
      {icon}
      <span>{children}</span>
    </p>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { mono?: boolean; sm?: boolean };
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, mono, sm, ...rest }, ref) {
  return <input ref={ref} className={cx("input", mono && "input-mono", sm && "input-sm", className)} {...rest} />;
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean };
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, mono, ...rest }, ref) {
  return <textarea ref={ref} className={cx("textarea", mono && "input-mono", className)} {...rest} />;
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { sm?: boolean; wrapperClassName?: string };
export function Select({ sm, wrapperClassName, className, children, ...rest }: SelectProps) {
  return (
    <span className={cx("select", sm && "select-sm", wrapperClassName)}>
      <select className={className} {...rest}>
        {children}
      </select>
      <Icon icon={ChevronDown} size={14} />
    </span>
  );
}

export function SwitchRow({ label, description, checked, onChange, disabled }: {
  label: ReactNode; description?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className="switch-row">
      <span className="switch-copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input type="checkbox" role="switch" className="switch" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
    </label>
  );
}

export function CheckRow({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check-row">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
