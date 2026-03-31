// ── Types ───────────────────────────────────────────────────────────

export type FontFamily = 'Calibri' | 'Arial' | 'Times New Roman' | 'Georgia' | 'Helvetica' | 'Aptos';

export interface HeadingStyle {
  fontSize: number;
  color: string;
  bgColor: string;
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
  borderStyle: 'none' | 'bottom' | 'box';
  borderColor: string;
  borderWidth: number;
}

export interface SpacingConfig {
  lineHeight: number;
  paragraphSpacing: number;
  sectionSpacing: number;
}

export interface TableStyle {
  headerBgColor: string;
  headerTextColor: string;
  borderColor: string;
  borderWidth: number;
  alternateRowColor: string;
}

export interface PdfTemplateConfig {
  fontFamily: FontFamily;
  page: { marginH: number; marginV: number };
  header: {
    text: string;
    logoLeft: string;
    logoRight: string;
    lineColor: string;
  };
  cover: {
    title: string;
    titleSize: number;
    titleColor: string;
    subtitleSize: number;
    footerText: string;
  };
  headings: {
    h1: HeadingStyle;
    h2: HeadingStyle;
    h3: HeadingStyle;
  };
  body: { fontSize: number; color: string };
  spacing: SpacingConfig;
  table: TableStyle;
  observations?: { bold: boolean; italic: boolean; bgColor: string; borderColor: string };
  disclaimer: { color: string };
  footer: { format: string; lineColor: string };
}

export interface PdfLogoData {
  logoLeft: string | null;
  logoRight: string | null;
}

// ── Defaults ────────────────────────────────────────────────────────

export const DEFAULT_TEMPLATE: PdfTemplateConfig = {
  fontFamily: 'Aptos',
  page: { marginH: 20, marginV: 15 },
  header: {
    text: 'PJF Bruxelles - DR5 - Data Management & Analysis',
    logoLeft: '',
    logoRight: '',
    lineColor: '#2E5A88',
  },
  cover: {
    title: 'Rapport OSINT',
    titleSize: 22,
    titleColor: '#2E5A88',
    subtitleSize: 12,
    footerText: 'PJF Bruxelles - DR5 - Data Management & Analysis',
  },
  headings: {
    h1: { fontSize: 14, color: '#2E5A88', bgColor: '', bold: true, italic: false, uppercase: false, borderStyle: 'bottom', borderColor: '#2E5A88', borderWidth: 2 },
    h2: { fontSize: 12, color: '#2E5A88', bgColor: '', bold: true, italic: false, uppercase: false, borderStyle: 'none', borderColor: '#2E5A88', borderWidth: 1 },
    h3: { fontSize: 11, color: '#2E5A88', bgColor: '', bold: true, italic: true, uppercase: false, borderStyle: 'none', borderColor: '#2E5A88', borderWidth: 1 },
  },
  body: { fontSize: 10, color: '#333333' },
  spacing: { lineHeight: 1.4, paragraphSpacing: 3, sectionSpacing: 6 },
  table: { headerBgColor: '#2E5A88', headerTextColor: '#ffffff', borderColor: '#2E5A88', borderWidth: 0.5, alternateRowColor: '#F0F4F8' },
  observations: { bold: true, italic: true, bgColor: '#F0F4F8', borderColor: '#2E5A88' },
  disclaimer: { color: '#CC0000' },
  footer: { format: 'Page {page} | {pages}', lineColor: '#2E5A88' },
};

export function defaultPdfTemplate(): PdfTemplateConfig {
  return JSON.parse(JSON.stringify(DEFAULT_TEMPLATE));
}

export function mergePdfTemplate(target: PdfTemplateConfig, source: Partial<Record<string, any>>): void {
  if (source.fontFamily) target.fontFamily = source.fontFamily;
  if (source.page) Object.assign(target.page, source.page);
  if (source.header) Object.assign(target.header, source.header);
  if (source.cover) Object.assign(target.cover, source.cover);
  if (source.headings) {
    if (source.headings.h1) Object.assign(target.headings.h1, source.headings.h1);
    if (source.headings.h2) Object.assign(target.headings.h2, source.headings.h2);
    if (source.headings.h3) Object.assign(target.headings.h3, source.headings.h3);
  }
  if (source.body) Object.assign(target.body, source.body);
  if (source.spacing) Object.assign(target.spacing, source.spacing);
  if (source.table) Object.assign(target.table, source.table);
  if (source.observations) {
    if (!target.observations) target.observations = { bold: true, italic: true, bgColor: '#F0F0F0', borderColor: '#CCCCCC' };
    Object.assign(target.observations, source.observations);
  }
  if (source.disclaimer) Object.assign(target.disclaimer, source.disclaimer);
  if (source.footer) Object.assign(target.footer, source.footer);
}

export function loadPdfTemplate(): PdfTemplateConfig {
  const defaults = defaultPdfTemplate();
  try {
    const saved = localStorage.getItem('pdfTemplate');
    if (saved) mergePdfTemplate(defaults, JSON.parse(saved));
  } catch { /* use defaults */ }
  return defaults;
}

export function savePdfTemplate(tpl: PdfTemplateConfig): void {
  try {
    localStorage.setItem('pdfTemplate', JSON.stringify(tpl));
  } catch { /* storage full or unavailable */ }
}

// ── Image utilities ─────────────────────────────────────────────────

export async function loadImageAsDataUrl(url: string): Promise<string> {
  if (!url) throw new Error('Empty image URL');
  if (url.startsWith('data:')) return url;

  let resolvedUrl = url;
  if (!url.startsWith('blob:') && !url.startsWith('http')) {
    resolvedUrl = new URL(url, window.location.origin).href;
  }

  const response = await fetch(resolvedUrl);
  if (!response.ok) {
    console.warn('[Export] Image fetch failed:', resolvedUrl, response.status);
    throw new Error(`Image fetch failed: ${resolvedUrl} (${response.status})`);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => {
      console.warn('[Export] FileReader failed for:', resolvedUrl);
      reject(new Error('FileReader failed'));
    };
    reader.readAsDataURL(blob);
  });
}

export function resolveLogoUrl(logo: string, serverUrl: string): string {
  if (!logo) return '';
  if (logo.startsWith('data:') || logo.startsWith('blob:')) return logo;
  if (logo.startsWith('http')) return logo;
  if (logo.startsWith('uploads/')) return `${serverUrl}/${logo}`;
  return new URL(`/${logo}`, window.location.origin).href;
}

export async function loadTemplateLogos(tpl: PdfTemplateConfig, serverUrl: string): Promise<PdfLogoData> {
  let logoLeft: string | null = null;
  let logoRight: string | null = null;
  // Only load logos if explicitly configured — no hardcoded fallbacks
  if (tpl.header.logoLeft) {
    try { logoLeft = await loadImageAsDataUrl(resolveLogoUrl(tpl.header.logoLeft, serverUrl)); } catch { /* */ }
  }
  if (tpl.header.logoRight) {
    try { logoRight = await loadImageAsDataUrl(resolveLogoUrl(tpl.header.logoRight, serverUrl)); } catch { /* */ }
  }
  return { logoLeft, logoRight };
}

// ── Sanitization ────────────────────────────────────────────────────

export function cleanControlChars(text: string): string {
  return text
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u0000-\u001F]/g, '')
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{E0020}-\u{E007F}\u{2300}-\u{23FF}\u{2B50}-\u{2B55}\u{200D}\u{20E3}\u{FE0E}]/gu, '')
    .trim();
}
