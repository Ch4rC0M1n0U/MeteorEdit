import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import api from '../../services/api';

export interface LTMatch {
  offset: number;
  length: number;
  message: string;
  shortMessage: string;
  replacements: { value: string }[];
  rule: { id: string; category: { id: string; name: string } };
  context: { text: string; offset: number; length: number };
}

export interface LTDecoSpec {
  match: LTMatch;
  from: number;
  to: number;
}

export const languageToolPluginKey = new PluginKey('languageTool');

const DEBOUNCE_MS = 800;
const MAX_FAILURES = 3;

function getCategoryClass(match: LTMatch): string {
  const catId = match.rule?.category?.id?.toLowerCase() || '';
  if (catId.includes('typo') || catId.includes('spell') || catId === 'compounding') return 'lt-spelling';
  if (catId.includes('style') || catId.includes('redundancy') || catId.includes('plain_english')) return 'lt-style';
  return 'lt-grammar';
}

interface ParagraphInfo {
  from: number;
  to: number;
  text: string;
}

function extractParagraphs(doc: PmNode): ParagraphInfo[] {
  const paragraphs: ParagraphInfo[] = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock && node.textContent.trim().length > 0) {
      paragraphs.push({ from: pos + 1, to: pos + node.nodeSize - 1, text: node.textContent });
      return false;
    }
  });
  return paragraphs;
}

async function checkText(text: string, language: string, signal?: AbortSignal): Promise<LTMatch[]> {
  try {
    const { data } = await api.post('/languagetool/check', { text, language }, { signal });
    if (data.available === false) return [];
    return data.matches || [];
  } catch {
    return [];
  }
}

function buildDecorations(paragraphs: ParagraphInfo[], matchesPerParagraph: LTMatch[][]): DecorationSet {
  const decos: Decoration[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const matches = matchesPerParagraph[i] || [];
    for (const match of matches) {
      const from = para.from + match.offset;
      const to = from + match.length;
      if (from >= para.from && to <= para.to) {
        decos.push(
          Decoration.inline(from, to, {
            class: getCategoryClass(match),
            nodeName: 'span',
          }, { match, from, to } as any)
        );
      }
    }
  }
  // We can't create a DecorationSet without a doc reference, so return from the plugin
  return null as any; // placeholder — actual creation in plugin
}

export function createLanguageToolExtension(options: {
  language?: string;
  enabled?: boolean;
}) {
  return Extension.create({
    name: 'languageTool',

    addProseMirrorPlugins() {
      const plugin = new Plugin({
        key: languageToolPluginKey,

        state: {
          init() {
            return {
              decorations: DecorationSet.empty,
              enabled: options.enabled ?? false,
              language: options.language || 'auto',
              failureCount: 0,
            };
          },
          apply(tr: Transaction, prev: any) {
            const meta = tr.getMeta(languageToolPluginKey);
            if (meta) {
              if (meta.decorations !== undefined) {
                return { ...prev, decorations: meta.decorations, failureCount: meta.failureCount ?? prev.failureCount };
              }
              if (meta.enabled !== undefined) {
                if (!meta.enabled) {
                  return { ...prev, enabled: false, decorations: DecorationSet.empty };
                }
                return { ...prev, enabled: true };
              }
              if (meta.language !== undefined) {
                return { ...prev, language: meta.language };
              }
            }
            // Map decorations through document changes
            if (tr.docChanged && prev.decorations) {
              return { ...prev, decorations: prev.decorations.map(tr.mapping, tr.doc) };
            }
            return prev;
          },
        },

        props: {
          decorations(state) {
            return this.getState(state)?.decorations || DecorationSet.empty;
          },

          handleClick(view: EditorView, pos: number) {
            const pluginState = languageToolPluginKey.getState(view.state);
            if (!pluginState?.enabled) return false;

            const decos = pluginState.decorations.find(pos, pos);
            if (!decos.length) return false;

            const spec = (decos[0] as any).spec as LTDecoSpec;
            if (!spec?.match) return false;

            showLTTooltip(view, spec);
            return false; // don't prevent default
          },
        },

        view(editorView: EditorView) {
          let timeout: ReturnType<typeof setTimeout> | null = null;
          let abortController: AbortController | null = null;

          async function runCheck() {
            const state = editorView.state;
            const pluginState = languageToolPluginKey.getState(state);
            if (!pluginState?.enabled) return;

            if (abortController) abortController.abort();
            abortController = new AbortController();
            const signal = abortController.signal;

            const paragraphs = extractParagraphs(state.doc);
            if (!paragraphs.length) return;

            // Batch all paragraphs into one request (join with \n\n)
            const fullText = paragraphs.map(p => p.text).join('\n\n');
            const matches = await checkText(fullText, pluginState.language, signal);

            if (signal.aborted) return;

            if (matches.length === 0 && fullText.length > 0) {
              // Could be a failure or just no errors — check if service returned empty
              // Build empty decorations
              const tr = editorView.state.tr;
              tr.setMeta(languageToolPluginKey, { decorations: DecorationSet.empty });
              editorView.dispatch(tr);
              return;
            }

            // Map matches back to paragraph positions
            // fullText offsets: paragraph i starts at sum of (prev paragraphs text length + 2 for \n\n)
            const decos: Decoration[] = [];
            let textOffset = 0;
            for (let i = 0; i < paragraphs.length; i++) {
              const para = paragraphs[i];
              const paraEnd = textOffset + para.text.length;

              for (const match of matches) {
                const matchStart = match.offset;
                const matchEnd = matchStart + match.length;
                if (matchStart >= textOffset && matchEnd <= paraEnd) {
                  const localOffset = matchStart - textOffset;
                  const from = para.from + localOffset;
                  const to = from + match.length;
                  decos.push(
                    Decoration.inline(from, to, {
                      class: getCategoryClass(match),
                      nodeName: 'span',
                    }, { match, from, to })
                  );
                }
              }

              textOffset = paraEnd + 2; // +2 for \n\n separator
            }

            const decorationSet = DecorationSet.create(editorView.state.doc, decos);
            const tr = editorView.state.tr;
            tr.setMeta(languageToolPluginKey, { decorations: decorationSet });
            editorView.dispatch(tr);
          }

          function scheduleCheck() {
            const pluginState = languageToolPluginKey.getState(editorView.state);
            if (!pluginState?.enabled) return;
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(runCheck, DEBOUNCE_MS);
          }

          return {
            update(view: EditorView, prevState) {
              const pluginState = languageToolPluginKey.getState(view.state);
              const prevPluginState = languageToolPluginKey.getState(prevState);

              // If just enabled, run immediately
              if (pluginState?.enabled && !prevPluginState?.enabled) {
                scheduleCheck();
                return;
              }

              // If language changed, re-check
              if (pluginState?.enabled && pluginState.language !== prevPluginState?.language) {
                scheduleCheck();
                return;
              }

              // If doc changed and enabled, schedule
              if (view.state.doc !== prevState.doc && pluginState?.enabled) {
                scheduleCheck();
              }
            },
            destroy() {
              if (timeout) clearTimeout(timeout);
              if (abortController) abortController.abort();
            },
          };
        },
      });

      return [plugin];
    },
  });
}

// --- Tooltip logic ---
let activeTooltipEl: HTMLElement | null = null;

function removeTooltip() {
  if (activeTooltipEl) {
    activeTooltipEl.remove();
    activeTooltipEl = null;
  }
}

function showLTTooltip(view: EditorView, spec: LTDecoSpec) {
  removeTooltip();

  const { match, from, to } = spec;
  const coords = view.coordsAtPos(from);

  const el = document.createElement('div');
  el.className = 'lt-tooltip';

  // Category
  const catId = match.rule?.category?.id?.toLowerCase() || '';
  let catLabel = 'Grammaire';
  let catClass = 'lt-cat-grammar';
  if (catId.includes('typo') || catId.includes('spell') || catId === 'compounding') {
    catLabel = 'Orthographe';
    catClass = 'lt-cat-spelling';
  } else if (catId.includes('style') || catId.includes('redundancy')) {
    catLabel = 'Style';
    catClass = 'lt-cat-style';
  }

  el.innerHTML = `
    <div class="lt-tooltip-category ${catClass}">${catLabel}</div>
    <div class="lt-tooltip-message">${escapeHtml(match.message)}</div>
    ${match.replacements.length ? `
      <div class="lt-tooltip-suggestions">
        ${match.replacements.slice(0, 5).map(r =>
          `<button class="lt-tooltip-suggestion" data-value="${escapeAttr(r.value)}">${escapeHtml(r.value)}</button>`
        ).join('')}
      </div>
    ` : '<div class="lt-tooltip-no-suggestion">Aucune suggestion</div>'}
    <button class="lt-tooltip-ignore">Ignorer</button>
  `;

  // Position
  el.style.position = 'fixed';
  el.style.left = `${coords.left}px`;
  el.style.top = `${coords.bottom + 6}px`;
  el.style.zIndex = '9999';

  document.body.appendChild(el);
  activeTooltipEl = el;

  // Reposition if overflows viewport
  requestAnimationFrame(() => {
    if (!activeTooltipEl) return;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      el.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.bottom > window.innerHeight - 8) {
      el.style.top = `${coords.top - rect.height - 6}px`;
    }
  });

  // Handle suggestion clicks
  el.querySelectorAll('.lt-tooltip-suggestion').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const value = (e.target as HTMLElement).dataset.value || '';
      const tr = view.state.tr.replaceWith(from, to, view.state.schema.text(value));
      view.dispatch(tr);
      removeTooltip();
    });
  });

  // Handle ignore
  el.querySelector('.lt-tooltip-ignore')?.addEventListener('click', () => {
    removeTooltip();
  });

  // Close on click outside
  const onClickOutside = (e: MouseEvent) => {
    if (!el.contains(e.target as Node)) {
      removeTooltip();
      document.removeEventListener('mousedown', onClickOutside);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', onClickOutside), 0);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
