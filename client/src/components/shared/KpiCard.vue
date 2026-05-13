<!--
  KpiCard.vue — Carte KPI v3 (utilisée dans la strip du dashboard)
  Props : icon (PrimeIcons), category ('open'|'progress'|'tasks'|'closed'|custom),
          label, value, trend?, trendKind? ('up'|'down'|'warn'|'neutral')
  La couleur de l'icône suit la "catégorie" (rythme visuel doux, pas arc-en-ciel).
-->
<script setup lang="ts">
defineProps<{
  icon: string;            // ex: 'pi-folder-open'
  category?: 'open' | 'progress' | 'tasks' | 'closed' | 'entity' | 'note' | 'clipper' | 'map';
  label: string;
  value: string | number;
  trend?: string;
  trendKind?: 'up' | 'down' | 'warn' | 'neutral';
}>();
</script>
<template>
  <div class="kpi" :data-cat="category">
    <div class="kpi__head">
      <span class="kpi__icon"><i class="pi" :class="icon" /></span>
      <span class="kpi__label">{{ label }}</span>
    </div>
    <div class="kpi__value num">{{ value }}</div>
    <div v-if="trend" class="kpi__trend" :class="trendKind ? `kpi__trend--${trendKind}` : null">{{ trend }}</div>
  </div>
</template>
<style scoped>
.kpi {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
  overflow: hidden;
  min-height: 96px;
}
.kpi__head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: var(--ink-3);
  letter-spacing: -0.005em;
}
.kpi__icon {
  width: 22px; height: 22px;
  display: grid; place-items: center;
  border-radius: var(--r-sm);
  background: var(--bg-2);
  color: var(--ink-2);
}
.kpi__icon .pi { font-size: 13px; }
.kpi[data-cat="open"]     .kpi__icon { background: var(--ok-soft);          color: var(--ok); }
.kpi[data-cat="progress"] .kpi__icon { background: var(--accent-soft);      color: var(--accent); }
.kpi[data-cat="tasks"]    .kpi__icon { background: var(--cat-clipper-soft); color: var(--cat-clipper); }
.kpi[data-cat="closed"]   .kpi__icon { background: var(--bg-3);             color: var(--ink-3); }
.kpi__label {
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
  color: var(--ink-3);
}
.kpi__value {
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
  margin-top: 2px;
  line-height: 1.1;
}
.kpi__trend {
  font-size: 11.5px;
  color: var(--ink-3);
  margin-top: 2px;
}
.kpi__trend--up   { color: var(--ok); }
.kpi__trend--down { color: var(--err); }
.kpi__trend--warn { color: var(--warn); }
</style>
