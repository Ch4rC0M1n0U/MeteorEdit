/**
 * Sanitize a chat message body before storing.
 * Strategy: chat is plain text only. We strip ALL HTML tags and decode entities,
 * then trim and cap length. The client renders mentions/links from the plain text.
 */

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&nbsp;': ' ',
};

export const MAX_BODY_LENGTH = 4000;

export function sanitizeMessageBody(input: unknown): string {
  if (typeof input !== 'string') return '';
  // Strip tags
  let s = input.replace(/<[^>]*>/g, '');
  // Decode common entities so we don't lose user intent
  s = s.replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp);/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? m);
  // Normalize whitespace but preserve newlines (max 2 consecutive)
  s = s.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  s = s.trim();
  if (s.length > MAX_BODY_LENGTH) s = s.slice(0, MAX_BODY_LENGTH);
  return s;
}

/**
 * Build a short preview (for conversation list) — single line, capped at 120 chars.
 */
export function buildPreview(body: string): string {
  const oneLine = body.replace(/\s+/g, ' ').trim();
  return oneLine.length > 120 ? oneLine.slice(0, 117) + '…' : oneLine;
}
