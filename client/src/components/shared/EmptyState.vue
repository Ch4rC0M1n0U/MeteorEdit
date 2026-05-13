<!--
  EmptyState.vue — état vide réutilisable
  Props : icon (pi-…), title, message, actionLabel?, @action
-->
<script setup lang="ts">
import Button from 'primevue/button';
defineProps<{
  icon?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  actionIcon?: string;
  compact?: boolean;
}>();
defineEmits<{ (e: 'action'): void }>();
</script>
<template>
  <div class="empty" :class="{ 'empty--compact': compact }">
    <div v-if="icon" class="empty__icon-wrap">
      <i class="pi" :class="icon" />
    </div>
    <h3 class="empty__title">{{ title }}</h3>
    <p v-if="message" class="empty__message">{{ message }}</p>
    <Button
      v-if="actionLabel"
      :label="actionLabel"
      :icon="actionIcon"
      size="small"
      class="empty__action"
      @click="$emit('action')"
    />
  </div>
</template>
<style scoped>
.empty {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 60px 24px;
  text-align: center;
  color: var(--ink-3);
  gap: 8px;
}
.empty--compact { padding: 32px 16px; }
.empty__icon-wrap {
  width: 56px; height: 56px;
  display: grid; place-items: center;
  background: var(--bg-3);
  border: 1px solid var(--line);
  border-radius: 50%;
  color: var(--ink-3);
  margin-bottom: 8px;
}
.empty__icon-wrap .pi { font-size: 22px; }
.empty__title {
  font-size: 14px; font-weight: 600;
  color: var(--ink);
  margin: 0;
}
.empty__message {
  font-size: 12.5px;
  color: var(--ink-3);
  max-width: 380px;
  line-height: 1.5;
  margin: 0;
}
.empty__action { margin-top: 12px; }
.empty__action :deep(.p-button) {
  background: var(--accent) !important;
  border-color: var(--accent) !important;
  color: var(--on-accent) !important;
}
</style>
