<template>
  <div class="note-editor">
    <div class="ne-toolbar" v-if="editor">
      <!-- Undo / Redo -->
      <div class="ne-toolbar-group">
        <button class="ne-btn" @click="editor.chain().focus().undo().run()" :disabled="!editor.can().undo()" title="Annuler (Ctrl+Z)">
          <v-icon size="16">mdi-undo</v-icon>
        </button>
        <button class="ne-btn" @click="editor.chain().focus().redo().run()" :disabled="!editor.can().redo()" title="Retablir (Ctrl+Y)">
          <v-icon size="16">mdi-redo</v-icon>
        </button>
      </div>

      <div class="ne-separator" />

      <!-- Text style -->
      <div class="ne-toolbar-group">
        <button class="ne-btn" :class="{ active: editor.isActive('bold') }" @click="editor.chain().focus().toggleBold().run()" title="Gras (Ctrl+B)">
          <v-icon size="16">mdi-format-bold</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()" title="Italique (Ctrl+I)">
          <v-icon size="16">mdi-format-italic</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive('underline') }" @click="editor.chain().focus().toggleUnderline().run()" title="Souligne (Ctrl+U)">
          <v-icon size="16">mdi-format-underline</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive('strike') }" @click="editor.chain().focus().toggleStrike().run()" title="Barre">
          <v-icon size="16">mdi-format-strikethrough</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive('code') }" @click="editor.chain().focus().toggleCode().run()" title="Code inline">
          <v-icon size="16">mdi-code-tags</v-icon>
        </button>
      </div>

      <div class="ne-separator" />

      <!-- Subscript / Superscript -->
      <div class="ne-toolbar-group">
        <button class="ne-btn" :class="{ active: editor.isActive('subscript') }" @click="editor.chain().focus().toggleSubscript().run()" title="Indice">
          <v-icon size="16">mdi-format-subscript</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive('superscript') }" @click="editor.chain().focus().toggleSuperscript().run()" title="Exposant">
          <v-icon size="16">mdi-format-superscript</v-icon>
        </button>
      </div>

      <div class="ne-separator" />

      <!-- Headings -->
      <div class="ne-toolbar-group">
        <button class="ne-btn ne-btn-text" :class="{ active: editor.isActive('heading', { level: 1 }) }" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" title="Titre 1">
          <span class="mono">H1</span>
        </button>
        <button class="ne-btn ne-btn-text" :class="{ active: editor.isActive('heading', { level: 2 }) }" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" title="Titre 2">
          <span class="mono">H2</span>
        </button>
        <button class="ne-btn ne-btn-text" :class="{ active: editor.isActive('heading', { level: 3 }) }" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" title="Titre 3">
          <span class="mono">H3</span>
        </button>
      </div>

      <div class="ne-separator" />

      <!-- Text color & Highlight -->
      <div class="ne-toolbar-group">
        <div class="ne-color-wrap">
          <button class="ne-btn" :class="{ active: editor.isActive('textStyle') }" title="Couleur du texte">
            <v-icon size="16">mdi-format-color-text</v-icon>
            <span class="ne-color-bar" :style="{ background: currentTextColor }" />
          </button>
          <input type="color" class="ne-color-input" :value="currentTextColor" @input="setTextColor($event)" title="Choisir couleur">
        </div>
        <div class="ne-color-wrap">
          <button class="ne-btn" :class="{ active: editor.isActive('highlight') }" title="Surlignage">
            <v-icon size="16">mdi-marker</v-icon>
            <span class="ne-color-bar" :style="{ background: currentHighlight }" />
          </button>
          <input type="color" class="ne-color-input" :value="currentHighlight" @input="setHighlight($event)" title="Choisir surlignage">
        </div>
        <button class="ne-btn" @click="editor.chain().focus().unsetAllMarks().run()" title="Effacer le formatage">
          <v-icon size="16">mdi-format-clear</v-icon>
        </button>
      </div>

      <div class="ne-separator" />

      <!-- Alignment -->
      <div class="ne-toolbar-group">
        <button class="ne-btn" :class="{ active: editor.isActive({ textAlign: 'left' }) }" @click="editor.chain().focus().setTextAlign('left').run()" title="Aligner a gauche">
          <v-icon size="16">mdi-format-align-left</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive({ textAlign: 'center' }) }" @click="editor.chain().focus().setTextAlign('center').run()" title="Centrer">
          <v-icon size="16">mdi-format-align-center</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive({ textAlign: 'right' }) }" @click="editor.chain().focus().setTextAlign('right').run()" title="Aligner a droite">
          <v-icon size="16">mdi-format-align-right</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive({ textAlign: 'justify' }) }" @click="editor.chain().focus().setTextAlign('justify').run()" title="Justifier">
          <v-icon size="16">mdi-format-align-justify</v-icon>
        </button>
      </div>

      <div class="ne-separator" />

      <!-- Lists -->
      <div class="ne-toolbar-group">
        <button class="ne-btn" :class="{ active: editor.isActive('bulletList') }" @click="editor.chain().focus().toggleBulletList().run()" title="Liste a puces">
          <v-icon size="16">mdi-format-list-bulleted</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive('orderedList') }" @click="editor.chain().focus().toggleOrderedList().run()" title="Liste numerotee">
          <v-icon size="16">mdi-format-list-numbered</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive('taskList') }" @click="editor.chain().focus().toggleTaskList().run()" title="Liste de taches">
          <v-icon size="16">mdi-checkbox-marked-outline</v-icon>
        </button>
        <button class="ne-btn" :class="{ active: editor.isActive('blockquote') }" @click="editor.chain().focus().toggleBlockquote().run()" title="Citation">
          <v-icon size="16">mdi-format-quote-close</v-icon>
        </button>
      </div>

      <div class="ne-separator" />

      <!-- Insert -->
      <div class="ne-toolbar-group">
        <button class="ne-btn" @click="insertLink" title="Inserer un lien (Ctrl+K)">
          <v-icon size="16">mdi-link-variant</v-icon>
        </button>
        <button class="ne-btn" @click="triggerImageUpload" title="Inserer image">
          <v-icon size="16">mdi-image-plus</v-icon>
        </button>
        <button class="ne-btn" @click="insertTable" title="Tableau">
          <v-icon size="16">mdi-table</v-icon>
        </button>
        <button class="ne-btn" @click="editor.chain().focus().toggleCodeBlock().run()" :class="{ active: editor.isActive('codeBlock') }" title="Bloc de code">
          <v-icon size="16">mdi-code-braces</v-icon>
        </button>
        <button class="ne-btn" @click="editor.chain().focus().setHorizontalRule().run()" title="Separateur">
          <v-icon size="16">mdi-minus</v-icon>
        </button>
      </div>
    </div>

    <editor-content :editor="editor" class="editor-content" />
    <input ref="fileInput" type="file" accept="image/*" hidden @change="handleFileSelect" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch } from 'vue';
import { useConfirm } from '../../composables/useConfirm';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
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

const props = defineProps<{ modelValue: any; nodeId: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: any] }>();

const { prompt: promptDialog } = useConfirm();
const fileInput = ref<HTMLInputElement | null>(null);
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

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
    title: 'Inserer un lien',
    message: 'Saisissez l\'URL du lien :',
    promptLabel: 'URL',
    promptDefault: prev,
    confirmText: 'Inserer',
  });
  if (url === null) return;
  if (url === '') {
    editor.value.chain().focus().unsetLink().run();
  } else {
    editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }
}

async function uploadImageFile(file: File): Promise<string | null> {
  const formData = new FormData();
  formData.append('image', file);
  try {
    const { data } = await api.post('/upload/image', formData);
    return `${SERVER_URL}${data.url}`;
  } catch {
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
  content: props.modelValue || '',
  extensions: [
    StarterKit,
    ResizableImageExtension.configure({ inline: true, allowBase64: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    Link.configure({ openOnClick: false }),
    Placeholder.configure({ placeholder: 'Commencez a ecrire...' }),
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Subscript,
    Superscript,
    TaskList,
    TaskItem.configure({ nested: true }),
  ],
  onUpdate: ({ editor: ed }) => {
    const json = ed.getJSON();
    emit('update:modelValue', json);
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      api.put(`/nodes/${props.nodeId}`, { content: json });
    }, 2000);
  },
  editorProps: {
    handlePaste: (view, event) => {
      const items = event.clipboardData?.items;
      if (!items) return false;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          const file = item.getAsFile();
          if (!file) return false;

          uploadImageFile(file).then(url => {
            if (url && editor.value) {
              editor.value.chain().focus().setImage({ src: url }).run();
            }
          });
          return true;
        }
      }

      // Handle base64 images pasted as HTML (e.g. from Excalidraw)
      const html = event.clipboardData?.getData('text/html');
      if (html) {
        const match = html.match(/<img[^>]+src="(data:[^"]+)"/);
        if (match) {
          event.preventDefault();
          fetch(match[1])
            .then(r => r.blob())
            .then(blob => {
              const file = new File([blob], 'pasted-image.png', { type: blob.type });
              return uploadImageFile(file);
            })
            .then(url => {
              if (url && editor.value) {
                editor.value.chain().focus().setImage({ src: url }).run();
              }
            });
          return true;
        }
      }

      return false;
    },
    handleDrop: (view, event, slice, moved) => {
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
          });
          return true;
        }
      }
      return false;
    },
    handleDOMEvents: {
      contextmenu: (view, event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === 'IMG') {
          event.preventDefault();
          const src = target.getAttribute('src');
          if (src) {
            fetch(src)
              .then(r => r.blob())
              .then(blob => {
                navigator.clipboard.write([
                  new ClipboardItem({ [blob.type]: blob })
                ]);
              });
          }
        }
      },
    },
  },
});

watch(() => props.modelValue, (val) => {
  if (editor.value && JSON.stringify(editor.value.getJSON()) !== JSON.stringify(val)) {
    editor.value.commands.setContent(val || '');
  }
});

watch(() => props.nodeId, () => {
  if (editor.value) {
    editor.value.commands.setContent(props.modelValue || '');
  }
});

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
  gap: 2px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  flex-wrap: wrap;
}
.ne-toolbar-group {
  display: flex;
  gap: 1px;
}
.ne-separator {
  width: 1px;
  height: 20px;
  background: var(--me-border);
  margin: 0 5px;
}
.ne-btn {
  width: 30px;
  height: 30px;
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
  padding: 0 7px;
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
</style>
