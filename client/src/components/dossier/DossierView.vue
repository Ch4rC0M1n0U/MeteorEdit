<template>
  <div class="dossier-view" :class="{ 'dv-focus-mode': focusMode }">
    <!-- Left panel: sidebar with tabs -->
    <aside v-show="!focusMode" class="dv-sidebar">
      <div class="dv-sidebar-header">
        <div class="dv-sidebar-title-row">
          <div class="dv-sidebar-icon-wrap">
            <img v-if="dossierLogoUrl" :src="dossierLogoUrl" class="dv-sidebar-logo" />
            <v-icon v-else-if="dossierStore.currentDossier?.icon" size="20">{{ dossierStore.currentDossier.icon }}</v-icon>
            <v-icon v-else size="20" class="dv-sidebar-icon-default">mdi-folder-outline</v-icon>
          </div>
          <h3 class="dv-sidebar-title" :title="dossierStore.currentDossier?.title">
            {{ dossierStore.currentDossier?.title }}
          </h3>
        </div>
        <div class="dv-sidebar-actions">
          <v-menu>
            <template #activator="{ props: menuProps }">
              <button v-bind="menuProps" class="dv-action-btn" :title="$t('dossier.export')">
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
                <span>{{ $t('dossier.exportPrint') }}</span>
              </button>
              <div v-if="aiEnabled" class="dv-export-divider" />
              <button v-if="aiEnabled" class="dv-export-option dv-export-ai" @click="openAiReportTemplateSelect">
                <v-icon size="16">mdi-robot-outline</v-icon>
                <span>{{ $t('dossier.generateAiReport') }}</span>
              </button>
            </div>
          </v-menu>
          <button
            v-if="dossierStore.selectedNode && ['note', 'mindmap', 'map'].includes(dossierStore.selectedNode.type)"
            class="dv-action-btn"
            @click="openSnapshots"
            :title="$t('dossier.versionHistory')"
          >
            <v-icon size="16">mdi-history</v-icon>
          </button>
          <button
            v-if="dossierStore.selectedNode?.fileHash"
            class="dv-action-btn"
            @click="evidencePanelOpen = true"
            :title="$t('dossier.evidenceIntegrity')"
          >
            <v-icon size="16">mdi-shield-check-outline</v-icon>
          </button>
          <button class="dv-action-btn" @click="webClipperOpen = true" title="Web Clipper">
            <v-icon size="16">mdi-web</v-icon>
          </button>
          <button v-if="aiEnabled" class="dv-action-btn" @click="runSummary" :disabled="summarizing" :title="$t('dossier.aiSummaryTitle')">
            <v-icon size="16" :class="{ 'ai-spin': summarizing }">{{ summarizing ? 'mdi-loading' : 'mdi-robot-outline' }}</v-icon>
          </button>
        </div>
      </div>

      <!-- Online collaborators -->
      <div v-if="dossierStore.activeCollaborators.length" class="dv-collab-bar">
        <div class="dv-collab-avatars">
          <v-tooltip v-for="collab in dossierStore.activeCollaborators" :key="collab.userId" :text="`${collab.firstName} ${collab.lastName}`" location="bottom">
            <template #activator="{ props: tooltipProps }">
              <div v-bind="tooltipProps" class="dv-collab-avatar">
                <img v-if="collab.avatarPath" :src="SERVER_URL + '/' + collab.avatarPath" class="dv-collab-img" />
                <span v-else class="dv-collab-initials">{{ collab.initials }}</span>
                <span class="dv-collab-dot" />
              </div>
            </template>
          </v-tooltip>
        </div>
        <span class="dv-collab-label">{{ $t('dossier.online', { count: dossierStore.activeCollaborators.length }) }}</span>
      </div>

      <!-- Quick nav -->
      <div class="dv-sidebar-nav">
        <button class="dv-nav-item" :class="{ active: sidebarTab === 'tree' }" @click="sidebarTab = 'tree'">
          <v-icon size="18">mdi-file-tree-outline</v-icon>
          <span>{{ $t('dossier.tree') }}</span>
        </button>
        <button class="dv-nav-item" :class="{ active: sidebarTab === 'tasks' }" @click="sidebarTab = 'tasks'">
          <v-icon size="18">mdi-checkbox-marked-outline</v-icon>
          <span>{{ $t('dossier.tasks') }}</span>
        </button>
        <button class="dv-nav-item" :class="{ active: sidebarTab === 'evidence' }" @click="sidebarTab = 'evidence'">
          <v-icon size="18">mdi-shield-check-outline</v-icon>
          <span>{{ $t('dossier.integrity') }}</span>
        </button>
      </div>

      <div class="dv-sidebar-content">
        <NodeTree v-show="sidebarTab === 'tree'" @create="handleCreateNode" @duplicate="handleDuplicateNode" @file-drop="handleFileDrop" />
        <TaskPanel v-if="sidebarTab === 'tasks'" />
        <DossierEvidenceView
          v-if="sidebarTab === 'evidence' && dossierStore.currentDossier"
          :dossier-id="dossierStore.currentDossier._id"
          @select-node="onEvidenceSelectNode"
        />
      </div>
    </aside>

    <!-- Right panel: content -->
    <main class="dv-main">
      <!-- Focus mode toggle (notes & maps only, not mindmap — mindmap uses toolbar slot) -->
      <div
        v-if="dossierStore.selectedNode && dossierStore.selectedNode.type === 'note'"
        class="dv-focus-bar"
      >
        <PomodoroTimer v-if="focusMode" />
        <button
          class="dv-focus-btn"
          :class="{ 'dv-focus-btn--active': focusMode }"
          @click="toggleFocusMode"
          :title="focusMode ? $t('dossier.exitFocusMode') : $t('dossier.focusMode')"
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
              :title="focusMode ? $t('dossier.exitFocusMode') : $t('dossier.focusMode')"
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
          @update:data="onMapUpdate">
          <template #toolbar-end>
            <PomodoroTimer v-if="focusMode" />
            <button
              class="me-map-focus-btn"
              :class="{ active: focusMode }"
              @click="toggleFocusMode"
              :title="focusMode ? $t('dossier.exitFocusMode') : $t('dossier.focusMode')"
            >
              <v-icon size="16">{{ focusMode ? 'mdi-fullscreen-exit' : 'mdi-fullscreen' }}</v-icon>
            </button>
          </template>
        </MapEditor>
      </div>

      <div v-else-if="dossierStore.selectedNode.type === 'dataset'" class="dv-editor-wrap">
        <DatasetEditor
          v-model="dossierStore.selectedNode.content"
          :node-id="dossierStore.selectedNode._id"
          :title="dossierStore.selectedNode.title"
          :key="dossierStore.selectedNode._id"
        />
      </div>

      <div v-else-if="dossierStore.selectedNode.type === 'document'" class="dv-content-panel dv-document-panel">
        <div class="dv-content-header">
          <v-icon size="20" class="mr-2">mdi-file-document-outline</v-icon>
          <h2>{{ dossierStore.selectedNode.title }}</h2>
          <span class="text-muted mono ml-2" style="font-size: 12px;">{{ dossierStore.selectedNode.fileName }}</span>
          <div class="dv-doc-actions">
            <button
              v-if="isImageFile(dossierStore.selectedNode.fileName)"
              class="dv-action-btn"
              :class="{ 'dv-action-btn--active': annotatorOpen }"
              @click="annotatorOpen = !annotatorOpen"
              :title="$t('dossier.annotateImage')"
            >
              <v-icon size="16">mdi-draw</v-icon>
            </button>
            <a
              v-if="dossierStore.selectedNode.fileUrl"
              :href="SERVER_URL + '/' + dossierStore.selectedNode.fileUrl"
              target="_blank"
              class="dv-action-btn"
              :title="$t('dossier.openFile')"
            >
              <v-icon size="16">mdi-open-in-new</v-icon>
            </a>
          </div>
        </div>
        <!-- Image preview with optional annotator -->
        <div v-if="isImageFile(dossierStore.selectedNode.fileName) && dossierStore.selectedNode.fileUrl" class="dv-doc-image-area">
          <ImageAnnotator
            v-if="annotatorOpen"
            :image-src="SERVER_URL + '/' + dossierStore.selectedNode.fileUrl"
            :initial-annotations="dossierStore.selectedNode.content?.annotations"
            :key="'annot-' + dossierStore.selectedNode._id"
            @save="onAnnotationsSave"
          />
          <img
            v-else
            :src="SERVER_URL + '/' + dossierStore.selectedNode.fileUrl"
            class="dv-doc-image-preview"
          />
        </div>
        <!-- Non-image file info -->
        <div v-else-if="dossierStore.selectedNode.fileUrl" class="dv-doc-file-info">
          <v-icon size="48" class="dv-doc-file-icon">mdi-file-document-outline</v-icon>
          <p class="text-muted">{{ dossierStore.selectedNode.fileName }}</p>
          <a
            :href="SERVER_URL + '/' + dossierStore.selectedNode.fileUrl"
            target="_blank"
            class="dv-doc-download-btn"
          >
            <v-icon size="14" class="mr-1">mdi-download</v-icon>
            {{ $t('dossier.download') }}
          </a>
        </div>
        <p v-else class="text-muted" style="padding: 16px;">{{ $t('dossier.noFileAttached') }}</p>
      </div>

      <div v-else-if="dossierStore.selectedNode.type === 'folder'" class="dv-content-panel">
        <div class="dv-content-header">
          <v-icon size="20" class="mr-2">mdi-folder-outline</v-icon>
          <h2>{{ dossierStore.selectedNode.title }}</h2>
        </div>
        <p class="text-muted">{{ $t('dossier.folderLabel') }}</p>
      </div>
    </main>

    <!-- Evidence Panel -->
    <v-dialog v-model="evidencePanelOpen" max-width="480">
      <div class="glass-card" style="max-height: 80vh; overflow: hidden;">
        <EvidencePanel
          v-if="dossierStore.selectedNode"
          :node-id="dossierStore.selectedNode._id"
          :node-title="dossierStore.selectedNode.title"
          @close="evidencePanelOpen = false"
        />
      </div>
    </v-dialog>

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
            {{ $t('dossier.aiSummaryTitle') }}
          </h3>
          <button class="me-close-btn" @click="summaryDialog = false">
            <v-icon size="18">mdi-close</v-icon>
          </button>
        </div>
        <div class="dialog-body" style="max-height: 400px; overflow-y: auto;">
          <div v-if="summarizing" style="text-align: center; padding: 32px;">
            <v-progress-circular indeterminate size="28" color="var(--me-accent)" />
            <p style="margin-top: 12px; color: var(--me-text-muted); font-size: 13px;">{{ $t('dossier.generatingSummary') }}</p>
          </div>
          <pre v-else class="ai-summary-text">{{ summaryContent }}</pre>
        </div>
        <div class="dialog-footer">
          <button class="me-btn-ghost" @click="summaryDialog = false">{{ $t('common.close') }}</button>
          <button v-if="summaryContent" class="me-btn-primary" @click="copySummary">
            <v-icon size="14" class="mr-1">mdi-content-copy</v-icon>
            {{ $t('dossier.copy') }}
          </button>
        </div>
      </div>
    </v-dialog>
  </div>

  <!-- Snapshot panel -->
  <v-dialog v-model="snapshotDialog" max-width="480">
    <div class="glass-card dialog-card">
      <div class="dialog-header">
        <h3 class="mono">{{ $t('dossier.versionHistory') }}</h3>
        <button class="me-close-btn" @click="snapshotDialog = false">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>
      <div class="dialog-body" style="max-height: 400px; overflow-y: auto;">
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
          <v-text-field
            v-model="snapshotLabel"
            :label="$t('dossier.labelOptional')"
            density="compact"
            hide-details
          />
          <button class="me-btn-primary" @click="createSnap" style="white-space: nowrap;">
            <v-icon size="14" class="mr-1">mdi-camera-outline</v-icon>
            {{ $t('common.save') }}
          </button>
        </div>
        <div v-if="!snapshots.length" style="text-align: center; padding: 24px; color: var(--me-text-muted); font-size: 13px;">
          {{ $t('dossier.noSavedVersions') }}
        </div>
        <div v-for="snap in snapshots" :key="snap._id" class="snap-item">
          <div class="snap-info">
            <span class="snap-label">{{ snap.label || $t('dossier.versionNoLabel') }}</span>
            <span class="snap-date mono">{{ formatDate(snap.createdAt) }}</span>
          </div>
          <div class="snap-actions">
            <button class="snap-action-btn" @click="restoreSnap(snap._id)" :title="$t('common.restore')">
              <v-icon size="14">mdi-restore</v-icon>
            </button>
            <button class="snap-action-btn snap-action-danger" @click="deleteSnap(snap._id)" :title="$t('common.delete')">
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
          {{ $t('dossier.chooseTemplate') }}
        </h3>
        <button class="me-close-btn" @click="aiTemplateSelectDialog = false">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>
      <div class="dialog-body">
        <div v-if="aiLoadingTemplates" class="ai-tpl-loading">
          <v-progress-circular indeterminate size="24" color="var(--me-accent)" />
          <span>{{ $t('common.loading') }}</span>
        </div>
        <div v-else class="ai-tpl-list">
          <button
            :class="['ai-tpl-item', { 'ai-tpl-item--active': aiSelectedTemplateId === null }]"
            @click="aiSelectedTemplateId = null"
          >
            <div class="ai-tpl-item-info">
              <span class="ai-tpl-item-title mono">{{ $t('dossier.defaultTemplate') }}</span>
              <span class="ai-tpl-item-desc">{{ $t('dossier.defaultTemplateDesc') }}</span>
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
              <span class="ai-tpl-item-desc">{{ tpl.description || $t('dossier.noDescription') }}</span>
              <span v-if="tpl.isShared" class="ai-tpl-shared-badge mono">{{ $t('dossier.shared') }}</span>
            </div>
            <v-icon v-if="aiSelectedTemplateId === tpl._id" size="16" color="var(--me-accent)">mdi-check-circle</v-icon>
          </button>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="me-btn-ghost" @click="aiTemplateSelectDialog = false">{{ $t('common.cancel') }}</button>
        <button class="me-btn-primary" @click="generateAiReport(aiSelectedTemplateId)" :disabled="aiLoadingTemplates">
          <v-icon size="14" class="mr-1">mdi-robot-outline</v-icon>
          {{ $t('dossier.generate') }}
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
          {{ $t('dossier.aiReportTitle') }}
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
          <p>{{ $t('dossier.preparingReport') }}</p>
        </div>

        <div v-if="aiReportContent" class="ai-report-content">
          <div class="ai-report-meta mono">
            <span>{{ $t('dossier.model') }}: {{ aiReportModel }}</span>
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
          {{ $t('dossier.stopGeneration') }}
        </button>
        <div v-else class="ai-footer-actions">
          <button class="me-btn-ghost" @click="closeAiReport">{{ $t('common.close') }}</button>
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
        <h3 class="mono">{{ $t('dossier.newNode', { type: createType }) }}</h3>
        <button class="me-close-btn" @click="createDialog = false">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>
      <div class="dialog-body">
        <v-text-field v-model="createTitle" :label="$t('common.title')" autofocus @keyup.enter="confirmCreate" />
        <!-- Template selection for notes -->
        <div v-if="createType === 'note' && templateStore.templates.length" class="template-select-section">
          <span class="template-select-label mono">{{ $t('dossier.useTemplate') }}</span>
          <div class="template-select-list">
            <button
              :class="['template-select-item', { 'template-select-item--active': !selectedTemplateId }]"
              @click="selectedTemplateId = null"
              type="button"
            >
              <v-icon size="16" class="mr-1">mdi-file-outline</v-icon>
              <span>{{ $t('dossier.blankNote') }}</span>
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
        <button class="me-btn-ghost" @click="createDialog = false">{{ $t('common.cancel') }}</button>
        <button class="me-btn-primary" @click="confirmCreate" :disabled="!createTitle.trim()">{{ $t('common.create') }}</button>
      </div>
    </div>
  </v-dialog>

</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDossierStore } from '../../stores/dossier';
import { useAuthStore } from '../../stores/auth';
import { useTemplateStore } from '../../stores/template';
import { useConfirm } from '../../composables/useConfirm';
import api, { SERVER_URL } from '../../services/api';
import { loadPdfTemplate, loadTemplateLogos, loadImageAsDataUrl, createPdfBuilder, cleanControlChars, type PdfBuilder } from '../../utils/pdfTemplate';
import { generateDocx, type DocxExportData } from '../../utils/docxTemplate';
import { convertTipTapToBlocks } from '../../utils/contentBlocks';
import { tiptapJsonToHtml } from '../../utils/tiptapToHtml';
import NodeTree from '../tree/NodeTree.vue';
import DossierInfo from './DossierInfo.vue';
import NoteEditor from '../editor/NoteEditor.vue';
import ExcalidrawWrapper from '../excalidraw/ExcalidrawWrapper.vue';
import MapEditor from '../map/MapEditor.vue';
import ImageAnnotator from '../editor/ImageAnnotator.vue';
import PomodoroTimer from '../common/PomodoroTimer.vue';
import TaskPanel from './TaskPanel.vue';
import WebClipperDialog from './WebClipperDialog.vue';
import ExportSelectDialog from './ExportSelectDialog.vue';
import DatasetEditor from '../dataset/DatasetEditor.vue';
import EvidencePanel from '../evidence/EvidencePanel.vue';
import DossierEvidenceView from '../evidence/DossierEvidenceView.vue';

const { t } = useI18n();

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

// Sidebar
const sidebarTab = ref<'tree' | 'tasks' | 'evidence'>('tree');
const evidencePanelOpen = ref(false);
const annotatorOpen = ref(false);

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];

function isImageFile(fileName: string | null): boolean {
  if (!fileName) return false;
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
  return IMAGE_EXTENSIONS.includes(ext);
}

async function onAnnotationsSave(annotations: any[]) {
  if (!dossierStore.selectedNode) return;
  const existing = dossierStore.selectedNode.content || {};
  await dossierStore.updateNode(dossierStore.selectedNode._id, {
    content: { ...existing, annotations },
  });
}

// Reset annotator when node changes
watch(() => dossierStore.selectedNode?._id, () => {
  annotatorOpen.value = false;
});

function onEvidenceSelectNode(nodeId: string) {
  const node = dossierStore.nodes.find(n => n._id === nodeId);
  if (node) {
    dossierStore.selectNode(node);
    sidebarTab.value = 'tree';
  }
}

const dossierLogoUrl = computed(() => {
  const d = dossierStore.currentDossier;
  return d?.logoPath ? `${SERVER_URL}/${d.logoPath}` : null;
});

// Focus mode
const focusMode = ref(false);

function toggleFocusMode() {
  focusMode.value = !focusMode.value;
}

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && focusMode.value) {
    focusMode.value = false;
    return;
  }

  // Delete selected node with Delete key
  if (e.key === 'Delete' && dossierStore.selectedNode) {
    // Ignore if user is typing in an input/editor
    const tag = (e.target as HTMLElement)?.tagName;
    const editable = (e.target as HTMLElement)?.isContentEditable;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable) return;

    e.preventDefault();
    const node = dossierStore.selectedNode;

    if (e.shiftKey) {
      // Shift+Delete: permanent delete without confirmation
      dossierStore.deleteNode(node._id).then(() => {
        dossierStore.purgeNode(node._id).catch(() => {});
      });
    } else {
      // Delete: soft delete with confirmation
      confirmDialog({
        title: 'Supprimer',
        message: `Envoyer "${node.title}" dans la corbeille ?`,
        confirmText: 'Supprimer',
        variant: 'danger',
      }).then((ok: boolean) => {
        if (ok) dossierStore.deleteNode(node._id);
      });
    }
  }
}

onMounted(() => document.addEventListener('keydown', onGlobalKeydown));
onUnmounted(() => document.removeEventListener('keydown', onGlobalKeydown));

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
    const b = await createPdfBuilder(doc, tpl, logos);

    const infoLines: string[] = [];
    infoLines.push(`Rapport IA - ${new Date().toLocaleDateString('fr-FR')}`);
    if (aiReportModel.value) infoLines.push(cleanControlChars(`Mod\u00E8le: ${aiReportModel.value}`));
    if (dossier.investigator) infoLines.push(cleanControlChars(`Enqu\u00EAteur: ${dossier.investigator}`));
    b.drawReportHeader(cleanControlChars(dossier.title), infoLines);

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
      if (section.title) b.addSectionTitle(cleanControlChars(section.title));
      if (section.body) {
        for (const para of section.body.split(/\n\s*\n/)) {
          const trimmed = para.trim();
          if (trimmed) b.addBody(cleanControlChars(trimmed));
        }
      }
    }

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

    const aiInfoLines: string[] = [];
    aiInfoLines.push(`Rapport IA - ${new Date().toLocaleDateString('fr-FR')}`);
    if (aiReportModel.value) aiInfoLines.push(`Mod\u00E8le: ${aiReportModel.value}`);
    if (dossier.investigator) aiInfoLines.push(`Enqu\u00EAteur: ${dossier.investigator}`);

    const data: DocxExportData = {
      dossierTitle: dossier.title,
      infoLines: aiInfoLines,
      sections: docxSections,
      closingDate: new Date().toLocaleDateString('fr-FR'),
      closingCity: (authStore.user as any)?.signature?.city || 'Bruxelles',
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

async function handleDuplicateNode(nodeId: string) {
  try {
    const { data } = await api.post(`/nodes/${nodeId}/duplicate`);
    dossierStore.nodes.push(data);
    dossierStore.selectNode(data);
  } catch (err) {
    console.error('Duplicate failed:', err);
  }
}

async function handleFileDrop(files: FileList, parentId: string | null) {
  if (!dossierStore.currentDossier) return;
  for (const file of Array.from(files)) {
    try {
      // Create a document node first
      const node = await dossierStore.createNode({
        type: 'document',
        title: file.name,
        parentId,
      });
      // Upload the file to the node
      const formData = new FormData();
      formData.append('file', file);
      const { data: updated } = await api.post(`/nodes/${node._id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Update local node with file info
      const idx = dossierStore.nodes.findIndex(n => n._id === node._id);
      if (idx >= 0) dossierStore.nodes[idx] = updated;
      dossierStore.selectNode(updated);
    } catch (err) {
      console.error('File drop upload failed:', err);
    }
  }
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
    title: t('dossier.restoreVersionTitle'),
    message: t('dossier.restoreVersionMessage'),
    confirmText: t('common.restore'),
    variant: 'warning',
  });
  if (!ok) return;
  try {
    // Create a backup first
    if (dossierStore.selectedNode) {
      await api.post(`/nodes/${dossierStore.selectedNode._id}/snapshots`, {
        label: t('dossier.autoBackupLabel'),
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
    title: t('dossier.deleteVersionTitle'),
    message: t('dossier.deleteVersionMessage'),
    confirmText: t('common.delete'),
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

async function addSignatureBlock(b: PdfBuilder) {
  const { doc } = b;
  const rightX = b.pageW - b.margin;
  const closingDate = new Date().toLocaleDateString('fr-FR');

  b.checkPage(60);
  b.y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const city = (authStore.user as any)?.signature?.city || 'Bruxelles';
  doc.text(`${city}, le ${closingDate}`, rightX, b.y, { align: 'right' });
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

// ── Section numbering ──────────────────────────────────────────────
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

// Collect TOC entries from node tree without rendering
interface TocEntry { title: string; level: 'h1' | 'h2' | 'h3'; number: string }

function collectTocEntries(
  allNodes: any[],
  parentId: string | null,
  depth: number,
  counter: SectionCounter,
): TocEntry[] {
  const entries: TocEntry[] = [];
  const children = allNodes
    .filter((n: any) => n.parentId === parentId && !n.deletedAt)
    .sort((a: any, b: any) => a.order - b.order);

  const hl: 'h1' | 'h2' | 'h3' = depth <= 1 ? 'h1' : depth === 2 ? 'h2' : 'h3';

  for (const node of children) {
    if (node.type === 'folder') {
      const num = nextSectionNumber(counter, hl);
      entries.push({ title: `${num} ${cleanControlChars(node.title)}`, level: hl, number: num });
      entries.push(...collectTocEntries(allNodes, node._id, depth + 1, counter));
    } else if (node.type === 'note') {
      const num = nextSectionNumber(counter, hl);
      entries.push({ title: `${num} ${cleanControlChars(node.title)}`, level: hl, number: num });
    }
  }
  return entries;
}

function handleSelectiveExport(format: 'pdf' | 'docx' | 'print', selectedIds: string[], includeToc: boolean) {
  if (format === 'pdf') exportPDF(selectedIds, includeToc);
  else if (format === 'docx') exportDOCX(selectedIds, includeToc);
  else if (format === 'print') printDossier(selectedIds);
}

// Collect dossier info lines for report header (only non-empty fields)
function buildDossierInfoLines(dossier: any): string[] {
  const lines: string[] = [];
  lines.push(new Date().toLocaleDateString('fr-FR'));
  if (dossier.status) lines.push(`Statut: ${dossier.status}`);
  if (dossier.investigator) lines.push(`Enqu\u00EAteur: ${dossier.investigator}`);
  if ((dossier as any).magistrate) lines.push(`Magistrat: ${(dossier as any).magistrate}`);
  if ((dossier as any).classification) lines.push(`Classification: ${(dossier as any).classification}`);
  if (dossier.entities?.length) {
    lines.push(`Entit\u00E9s: ${dossier.entities.map((e: any) => e.name).join(', ')}`);
  }
  return lines;
}

// Walk node tree recursively for PDF export
async function walkTreePdf(
  allNodes: any[],
  parentId: string | null,
  depth: number,
  b: PdfBuilder,
  counter: SectionCounter,
) {
  const children = allNodes
    .filter((n: any) => n.parentId === parentId && !n.deletedAt)
    .sort((a: any, b: any) => a.order - b.order);

  const hl: 'h1' | 'h2' | 'h3' = depth <= 1 ? 'h1' : depth === 2 ? 'h2' : 'h3';

  for (const node of children) {
    if (node.type === 'folder') {
      const num = nextSectionNumber(counter, hl);
      b.addHeading(`${num} ${cleanControlChars(node.title)}`, hl);
      await walkTreePdf(allNodes, node._id, depth + 1, b, counter);
    } else if (node.type === 'note') {
      const num = nextSectionNumber(counter, hl);
      b.addHeading(`${num} ${cleanControlChars(node.title)}`, hl);
      if (node.content) {
        const blocks = convertTipTapToBlocks(node.content);
        await b.renderBlocks(blocks);
      }
    }
  }
}

async function exportPDF(selectedNodeIds?: string[], includeToc = false) {
  if (!dossierStore.currentDossier) return;
  try {
    const { jsPDF } = await import('jspdf');
    const dossier = dossierStore.currentDossier;
    const allNodes = dossierStore.nodes;
    const nodes = selectedNodeIds ? allNodes.filter(n => selectedNodeIds.includes(n._id)) : allNodes;
    const tpl = loadPdfTemplate();
    const logos = await loadTemplateLogos(tpl, SERVER_URL);
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const b = await createPdfBuilder(doc, tpl, logos);

    // Title + info
    b.drawReportHeader(cleanControlChars(dossier.title), buildDossierInfoLines(dossier).map(cleanControlChars));

    // Collect orphans for both TOC and rendering
    const nodeIds = new Set(nodes.map((n: any) => n._id));
    const orphans = nodes.filter((n: any) => n.parentId && !nodeIds.has(n.parentId) && !n.deletedAt)
      .sort((a: any, b: any) => a.order - b.order);

    // Table of contents (without page numbers)
    if (includeToc) {
      const tocCounter: SectionCounter = [0, 0, 0];
      const tocEntries = collectTocEntries(nodes, null, 1, tocCounter);
      // Also collect orphan entries for TOC
      for (const node of orphans) {
        if (node.type === 'folder' || node.type === 'note') {
          const num = nextSectionNumber(tocCounter, 'h1');
          tocEntries.push({ title: `${num} ${cleanControlChars(node.title)}`, level: 'h1', number: num });
        }
      }

      if (tocEntries.length > 0) {
        b.addHeading('Table des matières', 'h1');
        const fontSize = tpl.body.fontSize;
        const lh = tpl.spacing?.lineHeight || 1.4;
        const lineH = fontSize * 0.3528 * lh;

        for (const entry of tocEntries) {
          const indent = entry.level === 'h1' ? 0 : entry.level === 'h2' ? 8 : 16;
          const isBold = entry.level === 'h1';
          b.checkPage(lineH + 2);
          doc.setFontSize(fontSize);
          doc.setFont('NotoSans', isBold ? 'bold' : 'normal');
          doc.setTextColor(0);
          doc.text(entry.title, b.margin + indent, b.y + fontSize * 0.3528 * 0.75);
          b.y += lineH;
        }
        b.y += 4;
      }
    }

    // Walk node tree respecting hierarchy
    const counter: SectionCounter = [0, 0, 0];
    await walkTreePdf(nodes, null, 1, b, counter);

    // Nodes without parent in selection (orphans) — show at root level
    for (const node of orphans) {
      if (node.type === 'folder') {
        const num = nextSectionNumber(counter, 'h1');
        b.addHeading(`${num} ${cleanControlChars(node.title)}`, 'h1');
      } else if (node.type === 'note') {
        const num = nextSectionNumber(counter, 'h1');
        b.addHeading(`${num} ${cleanControlChars(node.title)}`, 'h1');
        if (node.content) {
          const blocks = convertTipTapToBlocks(node.content);
          await b.renderBlocks(blocks);
        }
      }
    }

    await addSignatureBlock(b);
    const blob = b.finalize();
    downloadBlob(blob, `Rapport_OSINT_${dossier.title}.pdf`);
  } catch (err) {
    console.error('PDF export failed:', err);
  }
}

// Walk node tree recursively for DOCX sections
function walkTreeDocx(
  allNodes: any[],
  parentId: string | null,
  depth: number,
  sections: DocxExportData['sections'],
  counter: SectionCounter,
) {
  const children = allNodes
    .filter((n: any) => n.parentId === parentId && !n.deletedAt)
    .sort((a: any, b: any) => a.order - b.order);

  const hl: 'h1' | 'h2' | 'h3' = depth <= 1 ? 'h1' : depth === 2 ? 'h2' : 'h3';

  for (const node of children) {
    if (node.type === 'folder') {
      const num = nextSectionNumber(counter, hl);
      sections.push({ title: `${num} ${node.title}`, level: hl, paragraphs: [] });
      walkTreeDocx(allNodes, node._id, depth + 1, sections, counter);
    } else if (node.type === 'note') {
      const num = nextSectionNumber(counter, hl);
      const blocks = node.content ? convertTipTapToBlocks(node.content) : [];
      sections.push({ title: `${num} ${node.title}`, level: hl, paragraphs: [], blocks });
    }
  }
}

function buildDocxSections(dossier: any, nodes: any[]): DocxExportData['sections'] {
  const sections: DocxExportData['sections'] = [];
  const counter: SectionCounter = [0, 0, 0];

  // Walk tree from root
  walkTreeDocx(nodes, null, 1, sections, counter);

  // Orphan nodes (parent not in selection)
  const nodeIds = new Set(nodes.map((n: any) => n._id));
  const orphans = nodes.filter((n: any) => n.parentId && !nodeIds.has(n.parentId) && !n.deletedAt);
  for (const node of orphans.sort((a: any, b: any) => a.order - b.order)) {
    if (node.type === 'folder') {
      const num = nextSectionNumber(counter, 'h1');
      sections.push({ title: `${num} ${node.title}`, level: 'h1', paragraphs: [] });
    } else if (node.type === 'note') {
      const num = nextSectionNumber(counter, 'h1');
      const blocks = node.content ? convertTipTapToBlocks(node.content) : [];
      sections.push({ title: `${num} ${node.title}`, level: 'h1', paragraphs: [], blocks });
    }
  }

  return sections;
}

async function exportDOCX(selectedNodeIds?: string[], includeToc = false) {
  if (!dossierStore.currentDossier) return;
  try {
    const dossier = dossierStore.currentDossier;
    const allNodes = dossierStore.nodes;
    const nodes = selectedNodeIds ? allNodes.filter(n => selectedNodeIds.includes(n._id)) : allNodes;
    const sig = (authStore.user as any)?.signature;

    const data: DocxExportData = {
      dossierTitle: dossier.title,
      infoLines: buildDossierInfoLines(dossier),
      sections: buildDocxSections(dossier, nodes),
      closingDate: new Date().toLocaleDateString('fr-FR'),
      closingCity: (authStore.user as any)?.signature?.city || 'Bruxelles',
      includeToc,
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
  width: 320px;
  flex-shrink: 0;
  border-right: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.dv-sidebar-header {
  padding: 16px 18px 12px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.dv-sidebar-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}
.dv-sidebar-icon-wrap {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  flex-shrink: 0;
  color: var(--me-accent);
}
.dv-sidebar-icon-default { color: var(--me-text-muted); }
.dv-sidebar-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  object-fit: cover;
}
.dv-sidebar-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
/* Online collaborators bar */
.dv-collab-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--me-border);
}
.dv-collab-avatars {
  display: flex;
  gap: 0;
}
.dv-collab-avatar {
  position: relative;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--me-bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: -6px;
  border: 2px solid var(--me-bg-surface);
  cursor: default;
  flex-shrink: 0;
}
.dv-collab-avatar:first-child {
  margin-left: 0;
}
.dv-collab-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.dv-collab-initials {
  font-size: 10px;
  font-weight: 700;
  color: var(--me-accent);
  letter-spacing: 0.5px;
  font-family: var(--me-font-mono);
}
.dv-collab-dot {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  border: 2px solid var(--me-bg-surface);
}
.dv-collab-label {
  font-size: 11px;
  color: var(--me-text-muted);
  white-space: nowrap;
}
.dv-action-btn {
  width: 28px;
  height: 28px;
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
.dv-action-btn:hover {
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
  font-size: 15px;
  font-weight: 700;
  color: var(--me-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

/* Nav items (replaces tabs) */
.dv-sidebar-nav {
  display: flex;
  flex-direction: column;
  padding: 4px 12px 8px;
  gap: 2px;
}
.dv-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  background: none;
  border: none;
  color: var(--me-text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}
.dv-nav-item:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
.dv-nav-item.active {
  background: var(--me-accent-glow);
  color: var(--me-accent);
  font-weight: 600;
}

.dv-sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 4px 12px 12px;
  border-top: 1px solid var(--me-border);
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
/* Document node styles */
.dv-document-panel {
  padding: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.dv-document-panel .dv-content-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--me-border);
  flex-shrink: 0;
}
.dv-doc-actions {
  display: flex;
  gap: 2px;
  margin-left: auto;
}
.dv-action-btn--active {
  color: var(--me-accent) !important;
  background: var(--me-accent-glow) !important;
}
.dv-doc-image-area {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
.dv-doc-image-preview {
  max-width: 100%;
  max-height: 100%;
  padding: 16px;
  object-fit: contain;
}
.dv-doc-file-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  flex: 1;
}
.dv-doc-file-icon {
  color: var(--me-text-muted);
  opacity: 0.4;
}
.dv-doc-download-btn {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: 8px;
  background: var(--me-accent-glow);
  color: var(--me-accent);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
}
.dv-doc-download-btn:hover {
  background: var(--me-accent);
  color: #fff;
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
.me-map-focus-btn {
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
.me-map-focus-btn:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
.me-map-focus-btn.active {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
</style>
