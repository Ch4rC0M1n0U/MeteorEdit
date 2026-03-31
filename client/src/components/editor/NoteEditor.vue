<template>
  <div class="note-editor">
    <div class="ne-toolbar" v-if="editor">
      <!-- Undo / Redo -->
      <div class="ne-toolbar-group">
        <button class="ne-btn" @click="editor.chain().focus().undo().run()" :disabled="!editor.can().undo()" :title="$t('editor.undo')">
          <v-icon size="18">mdi-undo</v-icon>
        </button>
        <button class="ne-btn" @click="editor.chain().focus().redo().run()" :disabled="!editor.can().redo()" :title="$t('editor.redo')">
          <v-icon size="18">mdi-redo</v-icon>
        </button>
      </div>

      <div class="ne-separator" />

      <!-- Text style -->
      <div class="ne-toolbar-group">
        <button class="ne-btn" :class="{ active: editor.isActive('bold') }" @click="editor.chain().focus().toggleBold().run()" :title="$t('editor.bold')">
          <v-icon size="18">mdi-format-bold</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()" :title="$t('editor.italic')">
          <v-icon size="18">mdi-format-italic</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive('underline') }" @click="editor.chain().focus().toggleUnderline().run()" :title="$t('editor.underline')">
          <v-icon size="18">mdi-format-underline</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive('strike') }" @click="editor.chain().focus().toggleStrike().run()" :title="$t('editor.strike')">
          <v-icon size="18">mdi-format-strikethrough</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive('code') }" @click="editor.chain().focus().toggleCode().run()" :title="$t('editor.inlineCode')">
          <v-icon size="18">mdi-code-tags</v-icon>
        </button>
      </div>

      <div class="ne-separator" />

      <!-- Subscript / Superscript -->
      <div class="ne-toolbar-group">
        <button class="ne-btn" :class="{ active: editor.isActive('subscript') }" @click="editor.chain().focus().toggleSubscript().run()" :title="$t('editor.subscript')">
          <v-icon size="18">mdi-format-subscript</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive('superscript') }" @click="editor.chain().focus().toggleSuperscript().run()" :title="$t('editor.superscript')">
          <v-icon size="18">mdi-format-superscript</v-icon>
        </button>
      </div>

      <div class="ne-separator" />

      <!-- Headings -->
      <div class="ne-toolbar-group">
        <button class="ne-btn ne-btn-text" :class="{ active: editor.isActive('heading', { level: 1 }) }" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" :title="$t('editor.heading1')">
          <span class="mono">H1</span>
        </button>
        <button class="ne-btn ne-btn-text" :class="{ active: editor.isActive('heading', { level: 2 }) }" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" :title="$t('editor.heading2')">
          <span class="mono">H2</span>
        </button>
        <button class="ne-btn ne-btn-text" :class="{ active: editor.isActive('heading', { level: 3 }) }" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" :title="$t('editor.heading3')">
          <span class="mono">H3</span>
        </button>
      </div>

      <div class="ne-separator" />

      <!-- Text color & Highlight -->
      <div class="ne-toolbar-group">
        <div class="ne-color-wrap">
          <button class="ne-btn" :class="{ active: editor.isActive('textStyle') }" :title="$t('editor.textColor')">
            <v-icon size="18">mdi-format-color-text</v-icon>
            <span class="ne-color-bar" :style="{ background: currentTextColor }" />
          </button>
          <input type="color" class="ne-color-input" :value="currentTextColor" @input="setTextColor($event)" :title="$t('editor.chooseColor')">
        </div>
        <div class="ne-color-wrap">
          <button class="ne-btn" :class="{ active: editor.isActive('highlight') }" :title="$t('editor.highlight')">
            <v-icon size="18">mdi-marker</v-icon>
            <span class="ne-color-bar" :style="{ background: currentHighlight }" />
          </button>
          <input type="color" class="ne-color-input" :value="currentHighlight" @input="setHighlight($event)" :title="$t('editor.chooseHighlight')">
        </div>
        <button class="ne-btn" @click="editor.chain().focus().unsetAllMarks().run()" :title="$t('editor.clearFormatting')">
          <v-icon size="18">mdi-format-clear</v-icon>
        </button>
      </div>

      <div class="ne-separator" />

      <!-- Alignment -->
      <div class="ne-toolbar-group">
        <button class="ne-btn" :class="{ active: editor.isActive({ textAlign: 'left' }) }" @click="editor.chain().focus().setTextAlign('left').run()" :title="$t('editor.alignLeft')">
          <v-icon size="18">mdi-format-align-left</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive({ textAlign: 'center' }) }" @click="editor.chain().focus().setTextAlign('center').run()" :title="$t('editor.alignCenter')">
          <v-icon size="18">mdi-format-align-center</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive({ textAlign: 'right' }) }" @click="editor.chain().focus().setTextAlign('right').run()" :title="$t('editor.alignRight')">
          <v-icon size="18">mdi-format-align-right</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive({ textAlign: 'justify' }) }" @click="editor.chain().focus().setTextAlign('justify').run()" :title="$t('editor.justify')">
          <v-icon size="18">mdi-format-align-justify</v-icon>
        </button>
      </div>

      <div class="ne-separator" />

      <!-- Lists -->
      <div class="ne-toolbar-group">
        <button class="ne-btn" :class="{ active: editor.isActive('bulletList') }" @click="editor.chain().focus().toggleBulletList().run()" :title="$t('editor.bulletList')">
          <v-icon size="18">mdi-format-list-bulleted</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive('orderedList') }" @click="editor.chain().focus().toggleOrderedList().run()" :title="$t('editor.orderedList')">
          <v-icon size="18">mdi-format-list-numbered</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive('taskList') }" @click="editor.chain().focus().toggleTaskList().run()" :title="$t('editor.taskList')">
          <v-icon size="18">mdi-checkbox-marked-outline</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive('blockquote') }" @click="editor.chain().focus().toggleBlockquote().run()" :title="$t('editor.blockquote')">
          <v-icon size="18">mdi-format-quote-close</v-icon>
        </button>
      </div>

      <div class="ne-separator" />

      <!-- Insert -->
      <div class="ne-toolbar-group">
        <button class="ne-btn" @click="insertLink" :title="$t('editor.insertLink')">
          <v-icon size="18">mdi-link-variant</v-icon>
        </button>
        <button class="ne-btn" @click="triggerImageUpload" :title="$t('editor.insertImage')">
          <v-icon size="18">mdi-image-plus</v-icon>
        </button>
        <button class="ne-btn" @click="insertTable" :title="$t('editor.table')">
          <v-icon size="18">mdi-table</v-icon>
        </button>
        <button class="ne-btn" @click="editor.chain().focus().toggleCodeBlock().run()" :class="{ active: editor.isActive('codeBlock') }" :title="$t('editor.codeBlock')">
          <v-icon size="18">mdi-code-braces</v-icon>
        </button>
        <button class="ne-btn" @click="editor.chain().focus().setHorizontalRule().run()" :title="$t('editor.separator')">
          <v-icon size="18">mdi-minus</v-icon>
        </button>
      </div>

      <div class="ne-separator" />

      <!-- Comments & Templates -->
      <div class="ne-toolbar-group">
        <button class="ne-btn ne-btn-comments" :class="{ active: showComments }" @click="showComments = !showComments" :title="$t('editor.comments')">
          <v-icon size="18">mdi-comment-text-outline</v-icon>
          <span v-if="commentCount" class="ne-comment-badge">{{ commentCount }}</span>
        </button>
        <button class="ne-btn" @click="saveAsTemplate" :title="$t('editor.saveAsTemplate')">
          <v-icon size="18">mdi-content-save-check-outline</v-icon>
        </button>
      </div>

      <!-- AI Reformulate -->
      <div class="ne-separator" />
      <div class="ne-toolbar-group">
        <v-menu :close-on-content-click="true" location="bottom">
          <template #activator="{ props: menuProps }">
            <button
              class="ne-btn"
              v-bind="menuProps"
              :disabled="!hasSelection || reformulating"
              :title="$t('editor.reformulate')"
            >
              <v-icon size="18" :class="{ spin: reformulating }">{{ reformulating ? 'mdi-loading' : 'mdi-auto-fix' }}</v-icon>
            </button>
          </template>
          <v-list density="compact" class="ne-reform-menu">
            <v-list-item @click="reformulateSelection('formal')">
              <template #prepend><v-icon size="16">mdi-briefcase-outline</v-icon></template>
              <v-list-item-title>{{ $t('editor.toneFormal') }}</v-list-item-title>
            </v-list-item>
            <v-list-item @click="reformulateSelection('concise')">
              <template #prepend><v-icon size="16">mdi-arrow-collapse-horizontal</v-icon></template>
              <v-list-item-title>{{ $t('editor.toneConcise') }}</v-list-item-title>
            </v-list-item>
            <v-list-item @click="reformulateSelection('fluent')">
              <template #prepend><v-icon size="16">mdi-water-outline</v-icon></template>
              <v-list-item-title>{{ $t('editor.toneFluent') }}</v-list-item-title>
            </v-list-item>
            <v-list-item @click="reformulateSelection('simple')">
              <template #prepend><v-icon size="16">mdi-text-short</v-icon></template>
              <v-list-item-title>{{ $t('editor.toneSimple') }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>

      <template v-if="ltAvailable">
        <div class="ne-separator" />
        <div class="ne-toolbar-group">
          <button class="ne-btn" :class="{ active: spellCheckEnabled }" @click="toggleSpellCheck" :title="$t('editor.spellCheck')">
            <v-icon size="18">mdi-spellcheck</v-icon>
          </button>
        </div>
      </template>
    </div>

    <!-- Reformulation suggestions panel -->
    <div v-if="reformSuggestions.length > 0" class="ne-reform-panel glass-card">
      <div class="ne-reform-header">
        <v-icon size="16" color="var(--me-accent)">mdi-auto-fix</v-icon>
        <span class="ne-reform-title mono">{{ $t('editor.reformSuggestions') }}</span>
        <button class="ne-reform-close" @click="reformSuggestions = []">
          <v-icon size="14">mdi-close</v-icon>
        </button>
      </div>
      <div
        v-for="(suggestion, i) in reformSuggestions"
        :key="i"
        class="ne-reform-item"
        @click="applyReformulation(suggestion)"
      >
        <span class="ne-reform-text">{{ suggestion }}</span>
        <v-icon size="14" class="ne-reform-apply">mdi-check</v-icon>
      </div>
    </div>

    <!-- Presence indicators -->
    <div v-if="presenceUsers.length" class="ne-presence">
      <template v-for="u in presenceUsers">
        <img v-if="u.avatarUrl" :key="'img-'+u.name" :src="u.avatarUrl" :alt="u.name" class="ne-presence-avatar ne-presence-img" :title="u.name" />
        <span v-else :key="u.name" class="ne-presence-avatar" :style="{ background: u.color }" :title="u.name">
          {{ u.initials }}
        </span>
      </template>
    </div>

    <div class="ne-body">
      <editor-content :editor="editor" class="editor-content" />
      <CommentSidebar
        v-model="showComments"
        :node-id="props.nodeId"
        @count-change="commentCount = $event"
      />
    </div>
    <input ref="fileInput" type="file" accept="image/*" hidden @change="handleFileSelect" />

    <!-- Context Menu -->
    <teleport to="body">
      <div
        v-if="contextMenu.show"
        class="ne-context-menu"
        :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
        @click="contextMenu.show = false"
      >
        <!-- Table context -->
        <template v-if="contextMenu.context === 'table'">
          <button class="ne-ctx-item" @click="editor?.chain().focus().addColumnBefore().run()">
            <v-icon size="14">mdi-table-column-plus-before</v-icon>
            {{ $t('editor.ctx.insertColumnBefore') }}
          </button>
          <button class="ne-ctx-item" @click="editor?.chain().focus().addColumnAfter().run()">
            <v-icon size="14">mdi-table-column-plus-after</v-icon>
            {{ $t('editor.ctx.insertColumnAfter') }}
          </button>
          <button class="ne-ctx-item" @click="editor?.chain().focus().addRowBefore().run()">
            <v-icon size="14">mdi-table-row-plus-before</v-icon>
            {{ $t('editor.ctx.insertRowBefore') }}
          </button>
          <button class="ne-ctx-item" @click="editor?.chain().focus().addRowAfter().run()">
            <v-icon size="14">mdi-table-row-plus-after</v-icon>
            {{ $t('editor.ctx.insertRowAfter') }}
          </button>
          <div class="ne-ctx-separator" />
          <button class="ne-ctx-item ne-ctx-item--danger" @click="editor?.chain().focus().deleteColumn().run()">
            <v-icon size="14">mdi-table-column-remove</v-icon>
            {{ $t('editor.ctx.deleteColumn') }}
          </button>
          <button class="ne-ctx-item ne-ctx-item--danger" @click="editor?.chain().focus().deleteRow().run()">
            <v-icon size="14">mdi-table-row-remove</v-icon>
            {{ $t('editor.ctx.deleteRow') }}
          </button>
          <button class="ne-ctx-item ne-ctx-item--danger" @click="editor?.chain().focus().deleteTable().run()">
            <v-icon size="14">mdi-table-remove</v-icon>
            {{ $t('editor.ctx.deleteTable') }}
          </button>
          <div class="ne-ctx-separator" />
          <button class="ne-ctx-item" @click="editor?.chain().focus().mergeCells().run()">
            <v-icon size="14">mdi-table-merge-cells</v-icon>
            {{ $t('editor.ctx.mergeCells') }}
          </button>
          <button class="ne-ctx-item" @click="editor?.chain().focus().splitCell().run()">
            <v-icon size="14">mdi-table-split-cell</v-icon>
            {{ $t('editor.ctx.splitCell') }}
          </button>
          <button class="ne-ctx-item" @click="editor?.chain().focus().toggleHeaderCell().run()">
            <v-icon size="14">mdi-table-headers-eye</v-icon>
            {{ $t('editor.ctx.toggleHeader') }}
          </button>
          <div class="ne-ctx-separator" />
          <div class="ne-ctx-sublabel">{{ $t('editor.ctx.cellColor') }}</div>
          <div class="ne-ctx-colors">
            <button v-for="c in contextColors" :key="c" class="ne-ctx-color-btn" :style="{ background: c }" @click="editor?.chain().focus().setCellAttribute('backgroundColor', c).run()" :title="c" />
            <button class="ne-ctx-color-btn ne-ctx-color-reset" @click="editor?.chain().focus().setCellAttribute('backgroundColor', null).run()" title="Reset">
              <v-icon size="10">mdi-close</v-icon>
            </button>
          </div>
        </template>

        <!-- Image context -->
        <template v-else-if="contextMenu.context === 'image'">
          <button class="ne-ctx-item" @click="copyContextImage()">
            <v-icon size="14">mdi-content-copy</v-icon>
            {{ $t('editor.ctx.copyImage') }}
          </button>
          <button class="ne-ctx-item ne-ctx-item--danger" @click="editor?.chain().focus().deleteSelection().run()">
            <v-icon size="14">mdi-delete-outline</v-icon>
            {{ $t('editor.ctx.deleteImage') }}
          </button>
        </template>

        <!-- Text context (default) -->
        <template v-else>
          <button class="ne-ctx-item" @click="editor?.chain().focus().toggleBold().run()">
            <v-icon size="14">mdi-format-bold</v-icon>
            {{ $t('editor.ctx.bold') }}
          </button>
          <button class="ne-ctx-item" @click="editor?.chain().focus().toggleItalic().run()">
            <v-icon size="14">mdi-format-italic</v-icon>
            {{ $t('editor.ctx.italic') }}
          </button>
          <button class="ne-ctx-item" @click="editor?.chain().focus().toggleUnderline().run()">
            <v-icon size="14">mdi-format-underline</v-icon>
            {{ $t('editor.ctx.underline') }}
          </button>
          <button class="ne-ctx-item" @click="editor?.chain().focus().toggleStrike().run()">
            <v-icon size="14">mdi-format-strikethrough</v-icon>
            {{ $t('editor.ctx.strikethrough') }}
          </button>
          <div class="ne-ctx-separator" />
          <button class="ne-ctx-item" @click="insertLink()">
            <v-icon size="14">mdi-link-variant</v-icon>
            {{ $t('editor.ctx.insertLink') }}
          </button>
          <button class="ne-ctx-item" @click="triggerImageUpload()">
            <v-icon size="14">mdi-image-plus</v-icon>
            {{ $t('editor.ctx.insertImage') }}
          </button>
          <button class="ne-ctx-item" @click="insertTable()">
            <v-icon size="14">mdi-table</v-icon>
            {{ $t('editor.ctx.insertTable') }}
          </button>
          <div class="ne-ctx-separator" />
          <button class="ne-ctx-item" @click="editor?.chain().focus().toggleHighlight().run()">
            <v-icon size="14">mdi-marker</v-icon>
            {{ $t('editor.ctx.highlight') }}
          </button>
          <div class="ne-ctx-colors">
            <button v-for="c in contextColors" :key="c" class="ne-ctx-color-btn" :style="{ background: c }" @click="editor?.chain().focus().setColor(c).run()" :title="c" />
            <button class="ne-ctx-color-btn ne-ctx-color-reset" @click="editor?.chain().focus().unsetColor().run()" title="Reset">
              <v-icon size="10">mdi-close</v-icon>
            </button>
          </div>
          <div class="ne-ctx-separator" />
          <button class="ne-ctx-item" :disabled="!hasSelection || reformulating" @click="contextMenu.show = false; reformulateSelection('fluent')">
            <v-icon size="14">mdi-auto-fix</v-icon>
            {{ $t('editor.ctx.reformulate') }}
          </button>
          <div class="ne-ctx-separator" />
          <button class="ne-ctx-item" @click="editor?.chain().focus().toggleCodeBlock().run()">
            <v-icon size="14">mdi-code-braces</v-icon>
            {{ $t('editor.ctx.codeBlock') }}
          </button>
          <button class="ne-ctx-item" @click="editor?.chain().focus().setHorizontalRule().run()">
            <v-icon size="14">mdi-minus</v-icon>
            {{ $t('editor.ctx.horizontalRule') }}
          </button>
        </template>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useConfirm } from '../../composables/useConfirm';
import { useEditor, EditorContent, Extension } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import Collaboration from '@tiptap/extension-collaboration';
import { yCursorPlugin } from '@tiptap/y-tiptap';
import { useAuthStore } from '../../stores/auth';
import { ResizableImageExtension } from './resizableImageExtension';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import api, { SERVER_URL } from '../../services/api';
import { useTemplateStore } from '../../stores/template';
import { useDossierStore } from '../../stores/dossier';
import { useEncryptedUpload } from '../../composables/useEncryptedUpload';
import CommentSidebar from './CommentSidebar.vue';
import { createMentionExtension } from './mentionExtension';
import { createLanguageToolExtension, languageToolPluginKey } from './languageToolExtension';

const { t } = useI18n();

const props = defineProps<{ modelValue: any; nodeId: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: any] }>();

const authStore = useAuthStore();
const templateStore = useTemplateStore();
const dossierStore = useDossierStore();
const { uploadEncryptedImage } = useEncryptedUpload();
const { prompt: promptDialog } = useConfirm();
const fileInput = ref<HTMLInputElement | null>(null);
const showComments = ref(false);
const commentCount = ref(0);
const spellCheckEnabled = ref(false);
const ltAvailable = ref(false);
const ltLanguage = ref('auto');
const reformulating = ref(false);
const reformSuggestions = ref<string[]>([]);
const reformSelectionRange = ref<{ from: number; to: number } | null>(null);
// Context menu
const contextMenu = reactive({ show: false, x: 0, y: 0, context: 'text' as 'text' | 'table' | 'image' });
const contextColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#000000', '#ffffff'];

function closeContextMenu() {
  contextMenu.show = false;
}
function handleContextMenuEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') contextMenu.show = false;
}

function copyContextImage() {
  if (!editor.value) return;
  const { node } = editor.value.state.selection as any;
  const src = node?.attrs?.src;
  if (src) {
    fetch(src)
      .then(r => r.blob())
      .then(blob => {
        navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      })
      .catch(err => console.error('Copy image failed:', err));
  }
}

onMounted(() => {
  document.addEventListener('click', closeContextMenu);
  document.addEventListener('keydown', handleContextMenuEscape);
});
onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu);
  document.removeEventListener('keydown', handleContextMenuEscape);
});

const hasSelection = computed(() => {
  if (!editor.value) return false;
  const { from, to } = editor.value.state.selection;
  return to - from > 2;
});
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

// Load spell check prefs from user preferences
function loadSpellCheckPrefs() {
  try {
    const saved = localStorage.getItem('userPreferences');
    if (saved) {
      const p = JSON.parse(saved);
      if (p.spellCheckEnabled !== undefined) spellCheckEnabled.value = !!p.spellCheckEnabled;
      if (p.spellCheckLanguage) ltLanguage.value = p.spellCheckLanguage;
    }
  } catch {}
}
loadSpellCheckPrefs();

// Check LanguageTool availability
api.get('/languagetool/status').then(({ data }) => {
  ltAvailable.value = !!data.available;
  if (spellCheckEnabled.value && !data.available) {
    spellCheckEnabled.value = false;
  }
}).catch(() => {});

function getLtLanguage(): string {
  if (ltLanguage.value && ltLanguage.value !== 'auto') return ltLanguage.value;
  const { locale } = useI18n();
  const map: Record<string, string> = { fr: 'fr', en: 'en-US', nl: 'nl' };
  return map[locale.value] || 'auto';
}

function toggleSpellCheck() {
  spellCheckEnabled.value = !spellCheckEnabled.value;
  // Persist to user preferences in localStorage
  try {
    const saved = localStorage.getItem('userPreferences');
    const p = saved ? JSON.parse(saved) : {};
    p.spellCheckEnabled = spellCheckEnabled.value;
    localStorage.setItem('userPreferences', JSON.stringify(p));
  } catch {}
  // Also persist to server
  api.put('/auth/preferences', { spellCheckEnabled: spellCheckEnabled.value }).catch(() => {});
  editor.value?.view.dispatch(
    editor.value.view.state.tr.setMeta(languageToolPluginKey, { enabled: spellCheckEnabled.value })
  );
}

async function reformulateSelection(tone: string = 'fluent') {
  if (!editor.value || reformulating.value) return;
  const { from, to } = editor.value.state.selection;
  const selectedText = editor.value.state.doc.textBetween(from, to, ' ');
  if (!selectedText.trim() || selectedText.length < 3) return;

  reformulating.value = true;
  reformSuggestions.value = [];
  reformSelectionRange.value = { from, to };

  try {
    const { data } = await api.post('/ai/reformulate', { text: selectedText, tone });
    reformSuggestions.value = data.suggestions || [];
  } catch (err: any) {
    console.error('Reformulation failed:', err);
    reformSuggestions.value = [];
  } finally {
    reformulating.value = false;
  }
}

function applyReformulation(suggestion: string) {
  if (!editor.value || !reformSelectionRange.value) return;
  const { from, to } = reformSelectionRange.value;
  editor.value.chain().focus().deleteRange({ from, to }).insertContentAt(from, suggestion).run();
  reformSuggestions.value = [];
  reformSelectionRange.value = null;
}

function handleMention(userId: string, _label: string) {
  api.post(`/nodes/${props.nodeId}/mention`, { mentionedUserId: userId }).catch(() => {});
}

// Yjs collaborative editing
const ydoc = new Y.Doc();
const yjsUrl = import.meta.env.VITE_YJS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/yjs`;
const token = localStorage.getItem('accessToken') || '';
const provider = new WebsocketProvider(yjsUrl, `node:${props.nodeId}`, ydoc, {
  params: { token },
});

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 70%, 60%)`;
}
const userName = authStore.user ? `${authStore.user.firstName} ${authStore.user.lastName}` : t('editor.anonymous');
const userAvatarUrl = authStore.user?.avatarPath ? `${SERVER_URL}/${authStore.user.avatarPath}` : null;
provider.awareness.setLocalStateField('user', {
  name: userName,
  color: hashColor(authStore.user?.id || 'default'),
  avatarUrl: userAvatarUrl,
});

// Cursor plugin via y-tiptap (compatible with Collaboration@3.20.0)
const CollaborationCursorPlugin = Extension.create({
  name: 'collaborationCursor',
  addProseMirrorPlugins() {
    return [yCursorPlugin(provider.awareness)];
  },
});

// Presence tracking via awareness
interface PresenceUser { name: string; color: string; initials: string; avatarUrl: string | null }
const presenceUsers = ref<PresenceUser[]>([]);
function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
provider.awareness.on('change', () => {
  const states = Array.from(provider.awareness.getStates().values());
  presenceUsers.value = states
    .filter((s: any) => s.user && s.user.name !== userName)
    .map((s: any) => ({ name: s.user.name, color: s.user.color, initials: getInitials(s.user.name), avatarUrl: s.user.avatarUrl || null }));
});

const currentTextColor = computed(() => {
  if (!editor.value) return '#1a1a1a';
  return editor.value.getAttributes('textStyle').color || '#1a1a1a';
});

const currentHighlight = computed(() => {
  if (!editor.value) return '#facc15';
  return editor.value.getAttributes('highlight').color || '#facc15';
});

function setTextColor(e: Event) {
  const color = (e.target as HTMLInputElement).value;
  editor.value?.chain().focus().setColor(color).run();
}

function setHighlight(e: Event) {
  const color = (e.target as HTMLInputElement).value;
  editor.value?.chain().focus().toggleHighlight({ color }).run();
}

async function insertLink() {
  if (!editor.value) return;
  const prev = editor.value.getAttributes('link').href || '';
  const url = await promptDialog({
    title: t('editor.insertLinkTitle'),
    message: t('editor.insertLinkPrompt'),
    promptLabel: t('editor.url'),
    promptDefault: prev,
    confirmText: t('common.insert'),
  });
  if (url === null) return;
  if (url === '') {
    editor.value.chain().focus().unsetLink().run();
  } else {
    editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }
}

async function uploadImageFile(file: File): Promise<string | null> {
  try {
    const dossierId = dossierStore.currentDossier?._id;
    if (dossierId) {
      const url = await uploadEncryptedImage(dossierId, file);
      return `${SERVER_URL}${url}`;
    }
    // Fallback: no dossier context
    const formData = new FormData();
    formData.append('image', file);
    const { data } = await api.post('/upload/image', formData);
    return `${SERVER_URL}${data.url}`;
  } catch (err) {
    console.error('Image upload failed:', err);
    return null;
  }
}

function triggerImageUpload() {
  fileInput.value?.click();
}

async function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !editor.value) return;
  const url = await uploadImageFile(file);
  if (url) {
    editor.value.chain().focus().setImage({ src: url }).run();
  }
  input.value = '';
}

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      link: false,
      underline: false,
      undoRedo: false,
    }),
    Collaboration.configure({ document: ydoc }),
    CollaborationCursorPlugin,
    ResizableImageExtension.configure({ inline: true, allowBase64: true }),
    Table.configure({ resizable: true, allowTableNodeSelection: true }),
    TableRow,
    TableCell.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          backgroundColor: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('data-bg-color') || element.style.backgroundColor || null,
            renderHTML: (attributes: any) => {
              if (!attributes.backgroundColor) return {};
              return { 'data-bg-color': attributes.backgroundColor, style: `background-color: ${attributes.backgroundColor}` };
            },
          },
        };
      },
    }),
    TableHeader.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          backgroundColor: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('data-bg-color') || element.style.backgroundColor || null,
            renderHTML: (attributes: any) => {
              if (!attributes.backgroundColor) return {};
              return { 'data-bg-color': attributes.backgroundColor, style: `background-color: ${attributes.backgroundColor}` };
            },
          },
        };
      },
    }),
    Link.configure({ openOnClick: false }),
    Placeholder.configure({ placeholder: t('editor.placeholder') }),
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Subscript,
    Superscript,
    TaskList,
    TaskItem.configure({ nested: true }),
    createMentionExtension(handleMention),
    createLanguageToolExtension({ language: getLtLanguage(), enabled: spellCheckEnabled.value }),
  ],
  onUpdate: ({ editor: ed }) => {
    const json = ed.getJSON();
    emit('update:modelValue', json);
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      api.put(`/nodes/${props.nodeId}`, { content: json });
    }, 30000);
  },
  editorProps: {
    handlePaste: (_view, event) => {
      const items = event.clipboardData?.items;
      if (!items) return false;

      // If clipboard contains HTML text, let TipTap handle it natively
      // (preserves hyperlinks, formatting, etc. from AI chats)
      const html = event.clipboardData?.getData('text/html');
      if (html) {
        // Only intercept if it contains base64 images (e.g. from Excalidraw)
        const match = html.match(/<img[^>]+src="(data:[^"]+)"/);
        if (match) {
          event.preventDefault();
          fetch(match[1]!)
            .then(r => r.blob())
            .then(blob => {
              const file = new File([blob], 'pasted-image.png', { type: blob.type });
              return uploadImageFile(file);
            })
            .then(url => {
              if (url && editor.value) {
                editor.value.chain().focus().setImage({ src: url }).run();
              }
            })
            .catch(err => console.error('Paste base64 image failed:', err));
          return true;
        }
        // HTML without base64 images: let TipTap handle natively (preserves links)
        return false;
      }

      // No HTML content — check for pasted image files
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          const file = item.getAsFile();
          if (!file) return false;

          uploadImageFile(file).then(url => {
            if (url && editor.value) {
              editor.value.chain().focus().setImage({ src: url }).run();
            }
          }).catch(err => console.error('Paste image failed:', err));
          return true;
        }
      }

      return false;
    },
    handleDrop: (_view, event, _slice, moved) => {
      if (moved) return false;
      const files = event.dataTransfer?.files;
      if (!files?.length) return false;

      for (const file of files) {
        if (file.type.startsWith('image/')) {
          event.preventDefault();
          uploadImageFile(file).then(url => {
            if (url && editor.value) {
              editor.value.chain().focus().setImage({ src: url }).run();
            }
          }).catch(err => console.error('Drop image failed:', err));
          return true;
        }
      }
      return false;
    },
    handleDOMEvents: {
      contextmenu: (_view, event) => {
        event.preventDefault();
        const { clientX, clientY } = event;
        let context: 'text' | 'table' | 'image' = 'text';
        if (editor.value?.isActive('table')) {
          context = 'table';
        } else if (editor.value?.isActive('image') || editor.value?.isActive('resizableImage')) {
          context = 'image';
        }
        // Also detect image via DOM target
        const target = event.target as HTMLElement;
        if (target.tagName === 'IMG') {
          context = 'image';
        }
        contextMenu.show = true;
        contextMenu.x = clientX;
        contextMenu.y = clientY;
        contextMenu.context = context;
        return true;
      },
    },
  },
});

// Disable browser spellcheck when LanguageTool is active to prevent conflicts
watch(spellCheckEnabled, (enabled) => {
  if (editor.value) {
    editor.value.view.dom.setAttribute('spellcheck', enabled ? 'false' : 'true');
  }
});

// Seed initial content into Yjs when first synced
provider.on('sync', (isSynced: boolean) => {
  if (isSynced) {
    const fragment = ydoc.getXmlFragment('default');
    if (fragment.length === 0 && props.modelValue) {
      editor.value?.commands.setContent(props.modelValue);
    }
  }
});

async function saveAsTemplate() {
  if (!editor.value) return;
  const title = await promptDialog({
    title: t('editor.saveAsTemplate'),
    message: t('editor.templateNamePrompt'),
    promptLabel: t('editor.templateName'),
    promptDefault: '',
    confirmText: t('common.save'),
  });
  if (!title) return;
  try {
    await templateStore.createTemplate({
      title,
      content: editor.value.getJSON(),
    });
  } catch (err) {
    console.error('Failed to save template:', err);
  }
}

function insertTable() {
  editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
}

onBeforeUnmount(() => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    if (editor.value) {
      api.put(`/nodes/${props.nodeId}`, { content: editor.value.getJSON() });
    }
  }
  provider.disconnect();
  ydoc.destroy();
  editor.value?.destroy();
});
</script>

<style scoped>
.note-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.ne-toolbar {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  flex-wrap: wrap;
}
.ne-toolbar-group {
  display: flex;
  gap: 2px;
}
.ne-separator {
  width: 1px;
  height: 24px;
  background: var(--me-border);
  margin: 0 6px;
}
.ne-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--me-radius-xs);
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}
.ne-btn:hover:not(:disabled) {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
.ne-btn.active {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.ne-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.ne-btn-text {
  width: auto;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 700;
}
.ne-color-wrap {
  position: relative;
  display: inline-flex;
}
.ne-color-bar {
  position: absolute;
  bottom: 2px;
  left: 6px;
  right: 6px;
  height: 3px;
  border-radius: 1px;
  pointer-events: none;
}
.ne-color-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
}
.ne-presence {
  display: flex;
  gap: 6px;
  padding: 4px 12px;
  align-items: center;
  border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-surface);
}
.ne-presence-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  font-family: var(--me-font-mono);
  cursor: default;
  border: 2px solid var(--me-bg-surface);
}
.ne-presence-img {
  object-fit: cover;
}
.ne-body {
  flex: 1;
  min-height: 0;
  display: flex;
  position: relative;
  overflow: hidden;
}
.ne-body .editor-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}
.ne-btn-comments {
  position: relative;
}
.ne-comment-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--me-accent);
  color: var(--me-bg-deep);
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  font-family: var(--me-font-mono);
}

/* Reformulation panel */
.ne-reform-panel {
  margin: 0 8px 8px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--me-accent);
}
.ne-reform-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--me-border);
}
.ne-reform-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--me-text-primary);
  flex: 1;
}
.ne-reform-close {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
}
.ne-reform-close:hover {
  background: rgba(255,255,255,0.08);
  color: var(--me-text-primary);
}
.ne-reform-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s;
  margin-bottom: 4px;
}
.ne-reform-item:hover {
  background: rgba(var(--me-accent-rgb, 66,133,244), 0.12);
}
.ne-reform-text {
  flex: 1;
  font-size: 13px;
  color: var(--me-text-secondary);
  line-height: 1.4;
}
.ne-reform-item:hover .ne-reform-text {
  color: var(--me-text-primary);
}
.ne-reform-apply {
  color: var(--me-accent);
  opacity: 0;
  transition: opacity 0.12s;
  margin-top: 2px;
}
.ne-reform-item:hover .ne-reform-apply {
  opacity: 1;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Context menu */
.ne-context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 200px;
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}
.ne-ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 12px;
  border: none;
  background: none;
  color: var(--me-text-primary);
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
  text-align: left;
}
.ne-ctx-item:hover {
  background: rgba(var(--me-accent-rgb, 66, 133, 244), 0.12);
  color: var(--me-accent);
}
.ne-ctx-separator {
  height: 1px;
  background: var(--me-border);
  margin: 4px 8px;
}
.ne-ctx-item--danger {
  color: var(--me-danger, #ef4444);
}
.ne-ctx-item--danger:hover {
  background: rgba(239, 68, 68, 0.1);
}
.ne-ctx-sublabel {
  font-size: 11px;
  color: var(--me-text-muted);
  padding: 4px 12px 2px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
}
.ne-ctx-colors {
  display: flex;
  gap: 3px;
  padding: 4px 10px 6px;
  flex-wrap: wrap;
}
.ne-ctx-color-btn {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid var(--me-border);
  cursor: pointer;
  transition: transform 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ne-ctx-color-btn:hover {
  transform: scale(1.2);
  border-color: var(--me-accent);
}
.ne-ctx-color-reset {
  background: var(--me-bg-surface) !important;
}
.ne-ctx-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>

<style>
.note-editor .editor-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  background: #ffffff;
}
.note-editor .editor-content .ProseMirror {
  min-height: 400px;
  outline: none;
  font-family: var(--me-font-body);
  font-size: 15px;
  line-height: 1.7;
  color: #1a1a1a;
}

/* Task list */
.note-editor .editor-content ul[data-type="taskList"] {
  list-style: none;
  padding-left: 0;
}
.note-editor .editor-content ul[data-type="taskList"] li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 4px;
}
.note-editor .editor-content ul[data-type="taskList"] li > label {
  flex-shrink: 0;
  margin-top: 3px;
}
.note-editor .editor-content ul[data-type="taskList"] li > label input[type="checkbox"] {
  accent-color: var(--me-accent);
  width: 16px;
  height: 16px;
  cursor: pointer;
}
.note-editor .editor-content ul[data-type="taskList"] li > div {
  flex: 1;
}
.note-editor .editor-content ul[data-type="taskList"] li[data-checked="true"] > div {
  text-decoration: line-through;
  opacity: 0.5;
}

/* Highlight */
.note-editor .editor-content mark {
  border-radius: 2px;
  padding: 1px 2px;
}

/* Links */
.note-editor .editor-content a {
  color: #2563eb;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
.note-editor .editor-content a:hover {
  opacity: 0.8;
}

/* Tables */
.note-editor .editor-content table {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
}
.note-editor .editor-content th,
.note-editor .editor-content td {
  border: 1px solid #d1d5db;
  padding: 8px 12px;
  text-align: left;
  min-width: 80px;
}
.note-editor .editor-content th {
  background: #f3f4f6;
  font-weight: 600;
  font-size: 13px;
  color: #374151;
}

/* Blockquote */
.note-editor .editor-content blockquote {
  border-left: 3px solid #2563eb;
  padding-left: 16px;
  margin: 12px 0;
  color: #6b7280;
  font-style: italic;
}

/* Code block */
.note-editor .editor-content pre {
  background: #f8f9fa;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 16px;
  margin: 12px 0;
  overflow-x: auto;
  font-family: var(--me-font-mono);
  font-size: 13px;
  line-height: 1.5;
  color: #1a1a1a;
}
.note-editor .editor-content pre code {
  background: none;
  padding: 0;
  border: none;
  color: inherit;
}

/* Inline code */
.note-editor .editor-content code {
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 3px;
  padding: 1px 4px;
  font-family: var(--me-font-mono);
  font-size: 0.9em;
  color: #e11d48;
}

/* Horizontal rule */
.note-editor .editor-content hr {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 24px 0;
}

/* Headings */
.note-editor .editor-content h1,
.note-editor .editor-content h2,
.note-editor .editor-content h3 {
  color: #111827;
}

/* Task list checked */
.note-editor .editor-content ul[data-type="taskList"] li[data-checked="true"] > div {
  color: #9ca3af;
}

/* Mentions */
.note-editor .editor-content .mention {
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
  border-radius: 4px;
  padding: 1px 4px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
}
.note-editor .editor-content .mention:hover {
  background: rgba(59, 130, 246, 0.2);
}

/* LanguageTool decorations */
.note-editor .editor-content .lt-spelling {
  text-decoration: wavy underline #ef4444;
  text-decoration-skip-ink: none;
  text-underline-offset: 3px;
  cursor: pointer;
}
.note-editor .editor-content .lt-grammar {
  text-decoration: wavy underline #2563eb;
  text-decoration-skip-ink: none;
  text-underline-offset: 3px;
  cursor: pointer;
}
.note-editor .editor-content .lt-style {
  text-decoration: wavy underline #16a34a;
  text-decoration-skip-ink: none;
  text-underline-offset: 3px;
  cursor: pointer;
}

/* LanguageTool tooltip */
.lt-tooltip {
  background: var(--me-bg-surface, #1e1e2e);
  border: 1px solid var(--me-border, #333);
  border-radius: 8px;
  padding: 12px;
  max-width: 340px;
  min-width: 200px;
  font-size: 13px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  font-family: var(--me-font-body, sans-serif);
}
.lt-tooltip-category {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  font-family: var(--me-font-mono, monospace);
}
.lt-cat-spelling { color: #ef4444; }
.lt-cat-grammar { color: #2563eb; }
.lt-cat-style { color: #16a34a; }
.lt-tooltip-message {
  margin-bottom: 10px;
  color: var(--me-text-primary, #e0e0e0);
  line-height: 1.4;
}
.lt-tooltip-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.lt-tooltip-suggestion {
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(56, 189, 248, 0.1);
  color: var(--me-accent, #38bdf8);
  border: 1px solid var(--me-accent, #38bdf8);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.15s;
  font-family: inherit;
}
.lt-tooltip-suggestion:hover {
  background: var(--me-accent, #38bdf8);
  color: #fff;
}
.lt-tooltip-no-suggestion {
  font-size: 12px;
  color: var(--me-text-muted, #888);
  font-style: italic;
  margin-bottom: 8px;
}
.lt-tooltip-ignore {
  font-size: 11px;
  color: var(--me-text-muted, #888);
  cursor: pointer;
  background: none;
  border: none;
  padding: 2px 0;
  font-family: inherit;
}
.lt-tooltip-ignore:hover {
  color: var(--me-text-primary, #e0e0e0);
}

/* Collaborative cursors (y-tiptap) */
.ProseMirror-yjs-cursor {
  position: relative;
  border-left: 2px solid;
  margin-left: -1px;
  margin-right: -1px;
  pointer-events: none;
  word-break: normal;
}
.ProseMirror-yjs-cursor > div {
  position: absolute;
  top: -1.4em;
  left: -1px;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--me-font-mono);
  color: #fff;
  padding: 1px 4px;
  border-radius: 3px 3px 3px 0;
  white-space: nowrap;
  pointer-events: none;
}
</style>
