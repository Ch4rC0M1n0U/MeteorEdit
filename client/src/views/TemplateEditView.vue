<template>
  <div class="tpl-edit-page">
    <!-- Header bar -->
    <div class="tpl-edit-header">
      <div class="tpl-edit-header-left">
        <button class="tpl-back-btn" @click="goBack" :title="t('common.back')">
          <i class="pi pi-arrow-left" style="font-size: 16px;" />
        </button>
        <div class="tpl-edit-title-wrap">
          <input
            v-model="title"
            class="tpl-edit-title-input"
            :placeholder="t('templates.titlePlaceholder')"
            @blur="autoSave"
          />
          <span class="tpl-edit-status mono" :class="{ 'tpl-edit-status--saving': saving }">
            {{ saving ? t('common.saving') : saved ? t('common.saved') : '' }}
          </span>
        </div>
      </div>
      <div class="tpl-edit-header-right">
        <button
          v-for="ph in availablePlaceholders"
          :key="ph.key"
          class="placeholder-chip"
          @click="insertPlaceholder(ph.key)"
          type="button"
        >
          {{ ph.label }}
        </button>
      </div>
    </div>

    <!-- Description -->
    <div class="tpl-edit-desc-row">
      <label class="tpl-field-label">{{ t('common.description') }}</label>
      <input
        v-model="description"
        class="tpl-edit-desc-input"
        :placeholder="t('common.description')"
        @blur="autoSave"
      />
    </div>

    <!-- Toolbar -->
    <div class="tpl-edit-toolbar" v-if="editor">
      <button class="ne-btn" :class="{ active: editor.isActive('bold') }" @click="editor.chain().focus().toggleBold().run()">
        <span class="mdi mdi-format-bold" style="font-size: 16px;" />
      </button>
      <button class="ne-btn" :class="{ active: editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()">
        <span class="mdi mdi-format-italic" style="font-size: 16px;" />
      </button>
      <button class="ne-btn" :class="{ active: editor.isActive('underline') }" @click="editor.chain().focus().toggleUnderline().run()">
        <span class="mdi mdi-format-underline" style="font-size: 16px;" />
      </button>
      <button class="ne-btn" :class="{ active: editor.isActive('strike') }" @click="editor.chain().focus().toggleStrike().run()">
        <span class="mdi mdi-format-strikethrough" style="font-size: 16px;" />
      </button>
      <div class="ne-separator" />
      <button class="ne-btn ne-btn-text" :class="{ active: editor.isActive('heading', { level: 1 }) }" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()">
        <span class="mono">H1</span>
      </button>
      <button class="ne-btn ne-btn-text" :class="{ active: editor.isActive('heading', { level: 2 }) }" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()">
        <span class="mono">H2</span>
      </button>
      <button class="ne-btn ne-btn-text" :class="{ active: editor.isActive('heading', { level: 3 }) }" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()">
        <span class="mono">H3</span>
      </button>
      <div class="ne-separator" />
      <button class="ne-btn" :class="{ active: editor.isActive('bulletList') }" @click="editor.chain().focus().toggleBulletList().run()">
        <span class="mdi mdi-format-list-bulleted" style="font-size: 16px;" />
      </button>
      <button class="ne-btn" :class="{ active: editor.isActive('orderedList') }" @click="editor.chain().focus().toggleOrderedList().run()">
        <span class="mdi mdi-format-list-numbered" style="font-size: 16px;" />
      </button>
      <button class="ne-btn" :class="{ active: editor.isActive('taskList') }" @click="editor.chain().focus().toggleTaskList().run()">
        <span class="mdi mdi-checkbox-marked-outline" style="font-size: 16px;" />
      </button>
      <button class="ne-btn" :class="{ active: editor.isActive('blockquote') }" @click="editor.chain().focus().toggleBlockquote().run()">
        <span class="mdi mdi-format-quote-close" style="font-size: 16px;" />
      </button>
      <div class="ne-separator" />
      <button class="ne-btn" @click="editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()">
        <span class="mdi mdi-table" style="font-size: 16px;" />
      </button>
      <button class="ne-btn" @click="editor.chain().focus().setHorizontalRule().run()">
        <span class="mdi mdi-minus" style="font-size: 16px;" />
      </button>
      <button class="ne-btn" @click="editor.chain().focus().setCodeBlock().run()">
        <span class="mdi mdi-code-braces" style="font-size: 16px;" />
      </button>
      <div class="ne-separator" />
      <button class="ne-btn" @click="editor.chain().focus().setTextAlign('left').run()" :class="{ active: editor.isActive({ textAlign: 'left' }) }">
        <span class="mdi mdi-format-align-left" style="font-size: 16px;" />
      </button>
      <button class="ne-btn" @click="editor.chain().focus().setTextAlign('center').run()" :class="{ active: editor.isActive({ textAlign: 'center' }) }">
        <span class="mdi mdi-format-align-center" style="font-size: 16px;" />
      </button>
      <button class="ne-btn" @click="editor.chain().focus().setTextAlign('right').run()" :class="{ active: editor.isActive({ textAlign: 'right' }) }">
        <span class="mdi mdi-format-align-right" style="font-size: 16px;" />
      </button>
    </div>

    <!-- Editor content -->
    <div class="tpl-edit-body">
      <editor-content :editor="editor" class="tpl-edit-content" />
    </div>

    <!-- Loading -->
    <div v-if="loadingTemplate" class="tpl-edit-loading">
      <ProgressBar mode="indeterminate" style="height: 4px; border-radius: 4px;" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Editor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Placeholder } from '@tiptap/extension-placeholder';
import ProgressBar from 'primevue/progressbar';
import { useTemplateStore } from '../stores/template';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const templateStore = useTemplateStore();

const title = ref('');
const description = ref('');
const saving = ref(false);
const saved = ref(false);
const loadingTemplate = ref(true);
const templateId = route.params.id as string;
const editor = shallowRef<Editor | null>(null);
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

const availablePlaceholders = [
  { key: '{{dossier.title}}', label: t('templates.phDossierTitle') },
  { key: '{{dossier.description}}', label: t('common.description') },
  { key: '{{dossier.status}}', label: t('dossier.status') },
  { key: '{{dossier.investigator.name}}', label: t('dossier.investigator') },
  { key: '{{dossier.investigator.service}}', label: t('dossier.service') },
  { key: '{{dossier.investigator.unit}}', label: t('dossier.unit') },
  { key: '{{dossier.investigator.phone}}', label: t('dossier.phone') },
  { key: '{{dossier.investigator.email}}', label: 'Email' },
  { key: '{{date.now}}', label: t('templates.phDateNow') },
  { key: '{{user.name}}', label: t('templates.phUser') },
];

function insertPlaceholder(placeholder: string) {
  editor.value?.chain().focus().insertContent(placeholder).run();
}

async function autoSave() {
  if (!title.value.trim()) return;
  saving.value = true;
  saved.value = false;
  try {
    await templateStore.updateTemplate(templateId, {
      title: title.value,
      description: description.value,
      content: editor.value?.getJSON(),
    });
    saved.value = true;
    setTimeout(() => { saved.value = false; }, 2000);
  } finally {
    saving.value = false;
  }
}

function debouncedAutoSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(autoSave, 1500);
}

function goBack() {
  // Save before leaving
  if (title.value.trim() && editor.value) {
    autoSave();
  }
  router.push('/templates');
}

onMounted(async () => {
  try {
    const tpl = await templateStore.fetchTemplate(templateId);
    title.value = tpl.title;
    description.value = tpl.description || '';

    editor.value = new Editor({
      extensions: [
        StarterKit,
        Underline,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Highlight.configure({ multicolor: true }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        Placeholder.configure({ placeholder: t('templates.contentPlaceholder') }),
      ],
      content: tpl.content || '',
      onUpdate: () => {
        debouncedAutoSave();
      },
    });
  } catch {
    router.push('/templates');
  } finally {
    loadingTemplate.value = false;
  }
});

onBeforeUnmount(() => {
  if (saveTimeout) clearTimeout(saveTimeout);
  editor.value?.destroy();
});
</script>

<style scoped>
.tpl-edit-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.tpl-edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  flex-shrink: 0;
  gap: 16px;
}

.tpl-edit-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.tpl-back-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}
.tpl-back-btn:hover {
  background: var(--me-accent-glow);
  color: var(--me-accent);
  border-color: var(--me-accent);
}

.tpl-edit-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.tpl-edit-title-input {
  flex: 1;
  font-size: 18px;
  font-weight: 700;
  color: var(--me-text-primary);
  background: none;
  border: none;
  outline: none;
  font-family: var(--me-font-body);
  min-width: 0;
}
.tpl-edit-title-input::placeholder {
  color: var(--me-text-muted);
}

.tpl-edit-status {
  font-size: 11px;
  color: var(--me-success);
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.3s;
}
.tpl-edit-status--saving { color: var(--me-text-muted); opacity: 1; }
.tpl-edit-status:not(:empty) { opacity: 1; }

.tpl-edit-header-right {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex-shrink: 0;
}

.placeholder-chip {
  padding: 3px 8px;
  border-radius: 10px;
  background: var(--me-accent-glow);
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  font-size: 11px;
  font-family: var(--me-font-mono);
  cursor: pointer;
  transition: all 0.15s;
}
.placeholder-chip:hover {
  border-color: var(--me-accent);
  color: var(--me-accent);
}

.tpl-edit-desc-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 20px;
  border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  flex-shrink: 0;
}

.tpl-field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--me-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.tpl-edit-desc-input {
  flex: 1;
  font-size: 13px;
  color: var(--me-text-secondary);
  background: none;
  border: none;
  outline: none;
  font-family: var(--me-font-body);
}
.tpl-edit-desc-input::placeholder {
  color: var(--me-text-muted);
}

/* Toolbar */
.tpl-edit-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 20px;
  border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.ne-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.ne-btn:hover { background: var(--me-accent-glow); color: var(--me-text-primary); }
.ne-btn.active { background: var(--me-accent-glow); color: var(--me-accent); }
.ne-btn-text { width: auto; padding: 0 7px; font-size: 11px; font-weight: 700; }
.ne-separator { width: 1px; height: 20px; background: var(--me-border); margin: 0 5px; }

/* Editor body */
.tpl-edit-body {
  flex: 1;
  overflow-y: auto;
  background: var(--me-bg-deep);
}

.tpl-edit-loading {
  padding: 20px;
}

@media (max-width: 900px) {
  .tpl-edit-header-right { display: none; }
  .tpl-edit-header { padding: 8px 12px; }
  .tpl-edit-desc-row { padding: 6px 12px; }
  .tpl-edit-toolbar { padding: 6px 12px; }
}
</style>

<style>
/* Editor content — unscoped for ProseMirror */
.tpl-edit-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 48px;
  min-height: 100%;
}
.tpl-edit-content .ProseMirror {
  min-height: 400px;
  outline: none;
  font-family: var(--me-font-body);
  font-size: 15px;
  line-height: 1.7;
  color: var(--me-text-primary);
}
.tpl-edit-content .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--me-text-muted);
  pointer-events: none;
  height: 0;
}
.tpl-edit-content .ProseMirror h1 { font-size: 28px; font-weight: 700; margin: 16px 0 8px; }
.tpl-edit-content .ProseMirror h2 { font-size: 22px; font-weight: 700; margin: 14px 0 6px; }
.tpl-edit-content .ProseMirror h3 { font-size: 18px; font-weight: 600; margin: 12px 0 4px; }
.tpl-edit-content table { border-collapse: collapse; width: 100%; margin: 8px 0; }
.tpl-edit-content th, .tpl-edit-content td {
  border: 1px solid var(--me-border);
  padding: 8px 12px;
  text-align: left;
}
.tpl-edit-content th {
  background: var(--me-bg-elevated);
  font-weight: 600;
  font-size: 13px;
}
.tpl-edit-content blockquote {
  border-left: 3px solid var(--me-accent);
  margin: 8px 0;
  padding: 4px 16px;
  color: var(--me-text-secondary);
}
.tpl-edit-content ul[data-type="taskList"] { list-style: none; padding-left: 0; }
.tpl-edit-content ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 8px; }
.tpl-edit-content ul[data-type="taskList"] li > label input[type="checkbox"] { accent-color: var(--me-accent); }
.tpl-edit-content pre {
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  border-radius: 8px;
  padding: 12px 16px;
  font-family: var(--me-font-mono);
  font-size: 13px;
  overflow-x: auto;
}
.tpl-edit-content code {
  background: var(--me-bg-elevated);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--me-font-mono);
  font-size: 13px;
}
.tpl-edit-content hr {
  border: none;
  border-top: 1px solid var(--me-border);
  margin: 16px 0;
}
</style>
