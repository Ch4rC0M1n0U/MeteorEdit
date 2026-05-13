<!--
  SectionHeader.vue — heading "Dossiers récents", "À faire", etc.
  Props : title (court), hint? (compteur "12" ou "+3"), tabs? (SelectButton intégré)
-->
<script setup lang="ts">
import SelectButton from 'primevue/selectbutton';
defineProps<{
  title: string;
  hint?: string;
  tabs?: { label: string; value: string }[];
  modelValue?: string;
}>();
defineEmits<{ (e: 'update:modelValue', v: string): void }>();
</script>
<template>
  <div class="sec-head">
    <div class="sec-head__left">
      <h2 class="sec-head__title">{{ title }}</h2>
      <span v-if="hint" class="sec-head__hint num">{{ hint }}</span>
    </div>
    <SelectButton
      v-if="tabs"
      :modelValue="modelValue"
      :options="tabs"
      optionLabel="label"
      optionValue="value"
      class="sec-head__tabs"
      @update:modelValue="(v: string) => $emit('update:modelValue', v)"
    />
  </div>
</template>
<style scoped>
.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
}
.sec-head__left { display: flex; align-items: baseline; gap: 8px; }
.sec-head__title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.005em;
  color: var(--ink);
  margin: 0;
}
.sec-head__hint {
  font-size: 11.5px;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}
.sec-head__tabs :deep(.p-selectbutton) {
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  padding: 2px;
  gap: 2px;
}
.sec-head__tabs :deep(.p-togglebutton),
.sec-head__tabs :deep(.p-button) {
  padding: 4px 10px !important;
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-3);
  background: transparent !important;
  border: 0 !important;
  border-radius: var(--r-sm) !important;
  box-shadow: none !important;
  height: auto !important;
}
.sec-head__tabs :deep(.p-togglebutton.p-togglebutton-checked),
.sec-head__tabs :deep(.p-button.p-highlight) {
  background: var(--surface) !important;
  color: var(--ink) !important;
  box-shadow: var(--shadow-1) !important;
}
.sec-head__tabs :deep(.p-togglebutton:hover:not(.p-togglebutton-checked)),
.sec-head__tabs :deep(.p-button:hover:not(.p-highlight)) {
  color: var(--ink) !important;
}
</style>
