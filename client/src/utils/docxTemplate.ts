import {
  Document, Packer, Paragraph, TextRun, ImageRun, ExternalHyperlink,
  Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, BorderStyle,
  ShadingType, TabStopPosition, TabStopType,
  Table, TableRow, TableCell, WidthType, UnderlineType,
  type IImageOptions,
  type ParagraphChild,
} from 'docx';
import { saveAs } from 'file-saver';
import type { PdfTemplateConfig, FontFamily } from './pdfmakeRenderer';
import { loadPdfTemplate, loadImageAsDataUrl, resolveLogoUrl } from './pdfmakeRenderer';
import type { ContentBlock } from './contentBlocks';
import { blocksToPlainText } from './contentBlocks';

// ── Helpers ─────────────────────────────────────────────────────────

const DOCX_FONT_MAP: Record<FontFamily, string> = {
  'Calibri': 'Calibri',
  'Arial': 'Arial',
  'Aptos': 'Aptos',
  'Times New Roman': 'Times New Roman',
  'Georgia': 'Georgia',
  'Helvetica': 'Arial',
};

function hexToRgb(hex: string): string {
  return hex.replace('#', '').toUpperCase();
}

function ptToHalfPt(pt: number): number {
  return Math.round(pt * 2);
}

function docxFont(tpl: PdfTemplateConfig): string {
  return DOCX_FONT_MAP[tpl.fontFamily] || 'Calibri';
}

// ── Images ──────────────────────────────────────────────────────────

async function fetchImageBuffer(url: string): Promise<{ buffer: ArrayBuffer; w: number; h: number } | null> {
  try {
    const dataUrl = await loadImageAsDataUrl(url);
    const base64 = dataUrl.split(',')[1];
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ buffer: bytes.buffer, w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  } catch {
    return null;
  }
}

interface DocxLogos {
  left: { buffer: ArrayBuffer; w: number; h: number } | null;
  right: { buffer: ArrayBuffer; w: number; h: number } | null;
}

async function loadLogos(tpl: PdfTemplateConfig, serverUrl: string): Promise<DocxLogos> {
  let left = null;
  let right = null;
  if (tpl.header.logoLeft) left = await fetchImageBuffer(resolveLogoUrl(tpl.header.logoLeft, serverUrl));
  if (!left) left = await fetchImageBuffer(new URL('/logo-pjf.jpeg', window.location.origin).href);
  if (tpl.header.logoRight) right = await fetchImageBuffer(resolveLogoUrl(tpl.header.logoRight, serverUrl));
  if (!right) right = await fetchImageBuffer(new URL('/logo-dr5.png', window.location.origin).href);
  return { left, right };
}

function makeImageRun(imgData: { buffer: ArrayBuffer; w: number; h: number }, maxW: number, maxH: number): ImageRun {
  const ratio = Math.min(maxW / imgData.w, maxH / imgData.h, 1);
  return new ImageRun({
    data: imgData.buffer,
    transformation: { width: Math.round(imgData.w * ratio), height: Math.round(imgData.h * ratio) },
    type: 'png',
  } as IImageOptions);
}

// ── Header & Footer ─────────────────────────────────────────────────

function createHeaderSection(tpl: PdfTemplateConfig, logos: DocxLogos): Header {
  const children: (TextRun | ImageRun)[] = [];
  if (logos.left) children.push(makeImageRun(logos.left, 40, 40));
  children.push(new TextRun({
    text: `\t${tpl.header.text}\t`,
    font: docxFont(tpl),
    size: ptToHalfPt(8),
    color: hexToRgb(tpl.header.lineColor),
    bold: true,
  }));
  if (logos.right) children.push(makeImageRun(logos.right, 40, 40));
  return new Header({
    children: [new Paragraph({
      children,
      tabStops: [
        { type: TabStopType.CENTER, position: TabStopPosition.MAX / 2 },
        { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
      ],
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: hexToRgb(tpl.header.lineColor) } },
      spacing: { after: 120 },
    })],
  });
}

function createFooterSection(tpl: PdfTemplateConfig): Footer {
  return new Footer({
    children: [new Paragraph({
      children: [new TextRun({
        children: [
          tpl.footer.format.includes('Page') ? 'Page ' : '',
          PageNumber.CURRENT,
          tpl.footer.format.includes('{total}')
            ? (tpl.footer.format.includes('|') ? ' | ' : ' / ')
            : '',
          ...(tpl.footer.format.includes('{total}') ? [PageNumber.TOTAL_PAGES] : []),
        ],
        font: docxFont(tpl),
        size: ptToHalfPt(8),
        color: '666666',
      })],
      alignment: AlignmentType.RIGHT,
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: hexToRgb(tpl.footer.lineColor) } },
      spacing: { before: 120 },
    })],
  });
}

// ── Heading Border ──────────────────────────────────────────────────

function buildHeadingBorder(h: { bgColor: string; borderStyle?: string; borderColor?: string; borderWidth?: number }) {
  const bs = h.borderStyle || 'none';
  if (bs === 'none' && !h.bgColor) return undefined;
  const borderColor = h.borderColor ? hexToRgb(h.borderColor) : '000000';
  const borderSize = Math.round((h.borderWidth || 1) * 6);
  if (bs === 'bottom') {
    return {
      bottom: { style: BorderStyle.SINGLE, size: borderSize, color: borderColor },
      ...(h.bgColor ? {
        top: { style: BorderStyle.SINGLE, size: 1, color: hexToRgb(h.bgColor) },
        left: { style: BorderStyle.SINGLE, size: 1, color: hexToRgb(h.bgColor) },
        right: { style: BorderStyle.SINGLE, size: 1, color: hexToRgb(h.bgColor) },
      } : {}),
    };
  }
  if (bs === 'box') {
    return {
      top: { style: BorderStyle.SINGLE, size: borderSize, color: borderColor },
      bottom: { style: BorderStyle.SINGLE, size: borderSize, color: borderColor },
      left: { style: BorderStyle.SINGLE, size: borderSize, color: borderColor },
      right: { style: BorderStyle.SINGLE, size: borderSize, color: borderColor },
    };
  }
  if (h.bgColor) {
    const c = hexToRgb(h.bgColor);
    return {
      top: { style: BorderStyle.SINGLE, size: 1, color: c },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: c },
      left: { style: BorderStyle.SINGLE, size: 1, color: c },
      right: { style: BorderStyle.SINGLE, size: 1, color: c },
    };
  }
  return undefined;
}

// ── Paragraph Builders ──────────────────────────────────────────────

function sectionHeading(text: string, tpl: PdfTemplateConfig, level: 'h1' | 'h2' | 'h3'): Paragraph {
  const h = tpl.headings[level];
  const displayText = h.uppercase ? text.toUpperCase() : text;
  const beforeTwips = level === 'h1' ? 360 : (level === 'h2' ? 240 : 160);
  const afterTwips = level === 'h1' ? 120 : (level === 'h2' ? 80 : 60);
  return new Paragraph({
    children: [new TextRun({
      text: displayText,
      font: docxFont(tpl),
      size: ptToHalfPt(h.fontSize),
      bold: h.bold,
      italics: h.italic,
      color: hexToRgb(h.color),
    })],
    heading: level === 'h1' ? HeadingLevel.HEADING_1 : level === 'h2' ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    shading: h.bgColor ? { type: ShadingType.CLEAR, fill: hexToRgb(h.bgColor) } : undefined,
    spacing: { before: beforeTwips, after: afterTwips },
    border: buildHeadingBorder(h),
  });
}

function bodyParagraph(text: string, tpl: PdfTemplateConfig): Paragraph {
  const lh = tpl.spacing?.lineHeight || 1.4;
  return new Paragraph({
    children: [new TextRun({
      text,
      font: docxFont(tpl),
      size: ptToHalfPt(tpl.body.fontSize),
      color: tpl.body.color ? hexToRgb(tpl.body.color) : undefined,
    })],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 80, line: Math.round(lh * 240) },
  });
}

function bulletParagraph(text: string, tpl: PdfTemplateConfig): Paragraph {
  const lh = tpl.spacing?.lineHeight || 1.4;
  return new Paragraph({
    children: [new TextRun({
      text,
      font: docxFont(tpl),
      size: ptToHalfPt(tpl.body.fontSize),
      color: tpl.body.color ? hexToRgb(tpl.body.color) : undefined,
    })],
    bullet: { level: 0 },
    spacing: { after: 40, line: Math.round(lh * 240) },
  });
}

// ── Rich Content Rendering ──────────────────────────────────────────

/**
 * Convert inline ContentBlocks (text, hardBreak) into docx TextRun / ExternalHyperlink array,
 * applying InlineMark formatting.
 */
function richTextRuns(children: ContentBlock[], tpl: PdfTemplateConfig): ParagraphChild[] {
  const runs: ParagraphChild[] = [];
  for (const child of children) {
    if (child.type === 'hardBreak') {
      runs.push(new TextRun({ break: 1 }));
      continue;
    }
    if (child.type !== 'text') continue;

    const m = child.marks || {};
    const baseOpts: Record<string, unknown> = {
      text: child.text,
      font: m.code ? 'Courier New' : docxFont(tpl),
      size: m.code ? ptToHalfPt(tpl.body.fontSize - 1) : ptToHalfPt(tpl.body.fontSize),
      bold: m.bold || undefined,
      italics: m.italic || undefined,
      strike: m.strike || undefined,
    };
    if (m.underline) {
      baseOpts.underline = { type: UnderlineType.SINGLE };
    }
    if (m.color) {
      baseOpts.color = hexToRgb(m.color);
    }
    if (m.highlight) {
      baseOpts.highlight = 'yellow';
    }
    if (m.code) {
      baseOpts.shading = { type: ShadingType.CLEAR, fill: 'F0F0F0' };
    }

    if (m.link) {
      // Render as clickable hyperlink (blue + underlined)
      const linkRun = new TextRun({
        ...baseOpts,
        color: '0563C1',
        underline: { type: UnderlineType.SINGLE },
        style: 'Hyperlink',
      } as Record<string, unknown>);
      runs.push(new ExternalHyperlink({
        children: [linkRun],
        link: m.link,
      }));
    } else {
      runs.push(new TextRun(baseOpts as Record<string, unknown>));
    }
  }
  return runs;
}

/** Map alignment string from TipTap to docx AlignmentType */
function mapAlignment(align?: string): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  switch (align) {
    case 'center': return AlignmentType.CENTER;
    case 'right': return AlignmentType.RIGHT;
    case 'justify': return AlignmentType.JUSTIFIED;
    default: return undefined;
  }
}

/**
 * Build a docx Table from ContentBlock table rows.
 * First row treated as header with template headerBgColor.
 */
function contentTable(rows: ContentBlock[][][], tpl: PdfTemplateConfig): Table {
  const colCount = rows.length > 0 ? Math.max(...rows.map(r => r.length), 1) : 1;
  const colWidth = Math.floor(9000 / colCount); // roughly full width in twips

  const tableRows = rows.map((row, rowIdx) => {
    // Pad row to colCount if needed
    const cells: TableCell[] = [];
    for (let c = 0; c < colCount; c++) {
      const cellBlocks = row[c] || [];
      const cellText = blocksToPlainText(cellBlocks);
      const isHeader = rowIdx === 0;
      const useAltBg = !isHeader && rowIdx % 2 === 0 && tpl.table?.alternateRowColor;
      const fillColor = isHeader && tpl.table?.headerBgColor
        ? hexToRgb(tpl.table.headerBgColor)
        : useAltBg && tpl.table?.alternateRowColor
          ? hexToRgb(tpl.table.alternateRowColor)
          : undefined;

      cells.push(new TableCell({
        children: [new Paragraph({
          children: [new TextRun({
            text: cellText,
            font: docxFont(tpl),
            size: ptToHalfPt(tpl.body.fontSize),
            bold: isHeader || undefined,
            color: isHeader && tpl.table?.headerTextColor
              ? hexToRgb(tpl.table.headerTextColor)
              : tpl.body.color ? hexToRgb(tpl.body.color) : undefined,
          })],
        })],
        width: { size: colWidth, type: WidthType.DXA },
        shading: fillColor ? { type: ShadingType.CLEAR, fill: fillColor } : undefined,
      }));
    }
    return new TableRow({ children: cells });
  });

  return new Table({
    rows: tableRows,
    width: { size: 9000, type: WidthType.DXA },
  });
}

/**
 * Render a flat list of ContentBlocks into docx elements (Paragraph | Table).
 * Images are async — placeholders are created and resolved in generateDocx.
 * For simplicity here, images produce an empty paragraph (handled by generateDocx wrapper).
 */
export function renderBlocksToDocx(
  blocks: ContentBlock[],
  tpl: PdfTemplateConfig,
  _images?: { src: string; placeholder: Paragraph }[],
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  const lh = tpl.spacing?.lineHeight || 1.4;
  const lineSpacing = Math.round(lh * 240);

  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph': {
        const children = richTextRuns(block.children, tpl);
        elements.push(new Paragraph({
          children,
          alignment: mapAlignment(block.align),
          spacing: { after: 80, line: lineSpacing },
        }));
        break;
      }

      case 'heading': {
        const headingLevel = block.level <= 1 ? HeadingLevel.HEADING_1
          : block.level === 2 ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3;
        const children = richTextRuns(block.children, tpl);
        // Apply bold to all runs for content headings
        elements.push(new Paragraph({
          children,
          heading: headingLevel,
          spacing: { before: 200, after: 100 },
        }));
        break;
      }

      case 'bulletList': {
        for (const item of block.items) {
          // Each item is ContentBlock[] — may contain paragraphs or inline text
          const itemText = blocksToPlainText(item);
          elements.push(new Paragraph({
            children: [new TextRun({
              text: itemText,
              font: docxFont(tpl),
              size: ptToHalfPt(tpl.body.fontSize),
              color: tpl.body.color ? hexToRgb(tpl.body.color) : undefined,
            })],
            bullet: { level: 0 },
            spacing: { after: 40, line: lineSpacing },
          }));
        }
        break;
      }

      case 'orderedList': {
        const startNum = block.start || 1;
        block.items.forEach((item, idx) => {
          const itemText = blocksToPlainText(item);
          const prefix = `${startNum + idx}. `;
          elements.push(new Paragraph({
            children: [new TextRun({
              text: prefix + itemText,
              font: docxFont(tpl),
              size: ptToHalfPt(tpl.body.fontSize),
              color: tpl.body.color ? hexToRgb(tpl.body.color) : undefined,
            })],
            indent: { left: 360 },
            spacing: { after: 40, line: lineSpacing },
          }));
        });
        break;
      }

      case 'blockquote': {
        const innerElements = renderBlocksToDocx(block.children, tpl, _images);
        for (const el of innerElements) {
          if (el instanceof Paragraph) {
            // Re-create with indent and left border
            const quoteText = blocksToPlainText(block.children);
            elements.push(new Paragraph({
              children: [new TextRun({
                text: quoteText,
                font: docxFont(tpl),
                size: ptToHalfPt(tpl.body.fontSize),
                italics: true,
                color: '666666',
              })],
              indent: { left: 720 },
              border: { left: { style: BorderStyle.SINGLE, size: 12, color: 'CCCCCC' } },
              spacing: { before: 80, after: 80, line: lineSpacing },
            }));
            break; // Only one paragraph for the whole blockquote
          } else {
            elements.push(el);
          }
        }
        // If no paragraphs were found above, ensure we still render the blockquote
        if (innerElements.length === 0) {
          elements.push(new Paragraph({
            children: [new TextRun({
              text: blocksToPlainText(block.children),
              font: docxFont(tpl),
              size: ptToHalfPt(tpl.body.fontSize),
              italics: true,
              color: '666666',
            })],
            indent: { left: 720 },
            border: { left: { style: BorderStyle.SINGLE, size: 12, color: 'CCCCCC' } },
            spacing: { before: 80, after: 80, line: lineSpacing },
          }));
        }
        break;
      }

      case 'codeBlock': {
        // Split code text by newlines, render each as a paragraph with monospace font
        const lines = block.text.split('\n');
        for (const line of lines) {
          elements.push(new Paragraph({
            children: [new TextRun({
              text: line || ' ', // empty lines need a space to preserve height
              font: 'Courier New',
              size: ptToHalfPt(tpl.body.fontSize - 1),
              color: '333333',
            })],
            shading: { type: ShadingType.CLEAR, fill: 'F5F5F5' },
            spacing: { after: 0 },
          }));
        }
        // Add a small spacer after the code block
        elements.push(new Paragraph({ children: [], spacing: { after: 80 } }));
        break;
      }

      case 'table': {
        if (block.rows.length > 0) {
          elements.push(contentTable(block.rows, tpl));
          elements.push(new Paragraph({ children: [], spacing: { after: 80 } }));
        }
        break;
      }

      case 'image': {
        // Collect image for async resolution; push a placeholder paragraph
        const placeholder = new Paragraph({
          children: [new TextRun({ text: `[Image: ${block.alt || block.src}]`, font: docxFont(tpl), size: ptToHalfPt(8), color: '999999', italics: true })],
          spacing: { before: 80, after: 80 },
        });
        if (_images) {
          _images.push({ src: block.src, placeholder });
        }
        elements.push(placeholder);
        break;
      }

      case 'text': {
        // Standalone text block (not wrapped in paragraph) — render as body paragraph
        if (block.text.trim()) {
          elements.push(new Paragraph({
            children: richTextRuns([block], tpl),
            spacing: { after: 80, line: lineSpacing },
          }));
        }
        break;
      }

      case 'hardBreak': {
        elements.push(new Paragraph({ children: [], spacing: { after: 40 } }));
        break;
      }
    }
  }

  return elements;
}

/**
 * Resolve image placeholders in renderBlocksToDocx output.
 * Replaces placeholder paragraphs with actual ImageRun paragraphs.
 */
async function resolveBlockImages(
  elements: (Paragraph | Table)[],
  images: { src: string; placeholder: Paragraph }[],
): Promise<(Paragraph | Table)[]> {
  if (images.length === 0) return elements;

  const resolved = new Map<Paragraph, Paragraph>();
  for (const img of images) {
    try {
      const imgData = await fetchImageBuffer(img.src);
      if (imgData) {
        resolved.set(img.placeholder, new Paragraph({
          children: [makeImageRun(imgData, 500, 400)],
          spacing: { before: 80, after: 80 },
        }));
      }
    } catch { /* keep placeholder */ }
  }

  if (resolved.size === 0) return elements;
  return elements.map(el => resolved.get(el as Paragraph) || el);
}

// ── Types ───────────────────────────────────────────────────────────

export interface DocxExportData {
  dossierTitle: string;
  infoLines: string[];
  sections: Array<{
    title: string;
    level: 'h1' | 'h2' | 'h3';
    paragraphs: string[];
    bullets?: string[];
    blocks?: ContentBlock[];  // Rich content blocks — preferred over paragraphs/content
  }>;
  closingDate: string;
  closingCity?: string;
  includeToc?: boolean;
  signature?: {
    title?: string;
    name?: string;
    service?: string;
    unit?: string;
    email?: string;
  };
  signatureImagePath?: string;
  serverUrl: string;
}

// ── Document Generation ─────────────────────────────────────────────

export async function generateDocx(data: DocxExportData): Promise<void> {
  const tpl = loadPdfTemplate();
  const logos = await loadLogos(tpl, data.serverUrl);
  const docChildren: (Paragraph | Table)[] = [];

  // ─── TITLE BLOCK ───

  docChildren.push(new Paragraph({
    children: [new TextRun({
      text: data.dossierTitle,
      font: docxFont(tpl),
      size: ptToHalfPt(tpl.cover.titleSize),
      bold: true,
      color: hexToRgb(tpl.cover.titleColor),
    })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 120 },
  }));

  for (const line of data.infoLines) {
    docChildren.push(new Paragraph({
      children: [new TextRun({
        text: line,
        font: docxFont(tpl),
        size: ptToHalfPt(10),
        color: '666666',
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    }));
  }

  // Separator
  docChildren.push(new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: hexToRgb(tpl.header.lineColor) } },
    spacing: { before: 160, after: 240 },
  }));

  // ─── TABLE OF CONTENTS ───

  if (data.includeToc) {
    // TOC heading
    docChildren.push(new Paragraph({
      children: [new TextRun({
        text: 'Table des matières',
        font: docxFont(tpl),
        size: ptToHalfPt(tpl.headings.h1.fontSize),
        bold: true,
        color: hexToRgb(tpl.headings.h1.color),
      })],
      heading: HeadingLevel.HEADING_1,
      shading: tpl.headings.h1.bgColor ? { type: ShadingType.CLEAR, fill: hexToRgb(tpl.headings.h1.bgColor) } : undefined,
      spacing: { before: 360, after: 120 },
      border: buildHeadingBorder(tpl.headings.h1),
    }));

    // TOC entries — indented list of section titles with numbers
    for (const section of data.sections) {
      if (!section.title) continue;
      const indent = section.level === 'h1' ? 0 : section.level === 'h2' ? 360 : 720;
      const isBold = section.level === 'h1';
      docChildren.push(new Paragraph({
        children: [new TextRun({
          text: section.title,
          font: docxFont(tpl),
          size: ptToHalfPt(tpl.body.fontSize),
          bold: isBold,
          color: tpl.body.color ? hexToRgb(tpl.body.color) : undefined,
        })],
        indent: { left: indent },
        spacing: { after: 40 },
      }));
    }

    // Spacer after TOC
    docChildren.push(new Paragraph({
      children: [],
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: hexToRgb(tpl.header.lineColor) } },
      spacing: { before: 120, after: 240 },
    }));
  }

  // ─── CONTENT SECTIONS ───

  for (const section of data.sections) {
    if (section.title) {
      docChildren.push(sectionHeading(section.title, tpl, section.level));
    }

    // Rich ContentBlock rendering (preferred)
    if (section.blocks && section.blocks.length > 0) {
      const images: { src: string; placeholder: Paragraph }[] = [];
      const blockElements = renderBlocksToDocx(section.blocks, tpl, images);
      const resolved = await resolveBlockImages(blockElements, images);
      docChildren.push(...resolved);
    } else {
      // Fallback: plain text paragraphs
      for (const para of section.paragraphs) {
        if (para.trim()) docChildren.push(bodyParagraph(para, tpl));
      }
    }

    if (section.bullets) {
      for (const bullet of section.bullets) {
        docChildren.push(bulletParagraph(bullet, tpl));
      }
    }
  }

  // ─── CLOSING + SIGNATURE ───

  docChildren.push(new Paragraph({
    children: [new TextRun({
      text: `${data.closingCity || 'Bruxelles'}, le ${data.closingDate}`,
      font: docxFont(tpl),
      size: ptToHalfPt(10),
    })],
    alignment: AlignmentType.RIGHT,
    spacing: { before: 400, after: 200 },
  }));

  if (data.signatureImagePath) {
    const sigImg = await fetchImageBuffer(`${data.serverUrl}/${data.signatureImagePath}`);
    if (sigImg) {
      docChildren.push(new Paragraph({
        children: [makeImageRun(sigImg, 180, 70)],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 80 },
      }));
    }
  }

  if (data.signature?.name) {
    const sigLines: string[] = [];
    if (data.signature.title) sigLines.push(data.signature.title);
    sigLines.push(data.signature.name);
    if (data.signature.service) sigLines.push(data.signature.service);
    if (data.signature.unit) sigLines.push(data.signature.unit);
    if (data.signature.email) sigLines.push(data.signature.email);

    const sigRuns: TextRun[] = [];
    sigLines.forEach((line, i) => {
      if (i > 0) sigRuns.push(new TextRun({ break: 1, text: '', font: docxFont(tpl), size: ptToHalfPt(10) }));
      sigRuns.push(new TextRun({ text: line, font: docxFont(tpl), size: ptToHalfPt(10), bold: i <= 1 }));
    });
    docChildren.push(new Paragraph({ children: sigRuns, alignment: AlignmentType.RIGHT, spacing: { after: 100 } }));
  }

  // ─── BUILD ───

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: Math.round((tpl.page?.marginV || 15) * 56.7),
            bottom: Math.round((tpl.page?.marginV || 15) * 56.7),
            left: Math.round((tpl.page?.marginH || 20) * 56.7),
            right: Math.round((tpl.page?.marginH || 20) * 56.7),
          },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: { default: createHeaderSection(tpl, logos) },
      footers: { default: createFooterSection(tpl) },
      children: docChildren,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Rapport_OSINT_${data.dossierTitle}.docx`);
}
