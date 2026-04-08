import { Request } from 'express';

/**
 * Centralized image URL helpers.
 *
 * Convention:
 * - ALL stored paths (DB, TipTap content, fileUrl): relative with leading slash  →  /uploads/profiles/abc.jpg
 * - The client resolves relative paths to absolute URLs using window.location.origin at render time.
 * - This ensures portability across domains (IP, hostname, deployment changes).
 *
 * ALL controllers MUST use these helpers instead of manual string concatenation.
 */

/**
 * Normalize a file path to always start with /uploads/
 * Handles: "uploads/file.jpg", "/uploads/file.jpg", "file.jpg"
 */
export function normalizeUploadPath(filePath: string): string {
  if (!filePath) return '';
  // Already absolute URL (http/https) — return as-is
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  // Remove leading slash for uniform processing
  let p = filePath.startsWith('/') ? filePath.substring(1) : filePath;
  // Ensure uploads/ prefix
  if (!p.startsWith('uploads/')) p = `uploads/${p}`;
  return `/${p}`;
}

/**
 * Build the base URL from request headers (works behind reverse proxies).
 *
 * Uses the original Host header from the browser (which contains the correct
 * external port like 100.64.0.2:5173), NOT X-Forwarded-Host (which contains
 * the internal nginx port like 100.64.0.2:443).
 *
 * For protocol, we trust X-Forwarded-Proto since nginx correctly sets it.
 */
export function getBaseUrl(req: Request): string {
  const protocol = req.headers['x-forwarded-proto']?.toString().split(',')[0] || req.protocol;
  // Use the Host header from the original client request (has correct external port)
  // req.get('host') returns the Host header value in Express
  const host = req.get('host') || 'localhost:3001';
  return `${protocol}://${host}`;
}

/**
 * Normalize a file path for storage in TipTap content or DB fields.
 * Always returns a relative path — the client resolves to absolute at render time.
 */
export function toAbsoluteUrl(filePath: string, _req: Request): string {
  if (!filePath) return '';
  return normalizeUploadPath(stripBaseUrl(filePath));
}

/**
 * Normalize a file path for storage. Returns relative path.
 * Kept for backward compatibility — all callers already pass baseUrl but we ignore it.
 */
export function toAbsoluteUrlFromBase(filePath: string, _baseUrl: string): string {
  if (!filePath) return '';
  return normalizeUploadPath(stripBaseUrl(filePath));
}

/**
 * Strip any absolute base URL prefix, returning just the /uploads/... path.
 */
function stripBaseUrl(url: string): string {
  if (!url) return '';
  // Already relative
  if (!url.startsWith('http://') && !url.startsWith('https://')) return url;
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return url;
  }
}

// ─── IMAGE URL GUARD ──────────────────────────────────────────────
// Prevents absolute URLs, blob URLs, and data URIs from being stored
// in TipTap content. This is the LAST LINE OF DEFENSE before DB write.
// ───────────────────────────────────────────────────────────────────

const DANGEROUS_SRC_PATTERNS = [
  /^https?:\/\//,       // Absolute HTTP(S) URLs — must be relative
  /^blob:/,             // Ephemeral blob URLs — unrecoverable after page close
  /^data:image\/(?!gif;base64,R0lGODlhAQABA)/, // data URIs (except 1px transparent placeholder)
];

/**
 * Sanitize a single image src for storage.
 * - Absolute http(s) URLs → extract pathname (relative)
 * - blob: URLs → replace with /uploads/missing.png (unrecoverable)
 * - data: URIs (non-placeholder) → replace with /uploads/missing.png
 * - Already relative → pass through
 */
export function sanitizeImageSrc(src: string): string {
  if (!src) return '';
  // blob: URLs are ephemeral and unrecoverable
  if (src.startsWith('blob:')) return '/uploads/missing.png';
  // data: URIs should never be stored (except transparent pixel placeholder used during loading)
  if (src.startsWith('data:') && !src.startsWith('data:image/gif;base64,R0lGODlhAQABA')) {
    return '/uploads/missing.png';
  }
  // Absolute URLs → strip to relative path
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return normalizeUploadPath(stripBaseUrl(src));
  }
  return src;
}

/**
 * Recursively walk TipTap JSON content and sanitize all image src attributes.
 * Modifies the object IN PLACE for performance (called right before DB save).
 * Returns the number of fixes applied.
 */
export function sanitizeTipTapImageUrls(node: any): number {
  if (!node || typeof node !== 'object') return 0;
  let fixes = 0;

  // Check if this node is an image with a src attribute
  if (node.type === 'image' && node.attrs?.src) {
    const original = node.attrs.src;
    const sanitized = sanitizeImageSrc(original);
    if (sanitized !== original) {
      node.attrs.src = sanitized;
      fixes++;
      console.warn(`[ImageGuard] Fixed image src: "${original.substring(0, 80)}…" → "${sanitized}"`);
    }
  }

  // Also check resizableImage (custom TipTap extension)
  if (node.type === 'resizableImage' && node.attrs?.src) {
    const original = node.attrs.src;
    const sanitized = sanitizeImageSrc(original);
    if (sanitized !== original) {
      node.attrs.src = sanitized;
      fixes++;
      console.warn(`[ImageGuard] Fixed resizableImage src: "${original.substring(0, 80)}…" → "${sanitized}"`);
    }
  }

  // Recurse into content array
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      fixes += sanitizeTipTapImageUrls(child);
    }
  }

  return fixes;
}
