<template>
  <header class="section-header">
    <div class="section-header-text">
      <div class="section-header-title-row">
        <i v-if="icon" :class="['section-header-icon', icon]" />
        <h3 class="section-header-title">{{ title }}</h3>
        <span v-if="count !== null && count !== undefined" class="section-header-count mono">{{ count }}</span>
      </div>
      <p v-if="subtitle" class="section-header-subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="section-header-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
  icon?: string;
  count?: number | string | null;
}>();
</script>

<style scoped>
.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}
.section-header-text { min-width: 0; }
.section-header-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.section-header-icon {
  color: var(--me-text-muted);
  font-size: 14px;
}
.section-header-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--me-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.2px;
}
.section-header-count {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--me-text-secondary);
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  border-radius: 999px;
  padding: 1px 8px;
}
.section-header-subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--me-text-muted);
}
.section-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
</style>
