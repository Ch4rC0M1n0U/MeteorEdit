import type { jsPDF } from 'jspdf';
import { registerNotoSans, PDF_FONT } from './pdfFonts';
import { blocksToPlainText, type ContentBlock, type InlineMark } from './contentBlocks';

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
  addRichText: (children: ContentBlock[], align?: string) => void;
  addList: (items: ContentBlock[][], ordered: boolean, level?: number, startNum?: number) => void;
  addBlockquote: (children: ContentBlock[]) => void;
  addCodeBlock: (text: string) => void;
  addTable: (rows: ContentBlock[][][]) => void;
  addInlineImage: (dataUrl: string, imgW: number, imgH: number) => void;
  renderBlocks: (blocks: ContentBlock[]) => Promise<void>;
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
      const fontStyle = h.bold ? 'bold' : h.italic ? 'italic' : 'normal';
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

    addRichText(children: ContentBlock[], align?: string) {
      if (!children || children.length === 0) return;

      const lh = tpl.spacing?.lineHeight || 1.4;
      const ps = tpl.spacing?.paragraphSpacing ?? 3;
      const fontSize = tpl.body.fontSize;
      const defaultColor = tpl.body.color || '#000000';

      // ── helpers ──────────────────────────────────────────────
      interface RichRun { text: string; marks: InlineMark }

      function fontStyleFor(m: InlineMark): string {
        if (m.code) return 'normal'; // code uses normal style with gray background
        if (m.bold) return 'bold'; // no bolditalic variant registered, bold wins
        if (m.italic) return 'italic';
        return 'normal';
      }

      function fontNameFor(_m: InlineMark): string {
        // Always use NotoSans to support non-ASCII (accents, etc.)
        // Code blocks get a smaller size + gray background instead of courier
        return PDF_FONT;
      }

      function fontSizeFor(m: InlineMark): number {
        return m.code ? fontSize - 1 : fontSize;
      }

      function applyFont(m: InlineMark) {
        doc.setFont(fontNameFor(m), fontStyleFor(m));
        doc.setFontSize(fontSizeFor(m));
      }

      function measureWord(word: string, m: InlineMark): number {
        applyFont(m);
        return doc.getTextWidth(word);
      }

      // ── Build segments, splitting on hardBreak ───────────────
      // Each "visual line group" is separated by hardBreak
      const segmentGroups: RichRun[][] = [[]];
      for (const child of children) {
        if (child.type === 'hardBreak') {
          segmentGroups.push([]);
        } else if (child.type === 'text') {
          segmentGroups[segmentGroups.length - 1].push({
            text: child.text,
            marks: child.marks || {},
          });
        }
      }

      // ── Word-wrap into visual lines ──────────────────────────
      type VisualLine = RichRun[];
      const lines: VisualLine[] = [];

      for (const segments of segmentGroups) {
        let currentLine: RichRun[] = [];
        let currentLineW = 0;

        for (const seg of segments) {
          // Split segment text into words preserving spaces
          const words = seg.text.split(/( +)/);
          let pendingText = '';

          for (const word of words) {
            if (word === '') continue;
            // Skip leading whitespace on a fresh wrapped line
            if (currentLineW === 0 && word.trim() === '') continue;
            const wordW = measureWord(word, seg.marks);

            if (currentLineW + wordW > usableW && currentLine.length > 0 && currentLineW > 0) {
              // Flush pending text for this segment before breaking
              if (pendingText) {
                currentLine.push({ text: pendingText, marks: seg.marks });
                pendingText = '';
              }
              lines.push(currentLine);
              currentLine = [];
              currentLineW = 0;
            }

            pendingText += word;
            currentLineW += wordW;
          }

          if (pendingText) {
            currentLine.push({ text: pendingText, marks: seg.marks });
          }
        }

        // End of a hardBreak group always creates a line
        lines.push(currentLine);
      }

      // ── Render lines ─────────────────────────────────────────
      const lineH = fontSize * PT_MM * lh;

      for (const line of lines) {
        builder.checkPage(lineH + 2);
        const baseline = builder.y + fontAscent(fontSize);

        // Calculate total line width for alignment
        let totalW = 0;
        for (const run of line) {
          applyFont(run.marks);
          totalW += doc.getTextWidth(run.text);
        }

        let startX = margin;
        if (align === 'center') {
          startX = margin + (usableW - totalW) / 2;
        } else if (align === 'right') {
          startX = margin + usableW - totalW;
        }

        let curX = startX;

        for (const run of line) {
          const m = run.marks;
          const sz = fontSizeFor(m);
          applyFont(m);
          const runW = doc.getTextWidth(run.text);

          // Determine text color
          let textColor = defaultColor;
          if (m.link) {
            textColor = '#1565C0'; // blue for links
          } else if (m.color) {
            textColor = m.color;
          }

          // Draw highlight background
          if (m.highlight) {
            const hlAscent = fontAscent(sz);
            const hlDesc = sz * PT_MM * 0.25;
            doc.setFillColor(...hexToRgb(m.highlight));
            doc.rect(curX, baseline - hlAscent, runW, hlAscent + hlDesc, 'F');
          }

          // Draw code background
          if (m.code) {
            const codeAscent = fontAscent(sz);
            const codeDesc = sz * PT_MM * 0.25;
            doc.setFillColor(235, 235, 235);
            doc.rect(curX - 0.5, baseline - codeAscent, runW + 1, codeAscent + codeDesc, 'F');
          }

          // Set text color and draw
          doc.setTextColor(...hexToRgb(textColor));
          doc.text(run.text, curX, baseline);

          // Draw underline (for explicit underline mark or links)
          if (m.underline || m.link) {
            const ulY = baseline + sz * PT_MM * 0.15;
            doc.setDrawColor(...hexToRgb(textColor));
            doc.setLineWidth(0.2);
            doc.line(curX, ulY, curX + runW, ulY);
          }

          // Draw strikethrough
          if (m.strike) {
            const strikeY = baseline - fontAscent(sz) * 0.35;
            doc.setDrawColor(...hexToRgb(textColor));
            doc.setLineWidth(0.2);
            doc.line(curX, strikeY, curX + runW, strikeY);
          }

          curX += runW;
        }

        // Reset draw color after decorations (underline, strikethrough)
        doc.setDrawColor(0);

        builder.y += lineH;
      }

      // Reset font and color to defaults
      doc.setFont(PDF_FONT, 'normal');
      doc.setFontSize(fontSize);
      doc.setTextColor(...hexToRgb(defaultColor));

      // Paragraph spacing
      builder.y += ps;
    },

    addList(items: ContentBlock[][], ordered: boolean, level = 0, startNum = 1) {
      const lh = tpl.spacing?.lineHeight || 1.4;
      const fontSize = tpl.body.fontSize;
      const lineH = fontSize * PT_MM * lh;
      const indent = level * 8;
      const bulletWidth = ordered ? 6 : 4;

      // Save original margin/usableW
      const savedMargin = builder.margin;
      const savedUsableW = builder.usableW;

      for (let i = 0; i < items.length; i++) {
        const itemBlocks = items[i];
        const num = startNum + i;

        // Draw bullet/number
        const bulletX = savedMargin + indent;
        const bulletText = ordered ? `${num}.` : '\u2022';

        builder.checkPage(lineH + 2);
        doc.setFontSize(fontSize);
        doc.setFont(PDF_FONT, 'normal');
        doc.setTextColor(...hexToRgb(tpl.body.color || '#000000'));
        doc.text(bulletText, bulletX, builder.y + fontAscent(fontSize));

        // Temporarily shift margin for item content
        const contentIndent = indent + bulletWidth;
        builder.margin = savedMargin + contentIndent;
        builder.usableW = savedUsableW - contentIndent;

        // Render each block in the item
        for (const block of itemBlocks) {
          switch (block.type) {
            case 'paragraph':
              builder.addRichText(block.children, block.align);
              break;
            case 'bulletList':
              builder.addList(block.items, false, level + 1);
              break;
            case 'orderedList':
              builder.addList(block.items, true, level + 1, block.start ?? 1);
              break;
            case 'text': {
              const text = block.text;
              doc.setFontSize(fontSize);
              doc.setFont(PDF_FONT, 'normal');
              doc.setTextColor(...hexToRgb(tpl.body.color || '#000000'));
              const lines: string[] = doc.splitTextToSize(text, builder.usableW);
              for (const line of lines) {
                builder.checkPage(lineH + 2);
                doc.text(line, builder.margin, builder.y + fontAscent(fontSize));
                builder.y += lineH;
              }
              builder.y += tpl.spacing?.paragraphSpacing ?? 3;
              break;
            }
            case 'blockquote':
              builder.addBlockquote(block.children);
              break;
            case 'codeBlock':
              builder.addCodeBlock(block.text);
              break;
            default:
              // Skip unsupported types in list items
              break;
          }
        }

        // Restore margin/usableW
        builder.margin = savedMargin;
        builder.usableW = savedUsableW;

        // Small spacing between items (only if not last)
        if (i < items.length - 1) {
          builder.y += 1;
        }
      }

      // Paragraph spacing after list
      builder.y += tpl.spacing?.paragraphSpacing ?? 3;
    },

    addBlockquote(children: ContentBlock[]) {
      const ps = tpl.spacing?.paragraphSpacing ?? 3;
      const borderX = builder.margin + 3;
      const contentOffset = 7;

      // Save state
      const savedMargin = builder.margin;
      const savedUsableW = builder.usableW;
      const yStart = builder.y;

      // Shift content to the right
      builder.margin = savedMargin + contentOffset;
      builder.usableW = savedUsableW - contentOffset;

      // Render children in italic
      for (const block of children) {
        switch (block.type) {
          case 'paragraph': {
            // Override children marks to italic
            const italicChildren: ContentBlock[] = block.children.map(child => {
              if (child.type === 'text') {
                return { ...child, marks: { ...child.marks, italic: true } };
              }
              return child;
            });
            builder.addRichText(italicChildren, block.align);
            break;
          }
          case 'text': {
            const lh = tpl.spacing?.lineHeight || 1.4;
            const fontSize = tpl.body.fontSize;
            const lineH = fontSize * PT_MM * lh;
            doc.setFontSize(fontSize);
            doc.setFont(PDF_FONT, 'italic');
            doc.setTextColor(...hexToRgb(tpl.body.color || '#000000'));
            const lines: string[] = doc.splitTextToSize(block.text, builder.usableW);
            for (const line of lines) {
              builder.checkPage(lineH + 2);
              doc.text(line, builder.margin, builder.y + fontAscent(fontSize));
              builder.y += lineH;
            }
            builder.y += ps;
            break;
          }
          default:
            break;
        }
      }

      const yEnd = builder.y;

      // Draw vertical border line
      const [lr, lg, lb] = hexToRgb(tpl.header.lineColor);
      doc.setDrawColor(lr, lg, lb);
      doc.setLineWidth(0.5);
      doc.line(borderX, yStart, borderX, yEnd - ps);

      // Restore state
      builder.margin = savedMargin;
      builder.usableW = savedUsableW;

      // Paragraph spacing
      builder.y += ps;
    },

    addCodeBlock(text: string) {
      const lh = tpl.spacing?.lineHeight || 1.4;
      const ps = tpl.spacing?.paragraphSpacing ?? 3;
      const fontSize = tpl.body.fontSize - 1;
      const lineH = fontSize * PT_MM * lh;
      const pad = 3;

      const codeLines = text.split('\n');
      const totalH = pad * 2 + codeLines.length * lineH;

      builder.checkPage(Math.min(totalH, builder.contentBottom - builder.y));

      // Draw background
      const bgTop = builder.y;
      doc.setFillColor(245, 245, 245);
      doc.rect(builder.margin, bgTop, builder.usableW, totalH, 'F');

      // Optional thin border
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.rect(builder.margin, bgTop, builder.usableW, totalH);

      builder.y += pad;

      doc.setFontSize(fontSize);
      doc.setFont(PDF_FONT, 'normal');
      doc.setTextColor(...hexToRgb(tpl.body.color || '#000000'));

      for (const line of codeLines) {
        builder.checkPage(lineH + 2);
        doc.text(line || ' ', builder.margin + pad, builder.y + fontAscent(fontSize), { maxWidth: builder.usableW - pad * 2 });
        builder.y += lineH;
      }

      builder.y += pad + ps;
      doc.setDrawColor(0);
    },

    addTable(rows: ContentBlock[][][]) {
      if (!rows || rows.length === 0) return;

      const ps = tpl.spacing?.paragraphSpacing ?? 3;
      const fontSize = tpl.body.fontSize;
      const lh = tpl.spacing?.lineHeight || 1.4;
      const lineH = fontSize * PT_MM * lh;
      const cellPadH = 2; // horizontal padding per side
      const cellPadV = 2; // vertical padding per side
      const colCount = rows[0].length;
      const colWidth = usableW / colCount;

      // Helper: compute row heights and wrapped text
      function prepareRow(row: ContentBlock[][]) {
        const cellTexts: string[][] = [];
        let maxH = 0;
        for (let c = 0; c < colCount; c++) {
          const cell = row[c] || [];
          const plainText = blocksToPlainText(cell);
          const wrapped: string[] = doc.splitTextToSize(plainText, colWidth - cellPadH * 2);
          cellTexts.push(wrapped);
          const cellH = wrapped.length * lineH;
          if (cellH > maxH) maxH = cellH;
        }
        const rowH = maxH + cellPadV * 2;
        return { cellTexts, rowH };
      }

      // Helper: draw a single row
      function drawRow(row: ContentBlock[][], rowIndex: number, isHeader: boolean) {
        const { cellTexts, rowH } = prepareRow(row);

        // Draw cell backgrounds
        for (let c = 0; c < colCount; c++) {
          const cellX = margin + c * colWidth;

          if (isHeader) {
            doc.setFillColor(...hexToRgb(tpl.table.headerBgColor));
            doc.rect(cellX, builder.y, colWidth, rowH, 'F');
          } else if (rowIndex % 2 === 1 && tpl.table.alternateRowColor) {
            doc.setFillColor(...hexToRgb(tpl.table.alternateRowColor));
            doc.rect(cellX, builder.y, colWidth, rowH, 'F');
          }
        }

        // Draw cell text
        doc.setFontSize(fontSize);
        for (let c = 0; c < colCount; c++) {
          const cellX = margin + c * colWidth;
          const lines = cellTexts[c];

          if (isHeader) {
            doc.setFont(PDF_FONT, 'bold');
            doc.setTextColor(...hexToRgb(tpl.table.headerTextColor));
          } else {
            doc.setFont(PDF_FONT, 'normal');
            doc.setTextColor(...hexToRgb(tpl.body.color || '#000000'));
          }

          let textY = builder.y + cellPadV + fontAscent(fontSize);
          for (const line of lines) {
            doc.text(line, cellX + cellPadH, textY);
            textY += lineH;
          }
        }

        // Draw cell borders
        doc.setDrawColor(...hexToRgb(tpl.table.borderColor));
        doc.setLineWidth(tpl.table.borderWidth);
        for (let c = 0; c < colCount; c++) {
          const cellX = margin + c * colWidth;
          doc.rect(cellX, builder.y, colWidth, rowH);
        }

        builder.y += rowH;
      }

      // Render all rows
      for (let r = 0; r < rows.length; r++) {
        const { rowH } = prepareRow(rows[r]);
        const isHeader = r === 0;

        // Check page break
        if (builder.y + rowH > contentBottom) {
          builder.newContentPage();
          // Redraw header row on new page
          if (!isHeader && rows.length > 0) {
            const { rowH: headerH } = prepareRow(rows[0]);
            if (builder.y + headerH <= contentBottom) {
              drawRow(rows[0], 0, true);
            }
          }
        }

        drawRow(rows[r], r, isHeader);
      }

      // Reset colors
      doc.setDrawColor(0);
      doc.setTextColor(0);
      doc.setFont(PDF_FONT, 'normal');

      // Paragraph spacing after table
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

    async renderBlocks(blocks: ContentBlock[]) {
      for (const block of blocks) {
        switch (block.type) {
          case 'paragraph':
            builder.addRichText(block.children, block.align);
            break;
          case 'heading':
            // Headings inside note content — render as bold text, NOT structural h1/h2/h3
            // Because structural headings are handled by the tree walker
            builder.addRichText([{ type: 'text', text: blocksToPlainText(block.children), marks: { bold: true } }]);
            break;
          case 'bulletList':
            builder.addList(block.items, false);
            break;
          case 'orderedList':
            builder.addList(block.items, true, 0, block.start || 1);
            break;
          case 'blockquote':
            builder.addBlockquote(block.children);
            break;
          case 'codeBlock':
            builder.addCodeBlock(block.text);
            break;
          case 'table':
            builder.addTable(block.rows);
            break;
          case 'image':
            if (block.src) {
              try {
                const dataUrl = await loadImageAsDataUrl(block.src);
                const img = new Image();
                await new Promise<void>((resolve, reject) => {
                  img.onload = () => resolve();
                  img.onerror = () => reject();
                  img.src = dataUrl;
                });
                builder.addInlineImage(dataUrl, img.naturalWidth, img.naturalHeight);
              } catch {
                // Skip failed images silently
              }
            }
            break;
          case 'text':
            // Standalone text at top level — render as body
            builder.addBody(block.text);
            break;
          case 'hardBreak':
            builder.y += 2;
            break;
        }
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
