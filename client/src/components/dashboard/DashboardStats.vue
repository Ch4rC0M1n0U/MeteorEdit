<template>
  <div class="dash-stats-section">
    <!-- Streak KPIs -->
    <div class="dash-kpi-row fade-in">
      <div class="dash-kpi glass-card">
        <div class="dash-kpi-icon">
          <v-icon size="22" :color="streaks.current >= 7 ? '#f59e0b' : undefined">
            {{ streaks.current >= 7 ? 'mdi-fire' : 'mdi-lightning-bolt-outline' }}
          </v-icon>
        </div>
        <div class="dash-kpi-data">
          <span class="dash-kpi-value mono">{{ streaks.current }}</span>
          <span class="dash-kpi-label">Streak actuel</span>
        </div>
      </div>
      <div class="dash-kpi glass-card">
        <div class="dash-kpi-icon"><v-icon size="22">mdi-trophy-outline</v-icon></div>
        <div class="dash-kpi-data">
          <span class="dash-kpi-value mono">{{ streaks.best }}</span>
          <span class="dash-kpi-label">Meilleur streak</span>
        </div>
      </div>
      <div class="dash-kpi glass-card">
        <div class="dash-kpi-icon"><v-icon size="22">mdi-folder-star-outline</v-icon></div>
        <div class="dash-kpi-data">
          <span class="dash-kpi-value mono dash-kpi-value--small">{{ topDossierTitle }}</span>
          <span class="dash-kpi-label">Top dossier</span>
        </div>
      </div>
      <div class="dash-kpi glass-card">
        <div class="dash-kpi-icon">
          <v-icon size="22">{{ weeklyTrend.current >= weeklyTrend.previous ? 'mdi-trending-up' : 'mdi-trending-down' }}</v-icon>
        </div>
        <div class="dash-kpi-data">
          <span class="dash-kpi-value mono">{{ weeklyTrend.current }}</span>
          <span class="dash-kpi-label">Cette semaine</span>
        </div>
      </div>
    </div>

    <!-- Charts row -->
    <div class="dash-stats-row">
      <!-- Donut -->
      <div class="dash-card glass-card">
        <h3 class="dash-card-title mono">Repartition par type</h3>
        <div class="dash-donut-container">
          <Doughnut v-if="donutData" :data="donutData" :options="donutOptions" />
        </div>
      </div>
      <!-- Top dossiers bar -->
      <div class="dash-card glass-card">
        <h3 class="dash-card-title mono">Top dossiers actifs</h3>
        <Bar v-if="barData" :data="barData" :options="barOptions" />
        <p v-else class="dash-empty-text">Pas assez de donnees</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Doughnut, Bar } from 'vue-chartjs';
import {
  Chart as ChartJS, ArcElement, CategoryScale, LinearScale,
  BarElement, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const props = defineProps<{
  nodeCountsByType: { _id: string; count: number }[];
  topDossiersThisWeek: { _id: string; title: string; count: number }[];
  streaks: { current: number; best: number };
  weeklyTrend: { current: number; previous: number };
}>();

const typeColors: Record<string, string> = {
  note: '#38bdf8', mindmap: '#a78bfa', document: '#34d399',
  map: '#fb923c', dataset: '#22d3ee', folder: '#94a3b8',
};

const typeLabels: Record<string, string> = {
  note: 'Notes', mindmap: 'Mindmaps', document: 'Documents',
  map: 'Cartes', dataset: 'Datasets', folder: 'Dossiers',
};

const topDossierTitle = computed(() => {
  return props.topDossiersThisWeek[0]?.title || '-';
});

const donutData = computed(() => {
  if (!props.nodeCountsByType.length) return null;
  return {
    labels: props.nodeCountsByType.map(n => typeLabels[n._id] || n._id),
    datasets: [{
      data: props.nodeCountsByType.map(n => n.count),
      backgroundColor: props.nodeCountsByType.map(n => typeColors[n._id] || '#64748b'),
      borderWidth: 0,
    }],
  };
});

const donutOptions = {
  responsive: true,
  plugins: { legend: { position: 'bottom' as const, labels: { color: '#94a3b8', font: { size: 11 } } } },
  cutout: '60%',
};

const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--me-text-muted').trim() || '#64748b';
const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--me-accent').trim() || '#38bdf8';

const barData = computed(() => {
  if (!props.topDossiersThisWeek.length) return null;
  return {
    labels: props.topDossiersThisWeek.map(d => d.title.length > 20 ? d.title.slice(0, 20) + '...' : d.title),
    datasets: [{
      data: props.topDossiersThisWeek.map(d => d.count),
      backgroundColor: accentColor + '80',
      borderColor: accentColor,
      borderWidth: 1,
      borderRadius: 4,
    }],
  };
});

const barOptions = {
  indexAxis: 'y' as const,
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: mutedColor, font: { size: 10 }, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
    y: { ticks: { color: mutedColor, font: { size: 11 } }, grid: { display: false } },
  },
};
</script>

<style scoped>
.dash-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.dash-kpi { padding: 16px; display: flex; align-items: center; gap: 12px; }
.dash-kpi-icon { color: var(--me-accent); }
.dash-kpi-data { display: flex; flex-direction: column; min-width: 0; }
.dash-kpi-value { font-size: 24px; font-weight: 700; color: var(--me-text-primary); line-height: 1; }
.dash-kpi-value--small { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dash-kpi-label { font-size: 12px; color: var(--me-text-muted); margin-top: 2px; }
.dash-stats-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
.dash-card { padding: 18px; }
.dash-card-title { font-size: 13px; font-weight: 700; color: var(--me-text-primary); margin-bottom: 12px; }
.dash-donut-container { max-width: 280px; margin: 0 auto; }
.dash-empty-text { font-size: 12px; color: var(--me-text-muted); text-align: center; padding: 16px 0; }
@media (max-width: 900px) {
  .dash-kpi-row { grid-template-columns: repeat(2, 1fr); }
  .dash-stats-row { grid-template-columns: 1fr; }
}
@media (max-width: 600px) { .dash-kpi-row { grid-template-columns: 1fr; } }
</style>
