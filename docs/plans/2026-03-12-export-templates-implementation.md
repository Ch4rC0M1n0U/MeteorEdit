# Export Templates Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the PDF/DOCX export system with full TipTap content fidelity, Unicode font support, table of contents, section numbering, and configurable closing block.

**Architecture:** Refonte progressive du systeme existant. Nouveau convertisseur TipTap → ContentBlock[] partage entre PDF et DOCX. PdfBuilder enrichi avec font embedding Noto Sans + nouvelles methodes de rendu. DOCX enrichi via primitives docx.js natives. Double-pass PDF pour la TOC.

**Tech Stack:** jsPDF 4.2, docx 9.6, Vue 3, TypeScript, Noto Sans TTF fonts

**Design doc:** `docs/plans/2026-03-12-export-templates-design.md`

---

### Task 1: ContentBlocks Converter

Create the shared TipTap JSON → ContentBlock[] converter used by both PDF and DOCX exports.

**Files:**
- Create: `client/src/utils/contentBlocks.ts`

**Context:**
- Currently `extractContentBlocks()` in `client/src/utils/pdfTemplate.ts` (lines 444-476) only returns `{type:'text'}` and `{type:'image'}` — it loses all formatting.
- TipTap JSON structure: `{ type: 'doc', content: [ { type: 'paragraph', content: [ { type: 'text', text: '...', marks: [...] } ] } ] }`
- Marks are arrays: `[{ type: 'bold' }, { type: 'textStyle', attrs: { color: '#ff0000' } }, { type: 'link', attrs: { href: '...' } }]`

**Step 1: Create `client/src/utils/contentBlocks.ts`**

```typescript
// ── Types ────────────────────────────────────────────────────────

export interface InlineMark {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  color?: string;
  highlight?: string;
  link?: string;
}

export type ContentBlock =
  | { type: 'text'; text: string; marks: InlineMark }
  | { type: 'paragraph'; children: ContentBlock[]; align?: string }
  | { type: 'heading'; level: number; children: ContentBlock[] }
  | { type: 'bulletList'; items: ContentBlock[][] }
  | { type: 'orderedList'; items: ContentBlock[][]; start?: number }
  | { type: 'blockquote'; children: ContentBlock[] }
  | { type: 'codeBlock'; text: string; language?: string }
  | { type: 'table'; rows: ContentBlock[][][] }
  | { type: 'image'; src: string; alt?: string; width?: number; height?: number }
  | { type: 'hardBreak' };

// ── Mark extraction ──────────────────────────────────────────────

function extractMarks(marks?: any[]): InlineMark {
  const m: InlineMark = {};
  if (!marks) return m;
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold': m.bold = true; break;
      case 'italic': m.italic = true; break;
      case 'underline': m.underline = true; break;
      case 'strike': m.strike = true; break;
      case 'code': m.code = true; break;
      case 'textStyle':
        if (mark.attrs?.color) m.color = mark.attrs.color;
        break;
      case 'highlight':
        m.highlight = mark.attrs?.color || '#ffff00';
        break;
      case 'link':
        if (mark.attrs?.href) m.link = mark.attrs.href;
        break;
    }
  }
  return m;
}

// ── Node conversion ──────────────────────────────────────────────

function convertNode(node: any): ContentBlock | null {
  if (!node || !node.type) return null;

  switch (node.type) {
    case 'text':
      return { type: 'text', text: node.text || '', marks: extractMarks(node.marks) };

    case 'hardBreak':
      return { type: 'hardBreak' };

    case 'paragraph':
      return {
        type: 'paragraph',
        children: convertChildren(node.content),
        align: node.attrs?.textAlign || undefined,
      };

    case 'heading':
      return {
        type: 'heading',
        level: node.attrs?.level || 1,
        children: convertChildren(node.content),
      };

    case 'bulletList':
      return {
        type: 'bulletList',
        items: (node.content || []).map((li: any) => convertListItem(li)),
      };

    case 'orderedList':
      return {
        type: 'orderedList',
        items: (node.content || []).map((li: any) => convertListItem(li)),
        start: node.attrs?.start || 1,
      };

    case 'blockquote':
      return {
        type: 'blockquote',
        children: convertChildren(node.content),
      };

    case 'codeBlock':
      return {
        type: 'codeBlock',
        text: (node.content || []).map((c: any) => c.text || '').join(''),
        language: node.attrs?.language || undefined,
      };

    case 'table':
      return {
        type: 'table',
        rows: (node.content || []).map((row: any) =>
          (row.content || []).map((cell: any) => convertChildren(cell.content))
        ),
      };

    case 'image':
      return {
        type: 'image',
        src: node.attrs?.src || '',
        alt: node.attrs?.alt || undefined,
        width: node.attrs?.width || undefined,
        height: node.attrs?.height || undefined,
      };

    // Skip unknown node types, try to convert children
    default:
      if (node.content) {
        const children = convertChildren(node.content);
        if (children.length === 1) return children[0];
        if (children.length > 1) return { type: 'paragraph', children };
      }
      return null;
  }
}

function convertListItem(li: any): ContentBlock[] {
  // listItem nodes contain block-level children (paragraphs, nested lists, etc.)
  return convertChildren(li.content || (li.type === 'listItem' ? li.content : [li]));
}

function convertChildren(content: any[]): ContentBlock[] {
  if (!content) return [];
  const blocks: ContentBlock[] = [];
  for (const node of content) {
    const block = convertNode(node);
    if (block) blocks.push(block);
  }
  return blocks;
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Convert TipTap JSON document to ContentBlock array.
 * Accepts either a full doc node or a content array.
 */
export function convertTipTapToBlocks(json: any): ContentBlock[] {
  if (!json) return [];
  if (json.type === 'doc' && json.content) {
    return convertChildren(json.content);
  }
  if (Array.isArray(json)) {
    return convertChildren(json);
  }
  if (json.content) {
    return convertChildren(json.content);
  }
  const single = convertNode(json);
  return single ? [single] : [];
}

/**
 * Extract plain text from ContentBlock array (for TOC, fallback, etc.)
 */
export function blocksToPlainText(blocks: ContentBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'text': parts.push(b.text); break;
      case 'hardBreak': parts.push('\n'); break;
      case 'paragraph':
      case 'heading':
      case 'blockquote':
        parts.push(blocksToPlainText(b.children));
        parts.push('\n');
        break;
      case 'bulletList':
      case 'orderedList':
        for (const item of b.items) parts.push(blocksToPlainText(item) + '\n');
        break;
      case 'codeBlock': parts.push(b.text + '\n'); break;
      case 'image': if (b.alt) parts.push(`[${b.alt}]`); break;
      case 'table':
        for (const row of b.rows)
          for (const cell of row)
            parts.push(blocksToPlainText(cell) + '\t');
        parts.push('\n');
        break;
    }
  }
  return parts.join('').trim();
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd client && npx vue-tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add client/src/utils/contentBlocks.ts
git commit -m "feat(export): add TipTap to ContentBlock converter"
```

---

### Task 2: Noto Sans Font Embedding

Download Noto Sans TTF files and create a lazy-loading font module for jsPDF.

**Files:**
- Create: `client/src/assets/fonts/` directory
- Create: `client/src/utils/pdfFonts.ts` (font loader module)

**Context:**
- jsPDF 4.x supports custom fonts via `doc.addFileToVFS(filename, base64)` + `doc.addFont(filename, fontName, style)`
- We need Regular, Bold, Italic variants of Noto Sans (latin-extended subset)
- Fonts must be base64-encoded and lazy-loaded (not in initial bundle)
- Download from Google Fonts: https://fonts.google.com/noto/specimen/Noto+Sans
- Subset to latin + latin-extended (~100-150kb per variant instead of 500kb+)

**Step 1: Download and prepare font files**

Download Noto Sans from Google Fonts (Regular, Bold, Italic TTF files). Place them in:
- `client/src/assets/fonts/NotoSans-Regular.ttf`
- `client/src/assets/fonts/NotoSans-Bold.ttf`
- `client/src/assets/fonts/NotoSans-Italic.ttf`

Use a font subsetting tool (e.g. `pyftsubset` or glyphanger) to keep only Latin + Latin Extended glyphs if desired, or use full files (~300kb each).

**Step 2: Create font loader `client/src/utils/pdfFonts.ts`**

```typescript
import type { jsPDF } from 'jspdf';

let fontsLoaded = false;
let fontDataCache: { regular: string; bold: string; italic: string } | null = null;

/**
 * Lazy-load Noto Sans fonts and register them with jsPDF.
 * Fonts are fetched once and cached in memory.
 */
export async function registerNotoSans(doc: jsPDF): Promise<void> {
  if (!fontDataCache) {
    const [regular, bold, italic] = await Promise.all([
      fetchFontAsBase64(new URL('../assets/fonts/NotoSans-Regular.ttf', import.meta.url).href),
      fetchFontAsBase64(new URL('../assets/fonts/NotoSans-Bold.ttf', import.meta.url).href),
      fetchFontAsBase64(new URL('../assets/fonts/NotoSans-Italic.ttf', import.meta.url).href),
    ]);
    fontDataCache = { regular, bold, italic };
  }

  if (!fontsLoaded || !doc.getFontList()['NotoSans']) {
    doc.addFileToVFS('NotoSans-Regular.ttf', fontDataCache.regular);
    doc.addFileToVFS('NotoSans-Bold.ttf', fontDataCache.bold);
    doc.addFileToVFS('NotoSans-Italic.ttf', fontDataCache.italic);
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
    doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
    doc.addFont('NotoSans-Italic.ttf', 'NotoSans', 'italic');
    fontsLoaded = true;
  }
}

async function fetchFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const PDF_FONT = 'NotoSans';
```

**Step 3: Verify TypeScript compiles**

Run: `cd client && npx vue-tsc --noEmit`
Expected: No errors (the .ttf files are handled by Vite's asset pipeline)

**Step 4: Commit**

```bash
git add client/src/assets/fonts/ client/src/utils/pdfFonts.ts
git commit -m "feat(export): add Noto Sans font embedding for PDF Unicode support"
```

---

### Task 3: PdfBuilder Refactor — Font Integration + Remove sanitizeForPdf

Integrate Noto Sans into the PdfBuilder and remove the accent-stripping sanitizer.

**Files:**
- Modify: `client/src/utils/pdfTemplate.ts`

**Context:**
- Current `FONT_MAP` (line ~202-209) maps FontFamily → jsPDF built-in fonts (helvetica, times)
- `sanitizeForPdf()` (lines ~422-440) strips accents and Unicode chars — must be removed
- `createPdfBuilder()` (line ~211) is the factory function
- The builder must `await registerNotoSans(doc)` before any text rendering
- All `doc.setFont(pdfFont, ...)` calls must use `'NotoSans'` instead of mapped fonts

**Step 1: Update pdfTemplate.ts**

Changes needed:
1. Import `registerNotoSans, PDF_FONT` from `./pdfFonts`
2. Make `createPdfBuilder()` async — returns `Promise<PdfBuilder>`
3. Call `await registerNotoSans(doc)` inside createPdfBuilder before returning
4. Replace all `doc.setFont(pdfFont, ...)` with `doc.setFont(PDF_FONT, ...)`
5. Remove the `FONT_MAP` constant and `pdfFont` variable
6. Remove `sanitizeForPdf()` function entirely
7. Remove `export { sanitizeForPdf }` if present
8. Keep a minimal `cleanControlChars(text)` that only removes zero-width chars and control characters:
   ```typescript
   function cleanControlChars(text: string): string {
     return text.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u0000-\u001F]/g, '');
   }
   ```
9. Update all places that called `sanitizeForPdf(text)` to use `cleanControlChars(text)` instead

**Step 2: Verify TypeScript compiles**

Run: `cd client && npx vue-tsc --noEmit`
Expected: No errors. If DossierView.vue imports sanitizeForPdf, it will fail — update those imports too (replace with cleanControlChars export or remove the sanitize calls since cleanControlChars is internal).

**Step 3: Commit**

```bash
git add client/src/utils/pdfTemplate.ts client/src/components/dossier/DossierView.vue
git commit -m "feat(export): integrate Noto Sans font, remove accent sanitizer"
```

---

### Task 4: PdfBuilder — Rich Text Rendering (addRichText)

Add the ability to render paragraphs with inline marks (bold, italic, underline, strike, color, highlight).

**Files:**
- Modify: `client/src/utils/pdfTemplate.ts`

**Context:**
- jsPDF cannot render mixed styles in a single `doc.text()` call
- Strategy: split text into segments, measure each with `doc.getTextWidth()`, position sequentially
- Each segment sets its own font style and color before rendering
- Line wrapping must handle mid-line style changes
- Import `ContentBlock, InlineMark` from `./contentBlocks`

**Step 1: Add `addRichText` method to PdfBuilder**

The method receives `children: ContentBlock[]` (array of `text` and `hardBreak` blocks) and an optional `align`.

Algorithm:
1. Flatten children into segments: `{ text, marks, width }[]`
2. Word-wrap: iterate segments, split by words, accumulate line width, break when exceeding `usableW`
3. Render line by line: for each segment in line, set font/color, draw text at current X, advance X by width
4. Handle highlight: draw filled rect behind text segment
5. Handle underline/strike: draw line below/through text segment
6. Handle link: same as underline but in blue color

This is the most complex method. Key sub-functions:
- `measureSegment(text, marks)` — sets font style, returns `doc.getTextWidth(text)`
- `renderSegment(text, marks, x, baseline)` — renders one styled text chunk
- `wrapRichLine(segments)` — returns lines of segments that fit within usableW

**Step 2: Verify TypeScript compiles**

Run: `cd client && npx vue-tsc --noEmit`

**Step 3: Commit**

```bash
git add client/src/utils/pdfTemplate.ts
git commit -m "feat(export): add rich text rendering with inline marks to PdfBuilder"
```

---

### Task 5: PdfBuilder — Lists, Blockquotes, Code Blocks

Add `addList`, `addBlockquote`, `addCodeBlock` methods.

**Files:**
- Modify: `client/src/utils/pdfTemplate.ts`

**Context:**
- Lists: indentation +8mm per nesting level, bullet char "•" for unordered, "1." for ordered
- Each list item can contain rich text (use `addRichText` internally)
- Nested lists: recursive — a list item can contain a bulletList/orderedList ContentBlock
- Blockquote: left offset 10mm, left border 0.5mm wide in `tpl.header.lineColor`, italic body text
- Code block: Courier font, background #f5f5f5, padding 3mm, font size = body.fontSize - 1

**Step 1: Implement the three methods**

`addList(items: ContentBlock[][], ordered: boolean, level = 0, startNum = 1)`:
- For each item in items:
  - Calculate indent = margin + (level * 8)
  - Draw bullet/number at indent
  - Render item content (may contain paragraphs, rich text, nested lists)
  - If item contains a nested list block, recurse with level+1

`addBlockquote(children: ContentBlock[])`:
- Save current margin, increase left margin by 10mm
- Draw vertical border line at new margin - 3mm
- Render children with italic style override
- Restore margin

`addCodeBlock(text: string)`:
- Draw background rect #f5f5f5 with 3mm padding
- Set Courier font, size body.fontSize - 1
- Render text lines (split by \n)
- Restore font

**Step 2: Verify TypeScript compiles**

Run: `cd client && npx vue-tsc --noEmit`

**Step 3: Commit**

```bash
git add client/src/utils/pdfTemplate.ts
git commit -m "feat(export): add lists, blockquotes, code blocks to PdfBuilder"
```

---

### Task 6: PdfBuilder — Table Rendering

Add `addTable` method for inline tables from TipTap content.

**Files:**
- Modify: `client/src/utils/pdfTemplate.ts`

**Context:**
- Table data: `rows: ContentBlock[][][]` (rows → cells → content blocks)
- First row treated as header (styled with `tpl.table.headerBgColor`, `tpl.table.headerTextColor`)
- Remaining rows alternate with `tpl.table.alternateRowColor`
- Column widths: divide `usableW` equally, or proportional to content length
- Cell content: render as plain text (simplified — no rich text inside cells for now, extract plain text)
- Use `blocksToPlainText()` from contentBlocks.ts to get cell text
- Word-wrap within cells using `doc.splitTextToSize(text, colWidth - padding)`
- Row height = max cell height in that row
- Borders with `tpl.table.borderColor` and `tpl.table.borderWidth`

**Step 1: Implement `addTable` method**

Algorithm:
1. Calculate column count from first row
2. Column widths = usableW / colCount (equal distribution)
3. For each row:
   a. For each cell: get plain text, split to size, calculate required height
   b. Row height = max of all cells
   c. Check page break (if row doesn't fit, new page)
   d. Draw cell backgrounds (header color or alternate row)
   e. Draw cell text
   f. Draw cell borders
   g. Advance y by row height

**Step 2: Verify TypeScript compiles**

Run: `cd client && npx vue-tsc --noEmit`

**Step 3: Commit**

```bash
git add client/src/utils/pdfTemplate.ts
git commit -m "feat(export): add table rendering to PdfBuilder"
```

---

### Task 7: PdfBuilder — renderBlocks Orchestrator

Add the `renderBlocks` dispatcher that routes ContentBlock[] to the appropriate rendering method.

**Files:**
- Modify: `client/src/utils/pdfTemplate.ts`

**Context:**
- This is the main entry point used by DossierView's tree walker
- It replaces the old pattern of calling `addBody(text)` for each paragraph
- Must handle all ContentBlock types and dispatch to the right method

**Step 1: Implement `renderBlocks` method**

```typescript
renderBlocks(blocks: ContentBlock[]) {
  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
        this.addRichText(block.children, block.align);
        break;
      case 'heading':
        // Headings inside note content — render as sub-headings (bold text, not structural h1/h2/h3)
        this.addRichText(block.children);
        break;
      case 'bulletList':
        this.addList(block.items, false);
        break;
      case 'orderedList':
        this.addList(block.items, true, 0, block.start || 1);
        break;
      case 'blockquote':
        this.addBlockquote(block.children);
        break;
      case 'codeBlock':
        this.addCodeBlock(block.text);
        break;
      case 'table':
        this.addTable(block.rows);
        break;
      case 'image':
        // Load image and render inline — reuse existing addInlineImage logic
        // This needs async handling — store pending images or handle synchronously
        break;
      case 'text':
        // Standalone text (shouldn't happen at top level, but handle gracefully)
        this.addBody(block.text);
        break;
      case 'hardBreak':
        this.y += 2;
        break;
    }
  }
}
```

Note: Image handling inside renderBlocks needs to be async. Make `renderBlocks` async and await image loading. Update the method signature to `async renderBlocks(blocks: ContentBlock[]): Promise<void>`.

**Step 2: Add `renderBlocks` to the PdfBuilder interface type (line ~178)**

**Step 3: Verify TypeScript compiles**

Run: `cd client && npx vue-tsc --noEmit`

**Step 4: Commit**

```bash
git add client/src/utils/pdfTemplate.ts
git commit -m "feat(export): add renderBlocks orchestrator to PdfBuilder"
```

---

### Task 8: DOCX — Rich Content Rendering

Update docxTemplate.ts to render all ContentBlock types using docx.js primitives.

**Files:**
- Modify: `client/src/utils/docxTemplate.ts`

**Context:**
- Currently sections have `paragraphs: string[]` and optional `content: DocxContentItem[]`
- Replace with `blocks: ContentBlock[]` from the new converter
- docx.js has native support for: `TextRun` (with bold/italic/underline/strike/color/highlight), `Table`/`TableRow`/`TableCell`, `NumberingReference` for lists, `Paragraph` with indent for blockquotes

**Step 1: Add block rendering functions**

New functions to add:
- `renderBlocksToDocx(blocks: ContentBlock[], tpl): Paragraph[]` — orchestrator, returns Paragraph array
- `richTextRuns(children: ContentBlock[], tpl): TextRun[]` — converts inline content to TextRun array with marks
- `listParagraphs(items: ContentBlock[][], tpl, ordered, level): Paragraph[]` — renders list items
- `blockquoteParagraphs(children: ContentBlock[], tpl): Paragraph[]` — indented + bordered paragraphs
- `codeBlockParagraph(text: string, tpl): Paragraph` — monospace + shading
- `tableElement(rows: ContentBlock[][][], tpl): Table` — full docx Table

For lists, docx.js requires:
- Define `AbstractNumbering` and `Numbering` in document config
- Reference via `numbering: { reference: 'bullets', level: N }` on Paragraph

**Step 2: Update `DocxExportData` interface**

Replace the `sections` type:
```typescript
sections: Array<{
  title: string;
  level: 'h1' | 'h2' | 'h3';
  blocks: ContentBlock[];  // NEW — replaces paragraphs/bullets/content
}>;
```

Remove `paragraphs`, `bullets`, `content` fields.

**Step 3: Update `generateDocx` to use `renderBlocksToDocx`**

In the content sections loop, replace the old paragraph/content rendering with:
```typescript
const rendered = renderBlocksToDocx(section.blocks, tpl);
docChildren.push(...rendered);
```

**Step 4: Add numbering definitions to Document config**

```typescript
const doc = new Document({
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', ... }] },
      { reference: 'ordered', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', ... }] },
    ],
  },
  sections: [{ ... }],
});
```

**Step 5: Verify TypeScript compiles**

Run: `cd client && npx vue-tsc --noEmit`

**Step 6: Commit**

```bash
git add client/src/utils/docxTemplate.ts
git commit -m "feat(export): add rich content rendering to DOCX generator"
```

---

### Task 9: Section Numbering

Add section numbering counter to the tree walkers.

**Files:**
- Modify: `client/src/components/dossier/DossierView.vue`

**Context:**
- Tree walkers: `walkTreePdf()` (~line 1417) and `walkTreeDocx()` (~line 1521)
- Counter: `[h1Count, h2Count, h3Count]` — reset lower levels when higher increments
- Number prefixed to title: "1.1 Compte Instagram"
- Counter is passed through recursive calls and mutated

**Step 1: Create numbering utility**

Add at top of export section in DossierView.vue:
```typescript
type SectionCounter = [number, number, number];

function nextSectionNumber(counter: SectionCounter, level: 'h1' | 'h2' | 'h3'): string {
  if (level === 'h1') {
    counter[0]++;
    counter[1] = 0;
    counter[2] = 0;
    return `${counter[0]}.`;
  } else if (level === 'h2') {
    counter[1]++;
    counter[2] = 0;
    return `${counter[0]}.${counter[1]}`;
  } else {
    counter[2]++;
    return `${counter[0]}.${counter[1]}.${counter[2]}`;
  }
}
```

**Step 2: Update walkTreePdf and walkTreeDocx**

Add `counter: SectionCounter` parameter to both functions. Before `addHeading(title, level)`, prefix the title:
```typescript
const num = nextSectionNumber(counter, hl);
b.addHeading(`${num} ${node.title}`, hl);
```

Pass counter through recursive calls (same array reference, so mutations propagate).

**Step 3: Update callers in exportPDF and exportDOCX**

Initialize counter as `[0, 0, 0]` and pass to walkTree calls.

**Step 4: Verify TypeScript compiles**

Run: `cd client && npx vue-tsc --noEmit`

**Step 5: Commit**

```bash
git add client/src/components/dossier/DossierView.vue
git commit -m "feat(export): add section numbering to PDF and DOCX exports"
```

---

### Task 10: Table of Contents — PDF

Implement double-pass TOC generation for PDF export.

**Files:**
- Modify: `client/src/utils/pdfTemplate.ts` (add TOC rendering method)
- Modify: `client/src/components/dossier/DossierView.vue` (double-pass logic)

**Context:**
- During tree walk, collect TOC entries: `{ title: string, level: 'h1'|'h2'|'h3', sectionNumber: string, pageNumber: number }`
- After first pass: we know all entries + page numbers
- Calculate how many pages the TOC itself will take
- Add that offset to all collected page numbers
- Rebuild PDF: TOC first, then content

**Step 1: Add TOC entry collection to PdfBuilder**

Add to builder:
```typescript
tocEntries: { title: string; level: string; number: string; page: number }[];
```

Modify `addHeading` to optionally record TOC entries (when a `sectionNumber` is provided).

**Step 2: Add `renderTOC` method to PdfBuilder**

```typescript
renderTOC(entries: TocEntry[], pageOffset: number) {
  this.addHeading('Table des matieres', 'h1'); // no numbering
  for (const entry of entries) {
    const indent = entry.level === 'h1' ? 0 : entry.level === 'h2' ? 8 : 16;
    const isBold = entry.level === 'h1';
    const text = `${entry.number} ${entry.title}`;
    const pageNum = String(entry.page + pageOffset);
    // Render: text on left (with indent), dots, page number on right
    // Use getTextWidth to calculate dot leader
  }
}
```

**Step 3: Implement double-pass in exportPDF**

```
Pass 1: Generate full PDF content, collect TOC entries with page numbers
Pass 2: Calculate TOC page count, create new PDF with TOC + content (offset pages)
```

In practice:
1. First pass: build content normally, collect tocEntries from builder
2. Create temp builder just for TOC, render it, count pages used
3. Create final builder: render TOC first, then render content again
4. The page numbers collected in pass 1 are offset by tocPageCount

This is expensive (double rendering) but correct. Alternative: estimate TOC size and leave blank pages — less precise.

**Step 4: Verify TypeScript compiles**

Run: `cd client && npx vue-tsc --noEmit`

**Step 5: Commit**

```bash
git add client/src/utils/pdfTemplate.ts client/src/components/dossier/DossierView.vue
git commit -m "feat(export): add table of contents to PDF export"
```

---

### Task 11: Table of Contents — DOCX + Export Dialog Checkbox

Add native TOC field to DOCX and a checkbox in ExportSelectDialog.

**Files:**
- Modify: `client/src/utils/docxTemplate.ts`
- Modify: `client/src/components/dossier/ExportSelectDialog.vue`
- Modify: `client/src/components/dossier/DossierView.vue`

**Context:**
- docx.js supports `TableOfContents` element: Word auto-generates TOC on open
- ExportSelectDialog emits `@export` with `{ format, selectedIds }` — add `includeToc: boolean`
- Add i18n keys for TOC checkbox label in all 3 locale files

**Step 1: Add TOC to DOCX**

In `generateDocx()`, if `data.includeToc` is true, insert before content sections:
```typescript
import { TableOfContents } from 'docx';

if (data.includeToc) {
  docChildren.push(new TableOfContents('Table des matieres', {
    hyperlink: true,
    headingStyleRange: '1-3',
  }));
}
```

Add `includeToc: boolean` to `DocxExportData` interface.

**Step 2: Add checkbox to ExportSelectDialog**

Add a `v-checkbox` or toggle above the export buttons:
```vue
<v-checkbox v-model="includeToc" :label="$t('dossier.includeToc')" density="compact" />
```

Update the `$emit('export', ...)` to include `includeToc`.

**Step 3: Add i18n keys**

In `client/src/i18n/locales/fr.json`, `en.json`, `nl.json`:
```json
"dossier": {
  "includeToc": "Inclure la table des matières" / "Include table of contents" / "Inhoudsopgave opnemen"
}
```

**Step 4: Update DossierView.vue**

`handleSelectiveExport` receives includeToc and passes it to export functions.

**Step 5: Verify TypeScript compiles**

Run: `cd client && npx vue-tsc --noEmit`

**Step 6: Commit**

```bash
git add client/src/utils/docxTemplate.ts client/src/components/dossier/ExportSelectDialog.vue client/src/components/dossier/DossierView.vue client/src/i18n/locales/
git commit -m "feat(export): add TOC to DOCX and checkbox in export dialog"
```

---

### Task 12: DossierView Integration — Wire Up New Converter

Replace old content extraction with new ContentBlock converter in tree walkers.

**Files:**
- Modify: `client/src/components/dossier/DossierView.vue`

**Context:**
- Currently `walkTreePdf` calls `extractContentBlocks()` and manually renders text/images
- Replace with `convertTipTapToBlocks()` + `builder.renderBlocks(blocks)`
- Similarly for `walkTreeDocx`: replace content extraction with `convertTipTapToBlocks()`
- Remove old `extractContentBlocks` import from pdfTemplate.ts
- Import `convertTipTapToBlocks` from contentBlocks.ts

**Step 1: Update walkTreePdf**

Replace the note content rendering section:
```typescript
// OLD:
// const blocks = extractContentBlocks(node.content);
// for (const block of blocks) { if block.type === 'text' ... }

// NEW:
import { convertTipTapToBlocks } from '@/utils/contentBlocks';

const blocks = convertTipTapToBlocks(node.content);
await b.renderBlocks(blocks);
```

**Step 2: Update walkTreeDocx**

Replace content extraction:
```typescript
// OLD:
// content: DocxContentItem[] from manual extraction

// NEW:
const blocks = convertTipTapToBlocks(node.content);
sections.push({ title: node.title, level: hl, blocks });
```

**Step 3: Update buildDocxSections similarly**

**Step 4: Remove `extractContentBlocks` from pdfTemplate.ts if no longer used elsewhere**

**Step 5: Verify TypeScript compiles**

Run: `cd client && npx vue-tsc --noEmit`

**Step 6: Commit**

```bash
git add client/src/components/dossier/DossierView.vue client/src/utils/pdfTemplate.ts
git commit -m "feat(export): wire up ContentBlock converter in tree walkers"
```

---

### Task 13: Configurable Closing Block

Add `city` field to user signature and use it in exports.

**Files:**
- Modify: `server/src/models/User.ts`
- Modify: `client/src/components/profile/ProfileInfo.vue`
- Modify: `client/src/components/dossier/DossierView.vue`
- Modify: `client/src/utils/docxTemplate.ts`
- Modify: `client/src/i18n/locales/fr.json`, `en.json`, `nl.json`

**Context:**
- Current User schema signature: `{ title, name, service, unit, email }` in `server/src/models/User.ts`
- Signature editing UI is in `ProfileInfo.vue`
- Closing text is hardcoded: `"Bruxelles, le ${date}"` in DossierView.vue and docxTemplate.ts

**Step 1: Add `city` to User model**

In `server/src/models/User.ts`, add to signature sub-schema:
```typescript
city: { type: String, default: 'Bruxelles' },
```

**Step 2: Add city field to ProfileInfo.vue**

Add a text field in the signature section:
```vue
<v-text-field v-model="signatureForm.city" :label="$t('profile.signatureCity')" />
```

Make sure `signatureForm` includes `city` and it's sent in the PUT `/auth/signature` call.

**Step 3: Add i18n keys**

```json
"profile": {
  "signatureCity": "Ville" / "City" / "Stad"
}
```

**Step 4: Update DossierView.vue closing text**

Replace:
```typescript
// OLD: `Bruxelles, le ${date}`
// NEW:
const city = (authStore.user as any)?.signature?.city || 'Bruxelles';
const closingText = city ? `${city}, le ${date}` : date;
```

Apply in both exportPDF (addSignatureBlock) and exportDOCX (closingDate/city).

**Step 5: Update docxTemplate.ts**

Add `closingCity?: string` to DocxExportData. Use it in the closing paragraph:
```typescript
const cityText = data.closingCity || 'Bruxelles';
text: `${cityText}, le ${data.closingDate}`,
```

**Step 6: Verify TypeScript compiles**

Run: `cd client && npx vue-tsc --noEmit` and `cd server && npx tsc --noEmit`

**Step 7: Commit**

```bash
git add server/src/models/User.ts client/src/components/profile/ProfileInfo.vue client/src/components/dossier/DossierView.vue client/src/utils/docxTemplate.ts client/src/i18n/locales/
git commit -m "feat(export): add configurable closing city in signature"
```

---

### Task 14: ProfileTemplate Preview Update

Update the PDF preview in branding to demonstrate the new rendering capabilities.

**Files:**
- Modify: `client/src/components/profile/ProfileTemplate.vue`

**Context:**
- Preview is generated in the `generatePreview()` function (~line 550-596)
- Currently uses: `drawReportHeader`, `addHeading`, `addBody`
- Update to also show: a bullet list, a small table, a blockquote
- Use `renderBlocks()` with sample ContentBlock data
- Must use `await` since createPdfBuilder is now async

**Step 1: Update generatePreview()**

```typescript
async function generatePreview() {
  const b = await createPdfBuilder(tpl, { logoLeft: null, logoRight: null });
  b.drawReportHeader('Dossier Exemple', ['12/03/2026', 'Statut: En cours', 'Enqueteur: Agent Smith']);

  b.addHeading('1. Recherches en source ouverte', 'h1');
  b.addHeading('1.1 Compte Instagram', 'h2');
  b.addBody('Les recherches menees sur ce compte ont permis d\'identifier plusieurs publications.');

  // Demo: bullet list via renderBlocks
  await b.renderBlocks([
    { type: 'bulletList', items: [
      [{ type: 'text', text: 'Publication du 15 janvier 2026', marks: {} }],
      [{ type: 'text', text: 'Story archivee du 3 fevrier 2026', marks: {} }],
    ]},
  ]);

  b.addHeading('1.1.1 Analyse des publications', 'h3');
  b.addBody('Les publications identifiees couvrent la periode du 1er janvier au 15 mars 2026.');

  const blob = b.finalize();
  // ... rest of preview rendering
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd client && npx vue-tsc --noEmit`

**Step 3: Commit**

```bash
git add client/src/components/profile/ProfileTemplate.vue
git commit -m "feat(export): update PDF preview with rich content demo"
```

---

### Task 15: Final Integration Testing + Cleanup

Verify everything works together, remove dead code, check all imports.

**Files:**
- Modify: `client/src/utils/pdfTemplate.ts` (cleanup)
- Modify: `client/src/utils/docxTemplate.ts` (cleanup)
- Modify: `client/src/components/dossier/DossierView.vue` (cleanup)

**Step 1: Remove dead code**

- Remove old `extractContentBlocks()` from pdfTemplate.ts if still present
- Remove old `DocxContentItem` type from docxTemplate.ts if replaced
- Remove old `disclaimerParagraph()` from docxTemplate.ts (disclaimer was removed)
- Remove unused imports

**Step 2: Full TypeScript check**

Run: `cd client && npx vue-tsc --noEmit`
Run: `cd server && npx tsc --noEmit`

**Step 3: Manual verification checklist**

- [ ] PDF export with a dossier containing: text, images, lists, table, code block, blockquote
- [ ] DOCX export with same content
- [ ] Accents display correctly in PDF (e, a, c, etc.)
- [ ] Section numbering appears (1., 1.1, 1.1.1)
- [ ] TOC checkbox appears in export dialog
- [ ] TOC renders in PDF with correct page numbers
- [ ] DOCX opens in Word with TOC field
- [ ] Closing city from profile is used in export
- [ ] PDF preview in branding shows bullet list example
- [ ] Template customization still works (colors, fonts, margins)

**Step 4: Commit**

```bash
git add -A
git commit -m "chore(export): cleanup dead code and finalize integration"
```
