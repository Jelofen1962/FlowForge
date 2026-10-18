import { useId, useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { Icon } from "./Icon";

type Props = {
  title: ReactNode;
  /** Editorial section number, e.g. "01". */
  index?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

/** A card section that can be collapsed to reduce scrolling. */
export function Section({ title, index, icon, actions, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <section className="section">
      <div className="section-bar">
        <button type="button" className="section-head" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(value => !value)}>
          {index && <span className="section-index">{index}</span>}
          <span className="section-title">
            {icon && <Icon icon={icon} size={15} />}
            {title}
          </span>
          <Icon icon={ChevronDown} size={15} className="section-chevron" />
        </button>
        {actions}
      </div>
      <div id={bodyId} className="section-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
