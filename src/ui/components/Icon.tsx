import type { LucideIcon, LucideProps } from "lucide-react";
import { cx } from "./cx";

/**
 * Animation presets for Lucide icons. They play when the icon's host control
 * (button, nav item, step row…) is hovered or keyboard-focused. See the
 * "Animated Lucide icons" block in styles/components.css.
 */
export type IconAnim = "nudge" | "wiggle" | "pop" | "bounce" | "drop" | "swing" | "spin" | "rotate" | "turn" | "pulse" | "draw";

type Props = Omit<LucideProps, "ref"> & {
  icon: LucideIcon;
  anim?: IconAnim;
  /** Continuous spin (loading / running). */
  spinning?: boolean;
  /** Continuous gentle pulse (live / listening). */
  pulsing?: boolean;
};

export function Icon({ icon: Glyph, size = 16, strokeWidth = 1.75, anim, spinning, pulsing, className, ...rest }: Props) {
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      className={cx("ico", anim && `ico-${anim}`, spinning && "ico-loop-spin", pulsing && "ico-loop-pulse", className)}
      {...rest}
    />
  );
}
