<template>
  <div class="dp-page">
    <!-- Header -->
    <div class="dp-header dp-fade-in">
      <div>
        <h1 class="dp-title mono">{{ $t('home.myDossiers') }}</h1>
        <p class="dp-subtitle">{{ $t('home.dossierCount', { count: dossierStore.dossiers.length }) }}</p>
      </div>
      <div class="dp-header-actions">
        <Button icon="pi pi-upload" :label="$t('home.import')" severity="secondary" outlined size="small" class="dp-import-btn" @click="triggerImport" />
        <CreateDossierDialog />
      </div>
      <input ref="importInputRef" type="file" accept=".json" style="display: none;" @change="handleImport" />
    </div>

    <ProgressBar v-if="dossierStore.loading" mode="indeterminate" class="dp-progress" />

    <!-- Tabbed dossier list -->
    <Tabs v-model:value="activeTab" class="dp-tabs">
      <TabList>
        <Tab value="favorites"><i class="pi pi-star" /> {{ $t('home.tabs.favorites') }}</Tab>
        <Tab value="active"><i class="pi pi-folder-open" /> {{ $t('home.tabs.active') }}</Tab>
        <Tab value="closed"><i class="pi pi-inbox" /> {{ $t('home.tabs.closed') }}</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="favorites">
          <div v-if="favoriteDossiers.length" class="dp-dossier-grid">
            <DossierCard v-for="dossier in favoriteDossiers" :key="'fav-' + dossier._id" :dossier="dossier" :is-fav="true" @open="handleOpen" @delete="handleDelete" @toggle-favorite="handleToggleFavorite" />
          </div>
          <div v-else class="dp-empty dp-fade-in">
            <i class="pi pi-star" style="font-size: 2.5rem; color: var(--me-accent)" />
            <h3 class="mono">{{ $t('home.tabs.noFavorites') }}</h3>
            <p class="dp-text-muted">{{ $t('home.tabs.noFavoritesHint') }}</p>
          </div>
        </TabPanel>
        <TabPanel value="active">
          <div v-if="activeDossiers.length" class="dp-dossier-grid">
            <DossierCard v-for="(dossier, i) in activeDossiers" :key="dossier._id" :dossier="dossier" :is-fav="dossierStore.isFavorite(dossier._id)" :class="['dp-fade-in', `dp-fade-delay-${Math.min(i + 1, 4)}`]" @open="handleOpen" @delete="handleDelete" @toggle-favorite="handleToggleFavorite" />
          </div>
          <div v-else class="dp-empty dp-fade-in">
            <i class="pi pi-folder-open" style="font-size: 2.5rem; color: var(--me-accent)" />
            <h3 class="mono">{{ $t('home.noDossiers') }}</h3>
            <p class="dp-text-muted">{{ $t('home.noDossiersHint') }}</p>
          </div>
        </TabPanel>
        <TabPanel value="closed">
          <div v-if="closedDossiers.length" class="dp-dossier-grid dp-dossier-grid--compact">
            <div v-for="dossier in closedDossiers" :key="'closed-' + dossier._id" class="dp-closed-card" @click="handleOpen(dossier._id)">
              <div class="dp-closed-header">
                <Tag v-if="dossier.referenceNumber" :value="dossier.referenceNumber" severity="secondary" class="dp-closed-ref mono" />
                <span class="dp-closed-date mono">{{ formatClosureDate(dossier.closureDate) }}</span>
              </div>
              <h4 class="dp-closed-title">{{ dossier.title }}</h4>
            </div>
          </div>
          <div v-else class="dp-empty dp-fade-in">
            <i class="pi pi-inbox" style="font-size: 2.5rem; color: var(--me-accent)" />
            <h3 class="mono">{{ $t('home.tabs.noClosed') }}</h3>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <div ref="sentinelRef" style="height: 1px;" />

    <!-- Dashboard Section -->
    <div class="dp-dashboard">
      <div class="dp-dash-header">
        <h2 class="dp-dash-title mono">
          <i class="pi pi-chart-bar" />
          {{ $t('dashboard.title') }}
        </h2>
      </div>

      <ProgressBar v-if="dashLoading" mode="indeterminate" class="dp-progress" />

      <template v-if="!dashLoading">
        <!-- KPI Cards -->
        <div class="dp-kpi-row dp-fade-in">
          <div class="dp-kpi">
            <div class="dp-kpi-icon"><i class="pi pi-folder" /></div>
            <div class="dp-kpi-data">
              <span class="dp-kpi-value mono">{{ stats.totalDossiers }}</span>
              <span class="dp-kpi-label">{{ $t('dashboard.dossiers') }}</span>
            </div>
          </div>
          <div class="dp-kpi">
            <div class="dp-kpi-icon"><i class="pi pi-user" /></div>
            <div class="dp-kpi-data">
              <span class="dp-kpi-value mono">{{ stats.ownedDossiers }}</span>
              <span class="dp-kpi-label">{{ $t('dashboard.owner') }}</span>
            </div>
          </div>
          <div class="dp-kpi">
            <div class="dp-kpi-icon"><i class="pi pi-users" /></div>
            <div class="dp-kpi-data">
              <span class="dp-kpi-value mono">{{ stats.collabDossiers }}</span>
              <span class="dp-kpi-label">{{ $t('dashboard.collaborations') }}</span>
            </div>
          </div>
          <div class="dp-kpi">
            <div class="dp-kpi-icon"><i class="pi pi-sitemap" /></div>
            <div class="dp-kpi-data">
              <span class="dp-kpi-value mono">{{ stats.totalNodes }}</span>
              <span class="dp-kpi-label">{{ $t('dashboard.elements') }}</span>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <Tabs v-model:value="dashTab" class="dp-tabs">
          <TabList>
            <Tab value="overview"><i class="pi pi-home" /> {{ $t('dashboard.overview') }}</Tab>
            <Tab value="stats"><i class="pi pi-chart-bar" /> {{ $t('dashboard.statistics') }}</Tab>
            <Tab value="activity"><i class="pi pi-history" /> {{ $t('dashboard.activityTab') }}</Tab>
          </TabList>
          <TabPanels>
            <!-- Overview -->
            <TabPanel value="overview">
              <!-- Quick access -->
              <div class="dp-quick-row">
                <div class="dp-card">
                  <h3 class="dp-card-title mono"><i class="pi pi-history" /> {{ $t('dashboard.lastOpened') }}</h3>
                  <div v-if="(stats.lastAccessedNodes || []).length" class="dp-list">
                    <div v-for="node in stats.lastAccessedNodes" :key="node._id" class="dp-list-item" @click="handleOpenNode(node)">
                      <i :class="nodeIconClass(node.type)" class="dp-list-icon" />
                      <div class="dp-list-info">
                        <span class="dp-list-name">{{ node.title }}</span>
                        <span class="dp-list-meta mono">{{ node.dossierId?.title || '' }}</span>
                      </div>
                    </div>
                  </div>
                  <p v-else class="dp-empty-text">{{ $t('dashboard.noRecentElements') }}</p>
                </div>
                <div class="dp-card">
                  <h3 class="dp-card-title mono"><i class="pi pi-check-circle" /> {{ $t('dashboard.assignedTasks') }}</h3>
                  <div v-if="(stats.assignedTasks || []).length" class="dp-list">
                    <div v-for="(task, i) in stats.assignedTasks" :key="i" class="dp-list-item">
                      <span :class="['dp-priority-dot', `dp-priority-${task.task?.priority || 'normal'}`]" />
                      <div class="dp-list-info">
                        <span class="dp-list-name">{{ task.task?.title || task.title }}</span>
                        <span v-if="task.task?.dueDate" class="dp-list-meta mono">{{ formatShortDate(task.task.dueDate) }}</span>
                      </div>
                    </div>
                  </div>
                  <p v-else class="dp-empty-text">{{ $t('dashboard.noAssignedTasks') }}</p>
                </div>
              </div>

              <!-- Recent dossiers -->
              <div v-if="stats.recentDossiers?.length" class="dp-card dp-fade-in">
                <h3 class="dp-card-title mono">{{ $t('dashboard.recentlyModifiedDossiers') }}</h3>
                <div class="dp-list">
                  <div v-for="d in stats.recentDossiers.filter((r: any) => r.status !== 'closed')" :key="d._id" class="dp-list-item" @click="handleOpen(d._id)">
                    <span :class="['dp-status-dot', `dp-status-${d.status}`]" />
                    <span class="dp-list-name" style="flex:1">{{ d.title }}</span>
                    <span class="dp-list-meta mono">{{ formatDate(d.updatedAt) }}</span>
                  </div>
                </div>
              </div>
            </TabPanel>

            <!-- Stats -->
            <TabPanel value="stats">
              <!-- Processing stats -->
              <div v-if="processingStats" class="dp-card dp-fade-in">
                <h3 class="dp-card-title mono"><i class="pi pi-clock" /> {{ $t('dashboard.processingStats') }}</h3>
                <div class="dp-chips">
                  <Tag severity="info" class="dp-chip mono"><i class="pi pi-chart-line" /> {{ $t('dashboard.avgProcessing') }}: {{ processingStats.avgDays }} {{ $t('dashboard.days') }}</Tag>
                  <Tag severity="warn" class="dp-chip mono"><i class="pi pi-arrow-up" /> {{ $t('dashboard.maxProcessing') }}: {{ processingStats.maxDays }} {{ $t('dashboard.days') }}</Tag>
                  <Tag severity="success" class="dp-chip mono"><i class="pi pi-arrow-down" /> {{ $t('dashboard.minProcessing') }}: {{ processingStats.minDays }} {{ $t('dashboard.days') }}</Tag>
                  <Tag severity="secondary" class="dp-chip mono"><i class="pi pi-inbox" /> {{ $t('dashboard.closedDossiers') }}: {{ processingStats.totalClosed }}</Tag>
                </div>
                <div v-if="openDurationsChartData" style="margin-top: 16px;">
                  <Bar :data="openDurationsChartData" :options="openDurationsOptions" />
                </div>
              </div>

              <!-- Status bars + node types -->
              <div class="dp-content-row dp-fade-in">
                <div class="dp-card">
                  <h3 class="dp-card-title mono">{{ $t('dashboard.dossierStatuses') }}</h3>
                  <div class="dp-status-bars">
                    <div v-for="s in statusItems" :key="s.key" class="dp-status-item">
                      <div class="dp-status-head">
                        <span :class="['dp-status-dot', `dp-status-${s.key}`]" />
                        <span class="dp-status-name">{{ s.label }}</span>
                        <Badge :value="String(s.count)" :severity="s.severity" />
                      </div>
                      <ProgressBar :value="s.pct" :showValue="false" class="dp-status-progress" :pt="{ value: { style: { background: s.color } } }" />
                    </div>
                  </div>

                  <h3 class="dp-card-title mono" style="margin-top: 20px">{{ $t('dashboard.elementTypes') }}</h3>
                  <div class="dp-node-types">
                    <div v-for="n in nodeTypeItems" :key="n.type" class="dp-node-type">
                      <i :class="n.piIcon" class="dp-node-icon" />
                      <span class="dp-node-label">{{ n.label }}</span>
                      <Badge :value="String(n.count)" severity="secondary" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Streaks KPIs -->
              <div class="dp-kpi-row dp-fade-in">
                <div class="dp-kpi">
                  <div class="dp-kpi-icon"><i :class="streaks.current >= 7 ? 'pi pi-bolt' : 'pi pi-bolt'" :style="streaks.current >= 7 ? 'color: #f59e0b' : ''" /></div>
                  <div class="dp-kpi-data">
                    <span class="dp-kpi-value mono">{{ streaks.current }}</span>
                    <span class="dp-kpi-label">{{ $t('dashboard.currentStreak') }}</span>
                  </div>
                </div>
                <div class="dp-kpi">
                  <div class="dp-kpi-icon"><i class="pi pi-trophy" /></div>
                  <div class="dp-kpi-data">
                    <span class="dp-kpi-value mono">{{ streaks.best }}</span>
                    <span class="dp-kpi-label">{{ $t('dashboard.bestStreak') }}</span>
                  </div>
                </div>
                <div class="dp-kpi">
                  <div class="dp-kpi-icon"><i class="pi pi-star" /></div>
                  <div class="dp-kpi-data">
                    <span class="dp-kpi-value mono dp-kpi-value--small">{{ topDossierTitle }}</span>
                    <span class="dp-kpi-label">{{ $t('dashboard.topDossier') }}</span>
                  </div>
                </div>
                <div class="dp-kpi">
                  <div class="dp-kpi-icon"><i :class="weeklyTrend.current >= weeklyTrend.previous ? 'pi pi-arrow-up-right' : 'pi pi-arrow-down-right'" /></div>
                  <div class="dp-kpi-data">
                    <span class="dp-kpi-value mono">{{ weeklyTrend.current }}</span>
                    <span class="dp-kpi-label">{{ $t('dashboard.thisWeek') }}</span>
                  </div>
                </div>
              </div>

              <!-- Charts -->
              <div class="dp-charts-row dp-fade-in">
                <div class="dp-card">
                  <h3 class="dp-card-title mono">{{ $t('dashboard.distributionByType') }}</h3>
                  <div class="dp-donut-container">
                    <Doughnut v-if="donutData" :data="donutData" :options="donutOptions" />
                  </div>
                </div>
                <div class="dp-card">
                  <h3 class="dp-card-title mono">{{ $t('dashboard.topActiveDossiers') }}</h3>
                  <Bar v-if="barData" :data="barData" :options="barOptions" />
                  <p v-else class="dp-empty-text">{{ $t('dashboard.notEnoughData') }}</p>
                </div>
              </div>

              <!-- Heatmap -->
              <div class="dp-card dp-fade-in">
                <h3 class="dp-card-title mono"><i class="pi pi-calendar" /> {{ $t('dashboard.contribution6months') }}</h3>
                <div class="dp-heatmap-container">
                  <div class="dp-heatmap-grid">
                    <div v-for="(week, wi) in heatmapWeeks" :key="wi" class="dp-heatmap-week">
                      <div v-for="(day, di) in week" :key="di" class="dp-heatmap-cell" :class="heatmapCellClass(day.count)" :title="`${day.date}: ${day.count} action${day.count > 1 ? 's' : ''}`" />
                    </div>
                  </div>
                  <div class="dp-heatmap-legend">
                    <span class="dp-heatmap-legend-label mono">{{ $t('dashboard.less') }}</span>
                    <div class="dp-heatmap-cell dp-heat-0" />
                    <div class="dp-heatmap-cell dp-heat-1" />
                    <div class="dp-heatmap-cell dp-heat-2" />
                    <div class="dp-heatmap-cell dp-heat-3" />
                    <div class="dp-heatmap-cell dp-heat-4" />
                    <span class="dp-heatmap-legend-label mono">{{ $t('dashboard.more') }}</span>
                  </div>
                </div>
              </div>
            </TabPanel>

            <!-- Activity -->
            <TabPanel value="activity">
              <div class="dp-card dp-fade-in">
                <h3 class="dp-card-title mono">{{ $t('dashboard.activity7days') }}</h3>
                <Line v-if="activityChartData" :data="activityChartData" :options="lineOptions" />
                <p v-else class="dp-empty-text">{{ $t('dashboard.noRecentActivity') }}</p>
              </div>

              <div class="dp-card dp-fade-in" style="margin-top: 16px">
                <h3 class="dp-card-title mono">{{ $t('dashboard.recentActivity') }}</h3>
                <div v-if="stats.recentActivity?.length" class="dp-activity-list">
                  <div v-for="act in stats.recentActivity" :key="act._id" class="dp-activity-item">
                    <i :class="actionPiIcon(act.action)" class="dp-act-icon" />
                    <span class="dp-act-label">{{ actionLabel(act.action) }}</span>
                    <span v-if="act.metadata?.title" class="dp-act-target mono">{{ act.metadata.title }}</span>
                    <span class="dp-act-time mono">{{ formatTime(act.timestamp) }}</span>
                  </div>
                </div>
                <p v-else class="dp-empty-text">{{ $t('dashboard.noActivityThisWeek') }}</p>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </div>

    <!-- Prototype badge -->
    <div class="dp-proto-badge">
      <i class="pi pi-sparkles" />
      Prototype PrimeVue 4 / Aura — Dashboard
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { Line, Bar, Doughnut } from 'vue-chartjs';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Title, Tooltip, Filler, Legend,
} from 'chart.js';
import api from '../services/api';
import { useDossierStore } from '../stores/dossier';
import { useConfirm } from '../composables/useConfirm';
import DossierCard from '../components/dossier/DossierCard.vue';
import CreateDossierDialog from '../components/dossier/CreateDossierDialog.vue';

// PrimeVue
import Button from 'primevue/button';
import ProgressBar from 'primevue/progressbar';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import Tag from 'primevue/tag';
import Badge from 'primevue/badge';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Filler, Legend);

const { t, locale } = useI18n();
const dossierStore = useDossierStore();
const { confirm } = useConfirm();
const importInputRef = ref<HTMLInputElement | null>(null);
const sentinelRef = ref<HTMLElement | null>(null);
const activeTab = ref('active');
const dashTab = ref('overview');
const dashLoading = ref(true);
let observer: IntersectionObserver | null = null;

const stats = ref<any>({
  totalDossiers: 0, ownedDossiers: 0, collabDossiers: 0,
  statusCounts: { open: 0, in_progress: 0, closed: 0 },
  totalNodes: 0, nodeCountsByType: [],
  recentActivity: [], activityPerDay: [], recentDossiers: [],
  streaks: { current: 0, best: 0 },
  weeklyTrend: { current: 0, previous: 0 },
  topDossiersThisWeek: [],
  heatmap: [],
});

const favoriteDossiers = computed(() => dossierStore.dossiers.filter(d => dossierStore.isFavorite(d._id)));
const activeDossiers = computed(() => dossierStore.dossiers.filter(d => d.status === 'open' || d.status === 'in_progress'));
const closedDossiers = computed(() => dossierStore.dossiers.filter(d => d.status === 'closed'));
const processingStats = computed(() => stats.value.processingStats || null);
const streaks = computed(() => stats.value.streaks || { current: 0, best: 0 });
const weeklyTrend = computed(() => stats.value.weeklyTrend || { current: 0, previous: 0 });
const topDossierTitle = computed(() => stats.value.topDossiersThisWeek?.[0]?.title || '-');

function formatClosureDate(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString(locale.value);
}
function formatDate(dateStr: string): string { return new Date(dateStr).toLocaleDateString(locale.value); }
function formatShortDate(d: string): string { return new Date(d).toLocaleDateString(locale.value, { day: '2-digit', month: '2-digit' }); }
function formatTime(dateStr: string): string { return new Date(dateStr).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }

onMounted(async () => {
  dossierStore.fetchDossiers(true);
  dossierStore.fetchFavorites();

  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting && dossierStore.hasMoreDossiers && !dossierStore.loading) {
      dossierStore.fetchDossiers();
    }
  }, { threshold: 0.1 });
  if (sentinelRef.value) observer.observe(sentinelRef.value as Element);

  try {
    const { data } = await api.get('/dossiers/dashboard');
    stats.value = data;
  } finally {
    dashLoading.value = false;
  }
});

onBeforeUnmount(() => { observer?.disconnect(); });

function handleOpen(id: string) { dossierStore.openDossier(id); }
function handleToggleFavorite(id: string) { dossierStore.toggleFavorite(id); }
function handleOpenNode(node: any) {
  if (node.dossierId?._id) dossierStore.openDossier(node.dossierId._id);
}

function triggerImport() { importInputRef.value?.click(); }

async function handleImport(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.dossier?.title) { await confirm({ title: t('home.invalidImport'), message: t('home.invalidImportMsg'), confirmText: t('common.ok'), cancelText: '' }); return; }
    const { data: newDossier } = await api.post('/dossiers/import/json', data);
    await dossierStore.fetchDossiers(true);
    dossierStore.openDossier(newDossier._id);
  } catch {
    await confirm({ title: t('common.error'), message: t('home.importError'), confirmText: t('common.ok'), cancelText: '', variant: 'danger' });
  }
}

async function handleDelete(id: string) {
  const ok = await confirm({ title: t('home.deleteDossier'), message: t('home.deleteDossierConfirm'), confirmText: t('common.delete'), variant: 'danger' });
  if (ok) dossierStore.deleteDossier(id);
}

// ─── Node icons mapping (PrimeIcons) ───
function nodeIconClass(type: string): string {
  const map: Record<string, string> = {
    note: 'pi pi-file-edit', mindmap: 'pi pi-share-alt', document: 'pi pi-file',
    map: 'pi pi-map', dataset: 'pi pi-table', folder: 'pi pi-folder',
  };
  return map[type] || 'pi pi-file';
}

// ─── Status items ───
const statusItems = computed(() => {
  const c = stats.value.statusCounts || {};
  const total = (c.open || 0) + (c.in_progress || 0) + (c.closed || 0);
  return [
    { key: 'open', label: t('dossier.statusOpen'), color: '#22c55e', count: c.open || 0, pct: total ? ((c.open || 0) / total * 100) : 0, severity: 'success' as const },
    { key: 'in_progress', label: t('dossier.statusInProgress'), color: '#3b82f6', count: c.in_progress || 0, pct: total ? ((c.in_progress || 0) / total * 100) : 0, severity: 'info' as const },
    { key: 'closed', label: t('dossier.statusClosed'), color: '#ef4444', count: c.closed || 0, pct: total ? ((c.closed || 0) / total * 100) : 0, severity: 'danger' as const },
  ];
});

// ─── Node types ───
const nodeTypeItems = computed(() => {
  const map: Record<string, { label: string; piIcon: string }> = {
    folder: { label: t('dashboard.nodeTypes.folders'), piIcon: 'pi pi-folder' },
    note: { label: t('dashboard.nodeTypes.notes'), piIcon: 'pi pi-file-edit' },
    mindmap: { label: t('dashboard.nodeTypes.mindmaps'), piIcon: 'pi pi-share-alt' },
    document: { label: t('dashboard.nodeTypes.documents'), piIcon: 'pi pi-file' },
    map: { label: t('dashboard.nodeTypes.maps'), piIcon: 'pi pi-map' },
  };
  const counts = stats.value.nodeCountsByType || [];
  return Object.entries(map).map(([type, meta]) => {
    const found = counts.find((n: any) => n._id === type);
    return { type, label: meta.label, piIcon: meta.piIcon, count: found?.count || 0 };
  });
});

// ─── Charts ───
const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--me-accent').trim() || '#3b82f6';
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
    labels: days.map((d: any) => { const p = d._id.split('-'); return `${p[2]}/${p[1]}`; }),
    datasets: [{ data: days.map((d: any) => d.count), borderColor: accentColor, backgroundColor: accentColor + '20', fill: true, tension: 0.3, pointRadius: 3 }],
  };
});

const openDurationsChartData = computed(() => {
  const durations = processingStats.value?.openDurations;
  if (!durations?.length) return null;
  return {
    labels: durations.map((d: any) => d.title.length > 25 ? d.title.slice(0, 25) + '...' : d.title),
    datasets: [{ data: durations.map((d: any) => d.days), backgroundColor: durations.map((d: any) => d.isUrgent ? '#ef4444' : d.classification === 'priority' ? '#f59e0b' : '#3b82f6'), borderRadius: 4 }],
  };
});

const openDurationsOptions = {
  indexAxis: 'y' as const, responsive: true, plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: mutedColor, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true, title: { display: true, text: t('dashboard.days'), color: mutedColor, font: { size: 10 } } },
    y: { ticks: { color: mutedColor, font: { size: 11 } }, grid: { display: false } },
  },
};

const typeColors: Record<string, string> = { note: '#38bdf8', mindmap: '#a78bfa', document: '#34d399', map: '#fb923c', dataset: '#22d3ee', folder: '#94a3b8' };
const typeLabelsMap: Record<string, string> = { note: 'dashboard.nodeTypes.notes', mindmap: 'dashboard.nodeTypes.mindmaps', document: 'dashboard.nodeTypes.documents', map: 'dashboard.nodeTypes.maps', dataset: 'nodeTypes.dataset', folder: 'dashboard.nodeTypes.folders' };

const donutData = computed(() => {
  const data = stats.value.nodeCountsByType;
  if (!data?.length) return null;
  return {
    labels: data.map((n: any) => t(typeLabelsMap[n._id] || n._id)),
    datasets: [{ data: data.map((n: any) => n.count), backgroundColor: data.map((n: any) => typeColors[n._id] || '#64748b'), borderWidth: 0 }],
  };
});

const donutOptions = { responsive: true, plugins: { legend: { position: 'bottom' as const, labels: { color: '#94a3b8', font: { size: 11 } } } }, cutout: '60%' };

const barData = computed(() => {
  const data = stats.value.topDossiersThisWeek;
  if (!data?.length) return null;
  return {
    labels: data.map((d: any) => d.title.length > 20 ? d.title.slice(0, 20) + '...' : d.title),
    datasets: [{ data: data.map((d: any) => d.count), backgroundColor: accentColor + '80', borderColor: accentColor, borderWidth: 1, borderRadius: 4 }],
  };
});

const barOptions = {
  indexAxis: 'y' as const, responsive: true, plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: mutedColor, font: { size: 10 }, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
    y: { ticks: { color: mutedColor, font: { size: 11 } }, grid: { display: false } },
  },
};

// ─── Heatmap ───
const heatmapWeeks = computed(() => {
  const map = new Map((stats.value.heatmap || []).map((d: any) => [d.date, d.count]));
  const now = new Date();
  const result: { date: string; count: number }[][] = [];
  let currentWeek: { date: string; count: number }[] = [];
  for (let i = 182; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    if (d.getDay() === 1 && currentWeek.length > 0) { result.push(currentWeek); currentWeek = []; }
    currentWeek.push({ date: dateStr, count: (map.get(dateStr) as number) || 0 });
  }
  if (currentWeek.length > 0) result.push(currentWeek);
  return result;
});

function heatmapCellClass(count: number): string {
  if (count === 0) return 'dp-heat-0';
  if (count <= 2) return 'dp-heat-1';
  if (count <= 5) return 'dp-heat-2';
  if (count <= 10) return 'dp-heat-3';
  return 'dp-heat-4';
}

// ─── Activity icons ───
const actionPiIcons: Record<string, string> = {
  'login': 'pi pi-sign-in', 'dossier.create': 'pi pi-folder-plus', 'dossier.update': 'pi pi-pencil',
  'dossier.delete': 'pi pi-trash', 'node.create': 'pi pi-file-plus', 'node.delete': 'pi pi-file-minus',
  'collaborator.add': 'pi pi-user-plus', 'collaborator.remove': 'pi pi-user-minus',
  'comment.create': 'pi pi-comment', 'snapshot.create': 'pi pi-history',
  'profile.update': 'pi pi-user-edit', 'profile.avatar_upload': 'pi pi-camera',
  'profile.password_change': 'pi pi-lock', '2fa.enable': 'pi pi-shield', '2fa.disable': 'pi pi-shield',
};

const actionLabelKeys: Record<string, string> = {
  'login': 'dashboard.actions.login', 'dossier.create': 'dashboard.actions.dossierCreate',
  'dossier.update': 'dashboard.actions.dossierUpdate', 'dossier.delete': 'dashboard.actions.dossierDelete',
  'node.create': 'dashboard.actions.nodeCreate', 'node.delete': 'dashboard.actions.nodeDelete',
  'collaborator.add': 'dashboard.actions.collaboratorAdd', 'collaborator.remove': 'dashboard.actions.collaboratorRemove',
  'comment.create': 'dashboard.actions.commentCreate', 'snapshot.create': 'dashboard.actions.snapshotCreate',
  'profile.update': 'dashboard.actions.profileUpdate', 'profile.avatar_upload': 'dashboard.actions.avatarUpload',
  'profile.password_change': 'dashboard.actions.passwordChange', '2fa.enable': 'dashboard.actions.twoFaEnable',
  '2fa.disable': 'dashboard.actions.twoFaDisable',
};

function actionPiIcon(action: string): string { return actionPiIcons[action] || 'pi pi-circle'; }
function actionLabel(action: string): string { const key = actionLabelKeys[action]; return key ? t(key) : action; }
</script>

<style scoped>
/* ─── Inherit the app's design tokens ─── */

.dp-page {
  max-width: 1800px;
  margin: 0 auto;
  padding: 32px 48px;
  color: var(--me-text-primary);
}

/* Header */
.dp-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 32px; }
.dp-title { font-size: 24px; font-weight: 700; }
.dp-subtitle { font-size: 13px; color: var(--me-text-muted); margin-top: 4px; font-family: var(--me-font-mono); }
.dp-header-actions { display: flex; align-items: center; gap: 8px; }

/* Progress */
.dp-progress { border-radius: 4px; margin-bottom: 16px; height: 3px; }
:deep(.dp-progress .p-progressbar-value) { background: var(--me-accent) !important; }

/* Tabs override — deep integration with app design system */
:deep(.p-tabs) { margin-bottom: 16px; background: transparent !important; }
:deep(.p-tablist) { border-bottom: 1px solid var(--me-border); background: transparent !important; }
:deep(.p-tablist-tab-list) { background: transparent !important; }
:deep(.p-tab) {
  color: var(--me-text-muted) !important;
  font-size: 13px;
  font-family: var(--me-font-body);
  gap: 6px;
  padding: 10px 16px;
  border: none !important;
  background: transparent !important;
  transition: color 0.2s;
}
:deep(.p-tab:hover) { color: var(--me-text-primary) !important; }
:deep(.p-tab-active),
:deep(.p-tab[data-p-active="true"]) { color: var(--me-accent) !important; font-weight: 600; }
:deep(.p-tablist-active-bar) { background: var(--me-accent) !important; height: 2px; }
:deep(.p-tabpanels) { background: transparent !important; }
:deep(.p-tabpanel) { padding: 0 !important; background: transparent !important; }

/* Button overrides */
:deep(.p-button.p-button-outlined) {
  border-color: var(--me-border) !important;
  color: var(--me-text-secondary) !important;
  background: transparent !important;
}
:deep(.p-button.p-button-outlined:hover) {
  border-color: var(--me-accent) !important;
  color: var(--me-accent) !important;
  background: var(--me-accent-glow) !important;
}

/* Badge & Tag overrides */
:deep(.p-badge) { font-size: 11px !important; min-width: 1.5rem; height: 1.5rem; line-height: 1.5rem; font-family: var(--me-font-mono); }
:deep(.p-tag) { font-family: var(--me-font-mono); border-radius: 6px !important; }

/* Dossier grid */
.dp-dossier-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.dp-dossier-grid--compact { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }

/* Empty state */
.dp-empty { text-align: center; padding: 80px 20px; }
.dp-empty h3 { margin-top: 16px; }
.dp-text-muted { color: var(--me-text-muted); font-size: 14px; }

/* Closed cards */
.dp-closed-card {
  padding: 14px 16px; cursor: pointer; border-radius: var(--me-radius);
  background: var(--me-bg-elevated); border: 1px solid var(--me-border);
  transition: all 0.2s ease; opacity: 0.7;
}
.dp-closed-card:hover { opacity: 1; transform: translateY(-1px); border-color: var(--me-accent); }
.dp-closed-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.dp-closed-date { font-size: 11px; color: var(--me-text-muted); }
.dp-closed-title { font-size: 14px; font-weight: 600; color: var(--me-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
:deep(.dp-closed-ref) { font-size: 10px !important; padding: 2px 8px !important; }

/* Dashboard section */
.dp-dashboard { margin-top: 40px; padding-top: 32px; border-top: 1px solid var(--me-border); }
.dp-dash-header { margin-bottom: 20px; }
.dp-dash-title { font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 8px; }

/* KPI Cards */
.dp-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.dp-kpi {
  padding: 18px; display: flex; align-items: center; gap: 14px;
  background: var(--me-bg-glass); border: 1px solid var(--me-border);
  border-radius: var(--me-radius); transition: all 0.25s ease;
  backdrop-filter: blur(12px);
}
.dp-kpi:hover { border-color: var(--me-border-hover); transform: translateY(-2px); box-shadow: var(--me-shadow-glow); }
.dp-kpi-icon { color: var(--me-accent); font-size: 1.2rem; }
.dp-kpi-data { display: flex; flex-direction: column; min-width: 0; }
.dp-kpi-value { font-size: 26px; font-weight: 700; line-height: 1; }
.dp-kpi-value--small { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dp-kpi-label { font-size: 12px; color: var(--me-text-muted); margin-top: 3px; }

/* Cards */
.dp-card {
  padding: 20px; background: var(--me-bg-glass); border: 1px solid var(--me-border);
  border-radius: var(--me-radius); margin-bottom: 16px;
  backdrop-filter: blur(12px);
}
.dp-card-title { font-size: 13px; font-weight: 700; margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }

/* Quick access */
.dp-quick-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }

/* Lists */
.dp-list { display: flex; flex-direction: column; gap: 2px; }
.dp-list-item {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  border-radius: 8px; cursor: pointer; transition: background 0.15s;
}
.dp-list-item:hover { background: var(--me-accent-glow); }
.dp-list-icon { color: var(--me-accent); flex-shrink: 0; font-size: 0.9rem; }
.dp-list-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.dp-list-name { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dp-list-meta { font-size: 11px; color: var(--me-text-muted); }

/* Status dots */
.dp-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dp-status-open { background: #22c55e; }
.dp-status-in_progress { background: #3b82f6; }
.dp-status-closed { background: #ef4444; }

/* Priority dots */
.dp-priority-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dp-priority-urgent { background: #ef4444; }
.dp-priority-high { background: #f59e0b; }
.dp-priority-normal { background: #3b82f6; }
.dp-priority-low { background: #6b7280; }

/* Status bars */
.dp-content-row { display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 16px; }
.dp-status-bars { display: flex; flex-direction: column; gap: 12px; }
.dp-status-item { }
.dp-status-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.dp-status-name { font-size: 12px; color: var(--me-text-secondary); flex: 1; }
:deep(.dp-status-progress) { height: 6px; border-radius: 3px; }
:deep(.dp-status-progress .p-progressbar-value) { border-radius: 3px; }

/* Node types */
.dp-node-types { display: flex; flex-direction: column; gap: 8px; }
.dp-node-type { display: flex; align-items: center; gap: 10px; padding: 4px 0; }
.dp-node-icon { color: var(--me-accent); flex-shrink: 0; }
.dp-node-label { font-size: 12px; color: var(--me-text-secondary); flex: 1; }

/* Chips */
.dp-chips { display: flex; flex-wrap: wrap; gap: 8px; }
:deep(.dp-chip) { font-size: 11px !important; gap: 4px; }

/* Charts */
.dp-charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
.dp-donut-container { max-width: 280px; margin: 0 auto; }

/* Heatmap */
.dp-heatmap-container { overflow-x: auto; }
.dp-heatmap-grid { display: flex; gap: 3px; }
.dp-heatmap-week { display: flex; flex-direction: column; gap: 3px; }
.dp-heatmap-cell { width: 12px; height: 12px; border-radius: 2px; }
.dp-heat-0 { background: var(--me-bg-elevated); }
.dp-heat-1 { background: color-mix(in srgb, var(--me-accent) 25%, var(--me-bg-elevated)); }
.dp-heat-2 { background: color-mix(in srgb, var(--me-accent) 50%, var(--me-bg-elevated)); }
.dp-heat-3 { background: color-mix(in srgb, var(--me-accent) 75%, var(--me-bg-elevated)); }
.dp-heat-4 { background: var(--me-accent); }
.dp-heatmap-legend { display: flex; align-items: center; gap: 4px; margin-top: 8px; justify-content: flex-end; }
.dp-heatmap-legend-label { font-size: 10px; color: var(--me-text-muted); }

/* Activity */
.dp-activity-list { display: flex; flex-direction: column; gap: 2px; max-height: 260px; overflow-y: auto; }
.dp-activity-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; transition: background 0.15s; }
.dp-activity-item:hover { background: var(--me-accent-glow); }
.dp-act-icon { color: var(--me-accent); flex-shrink: 0; font-size: 0.85rem; }
.dp-act-label { font-size: 12px; color: var(--me-text-secondary); white-space: nowrap; }
.dp-act-target { font-size: 11px; color: var(--me-text-muted); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dp-act-time { font-size: 11px; color: var(--me-text-muted); flex-shrink: 0; }

.dp-empty-text { font-size: 12px; color: var(--me-text-muted); text-align: center; padding: 16px 0; }

/* Proto badge */
.dp-proto-badge {
  position: fixed; bottom: 16px; right: 16px;
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 24px;
  color: #a5b4fc; font-size: 12px; font-family: var(--me-font-mono);
  backdrop-filter: blur(8px); z-index: 100;
}

/* Animation */
.dp-fade-in { animation: dpFadeIn 0.5s ease-out; }
.dp-fade-delay-1 { animation-delay: 0.05s; }
.dp-fade-delay-2 { animation-delay: 0.1s; }
.dp-fade-delay-3 { animation-delay: 0.15s; }
.dp-fade-delay-4 { animation-delay: 0.2s; }
@keyframes dpFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* Responsive */
@media (max-width: 900px) {
  .dp-page { padding: 24px; }
  .dp-kpi-row { grid-template-columns: repeat(2, 1fr); }
  .dp-quick-row { grid-template-columns: 1fr; }
  .dp-charts-row { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .dp-page { padding: 16px; }
  .dp-kpi-row { grid-template-columns: 1fr; }
  .dp-header { flex-direction: column; align-items: flex-start; gap: 12px; }
}
</style>
