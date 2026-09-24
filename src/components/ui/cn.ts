/** Joins truthy class names. (No tailwind-merge: pass layout classes, not overrides of core styles.) */
export function cn(...parts: Array<string | false | null | undefined | 0>): string {
  let out = ''
  for (const p of parts) if (p) out = out ? `${out} ${p}` : p
  return out
}
