<template>
  <div class="admin-dashboard">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-view-dashboard-outline</v-icon>
        Dashboard
      </h2>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <!-- KPI Cards -->
    <div class="kpi-row fade-in fade-in-delay-1">
      <div class="kpi-card glass-card">
        <div class="kpi-icon"><v-icon size="24">mdi-account-group-outline</v-icon></div>
        <div class="kpi-data">
          <span class="kpi-value mono">{{ stats.totalUsers }}</span>
          <span class="kpi-label">Utilisateurs</span>
          <span class="kpi-sub mono">{{ stats.activeUsers }} actifs</span>
        </div>
      </div>
      <div class="kpi-card glass-card kpi-card--live">
        <div class="kpi-icon"><v-icon size="24">mdi-access-point</v-icon></div>
        <div class="kpi-data">
          <span class="kpi-value mono">{{ onlineCount }}</span>
          <span class="kpi-label">En ligne</span>
          <span class="kpi-sub"><span class="status-dot status-dot--active" /> temps reel</span>
        </div>
      </div>
      <div class="kpi-card glass-card">
        <div class="kpi-icon"><v-icon size="24">mdi-folder-multiple-outline</v-icon></div>
        <div class="kpi-data">
          <span class="kpi-value mono">{{ stats.totalDossiers }}</span>
          <span class="kpi-label">Dossiers</span>
        </div>
      </div>
      <div class="kpi-card glass-card">
        <div class="kpi-icon"><v-icon size="24">mdi-calendar-week</v-icon></div>
        <div class="kpi-data">
          <span class="kpi-value mono">{{ stats.weeklyDossiers }}</span>
          <span class="kpi-label">Cette semaine</span>
        </div>
      </div>
    </div>

    <!-- Charts row -->
    <div class="charts-row fade-in fade-in-delay-2">
      <div class="chart-card glass-card">
        <h3 class="chart-title mono">Connexions (30 jours)</h3>
        <Line v-if="loginChartData" :data="loginChartData" :options="lineOptions" />
      </div>
      <div class="chart-card glass-card">
        <h3 class="chart-title mono">Dossiers par utilisateur</h3>
        <Bar v-if="dossierChartData" :data="dossierChartData" :options="barOptions" />
      </div>
    </div>

    <!-- Bottom row -->
    <div class="bottom-row fade-in fade-in-delay-3">
      <div class="chart-card glass-card chart-card--small">
        <h3 class="chart-title mono">Statuts des dossiers</h3>
        <Doughnut v-if="statusChartData" :data="statusChartData" :options="doughnutOptions" />
      </div>
      <div class="chart-card glass-card chart-card--wide">
        <h3 class="chart-title mono">Dernieres connexions</h3>
        <table class="recent-table">
          <thead>
            <tr><th>Utilisateur</th><th>Date</th><th>IP</th></tr>
          </thead>
          <tbody>
            <tr v-for="log in stats.recentLogins" :key="log._id">
              <td>{{ log.userId?.firstName }} {{ log.userId?.lastName }}</td>
              <td class="mono">{{ formatDate(log.timestamp) }}</td>
              <td class="mono">{{ log.ip || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Line, Bar, Doughnut } from 'vue-chartjs';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import api from '../../services/api';
import { getSocket } from '../../services/socket';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const loading = ref(true);
const onlineCount = ref(0);
const stats = ref<any>({
  totalUsers: 0, activeUsers: 0, totalDossiers: 0, weeklyDossiers: 0,
  statusDistribution: [], dossiersPerUser: [], loginsPerDay: [], recentLogins: [],
});

onMounted(async () => {
  try {
    const { data } = await api.get('/admin/stats');
    stats.value = data;
    onlineCount.value = data.onlineCount;
  } finally {
    loading.value = false;
  }

  const socket = getSocket();
  if (socket) {
    socket.on('online-count', (count: number) => { onlineCount.value = count; });
  }
});

onUnmounted(() => {
  const socket = getSocket();
  if (socket) socket.off('online-count');
});

const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--me-accent').trim() || '#38bdf8';
const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--me-text-muted').trim() || '#64748b';

const lineOptions = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: mutedColor, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
    y: { ticks: { color: mutedColor, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
  },
};

const barOptions = {
  responsive: true,
  indexAxis: 'y' as const,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: mutedColor, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
    y: { ticks: { color: mutedColor, font: { size: 10 } }, grid: { display: false } },
  },
};

const doughnutOptions = {
  responsive: true,
  plugins: { legend: { position: 'bottom' as const, labels: { color: mutedColor, font: { size: 11 } } } },
};

const loginChartData = computed(() => {
  if (!stats.value.loginsPerDay?.length) return null;
  return {
    labels: stats.value.loginsPerDay.map((d: any) => d._id.slice(5)),
    datasets: [{
      data: stats.value.loginsPerDay.map((d: any) => d.count),
      borderColor: accentColor,
      backgroundColor: accentColor + '20',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
    }],
  };
});

const dossierChartData = computed(() => {
  if (!stats.value.dossiersPerUser?.length) return null;
  return {
    labels: stats.value.dossiersPerUser.map((d: any) => d.name),
    datasets: [{
      data: stats.value.dossiersPerUser.map((d: any) => d.count),
      backgroundColor: accentColor + '80',
      borderColor: accentColor,
      borderWidth: 1,
    }],
  };
});

const statusLabels: Record<string, string> = { open: 'Ouvert', in_progress: 'En cours', closed: 'Ferme' };
const statusColors = ['#38bdf8', '#fbbf24', '#34d399'];

const statusChartData = computed(() => {
  if (!stats.value.statusDistribution?.length) return null;
  return {
    labels: stats.value.statusDistribution.map((d: any) => statusLabels[d._id] || d._id),
    datasets: [{
      data: stats.value.statusDistribution.map((d: any) => d.count),
      backgroundColor: statusColors,
      borderWidth: 0,
    }],
  };
});

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
</script>

<style scoped>
.admin-dashboard { max-width: 1100px; }
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.mb-4 { margin-bottom: 16px; }
.kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.kpi-card { padding: 18px; display: flex; align-items: center; gap: 14px; }
.kpi-card--live { border-color: var(--me-success); }
.kpi-icon { color: var(--me-accent); }
.kpi-data { display: flex; flex-direction: column; }
.kpi-value { font-size: 26px; font-weight: 700; color: var(--me-text-primary); line-height: 1; }
.kpi-label { font-size: 12px; color: var(--me-text-muted); margin-top: 2px; }
.kpi-sub { font-size: 11px; color: var(--me-text-muted); margin-top: 2px; display: flex; align-items: center; gap: 4px; }
.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
.bottom-row { display: grid; grid-template-columns: 300px 1fr; gap: 12px; }
.chart-card { padding: 18px; }
.chart-title { font-size: 13px; font-weight: 700; color: var(--me-text-primary); margin-bottom: 14px; }
.recent-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.recent-table th { text-align: left; padding: 8px 10px; color: var(--me-text-muted); font-family: var(--me-font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--me-border); }
.recent-table td { padding: 8px 10px; border-bottom: 1px solid var(--me-border); color: var(--me-text-secondary); }
.recent-table tbody tr:hover { background: var(--me-accent-glow); }
</style>
