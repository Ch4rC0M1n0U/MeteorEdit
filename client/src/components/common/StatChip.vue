<template>
  <span class="stat-chip" :class="`stat-chip--${variant}`">
    <i v-if="icon" :class="['stat-chip-icon', icon]" />
    <span class="stat-chip-value mono">{{ value }}</span>
    <span v-if="label" class="stat-chip-label">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string;
  value: string | number;
  label?: string;
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'error';
}>(), {
  variant: 'default',
});
</script>

<style scoped>
.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: var(--me-radius-xs);
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  font-size: 11px;
  line-height: 1.4;
}
.stat-chip-icon { font-size: 11px; opacity: 0.85; }
.stat-chip-value {
  font-size: 11px;
  font-weight: 600;
  color: var(--me-text-primary);
}
.stat-chip-label {
  font-size: 10px;
  color: var(--me-text-muted);
}

.stat-chip--accent  .stat-chip-value { color: var(--me-accent); }
.stat-chip--accent              { border-color: var(--me-border-hover); }
.stat-chip--success .stat-chip-value { color: var(--me-success); }
.stat-chip--success             { border-color: rgba(52, 211, 153, 0.35); }
.stat-chip--warning .stat-chip-value { color: var(--me-warning); }
.stat-chip--warning             { border-color: rgba(251, 191, 36, 0.35); }
.stat-chip--error   .stat-chip-value { color: var(--me-error); }
.stat-chip--error               { border-color: rgba(248, 113, 113, 0.35); }
</style>
