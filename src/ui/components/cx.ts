export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");
export const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));
