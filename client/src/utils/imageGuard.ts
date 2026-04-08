/**
 * IMAGE URL GUARD — Client-side defense
 *
 * Convention: ALL image src stored in TipTap content MUST be relative paths
 * starting with /uploads/. Never absolute URLs, blob: URIs, or data: URIs.
 *
 * This module provides validation and sanitization to enforce this rule
 * at the point of insertion (upload, paste, annotation save).
 */

/**
 * Validate that an image URL is safe to store in TipTap content.
 * Returns the URL if valid, or a sanitized version if fixable.
 * Throws if the URL is completely invalid (blob:, data:).
 */
export function assertRelativeImageUrl(url: string): string {
  if (!url) return '';

  // blob: URLs are ephemeral — must never be stored
  if (url.startsWith('blob:')) {
    console.error('[ImageGuard] Blocked blob: URL from being stored in editor content');
    throw new Error('blob: URLs cannot be stored — image upload may have failed');
  }

  // data: URIs should never be stored (wastes DB space, may indicate upload failure)
  if (url.startsWith('data:')) {
    console.error('[ImageGuard] Blocked data: URI from being stored in editor content');
    throw new Error('data: URIs cannot be stored — image upload may have failed');
  }

  // Absolute HTTP(S) URLs — strip to relative path
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      const relativePath = parsed.pathname;
      console.warn(`[ImageGuard] Converted absolute URL to relative: ${url} → ${relativePath}`);
      return relativePath;
    } catch {
      return url;
    }
  }

  // Already relative — good
  return url;
}
