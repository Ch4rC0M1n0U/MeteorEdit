<template>
  <div class="dash-card glass-card dash-heatmap-card">
    <h3 class="dash-card-title mono">
      <v-icon size="16" class="mr-1">mdi-calendar-blank-outline</v-icon>
      {{ $t('dashboard.contribution6months') }}
    </h3>
    <div class="heatmap-container">
      <div class="heatmap-grid">
        <div v-for="(week, wi) in weeks" :key="wi" class="heatmap-week">
          <div
            v-for="(day, di) in week"
            :key="di"
            class="heatmap-cell"
            :class="cellClass(day.count)"
            :title="`${day.date}: ${day.count} action${day.count > 1 ? 's' : ''}`"
          />
        </div>
      </div>
      <div class="heatmap-legend">
        <span class="heatmap-legend-label mono">{{ $t('dashboard.less') }}</span>
        <div class="heatmap-cell heatmap-0" />
        <div class="heatmap-cell heatmap-1" />
        <div class="heatmap-cell heatmap-2" />
        <div class="heatmap-cell heatmap-3" />
        <div class="heatmap-cell heatmap-4" />
        <span class="heatmap-legend-label mono">{{ $t('dashboard.more') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ heatmap: { date: string; count: number }[] }>();

const weeks = computed(() => {
  const map = new Map(props.heatmap.map(d => [d.date, d.count]));
  const now = new Date();
  const result: { date: string; count: number }[][] = [];
  let currentWeek: { date: string; count: number }[] = [];

  for (let i = 182; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();

    if (dayOfWeek === 1 && currentWeek.length > 0) {
      result.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push({ date: dateStr, count: map.get(dateStr) || 0 });
  }
  if (currentWeek.length > 0) result.push(currentWeek);
  return result;
});

function cellClass(count: number): string {
  if (count === 0) return 'heatmap-0';
  if (count <= 2) return 'heatmap-1';
  if (count <= 5) return 'heatmap-2';
  if (count <= 10) return 'heatmap-3';
  return 'heatmap-4';
}
</script>

<style scoped>
.dash-heatmap-card { margin-bottom: 16px; }
.dash-card { padding: 18px; }
.dash-card-title { font-size: 13px; font-weight: 700; color: var(--me-text-primary); margin-bottom: 12px; display: flex; align-items: center; }
.heatmap-container { overflow-x: auto; }
.heatmap-grid { display: flex; gap: 3px; }
.heatmap-week { display: flex; flex-direction: column; gap: 3px; }
.heatmap-cell { width: 12px; height: 12px; border-radius: 2px; }
.heatmap-0 { background: var(--me-bg-elevated); }
.heatmap-1 { background: color-mix(in srgb, var(--me-accent) 25%, var(--me-bg-elevated)); }
.heatmap-2 { background: color-mix(in srgb, var(--me-accent) 50%, var(--me-bg-elevated)); }
.heatmap-3 { background: color-mix(in srgb, var(--me-accent) 75%, var(--me-bg-elevated)); }
.heatmap-4 { background: var(--me-accent); }
.heatmap-legend { display: flex; align-items: center; gap: 4px; margin-top: 8px; justify-content: flex-end; }
.heatmap-legend-label { font-size: 10px; color: var(--me-text-muted); }
</style>
