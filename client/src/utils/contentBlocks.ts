// ── Types ───────────────────────────────────────────────────────────

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

interface TextBlock {
  type: 'text';
  text: string;
  marks: InlineMark;
}

interface ParagraphBlock {
  type: 'paragraph';
  align?: string;
  children: ContentBlock[];
}

interface HeadingBlock {
  type: 'heading';
  level: number;
  children: ContentBlock[];
}

interface BulletListBlock {
  type: 'bulletList';
  items: ContentBlock[][];
}

interface OrderedListBlock {
  type: 'orderedList';
  start?: number;
  items: ContentBlock[][];
}

interface BlockquoteBlock {
  type: 'blockquote';
  children: ContentBlock[];
}

interface CodeBlockBlock {
  type: 'codeBlock';
  language?: string;
  text: string;
}

interface TableBlock {
  type: 'table';
  rows: ContentBlock[][][];
}

interface ImageBlock {
  type: 'image';
  src: string;
  alt?: string;
  width?: number;
  height?: number;
}

interface HardBreakBlock {
  type: 'hardBreak';
}

export type ContentBlock =
  | TextBlock
  | ParagraphBlock
  | HeadingBlock
  | BulletListBlock
  | OrderedListBlock
  | BlockquoteBlock
  | CodeBlockBlock
  | TableBlock
  | ImageBlock
  | HardBreakBlock;

// ── TipTap JSON types (internal) ────────────────────────────────────

interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: TipTapMark[];
  attrs?: Record<string, unknown>;
}

// ── Converter ───────────────────────────────────────────────────────

function parseMarks(marks?: TipTapMark[]): InlineMark {
  const result: InlineMark = {};
  if (!marks) return result;

  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        result.bold = true;
        break;
      case 'italic':
        result.italic = true;
        break;
      case 'underline':
        result.underline = true;
        break;
      case 'strike':
        result.strike = true;
        break;
      case 'code':
        result.code = true;
        break;
      case 'textStyle':
        if (mark.attrs?.color) {
          result.color = String(mark.attrs.color);
        }
        break;
      case 'highlight':
        result.highlight = mark.attrs?.color ? String(mark.attrs.color) : '#ffff00';
        break;
      case 'link':
        if (mark.attrs?.href) {
          result.link = String(mark.attrs.href);
        }
        break;
    }
  }

  return result;
}

function convertNode(node: TipTapNode): ContentBlock | null {
  switch (node.type) {
    case 'text':
      return {
        type: 'text',
        text: node.text ?? '',
        marks: parseMarks(node.marks),
      };

    case 'paragraph':
      return {
        type: 'paragraph',
        align: node.attrs?.textAlign ? String(node.attrs.textAlign) : undefined,
        children: convertNodes(node.content),
      };

    case 'heading':
      return {
        type: 'heading',
        level: Number(node.attrs?.level ?? 1),
        children: convertNodes(node.content),
      };

    case 'bulletList':
      return {
        type: 'bulletList',
        items: extractListItems(node.content),
      };

    case 'orderedList':
      return {
        type: 'orderedList',
        start: node.attrs?.start != null ? Number(node.attrs.start) : undefined,
        items: extractListItems(node.content),
      };

    case 'listItem': {
      // listItems should be handled by extractListItems, but if encountered
      // standalone, wrap children as a paragraph
      const children = convertNodes(node.content);
      if (children.length === 0) return null;
      return {
        type: 'paragraph',
        children,
      };
    }

    case 'blockquote':
      return {
        type: 'blockquote',
        children: convertNodes(node.content),
      };

    case 'codeBlock':
      return {
        type: 'codeBlock',
        language: node.attrs?.language ? String(node.attrs.language) : undefined,
        text: extractPlainTextFromNodes(node.content),
      };

    case 'table':
      return {
        type: 'table',
        rows: extractTableRows(node.content),
      };

    case 'tableRow':
    case 'tableCell':
    case 'tableHeader': {
      // These should be handled by extractTableRows; if encountered standalone,
      // try to convert children
      const children = convertNodes(node.content);
      if (children.length === 0) return null;
      return { type: 'paragraph', children };
    }

    case 'image':
      return {
        type: 'image',
        src: String(node.attrs?.src ?? ''),
        alt: node.attrs?.alt ? String(node.attrs.alt) : undefined,
        width: node.attrs?.width != null ? Number(node.attrs.width) : undefined,
        height: node.attrs?.height != null ? Number(node.attrs.height) : undefined,
      };

    case 'hardBreak':
      return { type: 'hardBreak' };

    case 'doc':
      // doc is the root wrapper — flatten its children
      return null; // handled separately in convertTipTapToBlocks

    default: {
      // Unknown node: try to convert children, skip if empty
      const fallback = convertNodes(node.content);
      if (fallback.length === 0) return null;
      if (fallback.length === 1) return fallback[0];
      return { type: 'paragraph', children: fallback };
    }
  }
}

function convertNodes(nodes?: TipTapNode[]): ContentBlock[] {
  if (!nodes) return [];
  const result: ContentBlock[] = [];
  for (const node of nodes) {
    const block = convertNode(node);
    if (block) result.push(block);
  }
  return result;
}

function extractListItems(nodes?: TipTapNode[]): ContentBlock[][] {
  if (!nodes) return [];
  const items: ContentBlock[][] = [];

  for (const node of nodes) {
    if (node.type === 'listItem') {
      items.push(convertNodes(node.content));
    }
  }

  return items;
}

function extractTableRows(nodes?: TipTapNode[]): ContentBlock[][][] {
  if (!nodes) return [];
  const rows: ContentBlock[][][] = [];

  for (const node of nodes) {
    if (node.type === 'tableRow') {
      const cells: ContentBlock[][] = [];
      if (node.content) {
        for (const cellNode of node.content) {
          if (cellNode.type === 'tableCell' || cellNode.type === 'tableHeader') {
            cells.push(convertNodes(cellNode.content));
          }
        }
      }
      rows.push(cells);
    }
  }

  return rows;
}

function extractPlainTextFromNodes(nodes?: TipTapNode[]): string {
  if (!nodes) return '';
  let text = '';
  for (const node of nodes) {
    if (node.type === 'text') {
      text += node.text ?? '';
    } else if (node.type === 'hardBreak') {
      text += '\n';
    } else if (node.content) {
      text += extractPlainTextFromNodes(node.content);
    }
  }
  return text;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Convert TipTap JSON (doc node or raw content array) into a flat
 * array of ContentBlocks preserving all formatting information.
 */
export function convertTipTapToBlocks(json: unknown): ContentBlock[] {
  if (!json || typeof json !== 'object') return [];

  const doc = json as TipTapNode;

  // Accept both { type: 'doc', content: [...] } and raw arrays
  if (doc.type === 'doc') {
    return convertNodes(doc.content);
  }

  // If it's an array, treat as content nodes directly
  if (Array.isArray(json)) {
    return convertNodes(json as TipTapNode[]);
  }

  // Single node
  const block = convertNode(doc);
  return block ? [block] : [];
}

/**
 * Extract plain text from a ContentBlock array.
 * Useful for TOC generation, table cell text, and fallbacks.
 *
 * Inline blocks (text, hardBreak) within a parent are joined without
 * extra newlines; only block-level elements produce newline separators.
 */
export function blocksToPlainText(blocks: ContentBlock[]): string {
  if (!blocks || !Array.isArray(blocks)) return '';

  const parts: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'text':
        // Inline: append to last part if previous was also inline
        if (parts.length > 0) {
          parts[parts.length - 1] += block.text;
        } else {
          parts.push(block.text);
        }
        continue;

      case 'hardBreak':
        // Inline line break within a paragraph
        if (parts.length > 0) {
          parts[parts.length - 1] += '\n';
        } else {
          parts.push('\n');
        }
        continue;

      case 'paragraph':
        parts.push(blocksToPlainText(block.children));
        break;

      case 'heading':
        parts.push(blocksToPlainText(block.children));
        break;

      case 'bulletList':
      case 'orderedList':
        for (const item of block.items) {
          parts.push(blocksToPlainText(item));
        }
        break;

      case 'blockquote':
        parts.push(blocksToPlainText(block.children));
        break;

      case 'codeBlock':
        parts.push(block.text);
        break;

      case 'table':
        for (const row of block.rows) {
          const cellTexts = row.map(cell => blocksToPlainText(cell));
          parts.push(cellTexts.join('\t'));
        }
        break;

      case 'image':
        if (block.alt) parts.push(block.alt);
        break;
    }
  }

  return parts.join('\n');
}
