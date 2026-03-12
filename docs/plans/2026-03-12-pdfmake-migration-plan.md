# Migration jsPDF → pdfmake — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace jsPDF with pdfmake for reliable PDF export with custom fonts, automatic word-wrap, and declarative layout.

**Architecture:** ContentBlock[] (from contentBlocks.ts, unchanged) is mapped to pdfmake's JSON docDefinition via a new pdfmakeRenderer.ts. The existing PdfTemplateConfig branding system is converted to pdfmake styles. Fonts (NotoSans) are loaded as VFS base64 at export time.

**Tech Stack:** pdfmake (client-side PDF), Vue 3 + TypeScript, Vite 7

---

### Task 1: Install pdfmake and types

**Files:**
- Modify: `client/package.json`

**Step 1: Install pdfmake**

```bash
cd client && npm install pdfmake && npm install -D @types/pdfmake
```

**Step 2: Verify install**

```bash
cd client && npx vue-tsc --noEmit
```

**Step 3: Commit**

```bash
git add client/package.json client/package-lock.json
git commit -m "feat: add pdfmake dependency for PDF export migration"
```

---

### Task 2: Create pdfmakeFonts.ts — Font VFS loader

**Files:**
- Create: `client/src/utils/pdfmakeFonts.ts`

Lazy-loads NotoSans TTF fonts as base64 for pdfmake's virtual file system. The existing font files in `client/src/assets/fonts/` are reused.

**Step 1: Create the font loader**

```typescript
// client/src/utils/pdfmakeFonts.ts
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
};
```

**Step 2: Verify compilation**

```bash
cd client && npx vue-tsc --noEmit
```

**Step 3: Commit**

```bash
git add client/src/utils/pdfmakeFonts.ts
git commit -m "feat: add pdfmake VFS font loader for NotoSans"
```

---

### Task 3: Create pdfmakeRenderer.ts — Core renderer

**Files:**
- Create: `client/src/utils/pdfmakeRenderer.ts`

This is the main file. It replaces pdfTemplate.ts entirely. Contains:
- `blocksToContent()` — maps ContentBlock[] to pdfmake Content[]
- `templateToStyles()` — maps PdfTemplateConfig to pdfmake styles
- `buildDocDefinition()` — assembles the full docDefinition
- `generatePdfBlob()` — produces the final PDF Blob
- Re-exports `loadPdfTemplate`, `PdfTemplateConfig`, `loadImageAsDataUrl` (kept from old file for compatibility)

**Step 1: Create the renderer file with types and helpers**

```typescript
// client/src/utils/pdfmakeRenderer.ts
import type { TDocumentDefinitions, Content, Style, ContentTable, ContentColumns } from 'pdfmake/interfaces';
import { type ContentBlock, type InlineMark, blocksToPlainText } from './contentBlocks';

// ── Re-export types from old pdfTemplate (kept for compat) ──────────

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

export interface PdfTemplateConfig {
  fontFamily: FontFamily;
  page: { marginH: number; marginV: number };
  header: { text: string; logoLeft: string; logoRight: string; lineColor: string };
  cover: { title: string; titleSize: number; titleColor: string; subtitleSize: number; footerText: string };
  headings: { h1: HeadingStyle; h2: HeadingStyle; h3: HeadingStyle };
  body: { fontSize: number; color: string };
  spacing: { lineHeight: number; paragraphSpacing: number; sectionSpacing: number };
  table: { headerBgColor: string; headerTextColor: string; borderColor: string; borderWidth: number; alternateRowColor: string };
  disclaimer: { color: string };
  footer: { format: string; lineColor: string };
}

export interface PdfLogoData {
  logoLeft: string | null;
  logoRight: string | null;
}

// ── Load/save template from localStorage ─────────────────────────────

const DEFAULT_TEMPLATE: PdfTemplateConfig = {
  fontFamily: 'Calibri',
  page: { marginH: 20, marginV: 20 },
  header: { text: '', logoLeft: '', logoRight: '', lineColor: '#1a237e' },
  cover: { title: '', titleSize: 22, titleColor: '#1a237e', subtitleSize: 14, footerText: '' },
  headings: {
    h1: { fontSize: 18, color: '#1a237e', bgColor: '#f5d6a8', bold: true, italic: false, uppercase: true, borderStyle: 'box', borderColor: '#1a237e', borderWidth: 0.5 },
    h2: { fontSize: 14, color: '#ffffff', bgColor: '#1a237e', bold: true, italic: false, uppercase: false, borderStyle: 'none', borderColor: '#1a237e', borderWidth: 0.5 },
    h3: { fontSize: 12, color: '#1a237e', bgColor: '#e8eaf6', bold: true, italic: false, uppercase: false, borderStyle: 'bottom', borderColor: '#1a237e', borderWidth: 0.3 },
  },
  body: { fontSize: 10, color: '#222222' },
  spacing: { lineHeight: 1.4, paragraphSpacing: 6, sectionSpacing: 10 },
  table: { headerBgColor: '#1a237e', headerTextColor: '#ffffff', borderColor: '#cccccc', borderWidth: 0.5, alternateRowColor: '#f5f5f5' },
  disclaimer: { color: '#888888' },
  footer: { format: 'Page {page} | {pages}', lineColor: '#1a237e' },
};

export function loadPdfTemplate(): PdfTemplateConfig {
  try {
    const raw = localStorage.getItem('pdfTemplate');
    if (raw) return { ...DEFAULT_TEMPLATE, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_TEMPLATE };
}

export function savePdfTemplate(tpl: PdfTemplateConfig) {
  localStorage.setItem('pdfTemplate', JSON.stringify(tpl));
}

// ── Image loading ────────────────────────────────────────────────────

export async function loadImageAsDataUrl(url: string): Promise<string> {
  if (!url) throw new Error('Empty image URL');
  if (url.startsWith('data:')) return url;
  let resolvedUrl = url;
  if (!url.startsWith('blob:') && !url.startsWith('http')) {
    resolvedUrl = new URL(url, window.location.origin).href;
  }
  const response = await fetch(resolvedUrl);
  if (!response.ok) throw new Error(`Image fetch failed: ${resolvedUrl} (${response.status})`);
  const blob = await response.blob();
  const mime = blob.type || 'image/png';
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FileReader failed'));
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

// ── Sanitization ─────────────────────────────────────────────────────

export function cleanControlChars(text: string): string {
  return text
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u0000-\u001F]/g, '')
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{E0020}-\u{E007F}\u{2300}-\u{23FF}\u{2B50}-\u{2B55}\u{200D}\u{20E3}\u{FE0E}]/gu, '')
    .trim();
}

// ── ContentBlock[] → pdfmake Content[] ───────────────────────────────

function marksToStyle(marks: InlineMark): Record<string, unknown> {
  const s: Record<string, unknown> = {};
  if (marks.bold) s.bold = true;
  if (marks.italic) s.italics = true;
  if (marks.underline) s.decoration = 'underline';
  if (marks.strike) s.decoration = s.decoration ? `${s.decoration} lineThrough` : 'lineThrough';
  if (marks.code) {
    s.font = 'Courier';
    s.background = '#eeeeee';
    s.fontSize = 9;
  }
  if (marks.color) s.color = marks.color;
  if (marks.highlight) s.background = marks.highlight;
  if (marks.link) {
    s.link = marks.link;
    s.color = '#1565C0';
    s.decoration = 'underline';
  }
  return s;
}

function childrenToRuns(children: ContentBlock[]): Content[] {
  const runs: Content[] = [];
  for (const child of children) {
    if (child.type === 'text') {
      runs.push({ text: child.text, ...marksToStyle(child.marks || {}) });
    } else if (child.type === 'hardBreak') {
      runs.push({ text: '\n' });
    }
  }
  return runs;
}

export function blocksToContent(blocks: ContentBlock[]): Content[] {
  const content: Content[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
        content.push({
          text: childrenToRuns(block.children),
          alignment: (block.align as 'left' | 'center' | 'right' | 'justify') || undefined,
          style: 'body',
          margin: [0, 0, 0, 3] as [number, number, number, number],
        });
        break;

      case 'heading':
        content.push({
          text: blocksToPlainText(block.children),
          style: `contentH${block.level}`,
          margin: [0, 4, 0, 2] as [number, number, number, number],
        });
        break;

      case 'bulletList':
        content.push({
          ul: block.items.map(item => {
            const itemContent = blocksToContent(item);
            return itemContent.length === 1 ? itemContent[0] : { stack: itemContent };
          }),
          style: 'body',
          margin: [0, 0, 0, 3] as [number, number, number, number],
        });
        break;

      case 'orderedList':
        content.push({
          ol: block.items.map(item => {
            const itemContent = blocksToContent(item);
            return itemContent.length === 1 ? itemContent[0] : { stack: itemContent };
          }),
          start: block.start || 1,
          style: 'body',
          margin: [0, 0, 0, 3] as [number, number, number, number],
        });
        break;

      case 'blockquote': {
        // Render as a table with left border to simulate blockquote
        const quoteContent = blocksToContent(block.children);
        content.push({
          table: {
            widths: ['*'],
            body: [[{ stack: quoteContent, italics: true, margin: [4, 2, 4, 2] as [number, number, number, number] }]],
          },
          layout: {
            hLineWidth: () => 0,
            vLineWidth: (i: number) => i === 0 ? 2 : 0,
            vLineColor: () => '#999999',
            paddingLeft: () => 8,
            paddingRight: () => 4,
            paddingTop: () => 2,
            paddingBottom: () => 2,
          },
          margin: [0, 2, 0, 4] as [number, number, number, number],
        } as Content);
        break;
      }

      case 'codeBlock':
        content.push({
          table: {
            widths: ['*'],
            body: [[{
              text: block.text || ' ',
              font: 'Courier',
              fontSize: 9,
              margin: [4, 4, 4, 4] as [number, number, number, number],
            }]],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#dddddd',
            vLineColor: () => '#dddddd',
            fillColor: () => '#f5f5f5',
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
          margin: [0, 2, 0, 4] as [number, number, number, number],
        } as Content);
        break;

      case 'table': {
        if (!block.rows || block.rows.length === 0) break;
        const colCount = block.rows[0]?.length || 1;
        const body = block.rows.map((row, rowIdx) =>
          row.map(cell => {
            const cellContent = blocksToContent(cell);
            return {
              stack: cellContent.length > 0 ? cellContent : [{ text: ' ' }],
              ...(rowIdx === 0 ? { bold: true, fillColor: '#1a237e', color: '#ffffff' } : {}),
            };
          })
        );
        content.push({
          table: {
            headerRows: 1,
            widths: Array(colCount).fill('*'),
            body,
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#cccccc',
            vLineColor: () => '#cccccc',
            fillColor: (rowIndex: number) => rowIndex === 0 ? undefined : (rowIndex % 2 === 1 ? '#f5f5f5' : undefined),
          },
          margin: [0, 2, 0, 4] as [number, number, number, number],
        } as Content);
        break;
      }

      case 'image':
        if (block.src) {
          content.push({
            image: block.src,
            width: Math.min(block.width || 500, 500),
            margin: [0, 2, 0, 4] as [number, number, number, number],
          });
        }
        break;

      case 'text':
        content.push({ text: block.text, style: 'body' });
        break;

      case 'hardBreak':
        content.push({ text: '\n' });
        break;
    }
  }
  return content;
}

// ── Resolve images in blocks to data URLs ────────────────────────────

export async function resolveBlockImages(blocks: ContentBlock[]): Promise<void> {
  for (const block of blocks) {
    if (block.type === 'image' && block.src && !block.src.startsWith('data:')) {
      try {
        block.src = await loadImageAsDataUrl(block.src);
      } catch {
        console.warn('[PDF] Image load failed, skipping:', block.src);
        block.src = '';
      }
    }
    if ('children' in block && Array.isArray((block as any).children)) {
      await resolveBlockImages((block as any).children);
    }
    if ('items' in block && Array.isArray((block as any).items)) {
      for (const item of (block as any).items) {
        await resolveBlockImages(item);
      }
    }
    if (block.type === 'table') {
      for (const row of block.rows) {
        for (const cell of row) {
          await resolveBlockImages(cell);
        }
      }
    }
  }
}

// ── Template → pdfmake styles ────────────────────────────────────────

function headingStyleToPdfMake(h: HeadingStyle, marginBefore: number, marginAfter: number): Style {
  return {
    fontSize: h.fontSize,
    bold: h.bold,
    italics: h.italic,
    color: h.color,
    margin: [0, marginBefore, 0, marginAfter],
  };
}

function templateToStyles(tpl: PdfTemplateConfig): Record<string, Style> {
  return {
    h1: headingStyleToPdfMake(tpl.headings.h1, 10, 4),
    h2: headingStyleToPdfMake(tpl.headings.h2, 8, 3),
    h3: headingStyleToPdfMake(tpl.headings.h3, 6, 2),
    contentH1: { fontSize: (tpl.body.fontSize || 10) + 2, bold: true, color: tpl.body.color, margin: [0, 4, 0, 2] },
    contentH2: { fontSize: (tpl.body.fontSize || 10) + 1, bold: true, color: tpl.body.color, margin: [0, 3, 0, 2] },
    contentH3: { fontSize: tpl.body.fontSize || 10, bold: true, color: tpl.body.color, margin: [0, 2, 0, 1] },
    body: {
      fontSize: tpl.body.fontSize || 10,
      color: tpl.body.color || '#222222',
      lineHeight: tpl.spacing?.lineHeight || 1.4,
    },
    tocEntry: { fontSize: tpl.body.fontSize || 10, color: tpl.body.color || '#222222' },
  };
}

// ── Heading background/border rendering ──────────────────────────────

function renderHeading(text: string, level: 'h1' | 'h2' | 'h3', tpl: PdfTemplateConfig): Content {
  const h = tpl.headings[level];
  const displayText = h.uppercase ? text.toUpperCase() : text;
  const marginBefore = level === 'h1' ? 10 : level === 'h2' ? 8 : 6;
  const marginAfter = level === 'h1' ? 4 : level === 'h2' ? 3 : 2;

  // Use a table to simulate background color + borders
  if (h.bgColor || (h.borderStyle && h.borderStyle !== 'none')) {
    return {
      table: {
        widths: ['*'],
        body: [[{
          text: displayText,
          fontSize: h.fontSize,
          bold: h.bold,
          italics: h.italic,
          color: h.color,
          margin: [3, 2, 3, 2] as [number, number, number, number],
        }]],
      },
      layout: {
        hLineWidth: (i: number, _node: any) => {
          if (h.borderStyle === 'box') return h.borderWidth || 0.5;
          if (h.borderStyle === 'bottom' && i === 1) return h.borderWidth || 0.5;
          return 0;
        },
        vLineWidth: () => h.borderStyle === 'box' ? (h.borderWidth || 0.5) : 0,
        hLineColor: () => h.borderColor || '#000000',
        vLineColor: () => h.borderColor || '#000000',
        fillColor: () => h.bgColor || undefined,
      },
      margin: [0, marginBefore, 0, marginAfter] as [number, number, number, number],
    } as Content;
  }

  return { text: displayText, style: level, margin: [0, marginBefore, 0, marginAfter] as [number, number, number, number] };
}

// ── Build full document definition ───────────────────────────────────

export interface PdfBuildOptions {
  dossierTitle: string;
  infoLines: string[];
  content: Content[];
  includeToc?: boolean;
  tocEntries?: { title: string; level: 'h1' | 'h2' | 'h3'; number: string }[];
  closingCity?: string;
  signatureImage?: string | null;
  signatureLines?: string[];
}

export function buildDocDefinition(
  tpl: PdfTemplateConfig,
  logos: PdfLogoData,
  opts: PdfBuildOptions,
): TDocumentDefinitions {
  const margin = tpl.page?.marginH || 20;
  const styles = templateToStyles(tpl);

  // ── Assemble content array ──
  const docContent: Content[] = [];

  // Title block
  docContent.push({
    text: cleanControlChars(opts.dossierTitle),
    fontSize: tpl.cover.titleSize || 22,
    bold: true,
    color: tpl.cover.titleColor || '#1a237e',
    alignment: 'center',
    margin: [0, 0, 0, 4] as [number, number, number, number],
  });

  // Info lines
  for (const line of opts.infoLines) {
    docContent.push({
      text: cleanControlChars(line),
      fontSize: 10,
      color: '#666666',
      alignment: 'center',
      margin: [0, 0, 0, 2] as [number, number, number, number],
    });
  }

  // Separator line
  docContent.push({
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515 - margin * 2, y2: 0, lineWidth: 0.5, lineColor: tpl.header.lineColor || '#1a237e' }],
    margin: [0, 4, 0, 8] as [number, number, number, number],
  } as Content);

  // TOC
  if (opts.includeToc && opts.tocEntries && opts.tocEntries.length > 0) {
    docContent.push({ text: 'Table des matières', style: 'h1', margin: [0, 6, 0, 4] as [number, number, number, number] });
    for (const entry of opts.tocEntries) {
      const indent = entry.level === 'h1' ? 0 : entry.level === 'h2' ? 15 : 30;
      docContent.push({
        text: entry.title,
        style: 'tocEntry',
        bold: entry.level === 'h1',
        margin: [indent, 1, 0, 1] as [number, number, number, number],
      });
    }
    docContent.push({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515 - margin * 2, y2: 0, lineWidth: 0.3, lineColor: '#cccccc' }],
      margin: [0, 6, 0, 8] as [number, number, number, number],
    } as Content);
  }

  // Main content
  docContent.push(...opts.content);

  // Closing block
  if (opts.closingCity || opts.signatureImage || opts.signatureLines?.length) {
    docContent.push({ text: '', margin: [0, 10, 0, 0] as [number, number, number, number] });

    const closingDate = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
    const cityText = opts.closingCity ? `${opts.closingCity}, le ${closingDate}` : closingDate;
    docContent.push({ text: cityText, alignment: 'right', style: 'body', margin: [0, 0, 0, 8] as [number, number, number, number] });

    if (opts.signatureImage) {
      docContent.push({ image: opts.signatureImage, width: 120, alignment: 'right', margin: [0, 0, 0, 4] as [number, number, number, number] });
    }

    if (opts.signatureLines?.length) {
      for (const line of opts.signatureLines) {
        docContent.push({ text: line, alignment: 'right', style: 'body', margin: [0, 0, 0, 1] as [number, number, number, number] });
      }
    }
  }

  // ── Header/Footer ──
  const headerFn = (_currentPage: number, _pageCount: number): Content => {
    const cols: Content[] = [];
    if (logos.logoLeft) {
      cols.push({ image: logos.logoLeft, width: 40, margin: [margin, 5, 0, 0] as [number, number, number, number] });
    } else {
      cols.push({ text: '', width: 40 });
    }
    cols.push({
      text: tpl.header.text || '',
      alignment: 'center',
      fontSize: 8,
      color: '#666666',
      margin: [0, 10, 0, 0] as [number, number, number, number],
    });
    if (logos.logoRight) {
      cols.push({ image: logos.logoRight, width: 40, alignment: 'right', margin: [0, 5, margin, 0] as [number, number, number, number] });
    } else {
      cols.push({ text: '', width: 40 });
    }
    return {
      columns: cols,
      margin: [0, 0, 0, 0] as [number, number, number, number],
    };
  };

  const footerFn = (currentPage: number, pageCount: number): Content => ({
    stack: [
      { canvas: [{ type: 'line', x1: margin, y1: 0, x2: 595 - margin, y2: 0, lineWidth: 0.3, lineColor: tpl.footer.lineColor || '#1a237e' }] },
      {
        text: (tpl.footer.format || 'Page {page} | {pages}')
          .replace('{page}', String(currentPage))
          .replace('{pages}', String(pageCount)),
        alignment: 'right',
        fontSize: 8,
        color: '#666666',
        margin: [margin, 2, margin, 0] as [number, number, number, number],
      },
    ],
  });

  return {
    content: docContent,
    styles,
    defaultStyle: {
      font: 'NotoSans',
      fontSize: tpl.body.fontSize || 10,
      color: tpl.body.color || '#222222',
      lineHeight: tpl.spacing?.lineHeight || 1.4,
    },
    pageSize: 'A4',
    pageMargins: [margin, 50, margin, 35],
    header: headerFn,
    footer: footerFn,
  };
}

// ── Generate PDF Blob ────────────────────────────────────────────────

export async function generatePdfBlob(docDef: TDocumentDefinitions): Promise<Blob> {
  const pdfMakeModule = await import('pdfmake/build/pdfmake');
  const pdfMake = pdfMakeModule.default || pdfMakeModule;
  const { loadVfsFonts, pdfMakeFontDescriptors } = await import('./pdfmakeFonts');
  const vfs = await loadVfsFonts();

  return new Promise<Blob>((resolve, reject) => {
    try {
      const printer = pdfMake.createPdf(docDef, undefined, pdfMakeFontDescriptors, vfs);
      printer.getBlob((blob: Blob) => resolve(blob));
    } catch (e) {
      reject(e);
    }
  });
}
```

**Step 2: Verify compilation**

```bash
cd client && npx vue-tsc --noEmit
```

Fix any type errors. pdfmake types can be tricky — may need `as any` casts on some layout functions.

**Step 3: Commit**

```bash
git add client/src/utils/pdfmakeRenderer.ts
git commit -m "feat: add pdfmake renderer with ContentBlock mapping and branding support"
```

---

### Task 4: Update DossierView.vue — Wire up pdfmake exports

**Files:**
- Modify: `client/src/components/dossier/DossierView.vue`

Replace all jsPDF imports and usage with pdfmakeRenderer imports. Simplify walkTreePdf into a pure content-building function.

**Step 1: Update imports**

Replace:
```typescript
import {
  loadPdfTemplate, loadTemplateLogos, loadImageAsDataUrl,
  createPdfBuilder, cleanControlChars, type PdfBuilder
} from '../../utils/pdfTemplate';
```

With:
```typescript
import {
  loadPdfTemplate, loadTemplateLogos, loadImageAsDataUrl,
  cleanControlChars, blocksToContent, resolveBlockImages,
  buildDocDefinition, generatePdfBlob, renderHeading,
  type PdfBuildOptions,
} from '../../utils/pdfmakeRenderer';
```

**Step 2: Replace walkTreePdf with a content-building function**

Replace the existing `walkTreePdf` function with:

```typescript
async function walkTreeContent(
  allNodes: any[],
  parentId: string | null,
  depth: number,
  counter: SectionCounter,
  tpl: PdfTemplateConfig,
): Promise<Content[]> {
  const children = allNodes
    .filter((n: any) => n.parentId === parentId && !n.deletedAt)
    .sort((a: any, b: any) => a.order - b.order);

  const hl: 'h1' | 'h2' | 'h3' = depth <= 1 ? 'h1' : depth === 2 ? 'h2' : 'h3';
  const content: Content[] = [];

  for (const node of children) {
    if (node.type === 'folder') {
      const num = nextSectionNumber(counter, hl);
      content.push(renderHeading(`${num} ${cleanControlChars(node.title)}`, hl, tpl));
      const subContent = await walkTreeContent(allNodes, node._id, depth + 1, counter, tpl);
      content.push(...subContent);
    } else if (node.type === 'note') {
      const num = nextSectionNumber(counter, hl);
      content.push(renderHeading(`${num} ${cleanControlChars(node.title)}`, hl, tpl));
      if (node.content) {
        const blocks = convertTipTapToBlocks(node.content);
        await resolveBlockImages(blocks);
        content.push(...blocksToContent(blocks));
      }
    }
  }
  return content;
}
```

**Step 3: Rewrite exportPDF**

Replace the existing `exportPDF` function with:

```typescript
async function exportPDF(selectedNodeIds?: string[], includeToc = false) {
  if (!dossierStore.currentDossier) return;
  try {
    const dossier = dossierStore.currentDossier;
    const allNodes = dossierStore.nodes;
    const nodes = selectedNodeIds ? allNodes.filter(n => selectedNodeIds.includes(n._id)) : allNodes;
    const tpl = loadPdfTemplate();
    const logos = await loadTemplateLogos(tpl, SERVER_URL);

    // Build TOC entries
    let tocEntries: { title: string; level: 'h1' | 'h2' | 'h3'; number: string }[] = [];
    if (includeToc) {
      const tocCounter: SectionCounter = [0, 0, 0];
      tocEntries = collectTocEntries(nodes, null, 1, tocCounter);
      // Add orphans to TOC
      const nodeIds = new Set(nodes.map((n: any) => n._id));
      const orphans = nodes.filter((n: any) => n.parentId && !nodeIds.has(n.parentId) && !n.deletedAt);
      for (const orphan of orphans) {
        const num = nextSectionNumber(tocCounter, 'h1');
        tocEntries.push({ title: `${num} ${cleanControlChars(orphan.title)}`, level: 'h1', number: num });
      }
    }

    // Build content
    const counter: SectionCounter = [0, 0, 0];
    const content: Content[] = [];

    // Walk rooted nodes
    const nodeIds = new Set(nodes.map((n: any) => n._id));
    const rootContent = await walkTreeContent(nodes, null, 1, counter, tpl);
    content.push(...rootContent);

    // Orphan nodes
    const orphans = nodes.filter((n: any) => n.parentId && !nodeIds.has(n.parentId) && !n.deletedAt)
      .sort((a: any, b: any) => a.order - b.order);
    for (const orphan of orphans) {
      const num = nextSectionNumber(counter, 'h1');
      content.push(renderHeading(`${num} ${cleanControlChars(orphan.title)}`, 'h1', tpl));
      if (orphan.type === 'note' && orphan.content) {
        const blocks = convertTipTapToBlocks(orphan.content);
        await resolveBlockImages(blocks);
        content.push(...blocksToContent(blocks));
      }
    }

    // Signature
    const user = authStore.user as any;
    const closingCity = user?.signature?.city || 'Bruxelles';
    let signatureImage: string | null = null;
    if (user?.signatureImagePath) {
      try { signatureImage = await loadImageAsDataUrl(`${SERVER_URL}/${user.signatureImagePath}`); } catch { /* */ }
    }
    const signatureLines: string[] = [];
    if (user?.signature?.title) signatureLines.push(user.signature.title);
    if (user?.signature?.name) signatureLines.push(user.signature.name);
    if (user?.signature?.service) signatureLines.push(user.signature.service);
    if (user?.signature?.unit) signatureLines.push(user.signature.unit);
    if (user?.signature?.email) signatureLines.push(user.signature.email);

    const docDef = buildDocDefinition(tpl, logos, {
      dossierTitle: dossier.title,
      infoLines: buildDossierInfoLines(dossier),
      content,
      includeToc,
      tocEntries,
      closingCity,
      signatureImage,
      signatureLines,
    });

    const blob = await generatePdfBlob(docDef);
    downloadBlob(blob, `Rapport_OSINT_${dossier.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  } catch (err) {
    console.error('PDF export failed:', err);
  }
}
```

**Step 4: Remove old PdfBuilder type import and jsPDF import**

Remove any remaining references to `jsPDF`, `PdfBuilder`, `createPdfBuilder` in the PDF export path. Keep the DOCX export unchanged.

**Step 5: Add `Content` type import at top of script**

```typescript
import type { Content } from 'pdfmake/interfaces';
```

**Step 6: Verify compilation**

```bash
cd client && npx vue-tsc --noEmit
```

**Step 7: Commit**

```bash
git add client/src/components/dossier/DossierView.vue
git commit -m "feat: wire DossierView PDF export to pdfmake renderer"
```

---

### Task 5: Update ProfileTemplate.vue — Preview with pdfmake

**Files:**
- Modify: `client/src/components/profile/ProfileTemplate.vue`

**Step 1: Update imports and preview function**

Replace `createPdfBuilder` and jsPDF usage with pdfmakeRenderer imports. The preview function should build a docDefinition with example content and generate a blob.

Replace the `generatePdfPreview` function to:
1. Import from `pdfmakeRenderer` instead of `pdfTemplate`
2. Build a sample `docDefinition` with example headings, body text, list, blockquote, table
3. Call `generatePdfBlob(docDef)` to get the blob
4. Create object URL for iframe display

Use `buildDocDefinition()` with sample content, `renderHeading()` for styled headings, and `blocksToContent()` for rich content examples.

**Step 2: Verify compilation**

```bash
cd client && npx vue-tsc --noEmit
```

**Step 3: Test preview** — Open the profile template page and verify the PDF preview renders.

**Step 4: Commit**

```bash
git add client/src/components/profile/ProfileTemplate.vue
git commit -m "feat: update ProfileTemplate preview to use pdfmake"
```

---

### Task 6: Update AI report export (if using PDF)

**Files:**
- Modify: `client/src/components/dossier/DossierView.vue`

Check if the AI report PDF export (around line 830-870) also uses jsPDF/PdfBuilder. If so, adapt to pdfmake the same way as the regular export. The DOCX AI report path should remain unchanged.

**Step 1: Locate AI report PDF code and adapt**

The AI report export uses the same `createPdfBuilder` pattern. Replace with pdfmake approach: build content array from AI text sections, use `buildDocDefinition`, call `generatePdfBlob`.

**Step 2: Verify compilation**

```bash
cd client && npx vue-tsc --noEmit
```

**Step 3: Commit**

```bash
git add client/src/components/dossier/DossierView.vue
git commit -m "feat: migrate AI report PDF export to pdfmake"
```

---

### Task 7: Remove jsPDF and old files

**Files:**
- Delete: `client/src/utils/pdfTemplate.ts`
- Delete: `client/src/utils/pdfFonts.ts`
- Modify: `client/package.json`

**Step 1: Verify no remaining imports of pdfTemplate.ts or pdfFonts.ts**

```bash
cd client && grep -r "pdfTemplate\|pdfFonts" src/ --include="*.ts" --include="*.vue" -l
```

Should return zero results (or only pdfmakeRenderer.ts if it re-exports).

**Step 2: Remove jsPDF dependency**

```bash
cd client && npm uninstall jspdf
```

**Step 3: Delete old files**

```bash
rm client/src/utils/pdfTemplate.ts client/src/utils/pdfFonts.ts
```

**Step 4: Verify compilation**

```bash
cd client && npx vue-tsc --noEmit
```

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove jsPDF and old PDF template files"
```

---

### Task 8: Manual testing

**Test checklist:**
- [ ] Export PDF from a dossier with notes, folders, nested content
- [ ] Verify NotoSans font renders correctly (accents: é, è, ê, ë, à, ç, ù)
- [ ] Verify headings with background colors and borders
- [ ] Verify bullet lists and numbered lists (nested)
- [ ] Verify blockquotes (left border, italic)
- [ ] Verify code blocks (gray background, monospace)
- [ ] Verify tables (header row styled, alternating rows)
- [ ] Verify images from web clipper appear
- [ ] Verify long URLs wrap correctly
- [ ] Verify TOC when checkbox is checked
- [ ] Verify section numbering (1., 1.1, 1.1.1)
- [ ] Verify header logos and footer pagination
- [ ] Verify signature block with city
- [ ] Verify ProfileTemplate preview still works
- [ ] Verify AI report PDF export still works
- [ ] Verify DOCX export still works (untouched)
