import type { jsPDF } from 'jspdf';
import { registerNotoSans, PDF_FONT } from './pdfFonts';

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
  disclaimer: { color: string };
  footer: { format: string; lineColor: string };
}

// ── Defaults ────────────────────────────────────────────────────────

export function defaultPdfTemplate(): PdfTemplateConfig {
  return {
    fontFamily: 'Calibri',
    page: { marginH: 20, marginV: 15 },
    header: {
      text: 'PJF Bruxelles - DR5 - Data Management & Analysis',
      logoLeft: '',
      logoRight: '',
      lineColor: '#29417a',
    },
    cover: {
      title: 'Rapport OSINT',
      titleSize: 28,
      titleColor: '#29417a',
      subtitleSize: 16,
      footerText: 'PJF Bruxelles - DR5 - Data Management & Analysis',
    },
    headings: {
      h1: { fontSize: 14, color: '#000000', bgColor: '#f4c6a0', bold: true, italic: false, uppercase: false, borderStyle: 'none', borderColor: '#29417a', borderWidth: 1 },
      h2: { fontSize: 12, color: '#000000', bgColor: '#f4c6a0', bold: true, italic: false, uppercase: false, borderStyle: 'none', borderColor: '#29417a', borderWidth: 1 },
      h3: { fontSize: 11, color: '#000000', bgColor: '', bold: true, italic: false, uppercase: false, borderStyle: 'bottom', borderColor: '#29417a', borderWidth: 1 },
    },
    body: { fontSize: 10, color: '#000000' },
    spacing: { lineHeight: 1.4, paragraphSpacing: 3, sectionSpacing: 6 },
    table: { headerBgColor: '#29417a', headerTextColor: '#ffffff', borderColor: '#cccccc', borderWidth: 0.5, alternateRowColor: '#f5f5f5' },
    disclaimer: { color: '#ee0000' },
    footer: { format: 'Page {n} | {total}', lineColor: '#29417a' },
  };
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

// ── Utilities ───────────────────────────────────────────────────────

const PT_MM = 0.3528;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

export function loadImageAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export interface PdfLogoData {
  logoLeft: string | null;
  logoRight: string | null;
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
  if (tpl.header.logoLeft) {
    try { logoLeft = await loadImageAsDataUrl(resolveLogoUrl(tpl.header.logoLeft, serverUrl)); } catch { /* */ }
  }
  if (!logoLeft) {
    try { logoLeft = await loadImageAsDataUrl(new URL('/logo-pjf.jpeg', window.location.origin).href); } catch { /* */ }
  }
  if (tpl.header.logoRight) {
    try { logoRight = await loadImageAsDataUrl(resolveLogoUrl(tpl.header.logoRight, serverUrl)); } catch { /* */ }
  }
  if (!logoRight) {
    try { logoRight = await loadImageAsDataUrl(new URL('/logo-dr5.png', window.location.origin).href); } catch { /* */ }
  }
  return { logoLeft, logoRight };
}

// ── PDF Builder ─────────────────────────────────────────────────────

export interface PdfBuilder {
  doc: jsPDF;
  tpl: PdfTemplateConfig;
  logos: PdfLogoData;
  y: number;
  currentPage: number;
  pageW: number;
  pageH: number;
  margin: number;
  usableW: number;
  contentTop: number;
  contentBottom: number;
  newContentPage: () => void;
  checkPage: (need: number) => void;
  addHeading: (text: string, level: 'h1' | 'h2' | 'h3') => void;
  addSectionTitle: (title: string) => void;
  addSubHeading: (text: string) => void;
  addBody: (text: string) => void;
  addDisclaimer: (text: string) => void;
  addInlineImage: (dataUrl: string, imgW: number, imgH: number) => void;
  drawReportHeader: (title: string, infoLines: string[]) => void;
  finalize: () => Blob;
}

export async function createPdfBuilder(doc: jsPDF, tpl: PdfTemplateConfig, logos: PdfLogoData): Promise<PdfBuilder> {
  await registerNotoSans(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = tpl.page?.marginH || 20;
  const usableW = pageW - margin * 2;
  const headerH = 22;
  const footerH = 15;
  const contentTop = headerH + 5;
  const contentBottom = pageH - footerH;

  function fontAscent(size: number): number { return size * PT_MM * 0.75; }

  const builder: PdfBuilder = {
    doc, tpl, logos,
    y: contentTop,
    currentPage: 1,
    pageW, pageH, margin, usableW, contentTop, contentBottom,

    newContentPage() {
      doc.addPage();
      builder.currentPage++;
      builder.y = contentTop;
    },

    checkPage(need: number) {
      if (builder.y + need > contentBottom) builder.newContentPage();
    },

    drawReportHeader(title: string, infoLines: string[]) {
      // Title
      const titleSize = tpl.cover.titleSize;
      doc.setFontSize(titleSize);
      doc.setFont(PDF_FONT, 'bold');
      const [tr, tg, tb] = hexToRgb(tpl.cover.titleColor);
      doc.setTextColor(tr, tg, tb);
      const titleBaseline = builder.y + fontAscent(titleSize);
      doc.text(title, pageW / 2, titleBaseline, { align: 'center' });
      builder.y += titleSize * PT_MM + 4;

      // Info lines
      if (infoLines.length > 0) {
        doc.setFontSize(10);
        doc.setFont(PDF_FONT, 'normal');
        doc.setTextColor(100);
        for (const line of infoLines) {
          const baseline = builder.y + fontAscent(10);
          doc.text(line, pageW / 2, baseline, { align: 'center' });
          builder.y += 10 * PT_MM + 2;
        }
      }

      // Separator
      builder.y += 3;
      const [lr, lg, lb] = hexToRgb(tpl.header.lineColor);
      doc.setDrawColor(lr, lg, lb);
      doc.setLineWidth(0.5);
      doc.line(margin, builder.y, pageW - margin, builder.y);
      builder.y += 6;
      doc.setTextColor(0);
    },

    addHeading(text: string, level: 'h1' | 'h2' | 'h3') {
      const h = tpl.headings[level];
      const displayText = h.uppercase ? text.toUpperCase() : text;

      const gapBefore = level === 'h1' ? 7 : (level === 'h2' ? 5 : 3);
      const gapAfter = level === 'h1' ? 4 : (level === 'h2' ? 3 : 2);
      const padV = 2;
      const padH = 3;
      const asc = fontAscent(h.fontSize);
      const desc = h.fontSize * PT_MM * 0.25;
      const rectH = padV + asc + desc + padV;

      builder.checkPage(gapBefore + rectH + gapAfter + 8);
      builder.y += gapBefore;

      const rectTop = builder.y;
      const baseline = rectTop + padV + asc;

      doc.setFontSize(h.fontSize);
      const fontStyle = (h.bold && h.italic) ? 'bolditalic' : h.bold ? 'bold' : h.italic ? 'italic' : 'normal';
      doc.setFont(PDF_FONT, fontStyle);

      if (h.bgColor) {
        doc.setFillColor(...hexToRgb(h.bgColor));
        doc.rect(margin, rectTop, usableW, rectH, 'F');
      }

      doc.setTextColor(...hexToRgb(h.color));
      doc.text(displayText, margin + padH, baseline);
      doc.setTextColor(0);

      if (h.borderStyle && h.borderStyle !== 'none') {
        doc.setDrawColor(...hexToRgb(h.borderColor || '#000000'));
        doc.setLineWidth(h.borderWidth || 0.5);
        const rectBottom = rectTop + rectH;
        if (h.borderStyle === 'bottom') {
          doc.line(margin, rectBottom, margin + usableW, rectBottom);
        } else if (h.borderStyle === 'box') {
          doc.rect(margin, rectTop, usableW, rectH);
        }
      }

      builder.y = rectTop + rectH + gapAfter;
    },

    addSectionTitle(title: string) { builder.addHeading(title, 'h1'); },
    addSubHeading(text: string) { builder.addHeading(text, 'h2'); },

    addBody(text: string) {
      const lh = tpl.spacing?.lineHeight || 1.4;
      const ps = tpl.spacing?.paragraphSpacing ?? 3;
      const fontSize = tpl.body.fontSize;
      doc.setFontSize(fontSize);
      doc.setFont(PDF_FONT, 'normal');
      doc.setTextColor(...hexToRgb(tpl.body.color || '#000000'));
      const lines: string[] = doc.splitTextToSize(text, usableW);
      const lineH = fontSize * PT_MM * lh;
      for (const line of lines) {
        builder.checkPage(lineH + 2);
        doc.text(line, margin, builder.y + fontAscent(fontSize), { maxWidth: usableW });
        builder.y += lineH;
      }
      doc.setTextColor(0);
      builder.y += ps;
    },

    addInlineImage(dataUrl: string, imgW: number, imgH: number) {
      const maxW = usableW;
      const maxH = 120;
      let w = imgW * 0.264583;
      let h = imgH * 0.264583;
      if (w > maxW) { const s = maxW / w; w = maxW; h *= s; }
      if (h > maxH) { const s = maxH / h; h = maxH; w *= s; }
      builder.checkPage(h + 8);
      builder.y += 2;
      try {
        const fmt = dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
        doc.addImage(dataUrl, fmt, margin, builder.y, w, h);
        builder.y += h + 3;
      } catch (e) {
        console.warn('PDF addImage failed:', e);
      }
    },

    addDisclaimer(text: string) {
      const lh = tpl.spacing?.lineHeight || 1.4;
      const ps = tpl.spacing?.paragraphSpacing ?? 3;
      const fontSize = tpl.body.fontSize - 1;
      doc.setFontSize(fontSize);
      doc.setFont(PDF_FONT, 'italic');
      doc.setTextColor(...hexToRgb(tpl.disclaimer.color));
      const lines: string[] = doc.splitTextToSize(text, usableW);
      const lineH = fontSize * PT_MM * lh;
      for (const line of lines) {
        builder.checkPage(lineH + 2);
        doc.text(line, margin, builder.y + fontAscent(fontSize), { maxWidth: usableW });
        builder.y += lineH;
      }
      doc.setTextColor(0);
      builder.y += ps;
    },

    finalize(): Blob {
      const totalPages = builder.currentPage;
      const [hlr, hlg, hlb] = hexToRgb(tpl.header.lineColor);
      const [flr, flg, flb] = hexToRgb(tpl.footer.lineColor);

      for (let p = 1; p <= builder.currentPage; p++) {
        doc.setPage(p);

        // Header
        doc.setDrawColor(hlr, hlg, hlb);
        doc.setLineWidth(0.5);
        doc.line(margin, headerH, pageW - margin, headerH);
        doc.setFontSize(8);
        doc.setFont(PDF_FONT, 'normal');
        doc.setTextColor(hlr, hlg, hlb);
        doc.text(tpl.header.text, pageW / 2, headerH - 5, { align: 'center' });
        if (logos.logoLeft) doc.addImage(logos.logoLeft, 'PNG', margin, 3, 15, 15);
        if (logos.logoRight) doc.addImage(logos.logoRight, 'PNG', pageW - margin - 15, 3, 15, 15);

        // Footer
        doc.setDrawColor(flr, flg, flb);
        doc.line(margin, pageH - footerH, pageW - margin, pageH - footerH);
        const paginationText = tpl.footer.format
          .replace('{n}', String(p))
          .replace('{total}', String(totalPages));
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(paginationText, pageW - margin, pageH - footerH + 5, { align: 'right' });
        doc.setTextColor(0);
      }

      const pdfOutput = doc.output('arraybuffer');
      const pdfString = new TextDecoder('latin1').decode(new Uint8Array(pdfOutput));
      const fixedPdf = pdfString.replace(/__TOTAL_PAGES__/g, String(totalPages));
      const finalBytes = new Uint8Array(fixedPdf.length);
      for (let i = 0; i < fixedPdf.length; i++) {
        finalBytes[i] = fixedPdf.charCodeAt(i) & 0xff;
      }
      return new Blob([finalBytes], { type: 'application/pdf' });
    },
  };

  return builder;
}

// ── Sanitization ────────────────────────────────────────────────────

export function cleanControlChars(text: string): string {
  return text.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u0000-\u001F]/g, '');
}

// ── Content Blocks ──────────────────────────────────────────────────

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; src: string; alt?: string };

export function extractContentBlocks(json: any): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  if (!json) return blocks;

  function walk(node: any) {
    if (!node) return;
    if (node.type === 'image' && node.attrs?.src) {
      blocks.push({ type: 'image', src: node.attrs.src, alt: node.attrs.alt });
      return;
    }
    if (node.text) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'text') { last.text += node.text; }
      else { blocks.push({ type: 'text', text: node.text }); }
      return;
    }
    if (node.content) {
      for (const child of node.content) { walk(child); }
      if (['paragraph', 'heading', 'blockquote', 'listItem'].includes(node.type)) {
        const last = blocks[blocks.length - 1];
        if (last && last.type === 'text') { last.text += '\n'; }
      }
    }
  }

  if (json.content) { for (const child of json.content) { walk(child); } }
  else { walk(json); }
  return blocks;
}
