<template>
  <span
    v-if="fileHash"
    class="ev-badge"
    :class="statusClass"
    :title="tooltip"
  >
    <v-icon v-if="verifying" size="12" class="ev-badge--spin">mdi-loading</v-icon>
    <v-icon v-else size="12">{{ statusIcon }}</v-icon>
  </span>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useEncryptionStore } from '../../stores/encryption';
import { decryptFile, hashFile } from '../../utils/encryption';
import api, { SERVER_URL } from '../../services/api';

const { t } = useI18n();

const props = defineProps<{
  fileHash: string | null;
  lastStatus: string | null;
  nodeId?: string;
  dossierId?: string;
  fileUrl?: string | null;
}>();

const emit = defineEmits<{
  verified: [status: string];
}>();

const verifying = ref(false);

const statusClass = computed(() => {
  if (!props.fileHash) return '';
  if (verifying.value) return 'ev-badge--pending';
  if (!props.lastStatus) return 'ev-badge--pending';
  return `ev-badge--${props.lastStatus}`;
});

const statusIcon = computed(() => {
  if (!props.lastStatus) return 'mdi-shield-alert-outline';
  switch (props.lastStatus) {
    case 'valid': return 'mdi-shield-check';
    case 'tampered': return 'mdi-shield-off';
    case 'missing': return 'mdi-shield-off-outline';
    case 'enriched': return 'mdi-shield-half-full';
    default: return 'mdi-shield-outline';
  }
});

const tooltip = computed(() => {
  if (!props.fileHash) return '';
  const short = props.fileHash.slice(0, 8) + '...' + props.fileHash.slice(-8);
  if (!props.lastStatus) return `Hash: ${short} (${t('evidence.statusPending').toLowerCase()})`;
  const labels: Record<string, string> = {
    valid: t('evidence.statusValid'),
    tampered: t('evidence.statusTampered'),
    missing: t('evidence.statusMissing'),
    enriched: t('evidence.statusEnriched'),
  };
  return `${labels[props.lastStatus] || ''} — Hash: ${short}`;
});

/**
 * Client-side integrity verification for encrypted files:
 * 1. Fetch encrypted blob
 * 2. Decrypt with dossier key
 * 3. Compute SHA-256
 * 4. Send hash to server for comparison
 */
async function clientVerify(): Promise<string | null> {
  if (!props.nodeId || !props.dossierId || !props.fileUrl) return null;
  if (verifying.value) return null;

  const encStore = useEncryptionStore();
  if (!encStore.isUnlocked) return null;

  const dossierKey = await encStore.getDossierKey(props.dossierId);
  if (!dossierKey) return null;

  verifying.value = true;
  try {
    // 1. Fetch encrypted file
    const fileUrl = props.fileUrl.startsWith('http')
      ? props.fileUrl
      : `${SERVER_URL}/${props.fileUrl.replace(/^\//, '')}`;
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error('Failed to fetch file');
    const encryptedData = await response.arrayBuffer();

    // 2. Decrypt
    const plaintext = await decryptFile(dossierKey, encryptedData);

    // 3. Compute SHA-256
    const computedHash = await hashFile(plaintext);

    // 4. Send to server
    const { data } = await api.post(`/nodes/${props.nodeId}/evidence/client-verify`, { computedHash });

    emit('verified', data.status);
    return data.status;
  } catch (err) {
    console.error('Client-side verification failed:', err);
    return null;
  } finally {
    verifying.value = false;
  }
}

defineExpose({ clientVerify });
</script>

<style scoped>
.ev-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  flex-shrink: 0;
}
.ev-badge--pending { color: var(--me-warning, #f59e0b); }
.ev-badge--valid { color: var(--me-success, #22c55e); }
.ev-badge--enriched { color: var(--me-info, #3b82f6); }
.ev-badge--tampered { color: var(--me-error, #ef4444); }
.ev-badge--missing { color: var(--me-error, #ef4444); opacity: 0.7; }

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.ev-badge--spin {
  animation: spin 1s linear infinite;
}
</style>
