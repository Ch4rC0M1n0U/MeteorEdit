<!--
  TagInput.vue — chips éditables (PrimeVue AutoComplete + multiple + chip)
-->
<script setup lang="ts">
import AutoComplete from 'primevue/autocomplete';
import { ref } from 'vue';

const props = defineProps<{
  modelValue: string[];
  suggestions?: string[];
  placeholder?: string;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>();

const filtered = ref<string[]>([]);

function search(e: { query: string }) {
  const q = e.query.toLowerCase();
  filtered.value = (props.suggestions || []).filter(s =>
    s.toLowerCase().includes(q) && !props.modelValue.includes(s)
  );
}
</script>
<template>
  <AutoComplete
    :modelValue="modelValue"
    @update:modelValue="(v) => emit('update:modelValue', v)"
    multiple
    typeahead
    :suggestions="filtered"
    :placeholder="placeholder"
    @complete="search"
    fluid
    :pt="{ root: { class: 'tag-input' } }"
  />
</template>
<style scoped>
.tag-input :deep(.p-autocomplete) { width: 100%; }
.tag-input :deep(.p-autocomplete-multiple) {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  padding: 4px 6px;
  min-height: 36px;
}
.tag-input :deep(.p-autocomplete-multiple:focus-within) {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.tag-input :deep(.p-autocomplete-chip) {
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: var(--r-sm);
  font-size: 11.5px;
  padding: 2px 8px;
  font-weight: 500;
}
.tag-input :deep(.p-autocomplete-input) {
  font-size: 13px;
  color: var(--ink);
  background: transparent;
  border: 0;
  outline: 0;
}
</style>
