/** Tiny class-name joiner (falsy values are dropped). */
export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
