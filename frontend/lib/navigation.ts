/**
 * Only same-origin absolute paths are valid post-auth destinations.
 * Normalize through the URL parser so backslashes, encoded separators or
 * unexpected schemes cannot turn a "path" into an external redirect.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("\\")) return "/";
  try {
    const base = "https://bartr.invalid";
    const url = new URL(value, base);
    if (url.origin !== base) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
