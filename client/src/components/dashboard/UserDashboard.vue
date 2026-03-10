<template>
  <div class="user-dashboard">
    <div class="dash-header">
      <h2 class="dash-title mono">
        <v-icon size="20" class="mr-2">mdi-view-dashboard-outline</v-icon>
        Tableau de bord
      </h2>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" style="border-radius: 4px;" />

    <template v-if="!loading">
      <!-- KPI Cards (always visible) -->
      <div class="dash-kpi-row fade-in">
        <div class="dash-kpi glass-card">
          <div class="dash-kpi-icon"><v-icon size="22">mdi-folder-multiple-outline</v-icon></div>
          <div class="dash-kpi-data">
            <span class="dash-kpi-value mono">{{ stats.totalDossiers }}</span>
            <span class="dash-kpi-label">Dossiers</span>
          </div>
        </div>
        <div class="dash-kpi glass-card">
          <div class="dash-kpi-icon"><v-icon size="22">mdi-folder-account-outline</v-icon></div>
          <div class="dash-kpi-data">
            <span class="dash-kpi-value mono">{{ stats.ownedDossiers }}</span>
            <span class="dash-kpi-label">Proprietaire</span>
          </div>
        </div>
        <div class="dash-kpi glass-card">
          <div class="dash-kpi-icon"><v-icon size="22">mdi-account-group-outline</v-icon></div>
          <div class="dash-kpi-data">
            <span class="dash-kpi-value mono">{{ stats.collabDossiers }}</span>
            <span class="dash-kpi-label">Collaborations</span>
          </div>
        </div>
        <div class="dash-kpi glass-card">
          <div class="dash-kpi-icon"><v-icon size="22">mdi-file-tree-outline</v-icon></div>
          <div class="dash-kpi-data">
            <span class="dash-kpi-value mono">{{ stats.totalNodes }}</span>
            <span class="dash-kpi-label">Elements</span>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <v-tabs v-model="activeTab" color="primary" density="compact" class="dash-tabs mb-4">
        <v-tab value="overview">
          <v-icon size="16" start>mdi-home-outline</v-icon>
          Apercu
        </v-tab>
        <v-tab value="stats">
          <v-icon size="16" start>mdi-chart-bar</v-icon>
          Statistiques
        </v-tab>
        <v-tab value="activity">
          <v-icon size="16" start>mdi-history</v-icon>
          Activite
        </v-tab>
      </v-tabs>

      <v-tabs-window v-model="activeTab">
        <!-- Tab: Apercu -->
        <v-tabs-window-item value="overview">
          <DashboardQuickAccess
            :last-accessed="stats.lastAccessedNodes || []"
            :assigned-tasks="stats.assignedTasks || []"
            @open-node="handleOpenNode"
          />

          <div v-if="stats.recentDossiers?.length" class="dash-recent fade-in">
            <div class="dash-card glass-card">
              <h3 class="dash-card-title mono">Dossiers recemment modifies</h3>
              <div class="dash-recent-list">
                <div v-for="d in stats.recentDossiers" :key="d._id" class="dash-recent-item" @click="$emit('openDossier', d._id)">
                  <span :class="['status-dot', `status-dot--${statusDot(d.status)}`]" />
                  <span class="dash-recent-title">{{ d.title }}</span>
                  <span class="dash-recent-date mono">{{ formatDate(d.updatedAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </v-tabs-window-item>

        <!-- Tab: Statistiques -->
        <v-tabs-window-item value="stats">
          <DashboardStats
            :node-counts-by-type="stats.nodeCountsByType || []"
            :top-dossiers-this-week="stats.topDossiersThisWeek || []"
            :streaks="stats.streaks || { current: 0, best: 0 }"
            :weekly-trend="stats.weeklyTrend || { current: 0, previous: 0 }"
          />

          <DashboardHeatmap :heatmap="stats.heatmap || []" />

          <div class="dash-content-row fade-in">
            <div class="dash-card glass-card dash-card--chart">
              <h3 class="dash-card-title mono">Statuts des dossiers</h3>
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

              <h3 class="dash-card-title mono mt-16">Types d'elements</h3>
              <div class="dash-node-types">
                <div v-for="n in nodeTypeItems" :key="n.type" class="dash-node-type">
                  <v-icon size="16" class="dash-node-icon">{{ n.icon }}</v-icon>
                  <span class="dash-node-label">{{ n.label }}</span>
                  <span class="dash-node-count mono">{{ n.count }}</span>
                </div>
              </div>
            </div>
          </div>
        </v-tabs-window-item>

        <!-- Tab: Activite -->
        <v-tabs-window-item value="activity">
          <div class="dash-card glass-card fade-in" style="margin-bottom: 16px;">
            <h3 class="dash-card-title mono">Activite (7 jours)</h3>
            <Line v-if="activityChartData" :data="activityChartData" :options="lineOptions" />
            <p v-else class="dash-empty-text">Aucune activite recente</p>
          </div>

          <div class="dash-card glass-card fade-in">
            <h3 class="dash-card-title mono">Activite recente</h3>
            <div v-if="stats.recentActivity?.length" class="dash-activity-list">
              <div v-for="act in stats.recentActivity" :key="act._id" class="dash-activity-item">
                <v-icon size="14" class="dash-act-icon">{{ actionIcon(act.action) }}</v-icon>
                <span class="dash-act-label">{{ actionLabel(act.action) }}</span>
                <span v-if="act.metadata?.title" class="dash-act-target mono">{{ act.metadata.title }}</span>
                <span class="dash-act-time mono">{{ formatTime(act.timestamp) }}</span>
              </div>
            </div>
            <p v-else class="dash-empty-text">Aucune activite cette semaine</p>
          </div>
        </v-tabs-window-item>
      </v-tabs-window>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Filler,
} from 'chart.js';
import api from '../../services/api';
import DashboardQuickAccess from './DashboardQuickAccess.vue';
import DashboardHeatmap from './DashboardHeatmap.vue';
import DashboardStats from './DashboardStats.vue';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

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
    { key: 'open', label: 'Ouvert', dot: 'active', color: '#38bdf8', count: c.open || 0, pct: total ? ((c.open || 0) / total * 100) : 0 },
    { key: 'in_progress', label: 'En cours', dot: 'warning', color: '#fbbf24', count: c.in_progress || 0, pct: total ? ((c.in_progress || 0) / total * 100) : 0 },
    { key: 'closed', label: 'Clos', dot: 'error', color: '#34d399', count: c.closed || 0, pct: total ? ((c.closed || 0) / total * 100) : 0 },
  ];
});

const nodeTypeMap: Record<string, { label: string; icon: string }> = {
  folder: { label: 'Dossiers', icon: 'mdi-folder-outline' },
  note: { label: 'Notes', icon: 'mdi-note-text-outline' },
  mindmap: { label: 'Mindmaps', icon: 'mdi-graph-outline' },
  document: { label: 'Documents', icon: 'mdi-file-document-outline' },
  map: { label: 'Cartes', icon: 'mdi-map-outline' },
};

const nodeTypeItems = computed(() => {
  const counts = stats.value.nodeCountsByType || [];
  return Object.entries(nodeTypeMap).map(([type, meta]) => {
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

const actionLabels: Record<string, string> = {
  'login': 'Connexion',
  'dossier.create': 'Dossier cree',
  'dossier.update': 'Dossier modifie',
  'dossier.delete': 'Dossier supprime',
  'node.create': 'Element cree',
  'node.delete': 'Element supprime',
  'node.restore': 'Element restaure',
  'node.purge': 'Element purge',
  'node.empty_trash': 'Corbeille videe',
  'collaborator.add': 'Collaborateur ajoute',
  'collaborator.remove': 'Collaborateur retire',
  'comment.create': 'Commentaire ajoute',
  'comment.delete': 'Commentaire supprime',
  'snapshot.create': 'Snapshot cree',
  'snapshot.restore': 'Snapshot restaure',
  'snapshot.delete': 'Snapshot supprime',
  'profile.update': 'Profil modifie',
  'profile.avatar_upload': 'Avatar modifie',
  'profile.password_change': 'Mot de passe modifie',
  '2fa.enable': '2FA active',
  '2fa.disable': '2FA desactive',
};

const actionIcons: Record<string, string> = {
  'login': 'mdi-login-variant',
  'dossier.create': 'mdi-folder-plus-outline',
  'dossier.update': 'mdi-folder-edit-outline',
  'dossier.delete': 'mdi-folder-remove-outline',
  'node.create': 'mdi-file-plus-outline',
  'node.delete': 'mdi-file-remove-outline',
  'node.restore': 'mdi-file-restore-outline',
  'node.purge': 'mdi-delete-forever-outline',
  'node.empty_trash': 'mdi-trash-can-outline',
  'collaborator.add': 'mdi-account-plus-outline',
  'collaborator.remove': 'mdi-account-minus-outline',
  'comment.create': 'mdi-comment-plus-outline',
  'comment.delete': 'mdi-comment-remove-outline',
  'snapshot.create': 'mdi-history',
  'snapshot.restore': 'mdi-backup-restore',
  'snapshot.delete': 'mdi-delete-clock-outline',
  'profile.update': 'mdi-account-edit-outline',
  'profile.avatar_upload': 'mdi-camera-outline',
  'profile.password_change': 'mdi-lock-reset',
  '2fa.enable': 'mdi-shield-check-outline',
  '2fa.disable': 'mdi-shield-off-outline',
};

function actionLabel(action: string): string {
  return actionLabels[action] || action;
}

function actionIcon(action: string): string {
  return actionIcons[action] || 'mdi-circle-small';
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
  grid-template-columns: 1fr;
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
