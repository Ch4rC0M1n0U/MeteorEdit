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

export interface PdfLogoData {
  logoLeft: string | null;
  logoRight: string | null;
}

// ── Defaults ────────────────────────────────────────────────────────

export const DEFAULT_TEMPLATE: PdfTemplateConfig = {
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
  footer: { format: 'Page {page} | {pages}', lineColor: '#29417a' },
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
    console.warn('[PDF] Image fetch failed:', resolvedUrl, response.status);
    throw new Error(`Image fetch failed: ${resolvedUrl} (${response.status})`);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => {
      console.warn('[PDF] FileReader failed for:', resolvedUrl);
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

// ── Sanitization ────────────────────────────────────────────────────

export function cleanControlChars(text: string): string {
  return text
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u0000-\u001F]/g, '')
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{E0020}-\u{E007F}\u{2300}-\u{23FF}\u{2B50}-\u{2B55}\u{200D}\u{20E3}\u{FE0E}]/gu, '')
    .trim();
}

// ── pdfmake inline mark conversion ─────────────────────────────────

export function marksToStyle(marks: InlineMark): Record<string, any> {
  const style: Record<string, any> = {};
  if (marks.bold) style.bold = true;
  if (marks.italic) style.italics = true;
  if (marks.underline && marks.strike) {
    style.decoration = 'underline lineThrough' as any;
  } else if (marks.underline) {
    style.decoration = 'underline';
  } else if (marks.strike) {
    style.decoration = 'lineThrough';
  }
  if (marks.color) style.color = marks.color;
  if (marks.highlight) style.background = marks.highlight;
  if (marks.link) {
    style.link = marks.link;
    style.color = style.color || '#1565C0';
    style.decoration = style.decoration ? `${style.decoration} underline` : 'underline';
  }
  if (marks.code) {
    style.font = 'Courier';
    style.background = '#ebebeb';
    style.fontSize = 9;
  }
  return style;
}

// ── Children to pdfmake text runs ───────────────────────────────────

export function childrenToRuns(children: ContentBlock[]): any[] {
  const runs: any[] = [];
  for (const child of children) {
    if (child.type === 'text') {
      const style = marksToStyle(child.marks || {});
      runs.push({ text: child.text, ...style });
    } else if (child.type === 'hardBreak') {
      runs.push({ text: '\n' });
    }
  }
  return runs;
}

// ── Blocks to pdfmake Content ───────────────────────────────────────

export function blocksToContent(blocks: ContentBlock[], tpl?: PdfTemplateConfig): any[] {
  const content: any[] = [];
  const bodySize = tpl?.body?.fontSize || 10;
  const bodyColor = tpl?.body?.color || '#000000';
  const accentColor = tpl?.header?.lineColor || '#29417a';

  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph': {
        const runs = childrenToRuns(block.children);
        if (runs.length === 0) {
          content.push({ text: ' ', fontSize: bodySize * 0.5, margin: [0, 0, 0, 2] });
        } else {
          const para: any = { text: runs, fontSize: bodySize, color: bodyColor, margin: [0, 0, 0, 3] };
          if (block.align === 'center') para.alignment = 'center';
          else if (block.align === 'right') para.alignment = 'right';
          else if (block.align === 'justify') para.alignment = 'justify';
          content.push(para);
        }
        break;
      }

      case 'heading': {
        // Headings inside note content — render as bold body text
        const headingText = blocksToPlainText(block.children);
        content.push({
          text: headingText,
          bold: true,
          fontSize: bodySize,
          color: bodyColor,
          margin: [0, 4, 0, 2],
        });
        break;
      }

      case 'bulletList': {
        const items: any[] = [];
        for (const item of block.items) {
          const itemContent = blocksToContent(item, tpl);
          items.push(itemContent.length === 1 ? itemContent[0] : { stack: itemContent });
        }
        content.push({ ul: items, fontSize: bodySize, color: bodyColor, margin: [0, 0, 0, 3] });
        break;
      }

      case 'orderedList': {
        const items: any[] = [];
        for (const item of block.items) {
          const itemContent = blocksToContent(item, tpl);
          items.push(itemContent.length === 1 ? itemContent[0] : { stack: itemContent });
        }
        const ol: any = { ol: items, fontSize: bodySize, color: bodyColor, margin: [0, 0, 0, 3] };
        if (block.start && block.start !== 1) ol.start = block.start;
        content.push(ol);
        break;
      }

      case 'blockquote': {
        // Table with 1 column, left border in accent color, italic text
        const quoteContent = blocksToContent(block.children, tpl);
        content.push({
          margin: [0, 2, 0, 4],
          table: {
            widths: ['*'],
            body: [[{ stack: quoteContent, italics: true, margin: [4, 4, 4, 4] }]],
          },
          layout: {
            hLineWidth: () => 0,
            vLineWidth: (i: number) => (i === 0 ? 2 : 0),
            vLineColor: () => accentColor,
            paddingLeft: () => 8,
            paddingRight: () => 4,
            paddingTop: () => 2,
            paddingBottom: () => 2,
          } as any,
        });
        break;
      }

      case 'codeBlock': {
        const codeLines = block.text.split('\n');
        const codeRuns = codeLines.map((line, i) => ({
          text: line + (i < codeLines.length - 1 ? '\n' : ''),
        }));
        content.push({
          margin: [0, 2, 0, 4],
          table: {
            widths: ['*'],
            body: [[{
              text: codeRuns,
              font: 'Courier',
              fontSize: bodySize - 1,
              color: bodyColor,
              margin: [6, 6, 6, 6],
            }]],
          },
          layout: {
            hLineWidth: () => 0.2,
            vLineWidth: () => 0.2,
            hLineColor: () => '#dcdcdc',
            vLineColor: () => '#dcdcdc',
            fillColor: () => '#f5f5f5',
            paddingLeft: () => 0,
            paddingRight: () => 0,
            paddingTop: () => 0,
            paddingBottom: () => 0,
          } as any,
        });
        break;
      }

      case 'table': {
        if (!block.rows || block.rows.length === 0) break;
        const colCount = block.rows[0].length || 1;
        const widths = Array(colCount).fill('*');
        const tblBody: any[][] = [];

        const headerBg = tpl?.table?.headerBgColor || '#29417a';
        const headerText = tpl?.table?.headerTextColor || '#ffffff';
        const altRowColor = tpl?.table?.alternateRowColor || '#f5f5f5';
        const borderColor = tpl?.table?.borderColor || '#cccccc';
        const borderW = tpl?.table?.borderWidth ?? 0.5;

        for (let r = 0; r < block.rows.length; r++) {
          const row = block.rows[r];
          const isHeader = r === 0;
          const pdfRow: any[] = [];
          for (let c = 0; c < colCount; c++) {
            const cell = row[c] || [];
            const cellText = blocksToPlainText(cell);
            const cellDef: any = {
              text: cellText,
              fontSize: bodySize,
              margin: [2, 2, 2, 2],
            };
            if (isHeader) {
              cellDef.bold = true;
              cellDef.color = headerText;
              cellDef.fillColor = headerBg;
            } else if (r % 2 === 1) {
              cellDef.fillColor = altRowColor;
            }
            pdfRow.push(cellDef);
          }
          tblBody.push(pdfRow);
        }

        content.push({
          margin: [0, 2, 0, 4],
          table: {
            headerRows: 1,
            widths,
            body: tblBody,
          },
          layout: {
            hLineWidth: () => borderW,
            vLineWidth: () => borderW,
            hLineColor: () => borderColor,
            vLineColor: () => borderColor,
          } as any,
        });
        break;
      }

      case 'image': {
        if (block.src) {
          const imgDef: any = { image: block.src, margin: [0, 2, 0, 4] };
          // Constrain to page width (approx 515pt for A4 with 40pt margins)
          imgDef.width = Math.min(block.width || 500, 500);
          if (block.width && block.height) {
            const ratio = block.height / block.width;
            imgDef.height = imgDef.width * ratio;
            if (imgDef.height > 400) {
              imgDef.height = 400;
              imgDef.width = 400 / ratio;
            }
          }
          content.push(imgDef);
        }
        break;
      }

      case 'text': {
        content.push({ text: block.text, fontSize: bodySize, color: bodyColor, margin: [0, 0, 0, 3] });
        break;
      }

      case 'hardBreak': {
        content.push({ text: '\n', fontSize: bodySize * 0.5 });
        break;
      }
    }
  }
  return content;
}

// ── Resolve block images to data URLs ───────────────────────────────

export async function resolveBlockImages(blocks: ContentBlock[]): Promise<void> {
  for (const block of blocks) {
    switch (block.type) {
      case 'image':
        if (block.src && !block.src.startsWith('data:')) {
          try {
            (block as any).src = await loadImageAsDataUrl(block.src);
          } catch (e) {
            console.warn('[PDF] Image resolve skipped:', block.src, e);
          }
        }
        break;
      case 'paragraph':
      case 'heading':
      case 'blockquote':
        await resolveBlockImages(block.children);
        break;
      case 'bulletList':
      case 'orderedList':
        for (const item of block.items) {
          await resolveBlockImages(item);
        }
        break;
      case 'table':
        for (const row of block.rows) {
          for (const cell of row) {
            await resolveBlockImages(cell);
          }
        }
        break;
    }
  }
}

// ── Render structural heading ───────────────────────────────────────

export function renderHeading(text: string, level: 'h1' | 'h2' | 'h3', tpl: PdfTemplateConfig): any {
  const h = tpl.headings[level];
  const displayText = h.uppercase ? text.toUpperCase() : text;

  const gapBefore = level === 'h1' ? 7 : (level === 'h2' ? 5 : 3);
  const gapAfter = level === 'h1' ? 4 : (level === 'h2' ? 3 : 2);

  const hasBg = !!h.bgColor;
  const hasBorder = h.borderStyle !== 'none';

  // Use a table to simulate background color + border
  const cell: any = {
    text: displayText,
    fontSize: h.fontSize,
    color: h.color,
    bold: h.bold || undefined,
    italics: h.italic || undefined,
    margin: [3, 2, 3, 2],
  };

  if (hasBg) {
    cell.fillColor = h.bgColor;
  }

  const borderColor = h.borderColor || '#000000';
  const borderW = h.borderWidth || 0.5;

  let layout: any;
  if (h.borderStyle === 'bottom') {
    layout = {
      hLineWidth: (i: number) => (i === 1 ? borderW : 0),
      vLineWidth: () => 0,
      hLineColor: () => borderColor,
      fillColor: (rowIndex: number) => (hasBg && rowIndex === 0 ? h.bgColor : null),
      paddingLeft: () => 3,
      paddingRight: () => 3,
      paddingTop: () => 2,
      paddingBottom: () => 2,
    };
  } else if (h.borderStyle === 'box') {
    layout = {
      hLineWidth: () => borderW,
      vLineWidth: () => borderW,
      hLineColor: () => borderColor,
      vLineColor: () => borderColor,
      fillColor: (rowIndex: number) => (hasBg && rowIndex === 0 ? h.bgColor : null),
      paddingLeft: () => 3,
      paddingRight: () => 3,
      paddingTop: () => 2,
      paddingBottom: () => 2,
    };
  } else {
    // No border
    layout = {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      fillColor: (rowIndex: number) => (hasBg && rowIndex === 0 ? h.bgColor : null),
      paddingLeft: () => 3,
      paddingRight: () => 3,
      paddingTop: () => 2,
      paddingBottom: () => 2,
    };
  }

  return {
    margin: [0, gapBefore, 0, gapAfter],
    table: {
      widths: ['*'],
      body: [[cell]],
    },
    layout,
  };
}

// ── Template to pdfmake styles ──────────────────────────────────────

export function templateToStyles(tpl: PdfTemplateConfig): Record<string, any> {
  return {
    body: {
      fontSize: tpl.body.fontSize,
      color: tpl.body.color,
      lineHeight: tpl.spacing.lineHeight,
    },
    disclaimer: {
      fontSize: tpl.body.fontSize - 1,
      color: tpl.disclaimer.color,
      italics: true,
    },
  };
}

// ── Build options ───────────────────────────────────────────────────

export interface TocEntry {
  title: string;
  level: 'h1' | 'h2' | 'h3';
}

export interface PdfBuildOptions {
  dossierTitle: string;
  infoLines: string[];
  content: any[];
  includeToc?: boolean;
  tocEntries?: TocEntry[];
  closingCity?: string;
  signatureImage?: string;
  signatureLines?: string[];
}

// ── Build full document definition ──────────────────────────────────

export function buildDocDefinition(
  tpl: PdfTemplateConfig,
  logos: PdfLogoData,
  opts: PdfBuildOptions,
): any {
  const marginH = tpl.page.marginH * 2.835; // mm to pt approx
  const bodySize = tpl.body.fontSize;
  const accentColor = tpl.header.lineColor || '#29417a';

  // ── Header function ───────────────────────────────────────
  const headerFn = (currentPage: number, _pageCount: number) => {
    if (currentPage === 1) return null;
    const cols: any[] = [];

    // Logo left
    if (logos.logoLeft) {
      cols.push({ image: logos.logoLeft, width: 30, height: 30, margin: [0, 5, 0, 0] });
    } else {
      cols.push({ text: '', width: 30 });
    }

    // Header text centered
    cols.push({
      text: tpl.header.text,
      alignment: 'center',
      fontSize: 8,
      color: accentColor,
      margin: [0, 12, 0, 0],
    });

    // Logo right
    if (logos.logoRight) {
      cols.push({ image: logos.logoRight, width: 30, height: 30, alignment: 'right', margin: [0, 5, 0, 0] });
    } else {
      cols.push({ text: '', width: 30 });
    }

    return {
      margin: [marginH, 10, marginH, 0],
      stack: [
        { columns: cols },
        {
          canvas: [{
            type: 'line',
            x1: 0, y1: 0,
            x2: 595.28 - marginH * 2, y2: 0,
            lineWidth: 0.5,
            lineColor: accentColor,
          }],
          margin: [0, 2, 0, 0],
        },
      ],
    };
  };

  // ── Footer function ───────────────────────────────────────
  const footerFn = (currentPage: number, pageCount: number) => {
    const lineColor = tpl.footer.lineColor || '#29417a';
    const paginationText = tpl.footer.format
      .replace('{page}', String(currentPage))
      .replace('{pages}', String(pageCount))
      // Legacy placeholders
      .replace('{n}', String(currentPage))
      .replace('{total}', String(pageCount));

    return {
      margin: [marginH, 0, marginH, 0],
      stack: [
        {
          canvas: [{
            type: 'line',
            x1: 0, y1: 0,
            x2: 595.28 - marginH * 2, y2: 0,
            lineWidth: 0.5,
            lineColor,
          }],
        },
        {
          text: paginationText,
          alignment: 'right',
          fontSize: 8,
          color: '#646464',
          margin: [0, 3, 0, 0],
        },
      ],
    };
  };

  // ── Content body ──────────────────────────────────────────
  const docContent: any[] = [];

  // Report header on first page
  docContent.push({
    text: opts.dossierTitle,
    fontSize: tpl.cover.titleSize,
    bold: true,
    color: tpl.cover.titleColor,
    alignment: 'center',
    margin: [0, 0, 0, 4],
  });

  // Info lines
  if (opts.infoLines.length > 0) {
    for (const line of opts.infoLines) {
      docContent.push({
        text: line,
        fontSize: 10,
        color: '#646464',
        alignment: 'center',
        margin: [0, 0, 0, 2],
      });
    }
  }

  // Separator line
  docContent.push({
    canvas: [{
      type: 'line',
      x1: 0, y1: 0,
      x2: 595.28 - marginH * 2, y2: 0,
      lineWidth: 0.5,
      lineColor: accentColor,
    }],
    margin: [0, 3, 0, 6],
  });

  // TOC
  if (opts.includeToc && opts.tocEntries && opts.tocEntries.length > 0) {
    docContent.push(renderHeading('Table des matieres', 'h1', tpl));
    for (const entry of opts.tocEntries) {
      const indent = entry.level === 'h1' ? 0 : entry.level === 'h2' ? 15 : 30;
      docContent.push({
        text: entry.title,
        fontSize: bodySize,
        color: tpl.body.color,
        bold: entry.level === 'h1',
        margin: [indent, 1, 0, 1],
      });
    }
    docContent.push({ text: '', pageBreak: 'after' });
  }

  // Main content
  docContent.push(...opts.content);

  // Closing block
  if (opts.closingCity || opts.signatureImage || (opts.signatureLines && opts.signatureLines.length > 0)) {
    docContent.push({ text: '', margin: [0, 20, 0, 0] });

    if (opts.closingCity) {
      const now = new Date();
      const dateStr = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      docContent.push({
        text: `${opts.closingCity}, le ${dateStr}`,
        alignment: 'right',
        fontSize: bodySize,
        color: tpl.body.color,
        margin: [0, 0, 0, 10],
      });
    }

    if (opts.signatureImage) {
      docContent.push({
        image: opts.signatureImage,
        width: 150,
        alignment: 'right',
        margin: [0, 0, 0, 5],
      });
    }

    if (opts.signatureLines && opts.signatureLines.length > 0) {
      for (const line of opts.signatureLines) {
        docContent.push({
          text: line,
          alignment: 'right',
          fontSize: bodySize,
          color: tpl.body.color,
          margin: [0, 0, 0, 2],
        });
      }
    }
  }

  // ── Assemble document definition ──────────────────────────
  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [marginH, 50, marginH, 35],
    defaultStyle: {
      font: 'NotoSans',
      fontSize: bodySize,
      color: tpl.body.color,
      lineHeight: tpl.spacing.lineHeight,
    },
    styles: templateToStyles(tpl),
    header: headerFn,
    footer: footerFn,
    content: docContent,
  };

  return docDefinition;
}

// ── Generate PDF blob ───────────────────────────────────────────────

export async function generatePdfBlob(docDef: any): Promise<Blob> {
  const pdfMakeModule = await import('pdfmake/build/pdfmake');
  const pdfMake = pdfMakeModule.default || pdfMakeModule;

  const { loadVfsFonts, pdfMakeFontDescriptors } = await import('./pdfmakeFonts');
  const vfs = await loadVfsFonts();

  pdfMake.vfs = vfs;
  pdfMake.fonts = pdfMakeFontDescriptors;

  return new Promise<Blob>((resolve, reject) => {
    try {
      const pdfDoc = pdfMake.createPdf(docDef);
      pdfDoc.getBlob((blob: Blob) => {
        resolve(blob);
      });
    } catch (e) {
      reject(e);
    }
  });
}
