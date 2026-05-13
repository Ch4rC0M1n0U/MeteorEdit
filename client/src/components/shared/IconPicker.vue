<!--
  IconPicker.vue — grille d'icônes pour dossiers / nodes
  Réutilise DOSSIER_ICONS de constants/dossierIcons.ts (icônes MDI conservées pour spécialisation police/OSINT).
-->
<script setup lang="ts">
import { DOSSIER_ICONS } from '@/constants/dossierIcons';

const props = defineProps<{
  modelValue: string | null;
  icons?: string[];
  columns?: number;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', v: string | null): void }>();

const list = props.icons || DOSSIER_ICONS;

function pick(ic: string) {
  emit('update:modelValue', props.modelValue === ic ? null : ic);
}
</script>
<template>
  <div class="ip" :style="{ '--ip-cols': columns ?? 8 }">
    <button
      v-for="ic in list"
      :key="ic"
      type="button"
      class="ip__item"
      :class="{ 'ip__item--active': modelValue === ic }"
      :title="ic"
      @click="pick(ic)"
    >
      <span class="mdi" :class="ic" />
    </button>
  </div>
</template>
<style scoped>
.ip {
  display: grid;
  grid-template-columns: repeat(var(--ip-cols, 8), 1fr);
  gap: 4px;
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  padding: 6px;
}
.ip__item {
  height: 32px;
  display: grid; place-items: center;
  border: 1px solid transparent;
  background: transparent;
  border-radius: var(--r-sm);
  color: var(--ink-2);
  cursor: pointer;
  transition: all 80ms ease;
}
.ip__item .mdi { font-size: 18px; }
.ip__item:hover {
  background: var(--bg-3);
  color: var(--ink);
}
.ip__item--active {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: var(--accent-line);
}
</style>
