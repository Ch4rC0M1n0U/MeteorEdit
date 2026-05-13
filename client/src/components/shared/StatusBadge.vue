<!--
  StatusBadge.vue — badge statut dossier (pill rounded)
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  status: 'open' | 'in_progress' | 'paused' | 'closed' | 'continuous';
}>();

const { t } = useI18n();

const variant = computed(() => ({
  open: 'ok',
  in_progress: 'accent',
  paused: 'warn',
  closed: 'muted',
  continuous: 'info',
}[props.status]));

const label = computed(() => t(`dossier.status.${props.status}`));
</script>
<template>
  <span class="sb" :class="`sb--${variant}`">
    <span class="sb__dot" />
    {{ label }}
  </span>
</template>
<style scoped>
.sb {
  display: inline-flex; align-items: center;
  gap: 6px;
  padding: 2px 8px 2px 6px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
  background: var(--bg-3);
  color: var(--ink-3);
  letter-spacing: -0.005em;
}
.sb__dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}
.sb--ok     { background: var(--ok-soft); color: var(--ok); }
.sb--accent { background: var(--accent-soft); color: var(--accent); }
.sb--warn   { background: var(--warn-soft); color: var(--warn); }
.sb--info   { background: var(--info-soft); color: var(--info); }
.sb--muted  { background: var(--bg-3); color: var(--ink-3); }
.sb--muted .sb__dot { background: var(--ink-4); }
</style>
