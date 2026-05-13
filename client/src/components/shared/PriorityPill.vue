<!--
  PriorityPill.vue — P1 / P2 / P3 / aucune
  Factorisé depuis DossierCard pour réutilisation (DossierView toolbar, TaskList, etc.)
-->
<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ priority?: 'P1' | 'P2' | 'P3' | null | undefined }>();
const cls = computed(() => props.priority ? `pri pri--${props.priority.toLowerCase()}` : '');
</script>
<template>
  <span v-if="priority" :class="cls">{{ priority }}</span>
</template>
<style scoped>
.pri {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0;
  background: var(--bg-3);
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}
.pri--p1 { background: var(--err-soft); color: var(--err); }
.pri--p2 { background: var(--warn-soft); color: var(--warn); }
.pri--p3 { background: var(--bg-3); color: var(--ink-3); }
</style>
