/**
 * Join class names, dropping anything falsy.
 * Small enough that pulling in `clsx` would not earn its place in the bundle.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
