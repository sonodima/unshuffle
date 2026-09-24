/** Deezer CDN images come in any square size: ask for `px` instead of the (1000px) default. */
export function dzCoverSize(url: string | null | undefined, px: number): string | undefined {
  if (!url) return undefined
  return /^https:\/\/[^/]*dzcdn\.net\//.test(url) ? url.replace(/\/\d{2,4}x\d{2,4}-/, `/${px}x${px}-`) : url
}
