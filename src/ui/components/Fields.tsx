import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown, TriangleAlert } from "lucide-react";
import { Icon } from "./Icon";
import { cx } from "./cx";

type FieldProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Small control shown on the right of the label (e.g. "Record selector"). */
  action?: ReactNode;
  /** Use "div" when the field wraps several controls. */
  as?: "label" | "div";
  className?: string;
  children: ReactNode;
};

/** Label + control + hint/error, wired for accessibility without ids. */
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

/** Inline helper text with an optional leading icon. */
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

type SwitchRowProps = {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

/** Accessible toggle row: a native checkbox with role="switch". */
export function SwitchRow({ label, description, checked, onChange, disabled }: SwitchRowProps) {
  return (
    <label className="switch-row">
      <span className="switch-copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input type="checkbox" role="switch" className="switch" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
    </label>
  );
}

export function CheckRow({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="check-row">
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
