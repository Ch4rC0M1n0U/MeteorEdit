import notoRegularUrl from '../assets/fonts/NotoSans-Regular.ttf?url';
import notoBoldUrl from '../assets/fonts/NotoSans-Bold.ttf?url';
import notoItalicUrl from '../assets/fonts/NotoSans-Italic.ttf?url';

let vfsCache: Record<string, string> | null = null;

async function fetchAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Font fetch failed: ${url} (${response.status})`);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function loadVfsFonts(): Promise<Record<string, string>> {
  if (vfsCache) return vfsCache;
  const [regular, bold, italic] = await Promise.all([
    fetchAsBase64(notoRegularUrl),
    fetchAsBase64(notoBoldUrl),
    fetchAsBase64(notoItalicUrl),
  ]);
  vfsCache = {
    'NotoSans-Regular.ttf': regular,
    'NotoSans-Bold.ttf': bold,
    'NotoSans-Italic.ttf': italic,
  };
  return vfsCache;
}

export const pdfMakeFontDescriptors = {
  NotoSans: {
    normal: 'NotoSans-Regular.ttf',
    bold: 'NotoSans-Bold.ttf',
    italics: 'NotoSans-Italic.ttf',
    bolditalics: 'NotoSans-Bold.ttf',
  },
  Courier: {
    normal: 'Courier',
    bold: 'Courier-Bold',
    italics: 'Courier-Oblique',
    bolditalics: 'Courier-BoldOblique',
  },
};
