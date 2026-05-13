<!--
  StatusDot.vue — point coloré 8 px par statut
  open=ok, in_progress=accent, paused/continuous=warn, closed=ink-4
-->
<script setup lang="ts">
defineProps<{ status: 'open' | 'in_progress' | 'paused' | 'closed' | 'continuous'; title?: string }>();
</script>
<template>
  <span class="status-dot" :class="`status-dot--${status}`" :title="title" :aria-label="title" />
</template>
<style scoped>
.status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--ink-4);
  display: inline-block;
  flex-shrink: 0;
}
.status-dot--open        { background: var(--ok); }
.status-dot--in_progress { background: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.status-dot--paused      { background: var(--warn); }
.status-dot--continuous  { background: var(--info); }
.status-dot--closed      { background: var(--ink-4); }
</style>
