<!--
  FormField.vue — wrapper label + input slot + hint + error
  Standard label uppercase 10.5 px tracking 0.06em color --ink-3.
-->
<script setup lang="ts">
defineProps<{
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  for?: string;
}>();
</script>
<template>
  <div class="ff" :class="{ 'ff--error': !!error }">
    <label v-if="label" :for="$props.for" class="ff__label">
      {{ label }}
      <span v-if="required" class="ff__required" aria-hidden="true">*</span>
    </label>
    <div class="ff__control">
      <slot />
    </div>
    <p v-if="error" class="ff__error">
      <i class="pi pi-exclamation-circle" /> {{ error }}
    </p>
    <p v-else-if="hint" class="ff__hint">{{ hint }}</p>
  </div>
</template>
<style scoped>
.ff { display: flex; flex-direction: column; gap: 6px; }
.ff__label {
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-3);
}
.ff__required { color: var(--err); margin-left: 2px; }
.ff__control { display: flex; flex-direction: column; gap: 4px; }
.ff__hint  { font-size: 11.5px; color: var(--ink-3); margin: 0; }
.ff__error {
  font-size: 11.5px;
  color: var(--err);
  margin: 0;
  display: flex; align-items: center; gap: 4px;
}
.ff__error .pi { font-size: 11px; }
.ff--error :deep(.p-inputtext),
.ff--error :deep(.p-textarea) {
  border-color: var(--err) !important;
}
</style>
