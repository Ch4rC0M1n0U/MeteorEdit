/**
 * Converts TipTap JSON content to HTML string for print rendering.
 */

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: TipTapMark[];
  attrs?: Record<string, any>;
}

interface TipTapMark {
  type: string;
  attrs?: Record<string, any>;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMarks(text: string, marks?: TipTapMark[]): string {
  if (!marks || marks.length === 0) return escapeHtml(text);

  let html = escapeHtml(text);
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        html = `<strong>${html}</strong>`;
        break;
      case 'italic':
        html = `<em>${html}</em>`;
        break;
      case 'underline':
        html = `<u>${html}</u>`;
        break;
      case 'strike':
        html = `<s>${html}</s>`;
        break;
      case 'code':
        html = `<code>${html}</code>`;
        break;
      case 'link':
        html = `<a href="${escapeHtml(mark.attrs?.href || '#')}" target="_blank">${html}</a>`;
        break;
      case 'highlight':
        html = `<mark>${html}</mark>`;
        break;
      case 'textStyle': {
        const styles: string[] = [];
        if (mark.attrs?.color) styles.push(`color: ${mark.attrs.color}`);
        if (mark.attrs?.fontSize) styles.push(`font-size: ${mark.attrs.fontSize}`);
        if (styles.length) html = `<span style="${styles.join('; ')}">${html}</span>`;
        break;
      }
      default:
        break;
    }
  }
  return html;
}

function renderNode(node: TipTapNode): string {
  if (node.type === 'text') {
    return renderMarks(node.text || '', node.marks);
  }

  const children = node.content ? node.content.map(renderNode).join('') : '';

  switch (node.type) {
    case 'doc':
      return children;
    case 'paragraph':
      return `<p>${children || '<br>'}</p>`;
    case 'heading': {
      const level = node.attrs?.level || 1;
      return `<h${level}>${children}</h${level}>`;
    }
    case 'bulletList':
      return `<ul>${children}</ul>`;
    case 'orderedList':
      return `<ol>${children}</ol>`;
    case 'listItem':
      return `<li>${children}</li>`;
    case 'taskList':
      return `<ul class="task-list">${children}</ul>`;
    case 'taskItem': {
      const checked = node.attrs?.checked ? 'checked' : '';
      return `<li class="task-item"><input type="checkbox" ${checked} disabled />${children}</li>`;
    }
    case 'blockquote':
      return `<blockquote>${children}</blockquote>`;
    case 'codeBlock':
      return `<pre><code>${children}</code></pre>`;
    case 'horizontalRule':
      return '<hr>';
    case 'hardBreak':
      return '<br>';
    case 'image': {
      const src = node.attrs?.src || '';
      const alt = node.attrs?.alt || '';
      const title = node.attrs?.title || '';
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" title="${escapeHtml(title)}" style="max-width:100%;height:auto;" />`;
    }
    case 'table':
      return `<table>${children}</table>`;
    case 'tableRow':
      return `<tr>${children}</tr>`;
    case 'tableCell':
      return `<td>${children}</td>`;
    case 'tableHeader':
      return `<th>${children}</th>`;
    default:
      // Fallback: render children or skip
      return children;
  }
}

/**
 * Convert TipTap JSON document to HTML string.
 * Returns empty string if input is null/undefined.
 */
export function tiptapJsonToHtml(json: any): string {
  if (!json) return '';

  // If it's a string, return as-is (already HTML or plain text)
  if (typeof json === 'string') return json;

  // Expect { type: 'doc', content: [...] }
  if (json.type === 'doc' || json.content) {
    return renderNode(json as TipTapNode);
  }

  return '';
}
