import type { LucideIcon, LucideProps } from "lucide-react";
import { cx } from "./cx";

export type IconAnim = "nudge" | "wiggle" | "pop" | "bounce" | "drop" | "swing" | "spin" | "rotate" | "turn" | "pulse";

type Props = Omit<LucideProps, "ref"> & {
  icon: LucideIcon;
  anim?: IconAnim;
  spinning?: boolean;
  pulsing?: boolean;
};

export function Icon({ icon: Glyph, size = 16, strokeWidth = 1.8, anim, spinning, pulsing, className, ...rest }: Props) {
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
