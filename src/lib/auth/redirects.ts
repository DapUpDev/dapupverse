/**
 * Open-redirect protection: only plain internal application paths are ever
 * used as post-auth destinations.
 */
export function safeInternalPath(path: unknown): string | null {
  if (typeof path !== "string" || path.length === 0) return null;
  if (!path.startsWith("/")) return null;
  // Reject protocol-relative URLs, schemes, and backslash tricks.
  if (path.startsWith("//") || path.includes("://") || path.includes("\\")) {
    return null;
  }
  return path;
}
