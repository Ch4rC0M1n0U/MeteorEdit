<template>
  <div class="dev-panel">
    <div class="dev-header">
      <h3 class="dev-title mono">
        <v-icon size="18" class="mr-2">mdi-shield-check-outline</v-icon>
        {{ $t('evidence.title') }}
      </h3>
      <div class="dev-header-actions">
        <button
          v-if="hasMissing"
          class="dev-purge-btn"
          @click="purgeMissing"
          :disabled="purging"
          :title="$t('evidence.purgeMissing')"
        >
          <v-icon size="14" :class="{ 'dev-spin': purging }">
            {{ purging ? 'mdi-loading' : 'mdi-delete-sweep' }}
          </v-icon>
        </button>
        <button
          v-if="groups.length"
          class="dev-verify-all-global"
          @click="verifyAllDossier"
          :disabled="verifyingAll"
          :title="$t('evidence.verifyAllDossier')"
        >
          <v-icon size="14" :class="{ 'dev-spin': verifyingAll }">
            {{ verifyingAll ? 'mdi-loading' : 'mdi-shield-check' }}
          </v-icon>
          <span>{{ $t('evidence.verifyAllDossier') }}</span>
        </button>
        <button class="dev-refresh" @click="refresh" :disabled="evidenceStore.loading" :title="$t('evidence.refresh')">
          <v-icon size="16" :class="{ 'dev-spin': evidenceStore.loading }">
            {{ evidenceStore.loading ? 'mdi-loading' : 'mdi-refresh' }}
          </v-icon>
        </button>
      </div>
    </div>

    <div v-if="evidenceStore.loading && !evidenceStore.dossierEvidence.length" class="dev-loading">
      <v-progress-circular indeterminate size="24" color="var(--me-accent)" />
    </div>

    <div v-else-if="!groups.length" class="dev-empty">
      <v-icon size="32" class="dev-empty-icon">mdi-shield-outline</v-icon>
      <p>{{ $t('evidence.noEvidence') }}</p>
      <p class="dev-empty-hint">{{ $t('evidence.autoCreatedHint') }}</p>
    </div>

    <div v-else class="dev-list">
      <div v-for="group in groups" :key="group.nodeId" class="dev-group">
        <!-- Parent row -->
        <div class="dev-group-header" @click="toggleGroup(group.nodeId)">
          <div class="dev-item-icon">
            <v-icon size="16" :class="groupStatusClass(group)">
              {{ groupStatusIcon(group) }}
            </v-icon>
          </div>
          <div class="dev-item-info">
            <span class="dev-item-title">{{ group.nodeTitle }}</span>
            <span class="dev-item-meta mono">
              {{ nodeTypeLabel(group.nodeType) }} · {{ group.records.length }} {{ $t('evidence.captures') }} · {{ formatSize(group.totalSize) }}
            </span>
          </div>
          <div class="dev-group-actions">
            <button
              class="dev-detail-btn"
              :title="$t('evidence.viewDetail')"
              @click.stop="$emit('select-node', group.nodeId)"
            >
              <v-icon size="14">mdi-eye-outline</v-icon>
            </button>
            <button
              v-if="group.records.length > 1"
              class="dev-verify-all-btn"
              :disabled="evidenceStore.verifying"
              :title="$t('evidence.verifyAll')"
              @click.stop="verifyAll(group.nodeId)"
            >
              <v-icon size="14" :class="{ 'dev-spin': verifyingNodeId === group.nodeId }">
                {{ verifyingNodeId === group.nodeId ? 'mdi-loading' : 'mdi-shield-check' }}
              </v-icon>
            </button>
            <div class="dev-item-status" :class="groupStatusClass(group)">
              {{ groupStatusLabel(group) }}
            </div>
            <v-icon size="16" class="dev-chevron" :class="{ 'dev-chevron--open': expandedNodes.has(group.nodeId) }">
              mdi-chevron-down
            </v-icon>
          </div>
        </div>

        <!-- Children rows (collapsible) -->
        <div v-if="expandedNodes.has(group.nodeId)" class="dev-children">
          <div
            v-for="record in group.records"
            :key="record._id"
            class="dev-item dev-item--child"
            @click="$emit('select-node', group.nodeId, record._id)"
          >
            <div class="dev-child-icon">
              <v-icon size="12" :class="statusClass(record.lastVerificationStatus)">
                {{ statusIcon(record.lastVerificationStatus) }}
              </v-icon>
            </div>
            <div class="dev-item-info">
              <span class="dev-child-title">{{ typeLabel(record.evidenceType) }}</span>
              <span class="dev-item-meta mono">
                {{ formatSize(record.fileSize) }} · {{ formatDate(record.capturedAt) }}
              </span>
            </div>
            <div class="dev-item-status dev-item-status--small" :class="statusClass(record.lastVerificationStatus)">
              {{ statusLabel(record.lastVerificationStatus) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="groups.length" class="dev-footer mono">
      {{ $t('evidence.evidenceCount', { count: evidenceStore.dossierEvidence.length }) }}
      · {{ $t('evidence.nodeCount', { count: groups.length }) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useEvidenceStore } from '../../stores/evidence';
import type { EvidenceRecord } from '../../types';

const { t, locale } = useI18n();

const props = defineProps<{ dossierId: string }>();
defineEmits<{ 'select-node': [nodeId: string, recordId?: string] }>();

const evidenceStore = useEvidenceStore();
const expandedNodes = ref<Set<string>>(new Set());
const verifyingNodeId = ref<string | null>(null);
const verifyingAll = ref(false);
const purging = ref(false);

watch(() => props.dossierId, (id) => {
  if (id) evidenceStore.fetchDossierEvidence(id);
}, { immediate: true });

interface EvidenceGroup {
  nodeId: string;
  nodeTitle: string;
  nodeType: string;
  records: EvidenceRecord[];
  totalSize: number;
}

const groups = computed<EvidenceGroup[]>(() => {
  const map = new Map<string, EvidenceGroup>();
  for (const record of evidenceStore.dossierEvidence) {
    const nodeId = typeof record.nodeId === 'object' ? (record.nodeId as any)._id : record.nodeId;
    const nodeTitle = typeof record.nodeId === 'object' ? (record.nodeId as any).title : 'Node';
    const nodeType = typeof record.nodeId === 'object' ? (record.nodeId as any).type : '';
    if (!map.has(nodeId)) {
      map.set(nodeId, { nodeId, nodeTitle, nodeType, records: [], totalSize: 0 });
    }
    const group = map.get(nodeId)!;
    group.records.push(record);
    group.totalSize += record.fileSize || 0;
  }
  return Array.from(map.values());
});

const hasMissing = computed(() =>
  evidenceStore.dossierEvidence.some(r => r.lastVerificationStatus === 'missing')
);

function toggleGroup(nodeId: string) {
  if (expandedNodes.value.has(nodeId)) {
    expandedNodes.value.delete(nodeId);
  } else {
    expandedNodes.value.add(nodeId);
  }
}

async function verifyAll(nodeId: string) {
  verifyingNodeId.value = nodeId;
  try {
    await evidenceStore.verifyAllForNode(nodeId);
    if (props.dossierId) await evidenceStore.fetchDossierEvidence(props.dossierId);
  } finally {
    verifyingNodeId.value = null;
  }
}

async function verifyAllDossier() {
  verifyingAll.value = true;
  try {
    await evidenceStore.verifyAllDossier(props.dossierId);
    if (props.dossierId) await evidenceStore.fetchDossierEvidence(props.dossierId);
  } finally {
    verifyingAll.value = false;
  }
}

async function purgeMissing() {
  purging.value = true;
  try {
    await evidenceStore.purgeMissing(props.dossierId);
    if (props.dossierId) await evidenceStore.fetchDossierEvidence(props.dossierId);
  } finally {
    purging.value = false;
  }
}

function refresh() {
  if (props.dossierId) evidenceStore.fetchDossierEvidence(props.dossierId);
}

// Group-level status: worst status across all records
function groupOverallStatus(group: EvidenceGroup): string | null {
  const statuses = group.records.map(r => r.lastVerificationStatus);
  if (statuses.includes('tampered')) return 'tampered';
  if (statuses.includes('missing')) return 'missing';
  if (statuses.every(s => s === 'valid' || s === 'enriched')) {
    return statuses.includes('enriched') ? 'enriched' : 'valid';
  }
  return null; // pending
}

function groupStatusIcon(group: EvidenceGroup) {
  return statusIcon(groupOverallStatus(group));
}
function groupStatusClass(group: EvidenceGroup) {
  return statusClass(groupOverallStatus(group));
}
function groupStatusLabel(group: EvidenceGroup) {
  return statusLabel(groupOverallStatus(group));
}

function statusIcon(status: string | null) {
  switch (status) {
    case 'valid': return 'mdi-shield-check';
    case 'enriched': return 'mdi-shield-star';
    case 'tampered': return 'mdi-shield-off';
    case 'missing': return 'mdi-shield-off-outline';
    default: return 'mdi-shield-alert-outline';
  }
}

function statusClass(status: string | null) {
  if (!status) return 'dev-status--pending';
  return `dev-status--${status}`;
}

function statusLabel(status: string | null) {
  if (!status) return t('evidence.statusPending');
  const labels: Record<string, string> = {
    valid: t('evidence.statusValid'),
    enriched: t('evidence.statusEnriched'),
    tampered: t('evidence.statusTampered'),
    missing: t('evidence.statusMissing'),
  };
  return labels[status] || status;
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    file: t('evidence.typeFile'),
    screenshot: t('evidence.typeScreenshot'),
    clip: t('evidence.typeClip'),
    'media-capture': t('evidence.typeMediaCapture'),
  };
  return labels[type] || type;
}

function nodeTypeLabel(type: string) {
  if (!type) return '';
  return t(`nodeTypes.${type}`, type);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(locale.value, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
</script>

<style scoped>
.dev-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.dev-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--me-border);
}
.dev-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--me-text-primary);
  display: flex;
  align-items: center;
}
.dev-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dev-purge-btn {
  display: flex;
  align-items: center;
  background: none;
  border: 1px solid var(--me-error, #ef4444);
  color: var(--me-error, #ef4444);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
  transition: all 0.15s;
}
.dev-purge-btn:hover {
  background: var(--me-error, #ef4444);
  color: #fff;
}
.dev-purge-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.dev-verify-all-global {
  display: flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: 1px solid var(--me-accent);
  color: var(--me-accent);
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  transition: all 0.15s;
}
.dev-verify-all-global:hover {
  background: var(--me-accent);
  color: var(--me-bg-deep);
}
.dev-verify-all-global:disabled { opacity: 0.5; cursor: not-allowed; }
.dev-refresh {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.15s;
}
.dev-refresh:hover { color: var(--me-text-primary); background: var(--me-bg-elevated); }
.dev-refresh:disabled { opacity: 0.5; cursor: not-allowed; }

.dev-loading {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.dev-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--me-text-muted);
  font-size: 13px;
}
.dev-empty-icon { color: var(--me-text-muted); opacity: 0.3; margin-bottom: 12px; }
.dev-empty-hint { font-size: 11px; margin-top: 8px; opacity: 0.6; }

.dev-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}

/* Group */
.dev-group {
  margin-bottom: 4px;
}
.dev-group-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.dev-group-header:hover { background: var(--me-accent-glow); }

.dev-group-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.dev-detail-btn,
.dev-verify-all-btn {
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 4px;
  transition: all 0.15s;
  display: flex;
  align-items: center;
}
.dev-detail-btn:hover,
.dev-verify-all-btn:hover {
  color: var(--me-accent);
  border-color: var(--me-accent);
  background: var(--me-accent-glow);
}
.dev-verify-all-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.dev-chevron {
  color: var(--me-text-muted);
  transition: transform 0.2s;
}
.dev-chevron--open {
  transform: rotate(180deg);
}

/* Children */
.dev-children {
  padding-left: 20px;
  border-left: 2px solid var(--me-border);
  margin-left: 24px;
  margin-top: 2px;
  margin-bottom: 4px;
}

.dev-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.dev-item:hover { background: var(--me-accent-glow); }

.dev-item--child {
  padding: 6px 10px;
  gap: 8px;
}

.dev-item-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--me-bg-elevated);
  flex-shrink: 0;
}

.dev-child-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: var(--me-bg-elevated);
  flex-shrink: 0;
}

.dev-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dev-item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dev-child-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--me-text-primary);
}
.dev-item-meta {
  font-size: 11px;
  color: var(--me-text-muted);
}
.dev-item-status {
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 4px;
}
.dev-item-status--small {
  font-size: 10px;
  padding: 2px 6px;
}

.dev-status--pending { color: var(--me-warning, #f59e0b); background: rgba(245, 158, 11, 0.1); }
.dev-status--valid { color: var(--me-success, #22c55e); background: rgba(34, 197, 94, 0.1); }
.dev-status--enriched { color: #3b82f6; background: rgba(59, 130, 246, 0.1); }
.dev-status--tampered { color: var(--me-error, #ef4444); background: rgba(239, 68, 68, 0.1); }
.dev-status--missing { color: var(--me-error, #ef4444); background: rgba(239, 68, 68, 0.08); opacity: 0.8; }

.dev-footer {
  padding: 10px 20px;
  border-top: 1px solid var(--me-border);
  font-size: 11px;
  color: var(--me-text-muted);
  text-align: center;
}

@keyframes dev-spin { to { transform: rotate(360deg); } }
.dev-spin { animation: dev-spin 1s linear infinite; }
</style>
