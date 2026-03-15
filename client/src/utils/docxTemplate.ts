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
import type { PdfTemplateConfig, FontFamily } from './templateConfig';
import { loadPdfTemplate, loadImageAsDataUrl, resolveLogoUrl } from './templateConfig';
import type { ContentBlock } from './contentBlocks';
import { blocksToPlainText } from './contentBlocks';
import { useEncryptionStore } from '../stores/encryption';
import { decryptFile } from './encryption';
import api from '../services/api';

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

async function fetchImageBuffer(url: string, serverUrl?: string, dossierId?: string): Promise<{ buffer: ArrayBuffer; w: number; h: number } | null> {
  try {
    // Check if this is an uploads URL that might be encrypted
    const isUploadsUrl = url.includes('/uploads/') || url.startsWith('uploads/');
    if (isUploadsUrl && dossierId) {
      // Try to fetch via authenticated API route and decrypt
      const filename = url.split('/').pop()?.split('?')[0] || '';
      if (filename) {
        try {
          const response = await api.get(`/files/${filename}`, { responseType: 'arraybuffer' });
          let imageData: ArrayBuffer = response.data;

          // Try to decrypt
          const encryptionStore = useEncryptionStore();
          const dossierKey = await encryptionStore.getDossierKey(dossierId);
          if (dossierKey) {
            try {
              imageData = await decryptFile(dossierKey, response.data);
            } catch {
              // Decryption failed — use raw data (legacy unencrypted)
            }
          }

          // Convert to data URL and get dimensions
          const blob = new Blob([imageData]);
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ buffer: imageData, w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = () => resolve(null);
            img.src = dataUrl;
          });
        } catch {
          // Fall through to standard fetch
        }
      }
    }

    // Standard fetch for non-encrypted files (logos, public assets)
    let resolvedUrl = url;
    if (serverUrl && !url.startsWith('data:') && !url.startsWith('blob:') && !url.startsWith('http')) {
      resolvedUrl = url.startsWith('/') ? `${serverUrl}${url}` : `${serverUrl}/${url}`;
    }
    const dataUrl = await loadImageAsDataUrl(resolvedUrl);
    const base64 = dataUrl.split(',')[1];
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ buffer: bytes.buffer, w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => {
        resolve(null);
      };
      img.src = dataUrl;
    });
  } catch (err) {
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
        // Extract inline images from paragraph children and render them separately
        const inlineChildren = block.children.filter(c => c.type !== 'image');
        const inlineImages = block.children.filter(c => c.type === 'image');

        if (inlineChildren.length > 0) {
          const children = richTextRuns(inlineChildren, tpl);
          elements.push(new Paragraph({
            children,
            alignment: mapAlignment(block.align),
            spacing: { after: 80, line: lineSpacing },
          }));
        }

        // Render images that were inside the paragraph as separate image blocks
        for (const imgBlock of inlineImages) {
          if (imgBlock.type === 'image' && imgBlock.src) {
            const placeholder = new Paragraph({
              children: [new TextRun({ text: `[Image: ${imgBlock.alt || imgBlock.src}]`, font: docxFont(tpl), size: ptToHalfPt(8), color: '999999', italics: true })],
              spacing: { before: 80, after: 80 },
            });
            if (_images) {
              _images.push({ src: imgBlock.src, placeholder });
            }
            elements.push(placeholder);
          }
        }
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
  serverUrl?: string,
  dossierId?: string,
): Promise<(Paragraph | Table)[]> {
  if (images.length === 0) return elements;

  const resolved = new Map<Paragraph, Paragraph>();
  for (const img of images) {
    try {
      const imgData = await fetchImageBuffer(img.src, serverUrl, dossierId);
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

/** Pre-resolve image URLs to buffers for use in table cell construction */
async function preResolveImages(
  screenshotUrls: string[],
  serverUrl?: string,
  dossierId?: string,
): Promise<Map<string, { buffer: ArrayBuffer; w: number; h: number }>> {
  const map = new Map<string, { buffer: ArrayBuffer; w: number; h: number }>();
  for (const url of screenshotUrls) {
    try {
      const imgData = await fetchImageBuffer(url, serverUrl, dossierId);
      if (imgData) map.set(url, imgData);
    } catch { /* skip */ }
  }
  return map;
}

// ── Media Helpers ───────────────────────────────────────────────────

function formatMediaTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function renderMediaMetadataDocx(metadata: any, tpl: PdfTemplateConfig): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const font = docxFont(tpl);
  const fontSize = ptToHalfPt(tpl.body.fontSize);
  const color = tpl.body.color ? hexToRgb(tpl.body.color) : undefined;

  // Title
  if (metadata.title) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: metadata.title, font, size: ptToHalfPt(tpl.headings.h3.fontSize), bold: true, color: hexToRgb(tpl.headings.h3.color) })],
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 120, after: 80 },
    }));
  }

  // Source + Channel
  const infoParts: string[] = [];
  if (metadata.platform) infoParts.push(`Source: ${metadata.platform}`);
  if (metadata.channelName) infoParts.push(`Channel: ${metadata.channelName}`);
  if (infoParts.length) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: infoParts.join(' | '), font, size: fontSize, color })],
      spacing: { after: 40 },
    }));
  }

  // URL
  if (metadata.url) {
    paragraphs.push(new Paragraph({
      children: [
        new TextRun({ text: 'URL: ', font, size: fontSize, bold: true, color }),
        new ExternalHyperlink({
          children: [new TextRun({ text: metadata.url, font, size: fontSize, color: '0563C1', underline: { type: UnderlineType.SINGLE }, style: 'Hyperlink' } as Record<string, unknown>)],
          link: metadata.url,
        }),
      ],
      spacing: { after: 40 },
    }));
  }

  // Published date
  if (metadata.publishedAt) {
    const dateStr = new Date(metadata.publishedAt).toLocaleDateString('fr-FR');
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: `Published: ${dateStr}`, font, size: fontSize, color })],
      spacing: { after: 40 },
    }));
  }

  // Duration
  if (metadata.duration) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: `Duration: ${formatMediaTime(metadata.duration)}`, font, size: fontSize, color })],
      spacing: { after: 80 },
    }));
  }

  return paragraphs;
}

export async function renderMediaAnnotationsTableDocx(
  annotations: any[],
  tpl: PdfTemplateConfig,
  serverUrl?: string,
  dossierId?: string,
): Promise<Table> {
  const font = docxFont(tpl);
  const fontSize = ptToHalfPt(tpl.body.fontSize);
  const sorted = [...annotations].sort((a, b) => a.timestamp - b.timestamp);

  // Pre-resolve all capture images so they can be embedded directly in cells
  const captureUrls = sorted
    .filter(a => a.type === 'capture' && a.screenshotUrl)
    .map(a => a.screenshotUrl);
  const resolvedImages = await preResolveImages(captureUrls, serverUrl, dossierId);

  // Header row — widths must match data rows
  const headerDefs = [
    { text: 'Temps', width: 900 },
    { text: 'Capture', width: 3800 },
    { text: 'Commentaire', width: 4300 },
  ];
  const headerCells = headerDefs.map(({ text, width }) =>
    new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text, font, size: fontSize, bold: true, color: tpl.table?.headerTextColor ? hexToRgb(tpl.table.headerTextColor) : 'FFFFFF' })],
      })],
      width: { size: width, type: WidthType.DXA },
      shading: tpl.table?.headerBgColor
        ? { type: ShadingType.CLEAR, fill: hexToRgb(tpl.table.headerBgColor) }
        : { type: ShadingType.CLEAR, fill: '2C3E50' },
    })
  );

  const rows: TableRow[] = [new TableRow({ children: headerCells })];

  for (const ann of sorted) {
    const timeText = formatMediaTime(ann.timestamp);

    // Capture cell — resolved image or text fallback
    let captureChildren: Paragraph[];
    if (ann.type === 'capture' && ann.screenshotUrl) {
      const imgData = resolvedImages.get(ann.screenshotUrl);
      if (imgData) {
        captureChildren = [new Paragraph({
          children: [makeImageRun(imgData, 250, 180)],
        })];
      } else {
        captureChildren = [new Paragraph({
          children: [new TextRun({ text: `[Capture ${timeText}]`, font, size: ptToHalfPt(8), color: '999999', italics: true })],
        })];
      }
    } else {
      captureChildren = [new Paragraph({ children: [new TextRun({ text: ann.type === 'capture' ? 'Capture' : '-', font, size: fontSize })] })];
    }

    const useAltBg = rows.length % 2 === 0 && tpl.table?.alternateRowColor;

    rows.push(new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: timeText, font, size: fontSize, bold: true })] })],
          width: { size: 900, type: WidthType.DXA },
          shading: useAltBg ? { type: ShadingType.CLEAR, fill: hexToRgb(tpl.table!.alternateRowColor!) } : undefined,
        }),
        new TableCell({
          children: captureChildren,
          width: { size: 3800, type: WidthType.DXA },
          shading: useAltBg ? { type: ShadingType.CLEAR, fill: hexToRgb(tpl.table!.alternateRowColor!) } : undefined,
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: ann.comment || '', font, size: fontSize })] })],
          width: { size: 4300, type: WidthType.DXA },
          shading: useAltBg ? { type: ShadingType.CLEAR, fill: hexToRgb(tpl.table!.alternateRowColor!) } : undefined,
        }),
      ],
    }));
  }

  return new Table({
    rows,
    width: { size: 9000, type: WidthType.DXA },
  });
}

export function renderMediaAnnotationsSequentialDocx(
  annotations: any[],
  tpl: PdfTemplateConfig,
  _images: { src: string; placeholder: Paragraph }[],
): (Paragraph | Table)[] {
  const font = docxFont(tpl);
  const fontSize = ptToHalfPt(tpl.body.fontSize);
  const color = tpl.body.color ? hexToRgb(tpl.body.color) : undefined;
  const sorted = [...annotations].sort((a, b) => a.timestamp - b.timestamp);
  const elements: (Paragraph | Table)[] = [];

  for (const ann of sorted) {
    const timeText = formatMediaTime(ann.timestamp);
    const typeLabel = ann.type === 'capture' ? 'Capture' : 'Note';

    // Timestamp + type header
    elements.push(new Paragraph({
      children: [
        new TextRun({ text: `[${timeText}] `, font, size: fontSize, bold: true, color: hexToRgb(tpl.headings.h3.color) }),
        new TextRun({ text: typeLabel, font, size: fontSize, bold: true, color }),
      ],
      spacing: { before: 160, after: 40 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' } },
    }));

    // Screenshot placeholder
    if (ann.type === 'capture' && ann.screenshotUrl) {
      const placeholder = new Paragraph({
        children: [new TextRun({ text: `[Capture ${timeText}]`, font, size: ptToHalfPt(8), color: '999999', italics: true })],
        spacing: { before: 40, after: 40 },
      });
      _images.push({ src: ann.screenshotUrl, placeholder });
      elements.push(placeholder);
    }

    // Comment
    if (ann.comment) {
      elements.push(new Paragraph({
        children: [new TextRun({ text: ann.comment, font, size: fontSize, color })],
        spacing: { after: 80 },
      }));
    }
  }

  return elements;
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
    mediaData?: any;  // MediaData for media nodes
    mediaFormat?: 'table' | 'sequential';
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
  dossierId?: string;
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

    // Media node rendering
    if (section.mediaData) {
      const md = section.mediaData;
      const metaObj = { ...md.metadata, url: md.source?.url };
      docChildren.push(...renderMediaMetadataDocx(metaObj, tpl));

      if (md.annotations?.length) {
        if (section.mediaFormat === 'table') {
          const table = await renderMediaAnnotationsTableDocx(md.annotations, tpl, data.serverUrl, data.dossierId);
          docChildren.push(table);
        } else {
          const images: { src: string; placeholder: Paragraph }[] = [];
          const seqElements = renderMediaAnnotationsSequentialDocx(md.annotations, tpl, images);
          const resolved = await resolveBlockImages(seqElements, images, data.serverUrl, data.dossierId);
          docChildren.push(...resolved);
        }
      }
    } else if (section.blocks && section.blocks.length > 0) {
      // Rich ContentBlock rendering (preferred)
      const images: { src: string; placeholder: Paragraph }[] = [];
      const blockElements = renderBlocksToDocx(section.blocks, tpl, images);
      const resolved = await resolveBlockImages(blockElements, images, data.serverUrl, data.dossierId);
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
