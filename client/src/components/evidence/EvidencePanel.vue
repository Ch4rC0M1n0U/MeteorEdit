<template>
  <div class="ev-panel">
    <div class="ev-panel-header">
      <h3 class="ev-panel-title mono">
        <v-icon size="18" class="mr-2">mdi-shield-check-outline</v-icon>
        Integrite de la preuve
      </h3>
      <button class="ev-close" @click="$emit('close')">
        <v-icon size="18">mdi-close</v-icon>
      </button>
    </div>

    <div v-if="!records.length" class="ev-empty">
      <v-icon size="32" class="ev-empty-icon">mdi-shield-outline</v-icon>
      <p>Aucun enregistrement d'integrite pour ce node.</p>
      <p class="ev-empty-hint">Les preuves sont enregistrees automatiquement lors du web clipper ou de l'upload de fichier.</p>
    </div>

    <div v-else class="ev-content">
      <!-- Record selector (if multiple) -->
      <div v-if="records.length > 1" class="ev-selector">
        <button class="ev-selector-btn" :disabled="selectedIdx === 0" @click="selectedIdx--">
          <v-icon size="16">mdi-chevron-left</v-icon>
        </button>
        <span class="ev-selector-label mono">{{ selectedIdx + 1 }} / {{ records.length }}</span>
        <button class="ev-selector-btn" :disabled="selectedIdx === records.length - 1" @click="selectedIdx++">
          <v-icon size="16">mdi-chevron-right</v-icon>
        </button>
      </div>

      <!-- Hash -->
      <div class="ev-section">
        <div class="ev-section-title mono">Empreinte SHA-256</div>
        <div class="ev-hash-wrap">
          <code class="ev-hash">{{ selected.fileHash }}</code>
          <button class="ev-copy" @click="copyHash" :title="copied ? 'Copie !' : 'Copier'">
            <v-icon size="14">{{ copied ? 'mdi-check' : 'mdi-content-copy' }}</v-icon>
          </button>
        </div>
        <div v-if="selected.originalHash && selected.originalHash !== selected.fileHash" class="ev-original-hash">
          <span class="ev-label">Original</span>
          <code class="ev-hash ev-hash--muted">{{ selected.originalHash }}</code>
        </div>
      </div>

      <!-- Info -->
      <div class="ev-section">
        <div class="ev-section-title mono">Informations</div>
        <div class="ev-field">
          <span class="ev-label">Type</span>
          <span class="ev-value">{{ typeLabel }}</span>
        </div>
        <div class="ev-field">
          <span class="ev-label">Taille</span>
          <span class="ev-value">{{ formatSize(selected.fileSize) }}</span>
        </div>
        <div class="ev-field">
          <span class="ev-label">Capture</span>
          <span class="ev-value">{{ formatDate(selected.capturedAt) }}</span>
        </div>
        <div class="ev-field">
          <span class="ev-label">Par</span>
          <span class="ev-value">{{ selected.capturedBy.firstName }} {{ selected.capturedBy.lastName }}</span>
        </div>
        <div v-if="selected.sourceUrl" class="ev-field">
          <span class="ev-label">Source</span>
          <span class="ev-value ev-url">{{ selected.sourceUrl }}</span>
        </div>
      </div>

      <!-- Status -->
      <div class="ev-section">
        <div class="ev-section-title mono">Statut</div>
        <div class="ev-status" :class="statusClass">
          <v-icon size="18">{{ statusIcon }}</v-icon>
          <span>{{ statusLabel }}</span>
        </div>
        <div v-if="selected.lastVerifiedAt" class="ev-last-check">
          Derniere verification : {{ formatDate(selected.lastVerifiedAt) }}
        </div>
      </div>

      <!-- Verifications history -->
      <div v-if="selected.verifications.length" class="ev-section">
        <div class="ev-section-title mono">Historique ({{ selected.verifications.length }})</div>
        <div class="ev-verif-list">
          <div v-for="(v, i) in [...selected.verifications].reverse()" :key="i" class="ev-verif-item">
            <v-icon size="14" :class="`ev-verif-icon--${v.status}`">
              {{ verifIcon(v.status) }}
            </v-icon>
            <span class="ev-verif-date">{{ formatDate(v.verifiedAt) }}</span>
            <span :class="`ev-verif-status--${v.status}`">{{ verifLabel(v.status) }}</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="ev-actions">
        <button class="ev-btn ev-btn-verify" @click="verify" :disabled="evidenceStore.verifying">
          <v-icon size="16" :class="{ 'ev-spin': evidenceStore.verifying }">
            {{ evidenceStore.verifying ? 'mdi-loading' : 'mdi-shield-refresh-outline' }}
          </v-icon>
          <span>Verifier l'integrite</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useEvidenceStore } from '../../stores/evidence';

const props = defineProps<{ nodeId: string; nodeTitle: string; recordId?: string }>();
defineEmits<{ close: [] }>();

const evidenceStore = useEvidenceStore();
const copied = ref(false);
const selectedIdx = ref(0);

const records = computed(() => evidenceStore.nodeEvidenceRecords);
const selected = computed(() => records.value[selectedIdx.value]);

watch(() => props.nodeId, async (id) => {
  if (id) {
    selectedIdx.value = 0;
    await evidenceStore.fetchNodeEvidence(id);
    if (props.recordId && records.value.length) {
      const idx = records.value.findIndex(r => r._id === props.recordId);
      if (idx >= 0) selectedIdx.value = idx;
    }
  }
}, { immediate: true });

watch(() => props.recordId, (rid) => {
  if (rid && records.value.length) {
    const idx = records.value.findIndex(r => r._id === rid);
    if (idx >= 0) selectedIdx.value = idx;
  }
});

const typeLabel = computed(() => {
  if (!selected.value) return '';
  const labels: Record<string, string> = {
    file: 'Fichier uploade', screenshot: 'Capture ecran', clip: 'Clip web', 'media-capture': 'Capture media',
  };
  return labels[selected.value.evidenceType] || selected.value.evidenceType;
});

const statusClass = computed(() => {
  if (!selected.value?.lastVerificationStatus) return 'ev-status--pending';
  return `ev-status--${selected.value.lastVerificationStatus}`;
});

const statusIcon = computed(() => {
  if (!selected.value?.lastVerificationStatus) return 'mdi-shield-alert-outline';
  switch (selected.value.lastVerificationStatus) {
    case 'valid': return 'mdi-shield-check';
    case 'enriched': return 'mdi-shield-star';
    case 'tampered': return 'mdi-shield-off';
    case 'missing': return 'mdi-shield-off-outline';
    default: return 'mdi-shield-outline';
  }
});

const statusLabel = computed(() => {
  if (!selected.value?.lastVerificationStatus) return 'Non verifie';
  const labels: Record<string, string> = {
    valid: 'Integrite confirmee',
    enriched: 'Enrichi — certifie conforme',
    tampered: 'Fichier altere !',
    missing: 'Fichier manquant !',
  };
  return labels[selected.value.lastVerificationStatus] || '';
});

function verifIcon(status: string) {
  switch (status) {
    case 'valid': return 'mdi-check-circle';
    case 'enriched': return 'mdi-star-circle';
    case 'tampered': return 'mdi-alert-circle';
    default: return 'mdi-help-circle';
  }
}

function verifLabel(status: string) {
  const labels: Record<string, string> = {
    valid: 'Valide', enriched: 'Enrichi', tampered: 'Altere', missing: 'Manquant',
  };
  return labels[status] || status;
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

function copyHash() {
  if (selected.value) {
    navigator.clipboard.writeText(selected.value.fileHash);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  }
}

async function verify() {
  if (props.nodeId) {
    try {
      await evidenceStore.verifyAllForNode(props.nodeId);
      await evidenceStore.fetchNodeEvidence(props.nodeId);
    } catch (err) {
      console.error('verify error:', err);
    }
  }
}

</script>

<style scoped>
.ev-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--me-bg-surface);
}
.ev-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--me-border);
}
.ev-panel-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--me-text-primary);
  display: flex;
  align-items: center;
}
.ev-close {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.15s;
}
.ev-close:hover { color: var(--me-text-primary); background: var(--me-bg-elevated); }

.ev-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--me-text-muted);
  font-size: 13px;
}
.ev-empty-icon { color: var(--me-text-muted); opacity: 0.3; margin-bottom: 12px; }
.ev-empty-hint { font-size: 11px; margin-top: 8px; opacity: 0.6; }

/* Record selector */
.ev-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 0 4px;
}
.ev-selector-btn {
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-muted);
  border-radius: 6px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}
.ev-selector-btn:hover:not(:disabled) { border-color: var(--me-accent); color: var(--me-accent); }
.ev-selector-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.ev-selector-label { font-size: 12px; color: var(--me-text-secondary); }

.ev-original-hash {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 6px;
}
.ev-hash--muted { opacity: 0.5; font-size: 10px; }

.ev-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.ev-section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--me-text-muted);
  margin-bottom: 8px;
}

/* Hash */
.ev-hash-wrap {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.ev-hash {
  flex: 1;
  font-size: 11px;
  font-family: var(--me-font-mono, monospace);
  word-break: break-all;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--me-bg-deep);
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  line-height: 1.5;
}
.ev-copy {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}
.ev-copy:hover { border-color: var(--me-accent); color: var(--me-accent); }

/* Fields */
.ev-field {
  display: flex;
  gap: 8px;
  font-size: 13px;
  padding: 4px 0;
}
.ev-label {
  width: 80px;
  font-size: 11px;
  font-weight: 600;
  color: var(--me-text-muted);
  text-transform: uppercase;
  flex-shrink: 0;
  padding-top: 1px;
}
.ev-value { color: var(--me-text-primary); }
.ev-url {
  word-break: break-all;
  font-size: 12px;
  color: var(--me-accent);
}

/* Status */
.ev-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
}
.ev-status--pending { background: rgba(245, 158, 11, 0.1); color: var(--me-warning, #f59e0b); }
.ev-status--valid { background: rgba(34, 197, 94, 0.1); color: var(--me-success, #22c55e); }
.ev-status--enriched { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
.ev-status--tampered { background: rgba(239, 68, 68, 0.1); color: var(--me-error, #ef4444); }
.ev-status--missing { background: rgba(239, 68, 68, 0.08); color: var(--me-error, #ef4444); opacity: 0.8; }

.ev-last-check {
  font-size: 11px;
  color: var(--me-text-muted);
  margin-top: 6px;
}

/* Verification history */
.ev-verif-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}
.ev-verif-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
}
.ev-verif-item:hover { background: var(--me-bg-elevated); }
.ev-verif-icon--valid { color: var(--me-success, #22c55e); }
.ev-verif-icon--enriched { color: #3b82f6; }
.ev-verif-icon--tampered { color: var(--me-error, #ef4444); }
.ev-verif-icon--missing { color: var(--me-warning, #f59e0b); }
.ev-verif-date { flex: 1; color: var(--me-text-muted); }
.ev-verif-status--valid { color: var(--me-success, #22c55e); font-weight: 600; }
.ev-verif-status--enriched { color: #3b82f6; font-weight: 600; }
.ev-verif-status--tampered { color: var(--me-error, #ef4444); font-weight: 600; }
.ev-verif-status--missing { color: var(--me-warning, #f59e0b); font-weight: 600; }

/* Actions */
.ev-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--me-border);
}
.ev-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.ev-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ev-btn-verify {
  background: var(--me-accent);
  color: var(--me-bg-deep);
}
.ev-btn-verify:hover:not(:disabled) { filter: brightness(1.15); }

@keyframes ev-spin { to { transform: rotate(360deg); } }
.ev-spin { animation: ev-spin 1s linear infinite; }
</style>
