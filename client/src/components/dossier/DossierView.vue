<template>
  <div class="dossier-view" :class="{ 'dv-focus-mode': focusMode }">
    <!-- Left panel: sidebar with tabs -->
    <aside v-show="!focusMode" class="dv-sidebar">
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
              <button class="dv-export-option" @click="exportSelectOpen = true">
                <v-icon size="16">mdi-file-export-outline</v-icon>
                <span>Exporter / Imprimer</span>
              </button>
              <div v-if="aiEnabled" class="dv-export-divider" />
              <button v-if="aiEnabled" class="dv-export-option dv-export-ai" @click="openAiReportTemplateSelect">
                <v-icon size="16">mdi-robot-outline</v-icon>
                <span>Generer rapport IA</span>
              </button>
            </div>
          </v-menu>
          <button
            v-if="dossierStore.selectedNode && ['note', 'mindmap', 'map'].includes(dossierStore.selectedNode.type)"
            class="dv-action-btn"
            @click="openSnapshots"
            title="Historique des versions"
          >
            <v-icon size="16">mdi-history</v-icon>
          </button>
          <button class="dv-action-btn" @click="webClipperOpen = true" title="Web Clipper">
            <v-icon size="16">mdi-web</v-icon>
          </button>
          <button v-if="aiEnabled" class="dv-action-btn" @click="runSummary" :disabled="summarizing" title="Resume IA">
            <v-icon size="16" :class="{ 'ai-spin': summarizing }">{{ summarizing ? 'mdi-loading' : 'mdi-robot-outline' }}</v-icon>
          </button>
        </div>
      </div>

      <!-- Sidebar tabs -->
      <div class="dv-sidebar-tabs">
        <button class="dv-tab" :class="{ active: sidebarTab === 'tree' }" @click="sidebarTab = 'tree'" title="Arborescence">
          <v-icon size="16">mdi-file-tree-outline</v-icon>
        </button>
        <button class="dv-tab" :class="{ active: sidebarTab === 'tasks' }" @click="sidebarTab = 'tasks'" title="Taches">
          <v-icon size="16">mdi-checkbox-marked-outline</v-icon>
        </button>
        <button class="dv-tab" :class="{ active: sidebarTab === 'activity' }" @click="sidebarTab = 'activity'" title="Historique">
          <v-icon size="16">mdi-history</v-icon>
        </button>
      </div>

      <div class="dv-sidebar-content">
        <NodeTree v-show="sidebarTab === 'tree'" @create="handleCreateNode" />
        <TaskPanel v-if="sidebarTab === 'tasks'" />
        <ActivityPanel v-if="sidebarTab === 'activity'" />
      </div>
    </aside>

    <!-- Right panel: content -->
    <main class="dv-main">
      <!-- Focus mode toggle (notes & maps only, not mindmap — mindmap uses toolbar slot) -->
      <div
        v-if="dossierStore.selectedNode && ['note', 'map'].includes(dossierStore.selectedNode.type)"
        class="dv-focus-bar"
      >
        <PomodoroTimer v-if="focusMode" />
        <button
          class="dv-focus-btn"
          :class="{ 'dv-focus-btn--active': focusMode }"
          @click="toggleFocusMode"
          :title="focusMode ? 'Quitter le mode focus (Esc)' : 'Mode focus'"
        >
          <v-icon size="18">{{ focusMode ? 'mdi-fullscreen-exit' : 'mdi-fullscreen' }}</v-icon>
        </button>
      </div>

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
        >
          <template #toolbar-end>
            <PomodoroTimer v-if="focusMode" />
            <button
              class="ex-tb-btn"
              :class="{ active: focusMode }"
              @click="toggleFocusMode"
              :title="focusMode ? 'Quitter le mode focus (Esc)' : 'Mode focus'"
            >
              <v-icon size="16">{{ focusMode ? 'mdi-fullscreen-exit' : 'mdi-fullscreen' }}</v-icon>
            </button>
          </template>
        </ExcalidrawWrapper>
      </div>

      <div v-else-if="dossierStore.selectedNode.type === 'map'" class="dv-map-wrap">
        <MapEditor
          :data="dossierStore.selectedNode.mapData"
          :node-id="dossierStore.selectedNode._id"
          :key="dossierStore.selectedNode._id"
          @update:data="onMapUpdate"
        />
      </div>

      <div v-else-if="dossierStore.selectedNode.type === 'dataset'" class="dv-editor-wrap">
        <DatasetEditor
          v-model="dossierStore.selectedNode.content"
          :node-id="dossierStore.selectedNode._id"
          :title="dossierStore.selectedNode.title"
          :key="dossierStore.selectedNode._id"
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

    <!-- Web Clipper -->
    <WebClipperDialog v-model="webClipperOpen" />

    <!-- Export Selection -->
    <ExportSelectDialog
      v-model="exportSelectOpen"
      :nodes="dossierStore.nodes"
      @export="handleSelectiveExport"
    />

    <!-- AI Summary dialog -->
    <v-dialog v-model="summaryDialog" max-width="600">
      <div class="glass-card dialog-card">
        <div class="dialog-header">
          <h3 class="mono">
            <v-icon size="18" class="mr-1">mdi-robot-outline</v-icon>
            Resume IA
          </h3>
          <button class="me-close-btn" @click="summaryDialog = false">
            <v-icon size="18">mdi-close</v-icon>
          </button>
        </div>
        <div class="dialog-body" style="max-height: 400px; overflow-y: auto;">
          <div v-if="summarizing" style="text-align: center; padding: 32px;">
            <v-progress-circular indeterminate size="28" color="var(--me-accent)" />
            <p style="margin-top: 12px; color: var(--me-text-muted); font-size: 13px;">Generation du resume...</p>
          </div>
          <pre v-else class="ai-summary-text">{{ summaryContent }}</pre>
        </div>
        <div class="dialog-footer">
          <button class="me-btn-ghost" @click="summaryDialog = false">Fermer</button>
          <button v-if="summaryContent" class="me-btn-primary" @click="copySummary">
            <v-icon size="14" class="mr-1">mdi-content-copy</v-icon>
            Copier
          </button>
        </div>
      </div>
    </v-dialog>
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

  <!-- AI Template selection dialog -->
  <v-dialog v-model="aiTemplateSelectDialog" max-width="500">
    <div class="glass-card dialog-card">
      <div class="dialog-header">
        <h3 class="mono">
          <v-icon size="18" class="mr-1">mdi-file-document-edit-outline</v-icon>
          Choisir un template
        </h3>
        <button class="me-close-btn" @click="aiTemplateSelectDialog = false">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>
      <div class="dialog-body">
        <div v-if="aiLoadingTemplates" class="ai-tpl-loading">
          <v-progress-circular indeterminate size="24" color="var(--me-accent)" />
          <span>Chargement...</span>
        </div>
        <div v-else class="ai-tpl-list">
          <button
            :class="['ai-tpl-item', { 'ai-tpl-item--active': aiSelectedTemplateId === null }]"
            @click="aiSelectedTemplateId = null"
          >
            <div class="ai-tpl-item-info">
              <span class="ai-tpl-item-title mono">Template par defaut</span>
              <span class="ai-tpl-item-desc">Prompt systeme configure dans les parametres</span>
            </div>
            <v-icon v-if="aiSelectedTemplateId === null" size="16" color="var(--me-accent)">mdi-check-circle</v-icon>
          </button>
          <button
            v-for="tpl in aiReportTemplates"
            :key="tpl._id"
            :class="['ai-tpl-item', { 'ai-tpl-item--active': aiSelectedTemplateId === tpl._id }]"
            @click="aiSelectedTemplateId = tpl._id"
          >
            <div class="ai-tpl-item-info">
              <span class="ai-tpl-item-title mono">{{ tpl.title }}</span>
              <span class="ai-tpl-item-desc">{{ tpl.description || 'Aucune description' }}</span>
              <span v-if="tpl.isShared" class="ai-tpl-shared-badge mono">Partage</span>
            </div>
            <v-icon v-if="aiSelectedTemplateId === tpl._id" size="16" color="var(--me-accent)">mdi-check-circle</v-icon>
          </button>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="me-btn-ghost" @click="aiTemplateSelectDialog = false">Annuler</button>
        <button class="me-btn-primary" @click="generateAiReport(aiSelectedTemplateId)" :disabled="aiLoadingTemplates">
          <v-icon size="14" class="mr-1">mdi-robot-outline</v-icon>
          Generer
        </button>
      </div>
    </div>
  </v-dialog>

  <!-- AI Report dialog -->
  <v-dialog v-model="aiReportDialog" max-width="800" persistent>
    <div class="glass-card dialog-card">
      <div class="dialog-header">
        <h3 class="mono">
          <v-icon size="18" class="mr-1">mdi-robot-outline</v-icon>
          Rapport genere par IA
        </h3>
        <button class="me-close-btn" @click="closeAiReport" :disabled="aiGenerating">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>

      <!-- Logs panel -->
      <div v-if="aiLogs.length" class="ai-logs-panel">
        <div class="ai-logs-header" @click="aiLogsExpanded = !aiLogsExpanded">
          <v-icon size="14" class="mr-1" :class="{ 'ai-log-spin': aiGenerating }">{{ aiGenerating ? 'mdi-loading' : 'mdi-console' }}</v-icon>
          <span class="mono">Logs</span>
          <span class="ai-log-count mono">{{ aiLogs.length }}</span>
          <v-icon size="14" class="ml-auto">{{ aiLogsExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
        </div>
        <div v-if="aiLogsExpanded" class="ai-logs-content" ref="aiLogsRef">
          <div v-for="(log, i) in aiLogs" :key="i" class="ai-log-line mono">
            <span class="ai-log-time">{{ log.time }}</span>
            <span :class="['ai-log-msg', log.type === 'error' ? 'ai-log-error' : '']">{{ log.message }}</span>
          </div>
        </div>
      </div>

      <!-- Report content -->
      <div class="dialog-body ai-report-body" ref="aiReportBodyRef">
        <div v-if="aiGenerating && !aiReportContent" class="ai-generating">
          <v-progress-circular indeterminate size="28" color="var(--me-accent)" />
          <p>Preparation du rapport...</p>
        </div>

        <div v-if="aiReportContent" class="ai-report-content">
          <div class="ai-report-meta mono">
            <span>Modele: {{ aiReportModel }}</span>
            <span v-if="aiTokenCount" class="ml-auto">{{ aiTokenCount }} tokens</span>
          </div>
          <pre class="ai-report-text">{{ aiReportContent }}<span v-if="aiGenerating" class="ai-cursor">|</span></pre>
        </div>

        <div v-if="aiReportError" class="ai-report-error">
          <v-icon size="20" color="#f87171" class="mr-2">mdi-alert-circle-outline</v-icon>
          {{ aiReportError }}
        </div>
      </div>

      <div class="dialog-footer">
        <button v-if="aiGenerating" class="ai-cancel-gen-btn" @click="cancelAiReport">
          <v-icon size="14" class="mr-1">mdi-stop-circle-outline</v-icon>
          Arreter la generation
        </button>
        <div v-else class="ai-footer-actions">
          <button class="me-btn-ghost" @click="closeAiReport">Fermer</button>
          <button v-if="aiReportContent" class="me-btn-primary" @click="downloadAiReportAsPdf">
            <v-icon size="14" class="mr-1">mdi-file-pdf-box</v-icon>
            PDF
          </button>
          <button v-if="aiReportContent" class="me-btn-primary" @click="downloadAiReportAsDocx">
            <v-icon size="14" class="mr-1">mdi-file-word-box</v-icon>
            DOCX
          </button>
        </div>
      </div>
    </div>
  </v-dialog>

  <!-- Create node dialog -->
  <v-dialog v-model="createDialog" max-width="480">
    <div class="glass-card dialog-card">
      <div class="dialog-header">
        <h3 class="mono">Nouveau {{ createType }}</h3>
        <button class="me-close-btn" @click="createDialog = false">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>
      <div class="dialog-body">
        <v-text-field v-model="createTitle" label="Titre" autofocus @keyup.enter="confirmCreate" />
        <!-- Template selection for notes -->
        <div v-if="createType === 'note' && templateStore.templates.length" class="template-select-section">
          <span class="template-select-label mono">Utiliser un modele</span>
          <div class="template-select-list">
            <button
              :class="['template-select-item', { 'template-select-item--active': !selectedTemplateId }]"
              @click="selectedTemplateId = null"
              type="button"
            >
              <v-icon size="16" class="mr-1">mdi-file-outline</v-icon>
              <span>Note vierge</span>
            </button>
            <button
              v-for="tpl in templateStore.templates"
              :key="tpl._id"
              :class="['template-select-item', { 'template-select-item--active': selectedTemplateId === tpl._id }]"
              @click="selectedTemplateId = tpl._id"
              type="button"
            >
              <v-icon size="16" class="mr-1">mdi-file-document-check-outline</v-icon>
              <span>{{ tpl.title }}</span>
              <span v-if="tpl.description" class="template-select-desc">{{ tpl.description }}</span>
            </button>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="me-btn-ghost" @click="createDialog = false">Annuler</button>
        <button class="me-btn-primary" @click="confirmCreate" :disabled="!createTitle.trim()">Creer</button>
      </div>
    </div>
  </v-dialog>

</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useDossierStore } from '../../stores/dossier';
import { useAuthStore } from '../../stores/auth';
import { useTemplateStore } from '../../stores/template';
import { useConfirm } from '../../composables/useConfirm';
import api, { SERVER_URL } from '../../services/api';
import { loadPdfTemplate, loadTemplateLogos, loadImageAsDataUrl, createPdfBuilder } from '../../utils/pdfTemplate';
import { generateDocx, type DocxExportData } from '../../utils/docxTemplate';
import { tiptapJsonToHtml } from '../../utils/tiptapToHtml';
import NodeTree from '../tree/NodeTree.vue';
import DossierInfo from './DossierInfo.vue';
import NoteEditor from '../editor/NoteEditor.vue';
import ExcalidrawWrapper from '../excalidraw/ExcalidrawWrapper.vue';
import MapEditor from '../map/MapEditor.vue';
import PomodoroTimer from '../common/PomodoroTimer.vue';
import TaskPanel from './TaskPanel.vue';
import ActivityPanel from './ActivityPanel.vue';
import WebClipperDialog from './WebClipperDialog.vue';
import ExportSelectDialog from './ExportSelectDialog.vue';
import DatasetEditor from '../dataset/DatasetEditor.vue';

const webClipperOpen = ref(false);
const exportSelectOpen = ref(false);

// AI Summary
const summaryDialog = ref(false);
const summaryContent = ref('');
const summarizing = ref(false);

async function runSummary() {
  if (!dossierStore.currentDossier || summarizing.value) return;
  summarizing.value = true;
  summaryContent.value = '';
  summaryDialog.value = true;
  try {
    const payload: Record<string, string> = { dossierId: dossierStore.currentDossier._id };
    if (dossierStore.selectedNode && dossierStore.selectedNode.type === 'note') {
      payload.nodeId = dossierStore.selectedNode._id;
    }
    const { data } = await api.post('/ai/summarize', payload);
    summaryContent.value = data.summary;
  } catch (err: any) {
    summaryContent.value = `Erreur: ${err.response?.data?.message || err.message}`;
  } finally {
    summarizing.value = false;
  }
}

function copySummary() {
  navigator.clipboard.writeText(summaryContent.value);
}

const dossierStore = useDossierStore();
const authStore = useAuthStore();
const templateStore = useTemplateStore();
templateStore.fetchTemplates();
const createDialog = ref(false);
const snapshotDialog = ref(false);
const snapshots = ref<any[]>([]);
const snapshotLabel = ref('');
const createType = ref('');
const createParentId = ref<string | null>(null);
const createTitle = ref('');
const selectedTemplateId = ref<string | null>(null);

// Sidebar tab
const sidebarTab = ref<'tree' | 'tasks' | 'activity'>('tree');

// Focus mode
const focusMode = ref(false);

function toggleFocusMode() {
  focusMode.value = !focusMode.value;
}

function onFocusKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && focusMode.value) {
    focusMode.value = false;
  }
}

onMounted(() => document.addEventListener('keydown', onFocusKeydown));
onUnmounted(() => document.removeEventListener('keydown', onFocusKeydown));

// AI Report
const aiEnabled = ref(false);
const aiTemplateSelectDialog = ref(false);
const aiReportTemplates = ref<Array<{ _id: string; title: string; description: string; isShared: boolean; owner?: any }>>([]);
const aiSelectedTemplateId = ref<string | null>(null);
const aiLoadingTemplates = ref(false);
const aiReportDialog = ref(false);
const aiGenerating = ref(false);
const aiReportContent = ref('');
const aiReportModel = ref('');
const aiReportError = ref('');
const aiTokenCount = ref(0);
const aiLogs = ref<Array<{ time: string; message: string; type: string }>>([]);
const aiLogsExpanded = ref(true);
const aiReportBodyRef = ref<HTMLElement | null>(null);
const aiLogsRef = ref<HTMLElement | null>(null);
let aiAbortController: AbortController | null = null;

function aiLogTime() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function checkAiStatus() {
  try {
    const { data } = await api.get('/ai/status');
    aiEnabled.value = data.enabled && data.hasModel;
  } catch {
    aiEnabled.value = false;
  }
}
checkAiStatus();

async function openAiReportTemplateSelect() {
  if (!dossierStore.currentDossier) return;
  aiSelectedTemplateId.value = null;
  aiLoadingTemplates.value = true;
  aiTemplateSelectDialog.value = true;
  try {
    const { data } = await api.get('/report-templates');
    aiReportTemplates.value = data.templates || [];
  } catch {
    aiReportTemplates.value = [];
  } finally {
    aiLoadingTemplates.value = false;
  }
}

async function generateAiReport(templateId?: string | null) {
  aiTemplateSelectDialog.value = false;
  if (!dossierStore.currentDossier) return;
  aiReportDialog.value = true;
  aiGenerating.value = true;
  aiReportContent.value = '';
  aiReportModel.value = '';
  aiReportError.value = '';
  aiTokenCount.value = 0;
  aiLogs.value = [];
  aiLogsExpanded.value = true;

  aiAbortController = new AbortController();
  const token = localStorage.getItem('accessToken');
  const dossierId = dossierStore.currentDossier._id;

  aiLogs.value.push({ time: aiLogTime(), message: 'Envoi de la requete...', type: 'info' });

  const bodyPayload: any = { dossierId };
  if (templateId) bodyPayload.templateId = templateId;

  try {
    const response = await fetch(`${SERVER_URL}/api/ai/generate-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(bodyPayload),
      signal: aiAbortController.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));

          if (event.type === 'token') {
            aiReportContent.value += event.token;
            aiTokenCount.value = event.tokenCount;
            // Auto-scroll report body
            if (aiReportBodyRef.value) {
              aiReportBodyRef.value.scrollTop = aiReportBodyRef.value.scrollHeight;
            }
          } else if (event.type === 'log') {
            aiLogs.value.push({ time: aiLogTime(), message: event.message, type: 'info' });
            scrollLogs();
          } else if (event.type === 'done') {
            aiReportModel.value = event.model;
            aiLogs.value.push({ time: aiLogTime(), message: 'Rapport termine.', type: 'info' });
            aiLogsExpanded.value = false;
          } else if (event.type === 'error') {
            aiReportError.value = event.message;
            aiLogs.value.push({ time: aiLogTime(), message: event.message, type: 'error' });
          } else if (event.type === 'cancelled') {
            aiLogs.value.push({ time: aiLogTime(), message: 'Generation annulee.', type: 'error' });
          }
        } catch {
          // skip malformed events
        }
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      aiLogs.value.push({ time: aiLogTime(), message: 'Generation annulee par l\'utilisateur.', type: 'error' });
    } else {
      aiReportError.value = `Erreur: ${err.message}`;
      aiLogs.value.push({ time: aiLogTime(), message: `Erreur: ${err.message}`, type: 'error' });
    }
  } finally {
    aiGenerating.value = false;
    aiAbortController = null;
  }
}

function scrollLogs() {
  setTimeout(() => {
    if (aiLogsRef.value) aiLogsRef.value.scrollTop = aiLogsRef.value.scrollHeight;
  }, 50);
}

async function cancelAiReport() {
  if (aiAbortController) aiAbortController.abort();
  if (dossierStore.currentDossier) {
    try {
      await api.post('/ai/generate-report/cancel', { dossierId: dossierStore.currentDossier._id });
    } catch {
      // best-effort
    }
  }
}

function closeAiReport() {
  if (aiGenerating.value) return;
  aiReportDialog.value = false;
}

async function downloadAiReportAsPdf() {
  if (!aiReportContent.value || !dossierStore.currentDossier) return;
  try {
    const { jsPDF } = await import('jspdf');
    const dossier = dossierStore.currentDossier;
    const tpl = loadPdfTemplate();
    const logos = await loadTemplateLogos(tpl, SERVER_URL);
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const b = createPdfBuilder(doc, tpl, logos);

    // === COVER PAGE ===
    const extraLines = [`Rapport IA - ${new Date().toLocaleDateString('fr-FR')}`];
    if (aiReportModel.value) extraLines.push(`Mod\u00E8le: ${aiReportModel.value}`);
    if (dossier.investigator) extraLines.push(`Enqu\u00EAteur demandeur: ${dossier.investigator}`);
    b.drawCover(`Dossier \u00AB ${dossier.title} \u00BB`, extraLines);

    // === CONTENT ===
    b.newContentPage();

    // Parse AI content into sections
    const aiText = aiReportContent.value;
    const sectionRegex = /^#{1,3}\s+(.+)$/gm;
    const sections: Array<{ title: string; body: string }> = [];
    let match: RegExpExecArray | null;
    const matches: Array<{ title: string; index: number }> = [];
    while ((match = sectionRegex.exec(aiText)) !== null) {
      matches.push({ title: match[1].trim(), index: match.index });
    }

    if (matches.length > 0) {
      const preamble = aiText.substring(0, matches[0].index).trim();
      if (preamble) sections.push({ title: '', body: preamble });
      for (let i = 0; i < matches.length; i++) {
        const headingEnd = aiText.indexOf('\n', matches[i].index);
        const bodyStart = headingEnd >= 0 ? headingEnd + 1 : matches[i].index + matches[i].title.length;
        const bodyEnd = i + 1 < matches.length ? matches[i + 1].index : aiText.length;
        sections.push({ title: matches[i].title, body: aiText.substring(bodyStart, bodyEnd).trim() });
      }
    } else {
      sections.push({ title: '', body: aiText });
    }

    for (const section of sections) {
      if (section.title) b.addSectionTitle(section.title);
      if (section.body) {
        const paragraphs = section.body.split(/\n\s*\n/);
        for (const para of paragraphs) {
          const trimmed = para.trim();
          if (trimmed) b.addBody(trimmed);
        }
      }
    }

    b.addDisclaimer('Le pr\u00E9sent rapport est strictement confidentiel et destin\u00E9 uniquement aux autorit\u00E9s judiciaires comp\u00E9tentes. Toute diffusion, reproduction ou utilisation non autoris\u00E9e est interdite.');

    await addSignatureBlock(b);
    const blob = b.finalize();
    downloadBlob(blob, `Rapport_OSINT_IA_${dossier.title}.pdf`);
    aiReportDialog.value = false;
  } catch (err) {
    console.error('AI PDF export failed:', err);
  }
}

async function downloadAiReportAsDocx() {
  if (!aiReportContent.value || !dossierStore.currentDossier) return;
  try {
    const dossier = dossierStore.currentDossier;
    const sig = (authStore.user as any)?.signature;

    // Parse AI content into sections
    const aiText = aiReportContent.value;
    const sectionRegex = /^#{1,3}\s+(.+)$/gm;
    const docxSections: DocxExportData['sections'] = [];
    let match: RegExpExecArray | null;
    const matches: Array<{ title: string; index: number; hashes: number }> = [];
    while ((match = sectionRegex.exec(aiText)) !== null) {
      const hashes = match[0].indexOf(' ');
      matches.push({ title: match[1].trim(), index: match.index, hashes });
    }

    if (matches.length > 0) {
      const preamble = aiText.substring(0, matches[0].index).trim();
      if (preamble) {
        docxSections.push({ title: '', level: 'h1', paragraphs: preamble.split(/\n\s*\n/).filter((p: string) => p.trim()) });
      }
      for (let i = 0; i < matches.length; i++) {
        const m = matches[i]!;
        const mNext = matches[i + 1];
        const headingEnd = aiText.indexOf('\n', m.index);
        const bodyStart = headingEnd >= 0 ? headingEnd + 1 : m.index + m.title.length;
        const bodyEnd = mNext ? mNext.index : aiText.length;
        const body = aiText.substring(bodyStart, bodyEnd).trim();
        const level = m.hashes <= 1 ? 'h1' : m.hashes === 2 ? 'h2' : 'h3';
        docxSections.push({
          title: m.title,
          level,
          paragraphs: body ? body.split(/\n\s*\n/).filter((p: string) => p.trim()) : [],
        });
      }
    } else {
      docxSections.push({ title: '', level: 'h1', paragraphs: aiText.split(/\n\s*\n/).filter((p: string) => p.trim()) });
    }

    const data: DocxExportData = {
      dossierTitle: dossier.title,
      subtitle: `Dossier \u00AB ${dossier.title} \u00BB - Rapport IA`,
      extraCoverLines: [
        new Date().toLocaleDateString('fr-FR'),
        ...(aiReportModel.value ? [`Mod\u00E8le: ${aiReportModel.value}`] : []),
        ...(dossier.investigator ? [`Enqu\u00EAteur demandeur: ${dossier.investigator}`] : []),
      ],
      sections: docxSections,
      disclaimerText: 'Le pr\u00E9sent rapport est strictement confidentiel et destin\u00E9 uniquement aux autorit\u00E9s judiciaires comp\u00E9tentes. Toute diffusion, reproduction ou utilisation non autoris\u00E9e est interdite.',
      closingDate: new Date().toLocaleDateString('fr-FR'),
      signature: sig?.name ? sig : undefined,
      signatureImagePath: (authStore.user as any)?.signatureImagePath || undefined,
      serverUrl: SERVER_URL,
    };

    await generateDocx(data);
    aiReportDialog.value = false;
  } catch (err) {
    console.error('AI DOCX export failed:', err);
  }
}

function onMindmapUpdate(val: any) {
  if (dossierStore.selectedNode) {
    dossierStore.selectedNode.excalidrawData = val;
  }
}

function onMapUpdate(val: any) {
  if (dossierStore.selectedNode) {
    dossierStore.selectedNode.mapData = val;
  }
}

function handleCreateNode(type: string, parentId: string | null) {
  createType.value = type;
  createParentId.value = parentId;
  createTitle.value = '';
  selectedTemplateId.value = null;
  createDialog.value = true;
}

async function confirmCreate() {
  let content = null;

  // If a template is selected, resolve placeholders
  if (selectedTemplateId.value && dossierStore.currentDossier) {
    try {
      content = await templateStore.resolveTemplate(
        selectedTemplateId.value,
        dossierStore.currentDossier._id
      );
    } catch (err) {
      console.error('Failed to resolve template:', err);
    }
  }

  await dossierStore.createNode({
    type: createType.value as any,
    title: createTitle.value,
    parentId: createParentId.value,
    content,
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

function esc(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function printDossier(selectedNodeIds?: string[]) {
  const dossier = dossierStore.currentDossier;
  if (!dossier) return;

  const allNotes = dossierStore.nodes.filter((n) => n.type === 'note' && !n.deletedAt);
  const nodes = selectedNodeIds ? allNotes.filter((n) => selectedNodeIds.includes(n._id)) : allNotes;
  const statusLabels: Record<string, string> = { open: 'Ouvert', in_progress: 'En cours', closed: 'Clos' };

  let entitiesHtml = '';
  if (dossier.entities && dossier.entities.length > 0) {
    entitiesHtml = `
      <div class="print-section">
        <h2>Entites</h2>
        <table>
          <thead><tr><th>Nom</th><th>Type</th><th>Description</th></tr></thead>
          <tbody>
            ${dossier.entities.map((e) => `<tr><td>${esc(e.name)}</td><td>${esc(e.type)}</td><td>${esc(e.description)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  let investigatorHtml = '';
  const inv = dossier.investigator;
  if (inv && (inv.name || inv.service || inv.email)) {
    investigatorHtml = `
      <div class="print-section">
        <h2>Enqueteur</h2>
        <table>
          <tbody>
            ${inv.name ? `<tr><td><strong>Nom</strong></td><td>${esc(inv.name)}</td></tr>` : ''}
            ${inv.service ? `<tr><td><strong>Service</strong></td><td>${esc(inv.service)}</td></tr>` : ''}
            ${inv.unit ? `<tr><td><strong>Unite</strong></td><td>${esc(inv.unit)}</td></tr>` : ''}
            ${inv.phone ? `<tr><td><strong>Telephone</strong></td><td>${esc(inv.phone)}</td></tr>` : ''}
            ${inv.email ? `<tr><td><strong>Email</strong></td><td>${esc(inv.email)}</td></tr>` : ''}
          </tbody>
        </table>
      </div>`;
  }

  let objectivesHtml = '';
  if (dossier.objectives) {
    objectivesHtml = `
      <div class="print-section">
        <h2>Objectifs</h2>
        <p>${esc(dossier.objectives).replace(/\n/g, '<br>')}</p>
      </div>`;
  }

  let judicialHtml = '';
  if (dossier.judicialFacts) {
    judicialHtml = `
      <div class="print-section">
        <h2>Faits judiciaires</h2>
        <p>${esc(dossier.judicialFacts).replace(/\n/g, '<br>')}</p>
      </div>`;
  }

  let notesHtml = '';
  if (nodes.length > 0) {
    notesHtml = nodes.map((node) => {
      let contentHtml = '';
      if (node.content) {
        contentHtml = tiptapJsonToHtml(node.content);
      }
      if (!contentHtml) {
        contentHtml = '<p><em>Contenu vide</em></p>';
      }
      return `
        <div class="print-section print-note">
          <h2>${esc(node.title)}</h2>
          <div class="note-content">${contentHtml}</div>
        </div>`;
    }).join('');
  }

  const createdDate = new Date(dossier.createdAt).toLocaleDateString('fr-FR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const printHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Impression - ${esc(dossier.title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a1a;
      background: #fff;
      line-height: 1.6;
      font-size: 12pt;
    }
    .print-cover {
      text-align: center;
      padding: 60px 40px 40px;
      border-bottom: 3px solid #2196F3;
      margin-bottom: 30px;
    }
    .print-cover h1 {
      font-size: 28pt;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 12px;
    }
    .print-cover .subtitle {
      font-size: 12pt;
      color: #555;
      margin-bottom: 6px;
    }
    .print-cover .status {
      display: inline-block;
      padding: 4px 16px;
      border-radius: 12px;
      background: #e3f2fd;
      color: #1565c0;
      font-size: 10pt;
      font-weight: 600;
      margin-top: 10px;
    }
    .print-container { max-width: 800px; margin: 0 auto; padding: 0 40px 40px; }
    .print-section {
      margin-bottom: 28px;
      page-break-inside: avoid;
    }
    .print-note { page-break-before: auto; }
    .print-section h2 {
      font-size: 16pt;
      font-weight: 700;
      color: #1565c0;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 6px;
      margin-bottom: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 11pt;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background: #f5f5f5;
      font-weight: 600;
      color: #333;
    }
    .note-content img { max-width: 100%; height: auto; }
    .note-content blockquote {
      border-left: 4px solid #90caf9;
      padding: 8px 16px;
      margin: 12px 0;
      background: #f9f9f9;
      color: #444;
    }
    .note-content pre {
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 12px;
      font-size: 10pt;
      overflow-x: auto;
      white-space: pre-wrap;
    }
    .note-content code {
      background: #f0f0f0;
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 10pt;
    }
    .note-content pre code { background: none; padding: 0; }
    .note-content ul, .note-content ol { padding-left: 24px; margin: 8px 0; }
    .note-content p { margin-bottom: 8px; }
    .note-content h1, .note-content h2, .note-content h3,
    .note-content h4, .note-content h5, .note-content h6 {
      margin-top: 16px; margin-bottom: 8px; color: #1a1a1a;
    }
    .note-content hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
    .note-content a { color: #1565c0; text-decoration: underline; }
    .note-content .task-list { list-style: none; padding-left: 0; }
    .note-content .task-item { display: flex; align-items: flex-start; gap: 6px; }
    .note-content .task-item input[type="checkbox"] { margin-top: 5px; }
    .print-footer {
      text-align: center;
      font-size: 9pt;
      color: #999;
      border-top: 1px solid #eee;
      padding-top: 12px;
      margin-top: 40px;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .print-cover { page-break-after: always; }
      .print-note { page-break-inside: avoid; }
      .print-section { page-break-inside: avoid; }
      @page { margin: 15mm 20mm; }
    }
  </style>
</head>
<body>
  <div class="print-cover">
    <h1>${esc(dossier.title)}</h1>
    ${dossier.description ? `<p class="subtitle">${esc(dossier.description)}</p>` : ''}
    <p class="subtitle">${createdDate}</p>
    <span class="status">${statusLabels[dossier.status] || dossier.status}</span>
  </div>
  <div class="print-container">
    ${investigatorHtml}
    ${objectivesHtml}
    ${judicialHtml}
    ${entitiesHtml}
    ${notesHtml}
    <div class="print-footer">
      Impression generee le ${new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
    </div>
  </div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(printHtml);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

async function addSignatureBlock(b: ReturnType<typeof createPdfBuilder>) {
  const { doc } = b;
  const rightX = b.pageW - b.margin;
  const closingDate = new Date().toLocaleDateString('fr-FR');

  b.checkPage(60);
  b.y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Bruxelles, le ${closingDate}`, rightX, b.y, { align: 'right' });
  b.y += 8;

  // Signature image
  const sigImgPath = (authStore.user as any)?.signatureImagePath;
  if (sigImgPath) {
    try {
      const imgData = await loadImageAsDataUrl(`${SERVER_URL}/${sigImgPath}`);
      if (imgData) {
        b.checkPage(35);
        doc.addImage(imgData, 'PNG', rightX - 50, b.y, 50, 20);
        b.y += 24;
      }
    } catch { /* skip */ }
  }

  // Signature text
  const sig = (authStore.user as any)?.signature;
  if (sig?.name) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    if (sig.title) { doc.text(sig.title, rightX, b.y, { align: 'right' }); b.y += 5; }
    doc.text(sig.name, rightX, b.y, { align: 'right' }); b.y += 5;
    doc.setFont('helvetica', 'normal');
    if (sig.service) { doc.text(sig.service, rightX, b.y, { align: 'right' }); b.y += 5; }
    if (sig.unit) { doc.text(sig.unit, rightX, b.y, { align: 'right' }); b.y += 5; }
    if (sig.email) { doc.text(sig.email, rightX, b.y, { align: 'right' }); b.y += 5; }
  }
}

function handleSelectiveExport(format: 'pdf' | 'docx' | 'print', selectedIds: string[]) {
  if (format === 'pdf') exportPDF(selectedIds);
  else if (format === 'docx') exportDOCX(selectedIds);
  else if (format === 'print') printDossier(selectedIds);
}

async function exportPDF(selectedNodeIds?: string[]) {
  if (!dossierStore.currentDossier) return;
  try {
    const { jsPDF } = await import('jspdf');
    const dossier = dossierStore.currentDossier;
    const allNodes = dossierStore.nodes;
    const nodes = selectedNodeIds ? allNodes.filter(n => selectedNodeIds.includes(n._id)) : allNodes;
    const tpl = loadPdfTemplate();
    const logos = await loadTemplateLogos(tpl, SERVER_URL);
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const b = createPdfBuilder(doc, tpl, logos);

    // === COVER PAGE ===
    const extraLines = [`Rapport n\u00B01 - ${new Date().toLocaleDateString('fr-FR')}`];
    if (dossier.status) extraLines.push(`Statut: ${dossier.status}`);
    if (dossier.investigator) extraLines.push(`Enqu\u00EAteur demandeur: ${dossier.investigator}`);
    b.drawCover(`Dossier \u00AB ${dossier.title} \u00BB`, extraLines);

    // === CONTENT ===
    b.newContentPage();

    if (dossier.entities?.length) {
      b.addSectionTitle('Entit\u00E9s concern\u00E9es');
      b.addBody('Les recherches demand\u00E9es par l\u2019enqu\u00EAteur portent sur les entit\u00E9s suivantes :');
      dossier.entities.forEach(ent => {
        b.checkPage(8);
        doc.setFontSize(tpl.body.fontSize);
        doc.setFont('helvetica', 'normal');
        const entLine = `\u2022 ${ent.name} (${ent.type})${ent.description ? ' : ' + ent.description : ''}`;
        const entLines: string[] = doc.splitTextToSize(entLine, b.usableW - 5);
        for (const l of entLines) {
          b.checkPage(5);
          doc.text(l, b.margin + 4, b.y);
          b.y += 4.5;
        }
      });
      b.y += 4;
    }

    if (dossier.objectives) {
      b.addSectionTitle('Objectifs de la recherche OSINT');
      b.addBody('Les objectifs sont d\u00E9finis comme suit :');
      b.addBody(dossier.objectives);
    }

    b.addSectionTitle('Synth\u00E8se des faits');
    if (dossier.judicialFacts) b.addBody(dossier.judicialFacts);
    if (dossier.description) b.addBody(dossier.description);
    if (!dossier.judicialFacts && !dossier.description) b.addBody('Aucune information disponible.');

    b.addSectionTitle('R\u00E9sum\u00E9 des recherches et des r\u00E9sultats');
    b.addBody('Les recherches en sources ouvertes ont \u00E9t\u00E9 men\u00E9es sur Internet. Il convient de souligner que, compte tenu de l\u2019immensit\u00E9 de ce r\u00E9seau et de la multiplicit\u00E9 des ressources disponibles, certaines informations pertinentes pourraient ne pas avoir \u00E9t\u00E9 identifi\u00E9es.');
    b.addDisclaimer('Note : toutes les recherches reprises dans ce rapport ont \u00E9t\u00E9 r\u00E9alis\u00E9es en sources ouvertes uniquement.');

    const noteNodes = nodes.filter(n => n.type === 'note');
    if (noteNodes.length > 0) {
      b.addSectionTitle('Recherches en source ouverte');
      for (const node of noteNodes) {
        b.checkPage(15);
        b.addSubHeading(node.title);
        if (node.content) {
          const text = extractTextFromTiptap(node.content);
          if (text) b.addBody(text);
        }
        b.y += 2;
      }
    }

    b.addSectionTitle('Conclusion');
    b.addBody(`Ce rapport est clos le ${new Date().toLocaleDateString('fr-FR')}.`);
    b.addDisclaimer('Le pr\u00E9sent rapport est strictement confidentiel et destin\u00E9 uniquement aux autorit\u00E9s judiciaires comp\u00E9tentes. Toute diffusion, reproduction ou utilisation non autoris\u00E9e est interdite.');

    await addSignatureBlock(b);
    const blob = b.finalize();
    downloadBlob(blob, `Rapport_OSINT_${dossier.title}.pdf`);
  } catch (err) {
    console.error('PDF export failed:', err);
  }
}


function buildDocxSections(dossier: any, nodes: any[], selectedNodeIds?: string[]): DocxExportData['sections'] {
  const sections: DocxExportData['sections'] = [];

  if (dossier.entities?.length) {
    sections.push({
      title: 'Entit\u00E9s concern\u00E9es',
      level: 'h1',
      paragraphs: ['Les recherches demand\u00E9es par l\u2019enqu\u00EAteur portent sur les entit\u00E9s suivantes :'],
      bullets: dossier.entities.map((ent: any) => `${ent.name} (${ent.type})${ent.description ? ' : ' + ent.description : ''}`),
    });
  }

  if (dossier.objectives) {
    sections.push({
      title: 'Objectifs de la recherche OSINT',
      level: 'h1',
      paragraphs: ['Les objectifs sont d\u00E9finis comme suit :', dossier.objectives],
    });
  }

  const factsParagraphs: string[] = [];
  if (dossier.judicialFacts) factsParagraphs.push(dossier.judicialFacts);
  if (dossier.description) factsParagraphs.push(dossier.description);
  if (!factsParagraphs.length) factsParagraphs.push('Aucune information disponible.');
  sections.push({ title: 'Synth\u00E8se des faits', level: 'h1', paragraphs: factsParagraphs });

  sections.push({
    title: 'R\u00E9sum\u00E9 des recherches et des r\u00E9sultats',
    level: 'h1',
    paragraphs: [
      'Les recherches en sources ouvertes ont \u00E9t\u00E9 men\u00E9es sur Internet. Il convient de souligner que, compte tenu de l\u2019immensit\u00E9 de ce r\u00E9seau et de la multiplicit\u00E9 des ressources disponibles, certaines informations pertinentes pourraient ne pas avoir \u00E9t\u00E9 identifi\u00E9es.',
      'Note : toutes les recherches reprises dans ce rapport ont \u00E9t\u00E9 r\u00E9alis\u00E9es en sources ouvertes uniquement.',
    ],
  });

  const noteNodes = nodes.filter(n => n.type === 'note');
  if (noteNodes.length > 0) {
    for (const node of noteNodes) {
      const text = node.content ? extractTextFromTiptap(node.content) : '';
      sections.push({
        title: node.title,
        level: 'h2',
        paragraphs: text ? text.split('\n').filter((l: string) => l.trim()) : [],
      });
    }
  }

  sections.push({
    title: 'Conclusion',
    level: 'h1',
    paragraphs: [`Ce rapport est clos le ${new Date().toLocaleDateString('fr-FR')}.`],
  });

  return sections;
}

async function exportDOCX(selectedNodeIds?: string[]) {
  if (!dossierStore.currentDossier) return;
  try {
    const dossier = dossierStore.currentDossier;
    const allNodes = dossierStore.nodes;
    const nodes = selectedNodeIds ? allNodes.filter(n => selectedNodeIds.includes(n._id)) : allNodes;
    const sig = (authStore.user as any)?.signature;

    const data: DocxExportData = {
      dossierTitle: dossier.title,
      subtitle: `Dossier \u00AB ${dossier.title} \u00BB - Rapport n\u00B01`,
      extraCoverLines: [
        `${new Date().toLocaleDateString('fr-FR')}`,
        `Statut: ${dossier.status}`,
        ...(dossier.investigator ? [`Enqu\u00EAteur demandeur: ${dossier.investigator}`] : []),
      ],
      sections: buildDocxSections(dossier, nodes),
      disclaimerText: 'Le pr\u00E9sent rapport est strictement confidentiel et destin\u00E9 uniquement aux autorit\u00E9s judiciaires comp\u00E9tentes. Toute diffusion, reproduction ou utilisation non autoris\u00E9e est interdite.',
      closingDate: new Date().toLocaleDateString('fr-FR'),
      signature: sig?.name ? sig : undefined,
      signatureImagePath: (authStore.user as any)?.signatureImagePath || undefined,
      serverUrl: SERVER_URL,
    };

    await generateDocx(data);
  } catch (err) {
    console.error('DOCX export failed:', err);
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
.dv-sidebar-tabs {
  display: flex;
  border-bottom: 1px solid var(--me-border);
  padding: 0 8px;
  gap: 2px;
}
.dv-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--me-text-muted);
  cursor: pointer;
  transition: all 0.15s;
  border-radius: 0;
}
.dv-tab:hover {
  color: var(--me-text-primary);
  background: var(--me-accent-glow);
}
.dv-tab.active {
  color: var(--me-accent);
  border-bottom-color: var(--me-accent);
}
.dv-sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.dv-main {
  flex: 1;
  overflow: hidden;
  background: var(--me-bg-deep);
  position: relative;
}
.dv-focus-bar {
  position: absolute;
  top: 8px;
  right: 12px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 6px;
}
.dv-focus-btn {
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--me-radius-xs);
  transition: all 0.15s;
  opacity: 0.6;
}
.dv-focus-btn:hover {
  opacity: 1;
  color: var(--me-accent);
  border-color: var(--me-accent);
}
.dv-focus-btn--active {
  opacity: 1;
  color: var(--me-accent);
  background: var(--me-accent-glow);
  border-color: var(--me-accent);
}
.dv-focus-mode {
  position: fixed;
  inset: 0;
  z-index: 100;
}
.dv-focus-mode .dv-main {
  width: 100%;
}
.dv-editor-wrap {
  height: 100%;
}
.dv-excalidraw-wrap {
  height: 100%;
  position: relative;
  z-index: 0;
}
.dv-map-wrap {
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
/* Template selection */
.template-select-section {
  margin-top: 8px;
}
.template-select-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--me-text-muted);
  margin-bottom: 8px;
}
.template-select-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}
.template-select-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}
.template-select-item:hover {
  border-color: var(--me-border-hover);
  color: var(--me-text-primary);
}
.template-select-item--active {
  border-color: var(--me-accent);
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.template-select-desc {
  font-size: 11px;
  color: var(--me-text-muted);
  margin-left: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 150px;
}
/* AI Report */
.dv-export-divider {
  height: 1px;
  background: var(--me-border);
  margin: 4px 0;
}
.dv-export-ai {
  color: var(--me-accent);
}
.ai-logs-panel {
  border-bottom: 1px solid var(--me-border);
}
.ai-logs-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 24px;
  cursor: pointer;
  font-size: 12px;
  color: var(--me-text-muted);
  transition: background 0.15s;
}
.ai-logs-header:hover {
  background: var(--me-accent-glow);
}
.ai-log-count {
  font-size: 10px;
  background: var(--me-bg-elevated);
  padding: 1px 6px;
  border-radius: 8px;
  color: var(--me-text-muted);
}
.ai-log-spin {
  animation: ai-spin 1s linear infinite;
}
@keyframes ai-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.ai-logs-content {
  max-height: 120px;
  overflow-y: auto;
  padding: 4px 24px 8px;
  background: var(--me-bg-deep);
}
.ai-log-line {
  font-size: 11px;
  line-height: 1.6;
  display: flex;
  gap: 8px;
}
.ai-log-time {
  color: var(--me-text-muted);
  flex-shrink: 0;
}
.ai-log-msg {
  color: var(--me-text-secondary);
}
.ai-log-error {
  color: #f87171;
}
.ai-report-body {
  max-height: 450px;
  overflow-y: auto;
}
.ai-generating {
  text-align: center;
  padding: 40px 20px;
  color: var(--me-text-muted);
  font-size: 14px;
}
.ai-generating p {
  margin-top: 12px;
}
.ai-report-content {
  font-size: 13px;
}
.ai-report-meta {
  font-size: 11px;
  color: var(--me-text-muted);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--me-border);
  display: flex;
  justify-content: space-between;
}
.ai-report-text {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
  color: var(--me-text-primary);
}
.ai-cursor {
  animation: ai-blink 0.6s infinite;
  color: var(--me-accent);
  font-weight: 700;
}
@keyframes ai-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
.ai-report-error {
  padding: 20px;
  text-align: center;
  color: #f87171;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ai-cancel-gen-btn {
  padding: 8px 16px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid #f87171;
  color: #f87171;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  transition: all 0.15s;
}
.ai-cancel-gen-btn:hover {
  background: rgba(248, 113, 113, 0.1);
}
.ai-footer-actions {
  display: flex;
  gap: 8px;
  width: 100%;
  justify-content: flex-end;
}
.ai-summary-text {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
  color: var(--me-text-primary);
}
/* AI Template selection */
.ai-tpl-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
  color: var(--me-text-muted);
  font-size: 13px;
}
.ai-tpl-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 350px;
  overflow-y: auto;
}
.ai-tpl-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: var(--me-radius-xs);
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  width: 100%;
  color: var(--me-text-primary);
}
.ai-tpl-item:hover {
  border-color: var(--me-accent);
}
.ai-tpl-item--active {
  border-color: var(--me-accent);
  background: var(--me-accent-glow);
}
.ai-tpl-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.ai-tpl-item-title {
  font-size: 13px;
  font-weight: 600;
}
.ai-tpl-item-desc {
  font-size: 11px;
  color: var(--me-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ai-tpl-shared-badge {
  font-size: 10px;
  color: var(--me-accent);
  font-weight: 600;
  margin-top: 2px;
}
</style>
