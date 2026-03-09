<template>
  <div class="templates-page">
    <div class="templates-header fade-in">
      <div>
        <h1 class="templates-title mono">Mes modeles</h1>
        <p class="templates-subtitle">{{ templateStore.templates.length }} modele{{ templateStore.templates.length > 1 ? 's' : '' }}</p>
      </div>
    </div>

    <v-progress-linear v-if="templateStore.loading" indeterminate color="primary" class="mb-4" style="border-radius: 4px;" />

    <div v-if="templateStore.templates.length" class="templates-grid">
      <div
        v-for="tpl in templateStore.templates"
        :key="tpl._id"
        class="tpl-card glass-card"
      >
        <div class="tpl-card-header">
          <v-icon size="20" color="primary" class="mr-2">mdi-file-document-check-outline</v-icon>
          <span class="tpl-card-title">{{ tpl.title }}</span>
          <div class="tpl-card-actions">
            <button class="tpl-action-btn" @click="openEdit(tpl)" title="Modifier">
              <v-icon size="16">mdi-pencil-outline</v-icon>
            </button>
            <button class="tpl-action-btn tpl-action-danger" @click="handleDelete(tpl._id)" title="Supprimer">
              <v-icon size="16">mdi-delete-outline</v-icon>
            </button>
          </div>
        </div>
        <p v-if="tpl.description" class="tpl-card-desc">{{ tpl.description }}</p>
        <div class="tpl-card-meta mono">
          {{ formatDate(tpl.updatedAt) }}
        </div>
      </div>
    </div>

    <div v-else-if="!templateStore.loading" class="templates-empty fade-in">
      <v-icon size="48" color="primary" class="mb-4">mdi-file-document-check-outline</v-icon>
      <h3 class="mono">Aucun modele</h3>
      <p class="text-muted">Sauvegardez une note comme modele depuis l'editeur pour commencer.</p>
    </div>

    <!-- Edit template dialog -->
    <v-dialog v-model="editDialog" max-width="700">
      <div class="glass-card dialog-card">
        <div class="dialog-header">
          <h3 class="mono">Modifier le modele</h3>
          <button class="me-close-btn" @click="editDialog = false">
            <v-icon size="18">mdi-close</v-icon>
          </button>
        </div>
        <div class="dialog-body">
          <v-text-field v-model="editForm.title" label="Titre du modele" class="mb-2" />
          <v-textarea v-model="editForm.description" label="Description" rows="2" class="mb-4" />

          <!-- Placeholder insertion -->
          <div class="placeholder-section">
            <span class="placeholder-label mono">Inserer un placeholder</span>
            <p class="placeholder-hint">Les placeholders seront remplaces automatiquement par les donnees du dossier lors de l'utilisation du modele.</p>
            <div class="placeholder-grid">
              <button
                v-for="ph in availablePlaceholders"
                :key="ph.key"
                class="placeholder-chip"
                @click="insertPlaceholderInEditor(ph.key)"
                type="button"
              >
                {{ ph.label }}
              </button>
            </div>
          </div>

          <!-- TipTap editor for template content -->
          <div class="tpl-editor-wrap">
            <div class="tpl-editor-toolbar" v-if="templateEditor">
              <button class="ne-btn" :class="{ active: templateEditor.isActive('bold') }" @click="templateEditor.chain().focus().toggleBold().run()">
                <v-icon size="16">mdi-format-bold</v-icon>
              </button>
              <button class="ne-btn" :class="{ active: templateEditor.isActive('italic') }" @click="templateEditor.chain().focus().toggleItalic().run()">
                <v-icon size="16">mdi-format-italic</v-icon>
              </button>
              <button class="ne-btn" :class="{ active: templateEditor.isActive('underline') }" @click="templateEditor.chain().focus().toggleUnderline().run()">
                <v-icon size="16">mdi-format-underline</v-icon>
              </button>
              <div class="ne-separator" />
              <button class="ne-btn ne-btn-text" :class="{ active: templateEditor.isActive('heading', { level: 1 }) }" @click="templateEditor.chain().focus().toggleHeading({ level: 1 }).run()">
                <span class="mono">H1</span>
              </button>
              <button class="ne-btn ne-btn-text" :class="{ active: templateEditor.isActive('heading', { level: 2 }) }" @click="templateEditor.chain().focus().toggleHeading({ level: 2 }).run()">
                <span class="mono">H2</span>
              </button>
              <button class="ne-btn ne-btn-text" :class="{ active: templateEditor.isActive('heading', { level: 3 }) }" @click="templateEditor.chain().focus().toggleHeading({ level: 3 }).run()">
                <span class="mono">H3</span>
              </button>
              <div class="ne-separator" />
              <button class="ne-btn" :class="{ active: templateEditor.isActive('bulletList') }" @click="templateEditor.chain().focus().toggleBulletList().run()">
                <v-icon size="16">mdi-format-list-bulleted</v-icon>
              </button>
              <button class="ne-btn" :class="{ active: templateEditor.isActive('orderedList') }" @click="templateEditor.chain().focus().toggleOrderedList().run()">
                <v-icon size="16">mdi-format-list-numbered</v-icon>
              </button>
              <button class="ne-btn" :class="{ active: templateEditor.isActive('taskList') }" @click="templateEditor.chain().focus().toggleTaskList().run()">
                <v-icon size="16">mdi-checkbox-marked-outline</v-icon>
              </button>
              <div class="ne-separator" />
              <button class="ne-btn" @click="templateEditor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()">
                <v-icon size="16">mdi-table</v-icon>
              </button>
              <button class="ne-btn" @click="templateEditor.chain().focus().setHorizontalRule().run()">
                <v-icon size="16">mdi-minus</v-icon>
              </button>
              <div class="ne-separator" />
              <button class="ne-btn" @click="editFullscreen = true" title="Plein ecran">
                <v-icon size="16">mdi-fullscreen</v-icon>
              </button>
            </div>
            <editor-content :editor="templateEditor" class="tpl-editor-content" />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="me-btn-ghost" @click="editDialog = false">Annuler</button>
          <button class="me-btn-primary" @click="saveEdit" :disabled="!editForm.title.trim()">Sauvegarder</button>
        </div>
      </div>
    </v-dialog>

    <!-- Fullscreen editor overlay -->
    <Teleport to="body">
      <div v-if="editFullscreen" class="fs-overlay">
        <div class="fs-header">
          <h3 class="mono">{{ editForm.title || 'Modele' }}</h3>
          <div class="fs-header-right">
            <div class="placeholder-grid-inline">
              <button
                v-for="ph in availablePlaceholders"
                :key="'fs-'+ph.key"
                class="placeholder-chip"
                @click="insertPlaceholderInEditor(ph.key)"
                type="button"
              >
                {{ ph.label }}
              </button>
            </div>
            <button class="me-close-btn" @click="editFullscreen = false" title="Quitter le plein ecran">
              <v-icon size="18">mdi-fullscreen-exit</v-icon>
            </button>
          </div>
        </div>
        <div class="fs-toolbar" v-if="templateEditor">
          <button class="ne-btn" :class="{ active: templateEditor.isActive('bold') }" @click="templateEditor.chain().focus().toggleBold().run()">
            <v-icon size="16">mdi-format-bold</v-icon>
          </button>
          <button class="ne-btn" :class="{ active: templateEditor.isActive('italic') }" @click="templateEditor.chain().focus().toggleItalic().run()">
            <v-icon size="16">mdi-format-italic</v-icon>
          </button>
          <button class="ne-btn" :class="{ active: templateEditor.isActive('underline') }" @click="templateEditor.chain().focus().toggleUnderline().run()">
            <v-icon size="16">mdi-format-underline</v-icon>
          </button>
          <div class="ne-separator" />
          <button class="ne-btn ne-btn-text" :class="{ active: templateEditor.isActive('heading', { level: 1 }) }" @click="templateEditor.chain().focus().toggleHeading({ level: 1 }).run()">
            <span class="mono">H1</span>
          </button>
          <button class="ne-btn ne-btn-text" :class="{ active: templateEditor.isActive('heading', { level: 2 }) }" @click="templateEditor.chain().focus().toggleHeading({ level: 2 }).run()">
            <span class="mono">H2</span>
          </button>
          <button class="ne-btn ne-btn-text" :class="{ active: templateEditor.isActive('heading', { level: 3 }) }" @click="templateEditor.chain().focus().toggleHeading({ level: 3 }).run()">
            <span class="mono">H3</span>
          </button>
          <div class="ne-separator" />
          <button class="ne-btn" :class="{ active: templateEditor.isActive('bulletList') }" @click="templateEditor.chain().focus().toggleBulletList().run()">
            <v-icon size="16">mdi-format-list-bulleted</v-icon>
          </button>
          <button class="ne-btn" :class="{ active: templateEditor.isActive('orderedList') }" @click="templateEditor.chain().focus().toggleOrderedList().run()">
            <v-icon size="16">mdi-format-list-numbered</v-icon>
          </button>
          <button class="ne-btn" :class="{ active: templateEditor.isActive('taskList') }" @click="templateEditor.chain().focus().toggleTaskList().run()">
            <v-icon size="16">mdi-checkbox-marked-outline</v-icon>
          </button>
          <div class="ne-separator" />
          <button class="ne-btn" @click="templateEditor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()">
            <v-icon size="16">mdi-table</v-icon>
          </button>
          <button class="ne-btn" @click="templateEditor.chain().focus().setHorizontalRule().run()">
            <v-icon size="16">mdi-minus</v-icon>
          </button>
        </div>
        <div class="fs-editor">
          <editor-content :editor="templateEditor" class="fs-editor-content" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useTemplateStore } from '../stores/template';
import { useConfirm } from '../composables/useConfirm';
import { useEditor, EditorContent } from '@tiptap/vue-3';
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
import type { NoteTemplate } from '../types';

const templateStore = useTemplateStore();
const { confirm } = useConfirm();

const editDialog = ref(false);
const editFullscreen = ref(false);
const editForm = ref({ id: '', title: '', description: '' });

const availablePlaceholders = [
  { key: '{{dossier.title}}', label: 'Titre dossier' },
  { key: '{{dossier.description}}', label: 'Description' },
  { key: '{{dossier.status}}', label: 'Statut' },
  { key: '{{dossier.investigator.name}}', label: 'Enqueteur' },
  { key: '{{dossier.investigator.service}}', label: 'Service' },
  { key: '{{dossier.investigator.unit}}', label: 'Unite' },
  { key: '{{dossier.investigator.phone}}', label: 'Telephone' },
  { key: '{{dossier.investigator.email}}', label: 'Email enqueteur' },
  { key: '{{date.now}}', label: 'Date du jour' },
  { key: '{{user.name}}', label: 'Utilisateur' },
];

const templateEditor = useEditor({
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
    Placeholder.configure({ placeholder: 'Contenu du modele...' }),
  ],
  content: '',
});

onMounted(() => {
  templateStore.fetchTemplates();
});

function openEdit(tpl: NoteTemplate) {
  editForm.value = { id: tpl._id, title: tpl.title, description: tpl.description || '' };
  editFullscreen.value = false;
  editDialog.value = true;
  nextTick(() => {
    templateEditor.value?.commands.setContent(tpl.content || '');
  });
}

function insertPlaceholderInEditor(placeholder: string) {
  if (!templateEditor.value) return;
  templateEditor.value.chain().focus().insertContent(placeholder).run();
}

async function saveEdit() {
  if (!editForm.value.title.trim()) return;
  await templateStore.updateTemplate(editForm.value.id, {
    title: editForm.value.title,
    description: editForm.value.description,
    content: templateEditor.value?.getJSON(),
  });
  editDialog.value = false;
}

async function handleDelete(id: string) {
  const ok = await confirm({
    title: 'Supprimer le modele',
    message: 'Supprimer ce modele ? Cette action est irreversible.',
    confirmText: 'Supprimer',
    variant: 'danger',
  });
  if (ok) await templateStore.deleteTemplate(id);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

onBeforeUnmount(() => {
  templateEditor.value?.destroy();
});
</script>

<style scoped>
.templates-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 32px 24px;
}
.templates-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 32px;
}
.templates-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.templates-subtitle {
  font-size: 13px;
  color: var(--me-text-muted);
  margin-top: 4px;
  font-family: var(--me-font-mono);
}
.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.tpl-card {
  padding: 16px 20px;
}
.tpl-card-header {
  display: flex;
  align-items: center;
}
.tpl-card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--me-text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tpl-card-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  margin-left: 8px;
}
.tpl-action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}
.tpl-action-btn:hover {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.tpl-action-danger:hover {
  background: rgba(248, 113, 113, 0.1);
  color: var(--me-error);
}
.tpl-card-desc {
  font-size: 13px;
  color: var(--me-text-secondary);
  margin-top: 8px;
  line-height: 1.4;
}
.tpl-card-meta {
  font-size: 11px;
  color: var(--me-text-muted);
  margin-top: 8px;
}
.templates-empty {
  text-align: center;
  padding: 80px 20px;
}
.templates-empty h3 {
  color: var(--me-text-primary);
  margin-bottom: 8px;
}
.text-muted {
  color: var(--me-text-muted);
  font-size: 14px;
}
/* Dialog styles */
.dialog-card { overflow: hidden; }
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--me-border);
}
.dialog-header h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.me-close-btn {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}
.me-close-btn:hover { color: var(--me-text-primary); background: var(--me-accent-glow); }
.dialog-body { padding: 20px 24px; }
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--me-border);
}
.me-btn-ghost {
  padding: 8px 16px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  cursor: pointer;
  font-size: 13px;
}
.me-btn-ghost:hover {
  border-color: var(--me-border-hover);
  color: var(--me-text-primary);
}
.me-btn-primary {
  padding: 8px 16px;
  border-radius: var(--me-radius-xs);
  background: var(--me-accent);
  border: none;
  color: var(--me-bg-deep);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}
.me-btn-primary:hover { box-shadow: 0 0 16px var(--me-accent-glow); }
.me-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
/* Placeholder section */
.placeholder-section {
  margin-bottom: 16px;
}
.placeholder-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--me-text-muted);
  margin-bottom: 4px;
}
.placeholder-hint {
  font-size: 12px;
  color: var(--me-text-muted);
  margin-bottom: 8px;
  line-height: 1.4;
}
.placeholder-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.placeholder-chip {
  padding: 4px 10px;
  border-radius: 12px;
  background: var(--me-accent-glow);
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  font-size: 12px;
  font-family: var(--me-font-mono);
  cursor: pointer;
  transition: all 0.15s;
}
.placeholder-chip:hover {
  border-color: var(--me-accent);
  color: var(--me-accent);
}
/* Template editor */
.tpl-editor-wrap {
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-sm);
  overflow: hidden;
}
.tpl-editor-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  flex-wrap: wrap;
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
}
.ne-btn:hover { background: var(--me-accent-glow); color: var(--me-text-primary); }
.ne-btn.active { background: var(--me-accent-glow); color: var(--me-accent); }
.ne-btn-text { width: auto; padding: 0 7px; font-size: 11px; font-weight: 700; }
.ne-separator { width: 1px; height: 20px; background: var(--me-border); margin: 0 5px; }
/* Fullscreen overlay */
.fs-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  background: var(--me-bg-deep);
}
.fs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  flex-shrink: 0;
  gap: 12px;
}
.fs-header h3 {
  font-size: 14px;
  font-weight: 700;
  color: var(--me-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fs-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.placeholder-grid-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.fs-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 16px;
  border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.fs-editor {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>

<style>
.tpl-editor-content {
  min-height: 200px;
  max-height: 350px;
  overflow-y: auto;
  padding: 16px;
  background: #ffffff;
}
.tpl-editor-content .ProseMirror {
  min-height: 180px;
  outline: none;
  font-family: var(--me-font-body);
  font-size: 14px;
  line-height: 1.6;
  color: #1a1a1a;
}
.tpl-editor-content .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #adb5bd;
  pointer-events: none;
  height: 0;
}
.tpl-editor-content table { border-collapse: collapse; width: 100%; margin: 8px 0; }
.tpl-editor-content th, .tpl-editor-content td { border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; }
.tpl-editor-content th { background: #f3f4f6; font-weight: 600; font-size: 12px; }
.tpl-editor-content ul[data-type="taskList"] { list-style: none; padding-left: 0; }
.tpl-editor-content ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 6px; }
.tpl-editor-content ul[data-type="taskList"] li > label input[type="checkbox"] { accent-color: var(--me-accent); }
/* Fullscreen editor content */
.fs-editor-content {
  height: 100%;
  padding: 32px 48px;
  background: #ffffff;
}
.fs-editor-content .ProseMirror {
  min-height: 100%;
  outline: none;
  font-family: var(--me-font-body);
  font-size: 15px;
  line-height: 1.7;
  color: #1a1a1a;
  max-width: 900px;
  margin: 0 auto;
}
.fs-editor-content .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #adb5bd;
  pointer-events: none;
  height: 0;
}
.fs-editor-content table { border-collapse: collapse; width: 100%; margin: 8px 0; }
.fs-editor-content th, .fs-editor-content td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
.fs-editor-content th { background: #f3f4f6; font-weight: 600; font-size: 13px; }
.fs-editor-content ul[data-type="taskList"] { list-style: none; padding-left: 0; }
.fs-editor-content ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 8px; }
.fs-editor-content ul[data-type="taskList"] li > label input[type="checkbox"] { accent-color: var(--me-accent); }
</style>
