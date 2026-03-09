import type { jsPDF } from 'jspdf';

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
      titleSize: 36,
      titleColor: '#29417a',
      subtitleSize: 20,
      footerText: 'PJF Bruxelles - DR5 - Data Management & Analysis',
    },
    headings: {
      h1: { fontSize: 16, color: '#000000', bgColor: '#f4c6a0', bold: true, italic: false, uppercase: false, borderStyle: 'none', borderColor: '#29417a', borderWidth: 1 },
      h2: { fontSize: 13, color: '#000000', bgColor: '#f4c6a0', bold: true, italic: false, uppercase: false, borderStyle: 'none', borderColor: '#29417a', borderWidth: 1 },
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
    try { logoLeft = await loadImageAsDataUrl(resolveLogoUrl(tpl.header.logoLeft, serverUrl)); } catch { /* skip */ }
  }
  // Fallback: try default public logo
  if (!logoLeft) {
    try { logoLeft = await loadImageAsDataUrl(new URL('/logo-pjf.jpeg', window.location.origin).href); } catch { /* skip */ }
  }

  if (tpl.header.logoRight) {
    try { logoRight = await loadImageAsDataUrl(resolveLogoUrl(tpl.header.logoRight, serverUrl)); } catch { /* skip */ }
  }
  if (!logoRight) {
    try { logoRight = await loadImageAsDataUrl(new URL('/logo-dr5.png', window.location.origin).href); } catch { /* skip */ }
  }

  return { logoLeft, logoRight };
}

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
  drawCover: (subtitle: string, extraLines?: string[]) => void;
  finalize: () => Blob;
}

const PDF_FONT_MAP: Record<FontFamily, string> = {
  'Calibri': 'helvetica',
  'Arial': 'helvetica',
  'Aptos': 'helvetica',
  'Times New Roman': 'times',
  'Georgia': 'times',
  'Helvetica': 'helvetica',
};

export function createPdfBuilder(doc: jsPDF, tpl: PdfTemplateConfig, logos: PdfLogoData): PdfBuilder {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = tpl.page?.marginH || 20;
  const usableW = pageW - margin * 2;
  const pdfFont = PDF_FONT_MAP[tpl.fontFamily] || 'helvetica';
  const headerH = 22;
  const footerH = 15;
  const contentTop = headerH + 5;
  const contentBottom = pageH - footerH;

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

    addHeading(text: string, level: 'h1' | 'h2' | 'h3') {
      const h = tpl.headings[level];
      const pad = level === 'h1' ? 4 : 3;
      const ss = tpl.spacing?.sectionSpacing || 6;
      const spaceBefore = level === 'h1' ? ss : (level === 'h2' ? ss * 0.5 : ss * 0.33);
      const spaceAfter = level === 'h1' ? ss + 2 : ss;
      const displayText = h.uppercase ? text.toUpperCase() : text;

      builder.checkPage(level === 'h1' ? 20 : 12);
      builder.y += spaceBefore;
      doc.setFontSize(h.fontSize);
      const fontStyle = (h.bold && h.italic) ? 'bolditalic' : h.bold ? 'bold' : h.italic ? 'italic' : 'normal';
      doc.setFont(pdfFont, fontStyle);

      const textH = h.fontSize * 0.5 + pad;
      const rectY = builder.y - h.fontSize * 0.35;

      if (h.bgColor) {
        const [r, g, b] = hexToRgb(h.bgColor);
        doc.setFillColor(r, g, b);
        doc.rect(margin, rectY, usableW, textH, 'F');
      }

      const [cr, cg, cb] = hexToRgb(h.color);
      doc.setTextColor(cr, cg, cb);
      doc.text(displayText, margin + 3, builder.y);
      doc.setTextColor(0);

      if (h.borderStyle && h.borderStyle !== 'none') {
        const [br, bg, bb] = hexToRgb(h.borderColor || '#000000');
        doc.setDrawColor(br, bg, bb);
        doc.setLineWidth(h.borderWidth || 0.5);
        if (h.borderStyle === 'bottom') {
          doc.line(margin, rectY + textH, margin + usableW, rectY + textH);
        } else if (h.borderStyle === 'box') {
          doc.rect(margin, rectY, usableW, textH);
        }
      }
      builder.y += h.fontSize * 0.5 + spaceAfter;
    },

    addSectionTitle(title: string) { builder.addHeading(title, 'h1'); },
    addSubHeading(text: string) { builder.addHeading(text, 'h2'); },

    addBody(text: string) {
      const lh = tpl.spacing?.lineHeight || 1.4;
      const ps = tpl.spacing?.paragraphSpacing ?? 3;
      doc.setFontSize(tpl.body.fontSize);
      doc.setFont(pdfFont, 'normal');
      const [br, bg, bb] = hexToRgb(tpl.body.color || '#000000');
      doc.setTextColor(br, bg, bb);
      const lines: string[] = doc.splitTextToSize(text, usableW);
      const lineStep = tpl.body.fontSize * 0.35 * lh;
      for (const line of lines) {
        builder.checkPage(5);
        doc.text(line, margin, builder.y, { maxWidth: usableW });
        builder.y += lineStep;
      }
      doc.setTextColor(0);
      builder.y += ps;
    },

    addDisclaimer(text: string) {
      const lh = tpl.spacing?.lineHeight || 1.4;
      const ps = tpl.spacing?.paragraphSpacing ?? 3;
      doc.setFontSize(tpl.body.fontSize - 1);
      doc.setFont(pdfFont, 'italic');
      const [r, g, b] = hexToRgb(tpl.disclaimer.color);
      doc.setTextColor(r, g, b);
      const lines: string[] = doc.splitTextToSize(text, usableW);
      const lineStep = (tpl.body.fontSize - 1) * 0.35 * lh;
      for (const line of lines) {
        builder.checkPage(5);
        doc.text(line, margin, builder.y, { maxWidth: usableW });
        builder.y += lineStep;
      }
      doc.setTextColor(0);
      builder.y += ps;
    },

    drawCover(subtitle: string, extraLines: string[] = []) {
      // Logo left (cover, centered top)
      if (logos.logoLeft) {
        doc.addImage(logos.logoLeft, 'PNG', margin, 15, 25, 25);
      }

      // Header text
      doc.setFontSize(8);
      doc.setFont(pdfFont, 'bold');
      doc.setTextColor(80);
      doc.text(tpl.header.text, pageW / 2, 28, { align: 'center' });

      // Logo right (cover top)
      if (logos.logoRight) {
        doc.addImage(logos.logoRight, 'PNG', pageW - margin - 25, 15, 25, 25);
      }

      // Separator line
      const [lr, lg, lb] = hexToRgb(tpl.header.lineColor);
      doc.setDrawColor(lr, lg, lb);
      doc.setLineWidth(0.8);
      doc.line(margin, 45, pageW - margin, 45);

      // Title
      const [tr, tg, tb] = hexToRgb(tpl.cover.titleColor);
      doc.setFontSize(tpl.cover.titleSize);
      doc.setFont(pdfFont, 'bold');
      doc.setTextColor(tr, tg, tb);
      doc.text(tpl.cover.title || 'Rapport OSINT', pageW / 2, 80, { align: 'center' });

      // Subtitle
      doc.setFontSize(tpl.cover.subtitleSize);
      doc.setFont(pdfFont, 'normal');
      doc.setTextColor(80);
      doc.text(subtitle, pageW / 2, 100, { align: 'center' });

      // Extra lines
      let extraY = 115;
      doc.setFontSize(12);
      for (const line of extraLines) {
        doc.text(line, pageW / 2, extraY, { align: 'center' });
        extraY += 10;
      }

      // Separator line bottom
      doc.setDrawColor(lr, lg, lb);
      doc.setLineWidth(0.5);
      doc.line(margin, extraY + 5, pageW - margin, extraY + 5);

      doc.setTextColor(0);

      // Footer text on cover
      if (tpl.cover.footerText) {
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(tpl.cover.footerText, pageW / 2, 270, { align: 'center' });
        doc.setTextColor(0);
      }
    },

    finalize(): Blob {
      // Draw headers/footers on all content pages (skip cover = page 1)
      const totalContentPages = builder.currentPage - 1;
      const [hlr, hlg, hlb] = hexToRgb(tpl.header.lineColor);
      const [flr, flg, flb] = hexToRgb(tpl.footer.lineColor);

      for (let p = 2; p <= builder.currentPage; p++) {
        doc.setPage(p);

        // Header line
        doc.setDrawColor(hlr, hlg, hlb);
        doc.setLineWidth(0.5);
        doc.line(margin, headerH, pageW - margin, headerH);

        // Header text
        doc.setFontSize(8);
        doc.setFont(pdfFont, 'normal');
        doc.setTextColor(hlr, hlg, hlb);
        doc.text(tpl.header.text, pageW / 2, headerH - 5, { align: 'center' });

        // Header logos
        if (logos.logoLeft) doc.addImage(logos.logoLeft, 'PNG', margin, 3, 15, 15);
        if (logos.logoRight) doc.addImage(logos.logoRight, 'PNG', pageW - margin - 15, 3, 15, 15);

        // Footer line
        doc.setDrawColor(flr, flg, flb);
        doc.line(margin, pageH - footerH, pageW - margin, pageH - footerH);

        // Footer pagination
        const pageNum = p - 1;
        const paginationText = tpl.footer.format
          .replace('{n}', String(pageNum))
          .replace('{total}', String(totalContentPages));
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(paginationText, pageW - margin, pageH - footerH + 5, { align: 'right' });
        doc.setTextColor(0);
      }

      // Replace placeholder in raw PDF for total pages
      const pdfOutput = doc.output('arraybuffer');
      const pdfString = new TextDecoder('latin1').decode(new Uint8Array(pdfOutput));
      const fixedPdf = pdfString.replace(/__TOTAL_PAGES__/g, String(totalContentPages));
      const finalBytes = new Uint8Array(fixedPdf.length);
      for (let i = 0; i < fixedPdf.length; i++) {
        finalBytes[i] = fixedPdf.charCodeAt(i) & 0xff;
      }
      return new Blob([finalBytes], { type: 'application/pdf' });
    },
  };

  return builder;
}
