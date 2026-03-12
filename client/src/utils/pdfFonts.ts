import type { jsPDF } from 'jspdf';

let fontDataCache: { regular: string; bold: string; italic: string } | null = null;

/**
 * Lazy-load Noto Sans fonts and register them with jsPDF instance.
 * Fonts are fetched once and cached in memory for subsequent exports.
 */
export async function registerNotoSans(doc: jsPDF): Promise<void> {
  if (!fontDataCache) {
    const [regular, bold, italic] = await Promise.all([
      fetchFontAsBase64(new URL('../assets/fonts/NotoSans-Regular.ttf', import.meta.url).href),
      fetchFontAsBase64(new URL('../assets/fonts/NotoSans-Bold.ttf', import.meta.url).href),
      fetchFontAsBase64(new URL('../assets/fonts/NotoSans-Italic.ttf', import.meta.url).href),
    ]);
    fontDataCache = { regular, bold, italic };
  }

  doc.addFileToVFS('NotoSans-Regular.ttf', fontDataCache.regular);
  doc.addFileToVFS('NotoSans-Bold.ttf', fontDataCache.bold);
  doc.addFileToVFS('NotoSans-Italic.ttf', fontDataCache.italic);
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
  doc.addFont('NotoSans-Italic.ttf', 'NotoSans', 'italic');
}

async function fetchFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Font name to use with doc.setFont() after registration */
export const PDF_FONT = 'NotoSans';
