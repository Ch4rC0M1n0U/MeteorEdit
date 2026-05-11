<template>
  <div class="empty-state" :class="{ 'empty-state--compact': compact }">
    <div v-if="icon" class="empty-state-icon">
      <i :class="icon" />
    </div>
    <h3 v-if="title" class="empty-state-title">{{ title }}</h3>
    <p v-if="message" class="empty-state-message">{{ message }}</p>
    <div v-if="$slots.actions" class="empty-state-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon?: string;
  title?: string;
  message?: string;
  compact?: boolean;
}>();
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  text-align: center;
}
.empty-state--compact { padding: 32px 16px; gap: 10px; }

.empty-state-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--me-text-muted);
  font-size: 24px;
}
.empty-state--compact .empty-state-icon { width: 40px; height: 40px; font-size: 18px; }

.empty-state-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--me-text-primary);
}

.empty-state-message {
  margin: 0;
  font-size: 13px;
  color: var(--me-text-muted);
  max-width: 360px;
  line-height: 1.5;
}

.empty-state-actions {
  margin-top: 4px;
  display: flex;
  gap: 8px;
}
</style>
