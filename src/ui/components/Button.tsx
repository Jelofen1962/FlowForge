import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Icon, type IconAnim } from "./Icon";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "dashed";
type Base = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title">;

export type ButtonProps = Base & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  icon?: LucideIcon;
  iconAnim?: IconAnim;
  iconSpinning?: boolean;
  block?: boolean;
  children?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, iconAnim, iconSpinning, block, className, children, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx("btn", `btn-${variant}`, size === "sm" && "btn-sm", size === "lg" && "btn-lg", block && "btn-block", className)}
      {...rest}
    >
      {icon && <Icon icon={icon} size={size === "sm" ? 14 : 16} anim={iconAnim} spinning={iconSpinning} />}
      {children}
    </button>
  );
});

export type IconButtonProps = Omit<Base, "aria-label" | "children"> & {
  icon: LucideIcon;
  label: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  iconAnim?: IconAnim;
  iconSpinning?: boolean;
  tipSide?: "top" | "right" | "end";
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = "ghost", size = "md", iconAnim, iconSpinning, tipSide, className, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      data-tip={label}
      data-tip-side={tipSide}
      className={cx("btn", `btn-${variant}`, size === "sm" ? "btn-icon-sm" : "btn-icon", className)}
      {...rest}
    >
      <Icon icon={icon} size={size === "sm" ? 14 : 16} anim={iconAnim} spinning={iconSpinning} />
    </button>
  );
});
