<template>
  <div class="user-dashboard">
    <div class="dash-header">
      <h2 class="dash-title mono">
        <i class="pi pi-objects-column" style="font-size: 20px; margin-right: 8px;" />
        {{ $t('dashboard.title') }}
      </h2>
    </div>

    <ProgressBar v-if="loading" mode="indeterminate" class="mb-4" style="border-radius: 4px; height: 4px;" />

    <template v-if="!loading">
      <!-- KPI Cards (always visible) -->
      <div class="dash-kpi-row fade-in">
        <div class="dash-kpi glass-card">
          <div class="dash-kpi-icon"><i class="pi pi-folder" style="font-size: 22px;" /></div>
          <div class="dash-kpi-data">
            <span class="dash-kpi-value mono">{{ stats.totalDossiers }}</span>
            <span class="dash-kpi-label">{{ $t('dashboard.dossiers') }}</span>
          </div>
        </div>
        <div class="dash-kpi glass-card">
          <div class="dash-kpi-icon"><i class="pi pi-user" style="font-size: 22px;" /></div>
          <div class="dash-kpi-data">
            <span class="dash-kpi-value mono">{{ stats.ownedDossiers }}</span>
            <span class="dash-kpi-label">{{ $t('dashboard.owner') }}</span>
          </div>
        </div>
        <div class="dash-kpi glass-card">
          <div class="dash-kpi-icon"><i class="pi pi-users" style="font-size: 22px;" /></div>
          <div class="dash-kpi-data">
            <span class="dash-kpi-value mono">{{ stats.collabDossiers }}</span>
            <span class="dash-kpi-label">{{ $t('dashboard.collaborations') }}</span>
          </div>
        </div>
        <div class="dash-kpi glass-card">
          <div class="dash-kpi-icon"><i class="pi pi-sitemap" style="font-size: 22px;" /></div>
          <div class="dash-kpi-data">
            <span class="dash-kpi-value mono">{{ stats.totalNodes }}</span>
            <span class="dash-kpi-label">{{ $t('dashboard.elements') }}</span>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <Tabs v-model:value="activeTab" class="dash-tabs mb-4">
        <TabList>
          <Tab value="overview">
            <i class="pi pi-home" style="font-size: 14px; margin-right: 6px;" />
            {{ $t('dashboard.overview') }}
          </Tab>
          <Tab value="stats">
            <i class="pi pi-chart-bar" style="font-size: 14px; margin-right: 6px;" />
            {{ $t('dashboard.statistics') }}
          </Tab>
          <Tab value="activity">
            <i class="pi pi-history" style="font-size: 14px; margin-right: 6px;" />
            {{ $t('dashboard.activityTab') }}
          </Tab>
        </TabList>

        <TabPanels>
          <!-- Tab: Overview -->
          <TabPanel value="overview">
            <DashboardQuickAccess
              :last-accessed="stats.lastAccessedNodes || []"
              :assigned-tasks="stats.assignedTasks || []"
              @open-node="handleOpenNode"
            />

            <div v-if="stats.recentDossiers?.length" class="dash-recent fade-in">
              <div class="dash-card glass-card">
                <h3 class="dash-card-title mono">{{ $t('dashboard.recentlyModifiedDossiers') }}</h3>
                <div class="dash-recent-list">
                  <div v-for="d in stats.recentDossiers.filter((r: any) => r.status !== 'closed')" :key="d._id" class="dash-recent-item" @click="$emit('openDossier', d._id)">
                    <span :class="['status-dot', `status-dot--${statusDot(d.status)}`]" />
                    <span class="dash-recent-title">{{ d.title }}</span>
                    <span class="dash-recent-date mono">{{ formatDate(d.updatedAt) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          <!-- Tab: Statistics -->
          <TabPanel value="stats">
            <!-- Processing Stats + Dossier Statuses FIRST -->
            <div v-if="processingStats" class="dash-card glass-card fade-in" style="margin-bottom: 16px;">
              <h3 class="dash-card-title mono" style="display: flex; align-items: center; gap: 6px;">
                <i class="pi pi-stopwatch" style="font-size: 16px;" />
                {{ $t('dashboard.processingStats') }}
              </h3>
              <div class="processing-chips">
                <span class="processing-chip mono">
                  <i class="pi pi-chart-bar" style="font-size: 12px;" />
                  {{ $t('dashboard.avgProcessing') }}: {{ processingStats.avgDays }} {{ $t('dashboard.days') }}
                </span>
                <span class="processing-chip mono">
                  <i class="pi pi-arrow-up" style="font-size: 12px;" />
                  {{ $t('dashboard.maxProcessing') }}: {{ processingStats.maxDays }} {{ $t('dashboard.days') }}
                </span>
                <span class="processing-chip mono">
                  <i class="pi pi-arrow-down" style="font-size: 12px;" />
                  {{ $t('dashboard.minProcessing') }}: {{ processingStats.minDays }} {{ $t('dashboard.days') }}
                </span>
                <span class="processing-chip mono">
                  <i class="pi pi-check-circle" style="font-size: 12px;" />
                  {{ $t('dashboard.closedDossiers') }}: {{ processingStats.totalClosed }}
                </span>
              </div>
              <div v-if="openDurationsChartData" style="margin-top: 16px;">
                <Bar :data="openDurationsChartData" :options="openDurationsOptions" />
              </div>
            </div>

            <div class="dash-content-row fade-in">
              <div class="dash-card glass-card dash-card--chart">
                <h3 class="dash-card-title mono">{{ $t('dashboard.dossierStatuses') }}</h3>
                <div class="dash-status-bars">
                  <div v-for="s in statusItems" :key="s.key" class="dash-status-item">
                    <div class="dash-status-head">
                      <span :class="['status-dot', `status-dot--${s.dot}`]" />
                      <span class="dash-status-name">{{ s.label }}</span>
                      <span class="dash-status-count mono">{{ s.count }}</span>
                    </div>
                    <div class="dash-status-bar-bg">
                      <div class="dash-status-bar-fill" :style="{ width: s.pct + '%', background: s.color }" />
                    </div>
                  </div>
                </div>

                <h3 class="dash-card-title mono mt-16">{{ $t('dashboard.elementTypes') }}</h3>
                <div class="dash-node-types">
                  <div v-for="n in nodeTypeItems" :key="n.type" class="dash-node-type">
                    <i :class="n.icon" style="font-size: 16px;" class="dash-node-icon" />
                    <span class="dash-node-label">{{ n.label }}</span>
                    <span class="dash-node-count mono">{{ n.count }}</span>
                  </div>
                </div>
              </div>
            </div>

            <DashboardStats
              :node-counts-by-type="stats.nodeCountsByType || []"
              :top-dossiers-this-week="stats.topDossiersThisWeek || []"
              :streaks="stats.streaks || { current: 0, best: 0 }"
              :weekly-trend="stats.weeklyTrend || { current: 0, previous: 0 }"
            />

            <DashboardHeatmap :heatmap="stats.heatmap || []" />
          </TabPanel>

          <!-- Tab: Activity -->
          <TabPanel value="activity">
            <div class="dash-card glass-card fade-in" style="margin-bottom: 16px;">
              <h3 class="dash-card-title mono">{{ $t('dashboard.activity7days') }}</h3>
              <Line v-if="activityChartData" :data="activityChartData" :options="lineOptions" />
              <p v-else class="dash-empty-text">{{ $t('dashboard.noRecentActivity') }}</p>
            </div>

            <div class="dash-card glass-card fade-in">
              <h3 class="dash-card-title mono">{{ $t('dashboard.recentActivity') }}</h3>
              <div v-if="stats.recentActivity?.length" class="dash-activity-list">
                <div v-for="act in stats.recentActivity" :key="act._id" class="dash-activity-item">
                  <i :class="actionIcon(act.action)" style="font-size: 14px;" class="dash-act-icon" />
                  <span class="dash-act-label">{{ actionLabel(act.action) }}</span>
                  <span v-if="act.metadata?.title" class="dash-act-target mono">{{ act.metadata.title }}</span>
                  <span class="dash-act-time mono">{{ formatTime(act.timestamp) }}</span>
                </div>
              </div>
              <p v-else class="dash-empty-text">{{ $t('dashboard.noActivityThisWeek') }}</p>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Line, Bar } from 'vue-chartjs';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Filler,
} from 'chart.js';
import api from '../../services/api';
import DashboardQuickAccess from './DashboardQuickAccess.vue';
import DashboardHeatmap from './DashboardHeatmap.vue';
import DashboardStats from './DashboardStats.vue';

import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import ProgressBar from 'primevue/progressbar';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Filler);

const { t } = useI18n();

const emit = defineEmits<{ openDossier: [id: string] }>();

function handleOpenNode(node: any) {
  if (node.dossierId?._id) {
    emit('openDossier', node.dossierId._id);
  }
}

const activeTab = ref('overview');
const loading = ref(true);
const stats = ref<any>({
  totalDossiers: 0, ownedDossiers: 0, collabDossiers: 0,
  statusCounts: { open: 0, in_progress: 0, closed: 0 },
  totalNodes: 0, nodeCountsByType: [],
  recentActivity: [], activityPerDay: [], recentDossiers: [],
});

onMounted(async () => {
  try {
    const { data } = await api.get('/dossiers/dashboard');
    stats.value = data;
  } finally {
    loading.value = false;
  }
});

const statusItems = computed(() => {
  const c = stats.value.statusCounts || {};
  const total = (c.open || 0) + (c.in_progress || 0) + (c.closed || 0);
  return [
    { key: 'open', label: t('dossier.statusOpen'), dot: 'active', color: '#22c55e', count: c.open || 0, pct: total ? ((c.open || 0) / total * 100) : 0 },
    { key: 'in_progress', label: t('dossier.statusInProgress'), dot: 'warning', color: '#3b82f6', count: c.in_progress || 0, pct: total ? ((c.in_progress || 0) / total * 100) : 0 },
    { key: 'closed', label: t('dossier.statusClosed'), dot: 'error', color: '#ef4444', count: c.closed || 0, pct: total ? ((c.closed || 0) / total * 100) : 0 },
  ];
});

const nodeTypeMap = computed<Record<string, { label: string; icon: string }>>(() => ({
  folder: { label: t('dashboard.nodeTypes.folders'), icon: 'pi pi-folder' },
  note: { label: t('dashboard.nodeTypes.notes'), icon: 'pi pi-file-edit' },
  mindmap: { label: t('dashboard.nodeTypes.mindmaps'), icon: 'pi pi-share-alt' },
  document: { label: t('dashboard.nodeTypes.documents'), icon: 'pi pi-file' },
  map: { label: t('dashboard.nodeTypes.maps'), icon: 'pi pi-map' },
}));

const nodeTypeItems = computed(() => {
  const counts = stats.value.nodeCountsByType || [];
  return Object.entries(nodeTypeMap.value).map(([type, meta]) => {
    const found = counts.find((n: any) => n._id === type);
    return { type, label: meta.label, icon: meta.icon, count: found?.count || 0 };
  });
});

const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--me-accent').trim() || '#38bdf8';
const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--me-text-muted').trim() || '#64748b';

const lineOptions = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: mutedColor, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
    y: { ticks: { color: mutedColor, font: { size: 10 }, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
  },
};

const activityChartData = computed(() => {
  if (!stats.value.activityPerDay?.length) return null;
  const days = stats.value.activityPerDay;
  return {
    labels: days.map((d: any) => {
      const parts = d._id.split('-');
      return `${parts[2]}/${parts[1]}`;
    }),
    datasets: [{
      data: days.map((d: any) => d.count),
      borderColor: accentColor,
      backgroundColor: accentColor + '20',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
    }],
  };
});

const processingStats = computed(() => stats.value.processingStats || null);

const openDurationsChartData = computed(() => {
  const durations = processingStats.value?.openDurations;
  if (!durations?.length) return null;
  return {
    labels: durations.map((d: any) => d.title.length > 25 ? d.title.slice(0, 25) + '...' : d.title),
    datasets: [{
      data: durations.map((d: any) => d.days),
      backgroundColor: durations.map((d: any) => {
        if (d.isUrgent) return '#ef4444';
        if (d.classification === 'priority') return '#f59e0b';
        return '#3b82f6';
      }),
      borderRadius: 4,
    }],
  };
});

const openDurationsOptions = {
  indexAxis: 'y' as const,
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    x: {
      ticks: { color: mutedColor, font: { size: 10 } },
      grid: { color: 'rgba(255,255,255,0.05)' },
      beginAtZero: true,
      title: { display: true, text: t('dashboard.days'), color: mutedColor, font: { size: 10 } },
    },
    y: {
      ticks: { color: mutedColor, font: { size: 11 } },
      grid: { display: false },
    },
  },
};

const actionLabelKeys: Record<string, string> = {
  'login': 'dashboard.actions.login',
  'dossier.create': 'dashboard.actions.dossierCreate',
  'dossier.update': 'dashboard.actions.dossierUpdate',
  'dossier.delete': 'dashboard.actions.dossierDelete',
  'node.create': 'dashboard.actions.nodeCreate',
  'node.delete': 'dashboard.actions.nodeDelete',
  'node.restore': 'dashboard.actions.nodeRestore',
  'node.purge': 'dashboard.actions.nodePurge',
  'node.empty_trash': 'dashboard.actions.emptyTrash',
  'collaborator.add': 'dashboard.actions.collaboratorAdd',
  'collaborator.remove': 'dashboard.actions.collaboratorRemove',
  'comment.create': 'dashboard.actions.commentCreate',
  'comment.delete': 'dashboard.actions.commentDelete',
  'snapshot.create': 'dashboard.actions.snapshotCreate',
  'snapshot.restore': 'dashboard.actions.snapshotRestore',
  'snapshot.delete': 'dashboard.actions.snapshotDelete',
  'profile.update': 'dashboard.actions.profileUpdate',
  'profile.avatar_upload': 'dashboard.actions.avatarUpload',
  'profile.password_change': 'dashboard.actions.passwordChange',
  '2fa.enable': 'dashboard.actions.twoFaEnable',
  '2fa.disable': 'dashboard.actions.twoFaDisable',
};

const actionIcons: Record<string, string> = {
  'login': 'pi pi-sign-in',
  'dossier.create': 'pi pi-folder-plus',
  'dossier.update': 'pi pi-folder',
  'dossier.delete': 'pi pi-folder',
  'node.create': 'pi pi-file-plus',
  'node.delete': 'pi pi-file',
  'node.restore': 'pi pi-file',
  'node.purge': 'pi pi-trash',
  'node.empty_trash': 'pi pi-trash',
  'collaborator.add': 'pi pi-user-plus',
  'collaborator.remove': 'pi pi-user-minus',
  'comment.create': 'pi pi-comment',
  'comment.delete': 'pi pi-comment',
  'snapshot.create': 'pi pi-history',
  'snapshot.restore': 'pi pi-history',
  'snapshot.delete': 'pi pi-history',
  'profile.update': 'pi pi-user-edit',
  'profile.avatar_upload': 'pi pi-camera',
  'profile.password_change': 'pi pi-lock',
  '2fa.enable': 'pi pi-shield',
  '2fa.disable': 'pi pi-shield',
};

function actionLabel(action: string): string {
  const key = actionLabelKeys[action];
  return key ? t(key) : action;
}

function actionIcon(action: string): string {
  return actionIcons[action] || 'pi pi-circle';
}

function statusDot(status: string): string {
  switch (status) {
    case 'open': return 'active';
    case 'in_progress': return 'warning';
    case 'closed': return 'error';
    default: return 'active';
  }
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR');
}
</script>

<style scoped>
.user-dashboard {
  margin-top: 40px;
  padding-top: 32px;
  border-top: 1px solid var(--me-border);
}
.dash-header {
  margin-bottom: 20px;
}
.dash-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--me-text-primary);
  display: flex;
  align-items: center;
}
.mb-4 { margin-bottom: 16px; }
.mt-16 { margin-top: 16px; }

/* KPI */
.dash-kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.dash-kpi {
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.dash-kpi-icon { color: var(--me-accent); }
.dash-kpi-data { display: flex; flex-direction: column; }
.dash-kpi-value { font-size: 24px; font-weight: 700; color: var(--me-text-primary); line-height: 1; }
.dash-kpi-label { font-size: 12px; color: var(--me-text-muted); margin-top: 2px; }

/* Tabs */
.dash-tabs {
  border-bottom: 1px solid var(--me-border);
}

/* Content row */
.dash-content-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}
.dash-card { padding: 18px; }
.dash-card-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--me-text-primary);
  margin-bottom: 12px;
}

/* Status bars */
.dash-status-item { margin-bottom: 10px; }
.dash-status-item:last-child { margin-bottom: 0; }
.dash-status-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.dash-status-name { font-size: 12px; color: var(--me-text-secondary); flex: 1; }
.dash-status-count { font-size: 12px; color: var(--me-text-muted); }
.dash-status-bar-bg {
  height: 6px;
  background: var(--me-bg-elevated);
  border-radius: 3px;
  overflow: hidden;
}
.dash-status-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

/* Node types */
.dash-node-types {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dash-node-type {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.dash-node-icon { color: var(--me-accent); flex-shrink: 0; }
.dash-node-label { font-size: 12px; color: var(--me-text-secondary); flex: 1; }
.dash-node-count { font-size: 12px; color: var(--me-text-muted); }

/* Activity */
.dash-activity-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 260px;
  overflow-y: auto;
}
.dash-activity-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--me-radius-xs);
  transition: background 0.15s;
}
.dash-activity-item:hover { background: var(--me-accent-glow); }
.dash-act-icon { color: var(--me-accent); flex-shrink: 0; }
.dash-act-label { font-size: 12px; color: var(--me-text-secondary); white-space: nowrap; }
.dash-act-target {
  font-size: 11px;
  color: var(--me-text-muted);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dash-act-time {
  font-size: 11px;
  color: var(--me-text-muted);
  flex-shrink: 0;
}

.dash-empty-text {
  font-size: 12px;
  color: var(--me-text-muted);
  text-align: center;
  padding: 16px 0;
}

/* Processing stats chips */
.processing-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.processing-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--me-bg-elevated);
  color: var(--me-text-secondary);
  border: 1px solid var(--me-border);
}

/* Recent dossiers */
.dash-recent { margin-bottom: 16px; }
.dash-recent-list { display: flex; flex-direction: column; gap: 2px; }
.dash-recent-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--me-radius-xs);
  cursor: pointer;
  transition: background 0.15s;
}
.dash-recent-item:hover { background: var(--me-accent-glow); }
.dash-recent-title {
  flex: 1;
  font-size: 13px;
  color: var(--me-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dash-recent-date { font-size: 11px; color: var(--me-text-muted); flex-shrink: 0; }

/* Responsive */
@media (max-width: 900px) {
  .dash-kpi-row { grid-template-columns: repeat(2, 1fr); }
  .dash-content-row { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .dash-kpi-row { grid-template-columns: 1fr; }
}
</style>
