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

    <div v-if="!evidence" class="ev-empty">
      <v-icon size="32" class="ev-empty-icon">mdi-shield-outline</v-icon>
      <p>Aucun enregistrement d'integrite pour ce node.</p>
      <p class="ev-empty-hint">Les preuves sont enregistrees automatiquement lors du web clipper ou de l'upload de fichier.</p>
    </div>

    <div v-else class="ev-content">
      <!-- Hash -->
      <div class="ev-section">
        <div class="ev-section-title mono">Empreinte SHA-256</div>
        <div class="ev-hash-wrap">
          <code class="ev-hash">{{ evidence.fileHash }}</code>
          <button class="ev-copy" @click="copyHash" :title="copied ? 'Copie !' : 'Copier'">
            <v-icon size="14">{{ copied ? 'mdi-check' : 'mdi-content-copy' }}</v-icon>
          </button>
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
          <span class="ev-value">{{ formatSize(evidence.fileSize) }}</span>
        </div>
        <div class="ev-field">
          <span class="ev-label">Capture</span>
          <span class="ev-value">{{ formatDate(evidence.capturedAt) }}</span>
        </div>
        <div class="ev-field">
          <span class="ev-label">Par</span>
          <span class="ev-value">{{ evidence.capturedBy.firstName }} {{ evidence.capturedBy.lastName }}</span>
        </div>
        <div v-if="evidence.sourceUrl" class="ev-field">
          <span class="ev-label">Source</span>
          <span class="ev-value ev-url">{{ evidence.sourceUrl }}</span>
        </div>
      </div>

      <!-- Status -->
      <div class="ev-section">
        <div class="ev-section-title mono">Statut</div>
        <div class="ev-status" :class="statusClass">
          <v-icon size="18">{{ statusIcon }}</v-icon>
          <span>{{ statusLabel }}</span>
        </div>
        <div v-if="evidence.lastVerifiedAt" class="ev-last-check">
          Derniere verification : {{ formatDate(evidence.lastVerifiedAt) }}
        </div>
      </div>

      <!-- Verifications history -->
      <div v-if="evidence.verifications.length" class="ev-section">
        <div class="ev-section-title mono">Historique ({{ evidence.verifications.length }})</div>
        <div class="ev-verif-list">
          <div v-for="(v, i) in evidence.verifications" :key="i" class="ev-verif-item">
            <v-icon size="14" :class="`ev-verif-icon--${v.status}`">
              {{ v.status === 'valid' ? 'mdi-check-circle' : v.status === 'tampered' ? 'mdi-alert-circle' : 'mdi-help-circle' }}
            </v-icon>
            <span class="ev-verif-date">{{ formatDate(v.verifiedAt) }}</span>
            <span :class="`ev-verif-status--${v.status}`">{{ v.status === 'valid' ? 'Valide' : v.status === 'tampered' ? 'Altere' : 'Manquant' }}</span>
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
        <button class="ev-btn ev-btn-cert" @click="downloadCert">
          <v-icon size="16">mdi-file-certificate-outline</v-icon>
          <span>Certificat PDF</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useEvidenceStore } from '../../stores/evidence';

const props = defineProps<{ nodeId: string; nodeTitle: string }>();
defineEmits<{ close: [] }>();

const evidenceStore = useEvidenceStore();
const copied = ref(false);

const evidence = computed(() => evidenceStore.currentEvidence);

watch(() => props.nodeId, (id) => {
  if (id) evidenceStore.fetchNodeEvidence(id);
}, { immediate: true });

const typeLabel = computed(() => {
  const labels: Record<string, string> = {
    file: 'Fichier uploade', screenshot: 'Capture ecran', clip: 'Clip web',
  };
  return evidence.value ? labels[evidence.value.evidenceType] || evidence.value.evidenceType : '';
});

const statusClass = computed(() => {
  if (!evidence.value?.lastVerificationStatus) return 'ev-status--pending';
  return `ev-status--${evidence.value.lastVerificationStatus}`;
});

const statusIcon = computed(() => {
  if (!evidence.value?.lastVerificationStatus) return 'mdi-shield-alert-outline';
  switch (evidence.value.lastVerificationStatus) {
    case 'valid': return 'mdi-shield-check';
    case 'tampered': return 'mdi-shield-off';
    case 'missing': return 'mdi-shield-off-outline';
    default: return 'mdi-shield-outline';
  }
});

const statusLabel = computed(() => {
  if (!evidence.value?.lastVerificationStatus) return 'Non verifie';
  const labels: Record<string, string> = {
    valid: 'Integrite confirmee',
    tampered: 'Fichier altere !',
    missing: 'Fichier manquant !',
  };
  return labels[evidence.value.lastVerificationStatus] || '';
});

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
  if (evidence.value) {
    navigator.clipboard.writeText(evidence.value.fileHash);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  }
}

async function verify() {
  if (props.nodeId) {
    await evidenceStore.verifyIntegrity(props.nodeId);
  }
}

async function downloadCert() {
  if (props.nodeId) {
    await evidenceStore.downloadCertificate(props.nodeId, props.nodeTitle);
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
.ev-verif-icon--tampered { color: var(--me-error, #ef4444); }
.ev-verif-icon--missing { color: var(--me-warning, #f59e0b); }
.ev-verif-date { flex: 1; color: var(--me-text-muted); }
.ev-verif-status--valid { color: var(--me-success, #22c55e); font-weight: 600; }
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
.ev-btn-cert {
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
}
.ev-btn-cert:hover { border-color: var(--me-accent); color: var(--me-accent); }

@keyframes ev-spin { to { transform: rotate(360deg); } }
.ev-spin { animation: ev-spin 1s linear infinite; }
</style>
