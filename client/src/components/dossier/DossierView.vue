<template>
  <div class="dossier-view">
    <!-- Left panel: tree -->
    <aside class="dv-sidebar">
      <div class="dv-sidebar-header">
        <h3 class="dv-sidebar-title mono" :title="dossierStore.currentDossier?.title">
          {{ dossierStore.currentDossier?.title }}
        </h3>
        <div class="dv-sidebar-actions">
          <v-menu>
            <template #activator="{ props: menuProps }">
              <button v-bind="menuProps" class="dv-action-btn" title="Exporter">
                <v-icon size="16">mdi-download-outline</v-icon>
              </button>
            </template>
            <div class="glass-card dv-export-menu">
              <button class="dv-export-option" @click="exportJSON">
                <v-icon size="16">mdi-code-json</v-icon>
                <span>Export JSON</span>
              </button>
              <button class="dv-export-option" @click="exportPDF">
                <v-icon size="16">mdi-file-pdf-box</v-icon>
                <span>Export PDF</span>
              </button>
            </div>
          </v-menu>
          <button
            v-if="dossierStore.selectedNode && (dossierStore.selectedNode.type === 'note' || dossierStore.selectedNode.type === 'mindmap')"
            class="dv-action-btn"
            @click="openSnapshots"
            title="Historique des versions"
          >
            <v-icon size="16">mdi-history</v-icon>
          </button>
        </div>
      </div>
      <div class="dv-sidebar-content">
        <NodeTree @create="handleCreateNode" />
      </div>
    </aside>

    <!-- Right panel: content -->
    <main class="dv-main">
      <DossierInfo v-if="!dossierStore.selectedNode" />

      <div v-else-if="dossierStore.selectedNode.type === 'note'" class="dv-editor-wrap">
        <NoteEditor
          v-model="dossierStore.selectedNode.content"
          :node-id="dossierStore.selectedNode._id"
          :key="dossierStore.selectedNode._id"
        />
      </div>

      <div v-else-if="dossierStore.selectedNode.type === 'mindmap'" class="dv-excalidraw-wrap">
        <ExcalidrawWrapper
          :data="dossierStore.selectedNode.excalidrawData"
          :node-id="dossierStore.selectedNode._id"
          :key="dossierStore.selectedNode._id"
          @update:data="onMindmapUpdate"
        />
      </div>

      <div v-else-if="dossierStore.selectedNode.type === 'document'" class="dv-content-panel">
        <div class="dv-content-header">
          <v-icon size="20" class="mr-2">mdi-file-document-outline</v-icon>
          <h2>{{ dossierStore.selectedNode.title }}</h2>
        </div>
        <p class="text-muted mono">{{ dossierStore.selectedNode.fileName }}</p>
      </div>

      <div v-else-if="dossierStore.selectedNode.type === 'folder'" class="dv-content-panel">
        <div class="dv-content-header">
          <v-icon size="20" class="mr-2">mdi-folder-outline</v-icon>
          <h2>{{ dossierStore.selectedNode.title }}</h2>
        </div>
        <p class="text-muted">Dossier</p>
      </div>
    </main>
  </div>

  <!-- Snapshot panel -->
  <v-dialog v-model="snapshotDialog" max-width="480">
    <div class="glass-card dialog-card">
      <div class="dialog-header">
        <h3 class="mono">Historique des versions</h3>
        <button class="me-close-btn" @click="snapshotDialog = false">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>
      <div class="dialog-body" style="max-height: 400px; overflow-y: auto;">
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
          <v-text-field
            v-model="snapshotLabel"
            label="Label (optionnel)"
            density="compact"
            hide-details
          />
          <button class="me-btn-primary" @click="createSnap" style="white-space: nowrap;">
            <v-icon size="14" class="mr-1">mdi-camera-outline</v-icon>
            Sauvegarder
          </button>
        </div>
        <div v-if="!snapshots.length" style="text-align: center; padding: 24px; color: var(--me-text-muted); font-size: 13px;">
          Aucune version sauvegardee
        </div>
        <div v-for="snap in snapshots" :key="snap._id" class="snap-item">
          <div class="snap-info">
            <span class="snap-label">{{ snap.label || 'Version sans label' }}</span>
            <span class="snap-date mono">{{ formatDate(snap.createdAt) }}</span>
          </div>
          <div class="snap-actions">
            <button class="snap-action-btn" @click="restoreSnap(snap._id)" title="Restaurer">
              <v-icon size="14">mdi-restore</v-icon>
            </button>
            <button class="snap-action-btn snap-action-danger" @click="deleteSnap(snap._id)" title="Supprimer">
              <v-icon size="14">mdi-delete-outline</v-icon>
            </button>
          </div>
        </div>
      </div>
    </div>
  </v-dialog>

  <!-- Create node dialog -->
  <v-dialog v-model="createDialog" max-width="400">
    <div class="glass-card dialog-card">
      <div class="dialog-header">
        <h3 class="mono">Nouveau {{ createType }}</h3>
        <button class="me-close-btn" @click="createDialog = false">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>
      <div class="dialog-body">
        <v-text-field v-model="createTitle" label="Titre" autofocus @keyup.enter="confirmCreate" />
      </div>
      <div class="dialog-footer">
        <button class="me-btn-ghost" @click="createDialog = false">Annuler</button>
        <button class="me-btn-primary" @click="confirmCreate" :disabled="!createTitle.trim()">Creer</button>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useDossierStore } from '../../stores/dossier';
import { useConfirm } from '../../composables/useConfirm';
import api, { SERVER_URL } from '../../services/api';
import NodeTree from '../tree/NodeTree.vue';
import DossierInfo from './DossierInfo.vue';
import NoteEditor from '../editor/NoteEditor.vue';
import ExcalidrawWrapper from '../excalidraw/ExcalidrawWrapper.vue';

const dossierStore = useDossierStore();
const createDialog = ref(false);
const snapshotDialog = ref(false);
const snapshots = ref<any[]>([]);
const snapshotLabel = ref('');
const createType = ref('');
const createParentId = ref<string | null>(null);
const createTitle = ref('');

function onMindmapUpdate(val: any) {
  if (dossierStore.selectedNode) {
    dossierStore.selectedNode.excalidrawData = val;
  }
}

function handleCreateNode(type: string, parentId: string | null) {
  createType.value = type;
  createParentId.value = parentId;
  createTitle.value = '';
  createDialog.value = true;
}

async function confirmCreate() {
  await dossierStore.createNode({
    type: createType.value as any,
    title: createTitle.value,
    parentId: createParentId.value,
  });
  createDialog.value = false;
}

const { confirm: confirmDialog } = useConfirm();

async function openSnapshots() {
  if (!dossierStore.selectedNode) return;
  try {
    const { data } = await api.get(`/nodes/${dossierStore.selectedNode._id}/snapshots`);
    snapshots.value = data;
    snapshotLabel.value = '';
    snapshotDialog.value = true;
  } catch (err) {
    console.error('Failed to load snapshots:', err);
  }
}

async function createSnap() {
  if (!dossierStore.selectedNode) return;
  try {
    await api.post(`/nodes/${dossierStore.selectedNode._id}/snapshots`, {
      label: snapshotLabel.value || `Version du ${new Date().toLocaleString('fr-FR')}`,
    });
    const { data } = await api.get(`/nodes/${dossierStore.selectedNode._id}/snapshots`);
    snapshots.value = data;
    snapshotLabel.value = '';
  } catch (err) {
    console.error('Snapshot creation failed:', err);
  }
}

async function restoreSnap(snapshotId: string) {
  const ok = await confirmDialog({
    title: 'Restaurer cette version',
    message: 'Le contenu actuel sera remplace par cette version. Voulez-vous creer une sauvegarde avant ?',
    confirmText: 'Restaurer',
    variant: 'warning',
  });
  if (!ok) return;
  try {
    // Create a backup first
    if (dossierStore.selectedNode) {
      await api.post(`/nodes/${dossierStore.selectedNode._id}/snapshots`, {
        label: `Sauvegarde auto avant restauration`,
      });
    }
    const { data } = await api.post(`/snapshots/${snapshotId}/restore`);
    if (dossierStore.selectedNode) {
      if (data.content) dossierStore.selectedNode.content = data.content;
      if (data.excalidrawData) dossierStore.selectedNode.excalidrawData = data.excalidrawData;
    }
    snapshotDialog.value = false;
  } catch (err) {
    console.error('Restore failed:', err);
  }
}

async function deleteSnap(snapshotId: string) {
  const ok = await confirmDialog({
    title: 'Supprimer la version',
    message: 'Cette version sera supprimee definitivement.',
    confirmText: 'Supprimer',
    variant: 'danger',
  });
  if (!ok) return;
  try {
    await api.delete(`/snapshots/${snapshotId}`);
    snapshots.value = snapshots.value.filter(s => s._id !== snapshotId);
  } catch (err) {
    console.error('Delete snapshot failed:', err);
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

async function exportJSON() {
  if (!dossierStore.currentDossier) return;
  try {
    const { data } = await api.get(`/dossiers/${dossierStore.currentDossier._id}/export/json`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${dossierStore.currentDossier.title}.json`);
  } catch (err) {
    console.error('JSON export failed:', err);
  }
}

async function exportPDF() {
  if (!dossierStore.currentDossier) return;
  try {
    const { jsPDF } = await import('jspdf');
    const dossier = dossierStore.currentDossier;
    const nodes = dossierStore.nodes;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 20;
    const usableW = pageW - margin * 2;
    let y = 25;

    function checkPage(need: number) {
      if (y + need > 275) {
        doc.addPage();
        y = 20;
      }
    }

    // Title
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(dossier.title, margin, y);
    y += 10;

    // Status + date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(`Statut: ${dossier.status} | Exporte le ${new Date().toLocaleDateString('fr-FR')}`, margin, y);
    doc.setTextColor(0);
    y += 10;

    // Description
    if (dossier.description) {
      checkPage(20);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Description', margin, y);
      y += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const descLines = doc.splitTextToSize(dossier.description, usableW);
      doc.text(descLines, margin, y);
      y += descLines.length * 5 + 6;
    }

    // Objectives
    if (dossier.objectives) {
      checkPage(20);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Objectifs', margin, y);
      y += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const objLines = doc.splitTextToSize(dossier.objectives, usableW);
      doc.text(objLines, margin, y);
      y += objLines.length * 5 + 6;
    }

    // Judicial facts
    if (dossier.judicialFacts) {
      checkPage(20);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Faits judiciaires', margin, y);
      y += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const factLines = doc.splitTextToSize(dossier.judicialFacts, usableW);
      doc.text(factLines, margin, y);
      y += factLines.length * 5 + 6;
    }

    // Investigator
    if (dossier.investigator?.name) {
      checkPage(30);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Enqueteur', margin, y);
      y += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const inv = dossier.investigator;
      const invLines = [
        inv.name,
        inv.service ? `Service: ${inv.service}` : '',
        inv.unit ? `Unite: ${inv.unit}` : '',
        inv.phone ? `Tel: ${inv.phone}` : '',
        inv.email ? `Email: ${inv.email}` : '',
      ].filter(Boolean);
      invLines.forEach(line => {
        doc.text(line, margin, y);
        y += 5;
      });
      y += 4;
    }

    // Entities
    if (dossier.entities?.length) {
      checkPage(20);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(`Entites (${dossier.entities.length})`, margin, y);
      y += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      dossier.entities.forEach(ent => {
        checkPage(10);
        doc.text(`• ${ent.name} [${ent.type}]${ent.description ? ' - ' + ent.description : ''}`, margin, y);
        y += 5;
      });
      y += 4;
    }

    // Separator
    checkPage(15);
    doc.setDrawColor(200);
    doc.line(margin, y, pageW - margin, y);
    y += 10;

    // Notes content
    const noteNodes = nodes.filter(n => n.type === 'note');
    for (const node of noteNodes) {
      checkPage(20);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(node.title, margin, y);
      y += 7;

      if (node.content) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const text = extractTextFromTiptap(node.content);
        if (text) {
          const lines = doc.splitTextToSize(text, usableW);
          for (const line of lines) {
            checkPage(6);
            doc.text(line, margin, y);
            y += 5;
          }
        }
      }
      y += 6;
    }

    doc.save(`${dossier.title}.pdf`);
  } catch (err) {
    console.error('PDF export failed:', err);
  }
}

function extractTextFromTiptap(json: any): string {
  if (!json) return '';
  if (typeof json === 'string') return json;
  let text = '';
  if (json.text) text += json.text;
  if (json.content) {
    for (const child of json.content) {
      const childText = extractTextFromTiptap(child);
      if (childText) {
        if (json.type === 'paragraph' || json.type === 'heading' || json.type === 'blockquote' || json.type === 'listItem') {
          text += childText + '\n';
        } else {
          text += childText;
        }
      }
    }
  }
  return text;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.dossier-view {
  display: flex;
  height: calc(100vh - 56px);
}
.dv-sidebar {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.dv-sidebar-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--me-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.dv-sidebar-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.dv-action-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.dv-action-btn:hover {
  border-color: var(--me-accent);
  color: var(--me-accent);
  background: var(--me-accent-glow);
}
.dv-export-menu {
  padding: 6px;
  min-width: 160px;
}
.dv-export-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: none;
  color: var(--me-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.dv-export-option:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
.dv-sidebar-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--me-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dv-sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.dv-main {
  flex: 1;
  overflow: auto;
  background: var(--me-bg-deep);
}
.dv-editor-wrap {
  height: 100%;
}
.dv-excalidraw-wrap {
  height: 100%;
}
.dv-content-panel {
  padding: 32px;
}
.dv-content-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
.dv-content-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--me-text-primary);
}
.text-muted {
  color: var(--me-text-muted);
  font-size: 13px;
}
.dialog-card {
  overflow: hidden;
}
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
.me-close-btn:hover {
  color: var(--me-text-primary);
}
.dialog-body {
  padding: 20px 24px;
}
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
.me-btn-primary:hover {
  box-shadow: 0 0 16px var(--me-accent-glow);
}
.me-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.snap-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: var(--me-radius-xs);
  border: 1px solid var(--me-border);
  margin-bottom: 6px;
  transition: all 0.15s;
}
.snap-item:hover {
  border-color: var(--me-accent);
  background: var(--me-accent-glow);
}
.snap-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.snap-label {
  font-size: 13px;
  color: var(--me-text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.snap-date {
  font-size: 11px;
  color: var(--me-text-muted);
}
.snap-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.snap-action-btn {
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
.snap-action-btn:hover {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.snap-action-danger:hover {
  background: rgba(248, 113, 113, 0.1);
  color: var(--me-error);
}
</style>
