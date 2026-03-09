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
              <div v-if="aiEnabled" class="dv-export-divider" />
              <button v-if="aiEnabled" class="dv-export-option dv-export-ai" @click="generateAiReport">
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

      <div v-else-if="dossierStore.selectedNode.type === 'map'" class="dv-map-wrap">
        <MapEditor
          :data="dossierStore.selectedNode.mapData"
          :node-id="dossierStore.selectedNode._id"
          :key="dossierStore.selectedNode._id"
          @update:data="onMapUpdate"
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
            Telecharger en PDF
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
import { ref, watch } from 'vue';
import { useDossierStore } from '../../stores/dossier';
import { useAuthStore } from '../../stores/auth';
import { useTemplateStore } from '../../stores/template';
import { useConfirm } from '../../composables/useConfirm';
import api, { SERVER_URL } from '../../services/api';
import NodeTree from '../tree/NodeTree.vue';
import DossierInfo from './DossierInfo.vue';
import NoteEditor from '../editor/NoteEditor.vue';
import ExcalidrawWrapper from '../excalidraw/ExcalidrawWrapper.vue';
import MapEditor from '../map/MapEditor.vue';

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

// AI Report
const aiEnabled = ref(false);
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

async function generateAiReport() {
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

  try {
    const response = await fetch(`${SERVER_URL}/api/ai/generate-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ dossierId }),
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
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 20;
    const usableW = pageW - margin * 2;
    const headerH = 22;
    const footerH = 15;
    const contentTop = headerH + 5;
    const contentBottom = pageH - footerH;
    let y = contentTop;

    // Pre-load logos
    let logoDr5Data: string | null = null;
    let logoPjfData: string | null = null;
    try { logoDr5Data = await loadImageAsDataUrl(new URL('/logo-dr5.png', window.location.origin).href); } catch { /* skip */ }
    try { logoPjfData = await loadImageAsDataUrl(new URL('/logo-pjf.jpeg', window.location.origin).href); } catch { /* skip */ }

    function drawHeaderFooter(pageNum: number) {
      const totalPages = '__TOTAL_PAGES__';
      doc.setDrawColor(41, 65, 122);
      doc.setLineWidth(0.5);
      doc.line(margin, headerH, pageW - margin, headerH);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(41, 65, 122);
      doc.text('PJF Bruxelles - DR5 - Data Management & Analysis', pageW / 2, headerH - 5, { align: 'center' });
      if (logoDr5Data) doc.addImage(logoDr5Data, 'PNG', pageW - margin - 15, 3, 15, 15);
      doc.setDrawColor(41, 65, 122);
      doc.line(margin, pageH - footerH, pageW - margin, pageH - footerH);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Page ${pageNum} | ${totalPages}`, pageW - margin, pageH - footerH + 5, { align: 'right' });
      doc.setTextColor(0);
    }

    let currentPage = 1;

    function newContentPage() {
      doc.addPage();
      currentPage++;
      y = contentTop;
    }

    function checkPage(need: number) {
      if (y + need > contentBottom) newContentPage();
    }

    function addSectionTitle(title: string) {
      checkPage(20);
      y += 6;
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 65, 122);
      doc.text(title, margin, y);
      y += 3;
      doc.setDrawColor(41, 65, 122);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageW - margin, y);
      doc.setTextColor(0);
      y += 8;
    }

    function addBody(text: string) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      const lines: string[] = doc.splitTextToSize(text, usableW);
      for (const line of lines) {
        checkPage(5);
        doc.text(line, margin, y, { maxWidth: usableW });
        y += 4.5;
      }
      y += 3;
    }

    function addDisclaimer(text: string) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(238, 0, 0);
      const lines: string[] = doc.splitTextToSize(text, usableW);
      for (const line of lines) {
        checkPage(5);
        doc.text(line, margin, y, { maxWidth: usableW });
        y += 4.5;
      }
      doc.setTextColor(0);
      y += 3;
    }

    // === COVER PAGE ===
    if (logoPjfData) doc.addImage(logoPjfData, 'JPEG', (pageW - 50) / 2, 30, 50, 50);
    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(41, 65, 122);
    doc.text('Rapport OSINT', pageW / 2, 110, { align: 'center' });
    doc.setFontSize(20);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(`Dossier \u00AB ${dossier.title} \u00BB`, pageW / 2, 130, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Rapport IA - ${new Date().toLocaleDateString('fr-FR')}`, pageW / 2, 145, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Mod\u00E8le: ${aiReportModel.value}`, pageW / 2, 158, { align: 'center' });
    if (dossier.investigator) {
      doc.text(`Enqu\u00EAteur demandeur: ${dossier.investigator}`, pageW / 2, 170, { align: 'center' });
    }
    doc.setTextColor(0);
    if (logoDr5Data) doc.addImage(logoDr5Data, 'PNG', (pageW - 25) / 2, 220, 25, 25);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('PJF Bruxelles - DR5 - Data Management & Analysis', pageW / 2, 260, { align: 'center' });
    doc.setTextColor(0);

    // === CONTENT PAGES ===
    newContentPage();

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
      // Text before first heading
      const preamble = aiText.substring(0, matches[0].index).trim();
      if (preamble) sections.push({ title: '', body: preamble });

      for (let i = 0; i < matches.length; i++) {
        const headingEnd = aiText.indexOf('\n', matches[i].index);
        const bodyStart = headingEnd >= 0 ? headingEnd + 1 : matches[i].index + matches[i].title.length;
        const bodyEnd = i + 1 < matches.length ? matches[i + 1].index : aiText.length;
        sections.push({ title: matches[i].title, body: aiText.substring(bodyStart, bodyEnd).trim() });
      }
    } else {
      // No headings — treat as single block
      sections.push({ title: '', body: aiText });
    }

    // Render sections
    for (const section of sections) {
      if (section.title) addSectionTitle(section.title);
      if (section.body) {
        // Split paragraphs by double newline
        const paragraphs = section.body.split(/\n\s*\n/);
        for (const para of paragraphs) {
          const trimmed = para.trim();
          if (trimmed) addBody(trimmed);
        }
      }
    }

    // === DISCLAIMER ===
    addDisclaimer('Le pr\u00E9sent rapport est strictement confidentiel et destin\u00E9 uniquement aux autorit\u00E9s judiciaires comp\u00E9tentes. Toute diffusion, reproduction ou utilisation non autoris\u00E9e est interdite.');

    // === RIGHT-ALIGNED CLOSING ===
    checkPage(60);
    y += 10;
    const rightX = pageW - margin;
    const closingDate = new Date().toLocaleDateString('fr-FR');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bruxelles, le ${closingDate}`, rightX, y, { align: 'right' });
    y += 8;

    // Signature image
    const sigImgPath = (authStore.user as any)?.signatureImagePath;
    if (sigImgPath) {
      try {
        const imgUrl = `${SERVER_URL}/${sigImgPath}`;
        const imgData = await loadImageAsDataUrl(imgUrl);
        if (imgData) {
          checkPage(35);
          doc.addImage(imgData, 'PNG', rightX - 50, y, 50, 20);
          y += 24;
        }
      } catch { /* skip */ }
    }

    // Signature text
    const sig = (authStore.user as any)?.signature;
    if (sig?.name) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      if (sig.title) { doc.text(sig.title, rightX, y, { align: 'right' }); y += 5; }
      doc.text(sig.name, rightX, y, { align: 'right' }); y += 5;
      doc.setFont('helvetica', 'normal');
      if (sig.service) { doc.text(sig.service, rightX, y, { align: 'right' }); y += 5; }
      if (sig.unit) { doc.text(sig.unit, rightX, y, { align: 'right' }); y += 5; }
      if (sig.email) { doc.text(sig.email, rightX, y, { align: 'right' }); y += 5; }
    }

    // === APPLY HEADERS/FOOTERS ===
    const totalPages = currentPage;
    for (let p = 2; p <= totalPages; p++) {
      doc.setPage(p);
      drawHeaderFooter(p - 1);
    }

    // Replace total pages placeholder
    const pdfOutput = doc.output('arraybuffer');
    const pdfString = new TextDecoder('latin1').decode(new Uint8Array(pdfOutput));
    const fixedPdf = pdfString.replace(/__TOTAL_PAGES__/g, String(totalPages - 1));
    const finalBytes = new Uint8Array(fixedPdf.length);
    for (let i = 0; i < fixedPdf.length; i++) {
      finalBytes[i] = fixedPdf.charCodeAt(i) & 0xff;
    }

    const blob = new Blob([finalBytes], { type: 'application/pdf' });
    downloadBlob(blob, `Rapport_OSINT_IA_${dossier.title}.pdf`);
    aiReportDialog.value = false;
  } catch (err) {
    console.error('AI PDF export failed:', err);
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

async function exportPDF() {
  if (!dossierStore.currentDossier) return;
  try {
    const { jsPDF } = await import('jspdf');
    const dossier = dossierStore.currentDossier;
    const nodes = dossierStore.nodes;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth(); // 210
    const pageH = doc.internal.pageSize.getHeight(); // 297
    const margin = 20;
    const usableW = pageW - margin * 2;
    const headerH = 22; // header zone height
    const footerH = 15; // footer zone height
    const contentTop = headerH + 5; // content starts after header
    const contentBottom = pageH - footerH; // content ends before footer
    let y = contentTop;

    // Pre-load logos
    let logoDr5Data: string | null = null;
    let logoPjfData: string | null = null;
    try { logoDr5Data = await loadImageAsDataUrl(new URL('/logo-dr5.png', window.location.origin).href); } catch { /* skip */ }
    try { logoPjfData = await loadImageAsDataUrl(new URL('/logo-pjf.jpeg', window.location.origin).href); } catch { /* skip */ }

    // --- Header/Footer applied to every page ---
    function drawHeaderFooter(pageNum: number) {
      const totalPages = '__TOTAL_PAGES__'; // placeholder replaced at end
      // Header background line
      doc.setDrawColor(41, 65, 122); // dark blue
      doc.setLineWidth(0.5);
      doc.line(margin, headerH, pageW - margin, headerH);

      // Header text
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(41, 65, 122);
      doc.text('PJF Bruxelles - DR5 - Data Management & Analysis', pageW / 2, headerH - 5, { align: 'center' });

      // Header DR5 logo (right side)
      if (logoDr5Data) {
        doc.addImage(logoDr5Data, 'PNG', pageW - margin - 15, 3, 15, 15);
      }

      // Footer line
      doc.setDrawColor(41, 65, 122);
      doc.line(margin, pageH - footerH, pageW - margin, pageH - footerH);

      // Footer page number (right-aligned)
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Page ${pageNum} | ${totalPages}`, pageW - margin, pageH - footerH + 5, { align: 'right' });
      doc.setTextColor(0);
    }

    // --- Page management ---
    let currentPage = 1;

    function newContentPage() {
      doc.addPage();
      currentPage++;
      y = contentTop;
    }

    function checkPage(need: number) {
      if (y + need > contentBottom) {
        newContentPage();
      }
    }

    // --- Section title (GrandTitre style) ---
    function addSectionTitle(title: string) {
      checkPage(20);
      y += 6;
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 65, 122);
      doc.text(title, margin, y);
      y += 3;
      // underline
      doc.setDrawColor(41, 65, 122);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageW - margin, y);
      doc.setTextColor(0);
      y += 8;
    }

    // --- Sub-heading (sz=28 ~ 14pt) ---
    function addSubHeading(text: string) {
      checkPage(12);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text(text, margin, y);
      y += 7;
    }

    // --- Body text (justified) ---
    function addBody(text: string) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      const lines: string[] = doc.splitTextToSize(text, usableW);
      for (const line of lines) {
        checkPage(5);
        doc.text(line, margin, y, { maxWidth: usableW });
        y += 4.5;
      }
      y += 3;
    }

    // --- Disclaimer text (red) ---
    function addDisclaimer(text: string) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(238, 0, 0); // #EE0000
      const lines: string[] = doc.splitTextToSize(text, usableW);
      for (const line of lines) {
        checkPage(5);
        doc.text(line, margin, y, { maxWidth: usableW });
        y += 4.5;
      }
      doc.setTextColor(0);
      y += 3;
    }

    // ============================================================
    // PAGE 1 — COVER PAGE (no header/footer on cover)
    // ============================================================
    // PJF logo centered at top
    if (logoPjfData) {
      doc.addImage(logoPjfData, 'JPEG', (pageW - 50) / 2, 30, 50, 50);
    }

    // Title: "Rapport OSINT" (sz=72 ~ 36pt)
    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(41, 65, 122);
    doc.text('Rapport OSINT', pageW / 2, 110, { align: 'center' });

    // Subtitle: Dossier name (sz=40 ~ 20pt)
    doc.setFontSize(20);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(`Dossier \u00AB ${dossier.title} \u00BB`, pageW / 2, 130, { align: 'center' });

    // Report number / date
    doc.setFontSize(12);
    doc.text(`Rapport n\u00B01 - ${new Date().toLocaleDateString('fr-FR')}`, pageW / 2, 145, { align: 'center' });

    // Status
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Statut: ${dossier.status}`, pageW / 2, 158, { align: 'center' });

    // Investigator
    if (dossier.investigator) {
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Enqu\u00EAteur demandeur: ${dossier.investigator}`, pageW / 2, 170, { align: 'center' });
    }

    doc.setTextColor(0);

    // DR5 logo small on cover bottom
    if (logoDr5Data) {
      doc.addImage(logoDr5Data, 'PNG', (pageW - 25) / 2, 220, 25, 25);
    }

    // Footer text on cover
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('PJF Bruxelles - DR5 - Data Management & Analysis', pageW / 2, 260, { align: 'center' });
    doc.setTextColor(0);

    // ============================================================
    // CONTENT PAGES — Start page 2
    // ============================================================
    newContentPage();

    // === Entites concernees ===
    if (dossier.entities?.length) {
      addSectionTitle('Entit\u00E9s concern\u00E9es');
      addBody('Les recherches demand\u00E9es par l\u2019enqu\u00EAteur portent sur les entit\u00E9s suivantes :');
      dossier.entities.forEach(ent => {
        checkPage(8);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const entLine = `\u2022 ${ent.name} (${ent.type})${ent.description ? ' : ' + ent.description : ''}`;
        const entLines: string[] = doc.splitTextToSize(entLine, usableW - 5);
        for (const l of entLines) {
          checkPage(5);
          doc.text(l, margin + 4, y);
          y += 4.5;
        }
      });
      y += 4;
    }

    // === Objectifs de la recherche OSINT ===
    if (dossier.objectives) {
      addSectionTitle('Objectifs de la recherche OSINT');
      addBody('Les objectifs sont d\u00E9finis comme suit :');
      addBody(dossier.objectives);
    }

    // === Synthese des faits ===
    addSectionTitle('Synth\u00E8se des faits');
    if (dossier.judicialFacts) {
      addBody(dossier.judicialFacts);
    }
    if (dossier.description) {
      addBody(dossier.description);
    }
    if (!dossier.judicialFacts && !dossier.description) {
      addBody('Aucune information disponible.');
    }

    // === Resume des recherches et des resultats ===
    addSectionTitle('R\u00E9sum\u00E9 des recherches et des r\u00E9sultats');
    addBody('Les recherches en sources ouvertes ont \u00E9t\u00E9 men\u00E9es sur Internet. Il convient de souligner que, compte tenu de l\u2019immensit\u00E9 de ce r\u00E9seau et de la multiplicit\u00E9 des ressources disponibles, certaines informations pertinentes pourraient ne pas avoir \u00E9t\u00E9 identifi\u00E9es.');
    addDisclaimer('Note : toutes les recherches reprises dans ce rapport ont \u00E9t\u00E9 r\u00E9alis\u00E9es en sources ouvertes uniquement.');

    // === Recherches en source ouverte (Notes) ===
    const noteNodes = nodes.filter(n => n.type === 'note');
    if (noteNodes.length > 0) {
      addSectionTitle('Recherches en source ouverte');
      for (const node of noteNodes) {
        checkPage(15);
        addSubHeading(node.title);

        if (node.content) {
          const text = extractTextFromTiptap(node.content);
          if (text) {
            addBody(text);
          }
        }
        y += 2;
      }
    }

    // === Conclusion ===
    addSectionTitle('Conclusion');
    const closingDate = new Date().toLocaleDateString('fr-FR');
    addBody(`Ce rapport est clos le ${closingDate}.`);

    addDisclaimer('Le pr\u00E9sent rapport est strictement confidentiel et destin\u00E9 uniquement aux autorit\u00E9s judiciaires comp\u00E9tentes. Toute diffusion, reproduction ou utilisation non autoris\u00E9e est interdite.');

    // === Right-aligned closing: date + signature ===
    checkPage(60);
    y += 10;
    const rightX = pageW - margin;

    // Date right-aligned
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bruxelles, le ${closingDate}`, rightX, y, { align: 'right' });
    y += 8;

    // Signature image (drawn or uploaded)
    const sigImgPath = (authStore.user as any)?.signatureImagePath;
    if (sigImgPath) {
      try {
        const imgUrl = `${SERVER_URL}/${sigImgPath}`;
        const imgData = await loadImageAsDataUrl(imgUrl);
        if (imgData) {
          checkPage(35);
          doc.addImage(imgData, 'PNG', rightX - 50, y, 50, 20);
          y += 24;
        }
      } catch {
        // Skip if image can't be loaded
      }
    }

    // Signature text right-aligned
    const sig = (authStore.user as any)?.signature;
    if (sig?.name) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      if (sig.title) { doc.text(sig.title, rightX, y, { align: 'right' }); y += 5; }
      doc.text(sig.name, rightX, y, { align: 'right' });
      y += 5;
      doc.setFont('helvetica', 'normal');
      if (sig.service) { doc.text(sig.service, rightX, y, { align: 'right' }); y += 5; }
      if (sig.unit) { doc.text(sig.unit, rightX, y, { align: 'right' }); y += 5; }
      if (sig.email) { doc.text(sig.email, rightX, y, { align: 'right' }); y += 5; }
    }

    // ============================================================
    // Apply headers/footers to all pages except cover (page 1)
    // ============================================================
    const totalPages = currentPage;
    for (let p = 2; p <= totalPages; p++) {
      doc.setPage(p);
      drawHeaderFooter(p - 1); // page numbering starts at 1 for content pages
    }

    // Replace total pages placeholder
    const pdfOutput = doc.output('arraybuffer');
    const pdfBytes = new Uint8Array(pdfOutput);
    const pdfString = new TextDecoder('latin1').decode(pdfBytes);
    const fixedPdf = pdfString.replace(/__TOTAL_PAGES__/g, String(totalPages - 1));
    const fixedBytes = new TextEncoder().encode(fixedPdf);
    // Use Uint8Array directly for latin1 encoding
    const finalBytes = new Uint8Array(fixedBytes.length);
    for (let i = 0; i < fixedPdf.length; i++) {
      finalBytes[i] = fixedPdf.charCodeAt(i) & 0xff;
    }

    const blob = new Blob([finalBytes], { type: 'application/pdf' });
    downloadBlob(blob, `Rapport_OSINT_${dossier.title}.pdf`);
  } catch (err) {
    console.error('PDF export failed:', err);
  }
}

function loadImageAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
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
</style>
