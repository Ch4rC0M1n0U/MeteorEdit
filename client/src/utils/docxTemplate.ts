import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, BorderStyle,
  ShadingType, TabStopPosition, TabStopType,
  type IImageOptions,
} from 'docx';
import { saveAs } from 'file-saver';
import type { PdfTemplateConfig, FontFamily } from './pdfTemplate';
import { loadPdfTemplate, loadImageAsDataUrl, resolveLogoUrl } from './pdfTemplate';

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

// Half-points (1pt = 2 half-points) for docx font sizes
function ptToHalfPt(pt: number): number {
  return Math.round(pt * 2);
}

async function fetchImageBuffer(url: string): Promise<{ buffer: ArrayBuffer; w: number; h: number } | null> {
  try {
    const dataUrl = await loadImageAsDataUrl(url);
    const base64 = dataUrl.split(',')[1];
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

    // Get dimensions from the image
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

  if (tpl.header.logoLeft) {
    left = await fetchImageBuffer(resolveLogoUrl(tpl.header.logoLeft, serverUrl));
  }
  if (!left) {
    left = await fetchImageBuffer(new URL('/logo-pjf.jpeg', window.location.origin).href);
  }

  if (tpl.header.logoRight) {
    right = await fetchImageBuffer(resolveLogoUrl(tpl.header.logoRight, serverUrl));
  }
  if (!right) {
    right = await fetchImageBuffer(new URL('/logo-dr5.png', window.location.origin).href);
  }

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

function createHeaderSection(tpl: PdfTemplateConfig, logos: DocxLogos): Header {
  const children: (TextRun | ImageRun)[] = [];

  if (logos.left) {
    children.push(makeImageRun(logos.left, 50, 50));
  }

  children.push(new TextRun({
    text: `\t${tpl.header.text}\t`,
    font: docxFont(tpl),
    size: ptToHalfPt(8),
    color: hexToRgb(tpl.header.lineColor),
    bold: true,
  }));

  if (logos.right) {
    children.push(makeImageRun(logos.right, 50, 50));
  }

  return new Header({
    children: [
      new Paragraph({
        children,
        tabStops: [
          { type: TabStopType.CENTER, position: TabStopPosition.MAX / 2 },
          { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
        ],
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: hexToRgb(tpl.header.lineColor) },
        },
        spacing: { after: 100 },
      }),
    ],
  });
}

function createFooterSection(tpl: PdfTemplateConfig): Footer {
  return new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            children: [
              tpl.footer.format.replace('{n}', '').replace('{total}', '').includes('Page')
                ? 'Page '
                : '',
              PageNumber.CURRENT,
              tpl.footer.format.includes('{total}')
                ? (tpl.footer.format.includes('|') ? ' | ' : ' / ')
                : '',
              ...(tpl.footer.format.includes('{total}') ? [PageNumber.TOTAL_PAGES] : []),
            ],
            font: docxFont(tpl),
            size: ptToHalfPt(8),
            color: '666666',
          }),
        ],
        alignment: AlignmentType.RIGHT,
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: hexToRgb(tpl.footer.lineColor) },
        },
        spacing: { before: 100 },
      }),
    ],
  });
}

function buildHeadingBorder(h: { bgColor: string; borderStyle?: string; borderColor?: string; borderWidth?: number }) {
  const bs = h.borderStyle || 'none';
  if (bs === 'none' && !h.bgColor) return undefined;

  const borderColor = h.borderColor ? hexToRgb(h.borderColor) : '000000';
  const borderSize = Math.round((h.borderWidth || 1) * 6); // docx border size in 1/8 pt

  if (bs === 'bottom') {
    return {
      bottom: { style: BorderStyle.SINGLE, size: borderSize, color: borderColor },
      // Transparent borders for bgColor padding if needed
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

  // No explicit border style but has bgColor - use bgColor borders for padding
  if (h.bgColor) {
    return {
      top: { style: BorderStyle.SINGLE, size: 1, color: hexToRgb(h.bgColor) },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: hexToRgb(h.bgColor) },
      left: { style: BorderStyle.SINGLE, size: 1, color: hexToRgb(h.bgColor) },
      right: { style: BorderStyle.SINGLE, size: 1, color: hexToRgb(h.bgColor) },
    };
  }

  return undefined;
}

function docxFont(tpl: PdfTemplateConfig): string {
  return DOCX_FONT_MAP[tpl.fontFamily] || 'Calibri';
}

function sectionHeading(text: string, tpl: PdfTemplateConfig, level: 'h1' | 'h2' | 'h3'): Paragraph {
  const h = tpl.headings[level];
  const displayText = h.uppercase ? text.toUpperCase() : text;
  const ss = tpl.spacing?.sectionSpacing || 6;
  const beforeTwips = Math.round(ss * 20 * (level === 'h1' ? 1 : level === 'h2' ? 0.7 : 0.5));
  const afterTwips = Math.round(ss * 20 * (level === 'h1' ? 0.7 : 0.5));
  return new Paragraph({
    children: [
      new TextRun({
        text: displayText,
        font: docxFont(tpl),
        size: ptToHalfPt(h.fontSize),
        bold: h.bold,
        italics: h.italic,
        color: hexToRgb(h.color),
      }),
    ],
    heading: level === 'h1' ? HeadingLevel.HEADING_1 : level === 'h2' ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    shading: h.bgColor ? { type: ShadingType.CLEAR, fill: hexToRgb(h.bgColor) } : undefined,
    spacing: { before: beforeTwips, after: afterTwips },
    border: buildHeadingBorder(h),
  });
}

function bodyParagraph(text: string, tpl: PdfTemplateConfig): Paragraph {
  const lh = tpl.spacing?.lineHeight || 1.4;
  const ps = tpl.spacing?.paragraphSpacing ?? 3;
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: docxFont(tpl),
        size: ptToHalfPt(tpl.body.fontSize),
        color: tpl.body.color ? hexToRgb(tpl.body.color) : undefined,
      }),
    ],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: Math.round(ps * 20), line: Math.round(lh * 240) },
  });
}

function disclaimerParagraph(text: string, tpl: PdfTemplateConfig): Paragraph {
  const ps = tpl.spacing?.paragraphSpacing ?? 3;
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: docxFont(tpl),
        size: ptToHalfPt(tpl.body.fontSize - 1),
        italics: true,
        color: hexToRgb(tpl.disclaimer.color),
      }),
    ],
    spacing: { before: 120, after: Math.round(ps * 20) },
  });
}

function bulletParagraph(text: string, tpl: PdfTemplateConfig): Paragraph {
  const lh = tpl.spacing?.lineHeight || 1.4;
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: docxFont(tpl),
        size: ptToHalfPt(tpl.body.fontSize),
        color: tpl.body.color ? hexToRgb(tpl.body.color) : undefined,
      }),
    ],
    bullet: { level: 0 },
    spacing: { after: 40, line: Math.round(lh * 240) },
  });
}

export interface DocxExportData {
  dossierTitle: string;
  subtitle: string;
  extraCoverLines: string[];
  sections: Array<{
    title: string;
    level: 'h1' | 'h2' | 'h3';
    paragraphs: string[];
    bullets?: string[];
  }>;
  disclaimerText: string;
  closingDate: string;
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

export async function generateDocx(data: DocxExportData): Promise<void> {
  const tpl = loadPdfTemplate();
  const logos = await loadLogos(tpl, data.serverUrl);

  const docChildren: Paragraph[] = [];

  // === COVER PAGE content ===
  // Logo left centered
  if (logos.left) {
    docChildren.push(new Paragraph({
      children: [makeImageRun(logos.left, 120, 120)],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }));
  }

  // Header text on cover
  docChildren.push(new Paragraph({
    children: [new TextRun({
      text: tpl.header.text,
      font: docxFont(tpl),
      size: ptToHalfPt(10),
      bold: true,
      color: hexToRgb(tpl.header.lineColor),
    })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
  }));

  // Logo right on cover
  if (logos.right) {
    docChildren.push(new Paragraph({
      children: [makeImageRun(logos.right, 80, 80)],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 100 },
    }));
  }

  // Separator line
  docChildren.push(new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: hexToRgb(tpl.header.lineColor) } },
    spacing: { after: 400 },
  }));

  // Main title
  docChildren.push(new Paragraph({
    children: [new TextRun({
      text: tpl.cover.title || 'Rapport OSINT',
      font: docxFont(tpl),
      size: ptToHalfPt(tpl.cover.titleSize),
      bold: true,
      color: hexToRgb(tpl.cover.titleColor),
    })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
  }));

  // Subtitle
  docChildren.push(new Paragraph({
    children: [new TextRun({
      text: data.subtitle,
      font: docxFont(tpl),
      size: ptToHalfPt(tpl.cover.subtitleSize),
      color: '555555',
    })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
  }));

  // Extra cover lines
  for (const line of data.extraCoverLines) {
    docChildren.push(new Paragraph({
      children: [new TextRun({
        text: line,
        font: docxFont(tpl),
        size: ptToHalfPt(12),
        color: '666666',
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }));
  }

  // Bottom separator
  docChildren.push(new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: hexToRgb(tpl.header.lineColor) } },
    spacing: { before: 600, after: 200 },
  }));

  // Cover footer text
  if (tpl.cover.footerText) {
    docChildren.push(new Paragraph({
      children: [new TextRun({
        text: tpl.cover.footerText,
        font: docxFont(tpl),
        size: ptToHalfPt(8),
        color: '666666',
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
    }));
  }

  // Page break after cover
  docChildren.push(new Paragraph({ children: [], pageBreakBefore: true }));

  // === CONTENT SECTIONS ===
  for (const section of data.sections) {
    docChildren.push(sectionHeading(section.title, tpl, section.level));

    for (const para of section.paragraphs) {
      if (para.trim()) docChildren.push(bodyParagraph(para, tpl));
    }

    if (section.bullets) {
      for (const bullet of section.bullets) {
        docChildren.push(bulletParagraph(bullet, tpl));
      }
    }
  }

  // === DISCLAIMER ===
  if (data.disclaimerText) {
    docChildren.push(disclaimerParagraph(data.disclaimerText, tpl));
  }

  // === CLOSING + SIGNATURE (right-aligned) ===
  docChildren.push(new Paragraph({
    children: [new TextRun({
      text: `Bruxelles, le ${data.closingDate}`,
      font: docxFont(tpl),
      size: ptToHalfPt(10),
    })],
    alignment: AlignmentType.RIGHT,
    spacing: { before: 400, after: 200 },
  }));

  // Signature image
  if (data.signatureImagePath) {
    const sigUrl = `${data.serverUrl}/${data.signatureImagePath}`;
    const sigImg = await fetchImageBuffer(sigUrl);
    if (sigImg) {
      docChildren.push(new Paragraph({
        children: [makeImageRun(sigImg, 180, 70)],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 80 },
      }));
    }
  }

  // Signature text
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
      sigRuns.push(new TextRun({
        text: line,
        font: docxFont(tpl),
        size: ptToHalfPt(10),
        bold: i <= 1, // title + name bold
      }));
    });

    docChildren.push(new Paragraph({
      children: sigRuns,
      alignment: AlignmentType.RIGHT,
      spacing: { after: 100 },
    }));
  }

  // === BUILD DOCUMENT ===
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
