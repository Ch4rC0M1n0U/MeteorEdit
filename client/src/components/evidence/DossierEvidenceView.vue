<template>
  <div class="dev-panel">
    <div class="dev-header">
      <h3 class="dev-title mono">
        <v-icon size="18" class="mr-2">mdi-shield-check-outline</v-icon>
        Preuves du dossier
      </h3>
      <button class="dev-refresh" @click="refresh" :disabled="evidenceStore.loading" title="Actualiser">
        <v-icon size="16" :class="{ 'dev-spin': evidenceStore.loading }">
          {{ evidenceStore.loading ? 'mdi-loading' : 'mdi-refresh' }}
        </v-icon>
      </button>
    </div>

    <div v-if="evidenceStore.loading && !evidenceStore.dossierEvidence.length" class="dev-loading">
      <v-progress-circular indeterminate size="24" color="var(--me-accent)" />
    </div>

    <div v-else-if="!evidenceStore.dossierEvidence.length" class="dev-empty">
      <v-icon size="32" class="dev-empty-icon">mdi-shield-outline</v-icon>
      <p>Aucune preuve enregistree pour ce dossier.</p>
      <p class="dev-empty-hint">Les preuves sont creees automatiquement lors du web clipper ou de l'upload de fichier.</p>
    </div>

    <div v-else class="dev-list">
      <div
        v-for="record in evidenceStore.dossierEvidence"
        :key="record._id"
        class="dev-item"
        @click="$emit('select-node', getNodeId(record))"
      >
        <div class="dev-item-icon">
          <v-icon size="16" :class="statusClass(record.lastVerificationStatus)">
            {{ statusIcon(record.lastVerificationStatus) }}
          </v-icon>
        </div>
        <div class="dev-item-info">
          <span class="dev-item-title">{{ getNodeTitle(record) }}</span>
          <span class="dev-item-meta mono">
            {{ typeLabel(record.evidenceType) }} · {{ formatSize(record.fileSize) }} · {{ formatDate(record.capturedAt) }}
          </span>
        </div>
        <div class="dev-item-status" :class="statusClass(record.lastVerificationStatus)">
          {{ statusLabel(record.lastVerificationStatus) }}
        </div>
      </div>
    </div>

    <div v-if="evidenceStore.dossierEvidence.length" class="dev-footer mono">
      {{ evidenceStore.dossierEvidence.length }} preuve(s) enregistree(s)
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useEvidenceStore } from '../../stores/evidence';

const props = defineProps<{ dossierId: string }>();
defineEmits<{ 'select-node': [nodeId: string] }>();

const evidenceStore = useEvidenceStore();

watch(() => props.dossierId, (id) => {
  if (id) evidenceStore.fetchDossierEvidence(id);
}, { immediate: true });

// nodeId is populated by the server, so it can be an object { _id, title, type } or a string
function getNodeId(record: any): string {
  return typeof record.nodeId === 'object' ? record.nodeId._id : record.nodeId;
}

function getNodeTitle(record: any): string {
  return typeof record.nodeId === 'object' ? record.nodeId.title : 'Node';
}

function refresh() {
  if (props.dossierId) evidenceStore.fetchDossierEvidence(props.dossierId);
}

function statusIcon(status: string | null) {
  switch (status) {
    case 'valid': return 'mdi-shield-check';
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
  if (!status) return 'Non verifie';
  const labels: Record<string, string> = {
    valid: 'Valide',
    tampered: 'Altere',
    missing: 'Manquant',
  };
  return labels[status] || status;
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    file: 'Fichier', screenshot: 'Capture', clip: 'Clip web',
  };
  return labels[type] || type;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', {
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

.dev-status--pending { color: var(--me-warning, #f59e0b); background: rgba(245, 158, 11, 0.1); }
.dev-status--valid { color: var(--me-success, #22c55e); background: rgba(34, 197, 94, 0.1); }
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
