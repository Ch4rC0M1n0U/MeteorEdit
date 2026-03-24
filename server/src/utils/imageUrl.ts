import { Request } from 'express';

/**
 * Centralized image URL helpers.
 *
 * Convention:
 * - DB storage / fileUrl fields: relative with leading slash  →  /uploads/profiles/abc.jpg
 * - TipTap content (src attrs):  absolute with protocol+host  →  https://host/uploads/profiles/abc.jpg
 *   Why absolute? So images can be copy-pasted to OneNote, Word, etc.
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
 * Convert a relative upload path to an absolute URL for use in TipTap content.
 * This is the ONLY function that should create absolute image URLs for TipTap.
 */
export function toAbsoluteUrl(filePath: string, req: Request): string {
  if (!filePath) return '';
  // Already absolute
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  const normalized = normalizeUploadPath(filePath);
  return `${getBaseUrl(req)}${normalized}`;
}

/**
 * Convert a relative upload path to an absolute URL using a pre-computed baseUrl.
 * Use when req is not available (e.g., inside helper functions called from controllers).
 */
export function toAbsoluteUrlFromBase(filePath: string, baseUrl: string): string {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  const normalized = normalizeUploadPath(filePath);
  return `${baseUrl}${normalized}`;
}
