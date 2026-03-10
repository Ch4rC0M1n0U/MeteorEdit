<template>
  <span
    v-if="fileHash"
    class="ev-badge"
    :class="statusClass"
    :title="tooltip"
  >
    <v-icon size="12">{{ statusIcon }}</v-icon>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  fileHash: string | null;
  lastStatus: string | null;
}>();

const statusClass = computed(() => {
  if (!props.fileHash) return '';
  if (!props.lastStatus) return 'ev-badge--pending';
  return `ev-badge--${props.lastStatus}`;
});

const statusIcon = computed(() => {
  if (!props.lastStatus) return 'mdi-shield-alert-outline';
  switch (props.lastStatus) {
    case 'valid': return 'mdi-shield-check';
    case 'tampered': return 'mdi-shield-off';
    case 'missing': return 'mdi-shield-off-outline';
    default: return 'mdi-shield-outline';
  }
});

const tooltip = computed(() => {
  if (!props.fileHash) return '';
  const short = props.fileHash.slice(0, 8) + '...' + props.fileHash.slice(-8);
  if (!props.lastStatus) return `Hash: ${short} (non verifie)`;
  const labels: Record<string, string> = {
    valid: 'Integrite verifiee',
    tampered: 'Fichier altere !',
    missing: 'Fichier manquant !',
  };
  return `${labels[props.lastStatus] || ''} — Hash: ${short}`;
});
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
.ev-badge--tampered { color: var(--me-error, #ef4444); }
.ev-badge--missing { color: var(--me-error, #ef4444); opacity: 0.7; }
</style>
