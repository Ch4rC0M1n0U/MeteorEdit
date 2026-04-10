<template>
  <div class="dp">
    <!-- ─── TOP BAR ─── -->
    <header class="dp-topbar">
      <div class="dp-topbar-left">
        <h1 class="dp-page-title">{{ $t('home.myDossiers') }}</h1>
        <Tag :value="`${dossierStore.dossiers.length} dossier${dossierStore.dossiers.length > 1 ? 's' : ''}`" severity="secondary" rounded />
      </div>
      <div class="dp-topbar-right">
        <Button icon="pi pi-upload" :label="$t('home.import')" text size="small" @click="triggerImport" />
        <CreateDossierDialog />
      </div>
      <input ref="importInputRef" type="file" accept=".json" style="display:none" @change="handleImport" />
    </header>

    <!-- ─── DOSSIER TABS ─── -->
    <SelectButton v-model="activeTab" :options="tabOptions" optionLabel="label" optionValue="value" class="dp-seg" />

    <ProgressBar v-if="dossierStore.loading" mode="indeterminate" class="dp-loader" />

    <div v-if="activeTab === 'favorites'" class="dp-grid">
      <template v-if="favoriteDossiers.length">
        <DossierCard v-for="d in favoriteDossiers" :key="d._id" :dossier="d" :is-fav="true" @open="handleOpen" @delete="handleDelete" @toggle-favorite="handleToggleFavorite" />
      </template>
      <div v-else class="dp-empty">
        <i class="pi pi-star" />
        <p>{{ $t('home.tabs.noFavorites') }}</p>
      </div>
    </div>
    <div v-else-if="activeTab === 'active'" class="dp-grid">
      <template v-if="activeDossiers.length">
        <DossierCard v-for="d in activeDossiers" :key="d._id" :dossier="d" :is-fav="dossierStore.isFavorite(d._id)" @open="handleOpen" @delete="handleDelete" @toggle-favorite="handleToggleFavorite" />
      </template>
      <div v-else class="dp-empty">
        <i class="pi pi-folder-open" />
        <p>{{ $t('home.noDossiers') }}</p>
      </div>
    </div>
    <div v-else class="dp-grid dp-grid--compact">
      <template v-if="closedDossiers.length">
        <div v-for="d in closedDossiers" :key="d._id" class="dp-closed" @click="handleOpen(d._id)">
          <div class="dp-closed-top">
            <Tag v-if="d.referenceNumber" :value="d.referenceNumber" severity="contrast" rounded class="dp-closed-ref" />
            <span class="dp-mono dp-xs">{{ formatClosureDate(d.closureDate) }}</span>
          </div>
          <span class="dp-closed-title">{{ d.title }}</span>
        </div>
      </template>
      <div v-else class="dp-empty"><i class="pi pi-inbox" /><p>{{ $t('home.tabs.noClosed') }}</p></div>
    </div>

    <div ref="sentinelRef" style="height:1px" />

    <!-- ─── DASHBOARD ─── -->
    <Divider />

    <div class="dp-section-head">
      <h2 class="dp-section-title">{{ $t('dashboard.title') }}</h2>
      <SelectButton v-model="dashTab" :options="dashTabOptions" optionLabel="label" optionValue="value" class="dp-seg dp-seg--sm" />
    </div>

    <ProgressBar v-if="dashLoading" mode="indeterminate" class="dp-loader" />

    <template v-if="!dashLoading">
      <!-- ─── KPI ROW ─── -->
      <div class="dp-kpis">
        <div class="dp-kpi" v-for="kpi in kpis" :key="kpi.label">
          <div class="dp-kpi-icon" :style="{ background: kpi.bg }">
            <i :class="kpi.icon" />
          </div>
          <div>
            <div class="dp-kpi-val dp-mono">{{ kpi.value }}</div>
            <div class="dp-kpi-lbl">{{ kpi.label }}</div>
          </div>
        </div>
      </div>

      <!-- ─── OVERVIEW ─── -->
      <template v-if="dashTab === 'overview'">
        <div class="dp-duo">
          <!-- Quick access -->
          <div class="dp-card">
            <div class="dp-card-head">
              <i class="pi pi-history" />
              <span>{{ $t('dashboard.lastOpened') }}</span>
            </div>
            <div v-if="(stats.lastAccessedNodes||[]).length" class="dp-stack">
              <div v-for="node in stats.lastAccessedNodes" :key="node._id" class="dp-row" @click="handleOpenNode(node)">
                <Avatar :icon="nodePI(node.type)" shape="circle" class="dp-row-av" />
                <div class="dp-row-info">
                  <span class="dp-row-name">{{ node.title }}</span>
                  <span class="dp-xs dp-muted">{{ node.dossierId?.title || '' }}</span>
                </div>
                <i class="pi pi-angle-right dp-muted" />
              </div>
            </div>
            <p v-else class="dp-placeholder">{{ $t('dashboard.noRecentElements') }}</p>
          </div>

          <!-- Tasks -->
          <div class="dp-card">
            <div class="dp-card-head">
              <i class="pi pi-check-circle" />
              <span>{{ $t('dashboard.assignedTasks') }}</span>
            </div>
            <div v-if="(stats.assignedTasks||[]).length" class="dp-stack">
              <div v-for="(task, i) in stats.assignedTasks" :key="i" class="dp-row">
                <span :class="['dp-dot', `dp-dot--${task.task?.priority || 'normal'}`]" />
                <div class="dp-row-info">
                  <span class="dp-row-name">{{ task.task?.title || task.title }}</span>
                  <span v-if="task.task?.dueDate" class="dp-xs dp-muted dp-mono">{{ formatShortDate(task.task.dueDate) }}</span>
                </div>
              </div>
            </div>
            <p v-else class="dp-placeholder">{{ $t('dashboard.noAssignedTasks') }}</p>
          </div>
        </div>

        <!-- Recent dossiers -->
        <div v-if="stats.recentDossiers?.length" class="dp-card">
          <div class="dp-card-head">
            <i class="pi pi-folder" />
            <span>{{ $t('dashboard.recentlyModifiedDossiers') }}</span>
          </div>
          <div class="dp-stack">
            <div v-for="d in stats.recentDossiers.filter((r:any) => r.status !== 'closed')" :key="d._id" class="dp-row" @click="handleOpen(d._id)">
              <span :class="['dp-dot', `dp-dot--${d.status === 'open' ? 'success' : d.status === 'in_progress' ? 'info' : 'danger'}`]" />
              <span class="dp-row-name" style="flex:1">{{ d.title }}</span>
              <span class="dp-xs dp-muted dp-mono">{{ formatDate(d.updatedAt) }}</span>
              <i class="pi pi-angle-right dp-muted" />
            </div>
          </div>
        </div>
      </template>

      <!-- ─── STATS ─── -->
      <template v-if="dashTab === 'stats'">
        <!-- Processing chips -->
        <div v-if="processingStats" class="dp-card">
          <div class="dp-card-head"><i class="pi pi-clock" /><span>{{ $t('dashboard.processingStats') }}</span></div>
          <div class="dp-chip-row">
            <Chip :label="`${$t('dashboard.avgProcessing')}: ${processingStats.avgDays}j`" icon="pi pi-chart-line" />
            <Chip :label="`${$t('dashboard.maxProcessing')}: ${processingStats.maxDays}j`" icon="pi pi-arrow-up" />
            <Chip :label="`${$t('dashboard.minProcessing')}: ${processingStats.minDays}j`" icon="pi pi-arrow-down" />
            <Chip :label="`${$t('dashboard.closedDossiers')}: ${processingStats.totalClosed}`" icon="pi pi-inbox" />
          </div>
          <div v-if="openDurationsChartData" style="margin-top:20px"><Bar :data="openDurationsChartData" :options="openDurationsOptions" /></div>
        </div>

        <!-- Status meter -->
        <div class="dp-duo">
          <div class="dp-card">
            <div class="dp-card-head"><i class="pi pi-chart-pie" /><span>{{ $t('dashboard.dossierStatuses') }}</span></div>
            <MeterGroup :value="meterValues" class="dp-meter" />
            <div class="dp-meter-legend">
              <span v-for="s in statusItems" :key="s.key" class="dp-meter-item">
                <span class="dp-dot" :style="{ background: s.color }" /> {{ s.label }} <b class="dp-mono">{{ s.count }}</b>
              </span>
            </div>
          </div>
          <div class="dp-card">
            <div class="dp-card-head"><i class="pi pi-objects-column" /><span>{{ $t('dashboard.elementTypes') }}</span></div>
            <div class="dp-stack">
              <div v-for="n in nodeTypeItems" :key="n.type" class="dp-row dp-row--flat">
                <i :class="n.piIcon" :style="{ color: n.color }" />
                <span class="dp-row-name" style="flex:1">{{ n.label }}</span>
                <Badge :value="String(n.count)" severity="secondary" />
              </div>
            </div>
          </div>
        </div>

        <!-- Streak KPIs -->
        <div class="dp-kpis dp-kpis--4">
          <div class="dp-streak-card" v-for="sk in streakCards" :key="sk.label">
            <Knob :modelValue="sk.val" :max="sk.max" :size="64" :strokeWidth="6" readonly :valueColor="sk.color" />
            <div>
              <div class="dp-streak-val dp-mono">{{ sk.display }}</div>
              <div class="dp-streak-lbl">{{ sk.label }}</div>
            </div>
          </div>
        </div>

        <!-- Charts -->
        <div class="dp-duo">
          <div class="dp-card">
            <div class="dp-card-head"><i class="pi pi-chart-pie" /><span>{{ $t('dashboard.distributionByType') }}</span></div>
            <div class="dp-donut"><Doughnut v-if="donutData" :data="donutData" :options="donutOptions" /></div>
          </div>
          <div class="dp-card">
            <div class="dp-card-head"><i class="pi pi-chart-bar" /><span>{{ $t('dashboard.topActiveDossiers') }}</span></div>
            <Bar v-if="barData" :data="barData" :options="barOptions" />
            <p v-else class="dp-placeholder">{{ $t('dashboard.notEnoughData') }}</p>
          </div>
        </div>

        <!-- Heatmap -->
        <div class="dp-card">
          <div class="dp-card-head"><i class="pi pi-calendar" /><span>{{ $t('dashboard.contribution6months') }}</span></div>
          <div class="dp-heatmap-scroll">
            <div class="dp-heatmap">
              <div v-for="(week, wi) in heatmapWeeks" :key="wi" class="dp-heatmap-col">
                <div v-for="(day, di) in week" :key="di" :class="['dp-hm', heatClass(day.count)]" :title="`${day.date}: ${day.count}`" />
              </div>
            </div>
          </div>
          <div class="dp-heatmap-legend"><span class="dp-xs dp-muted">{{ $t('dashboard.less') }}</span><div class="dp-hm dp-hm0" /><div class="dp-hm dp-hm1" /><div class="dp-hm dp-hm2" /><div class="dp-hm dp-hm3" /><div class="dp-hm dp-hm4" /><span class="dp-xs dp-muted">{{ $t('dashboard.more') }}</span></div>
        </div>
      </template>

      <!-- ─── ACTIVITY ─── -->
      <template v-if="dashTab === 'activity'">
        <div class="dp-card">
          <div class="dp-card-head"><i class="pi pi-chart-line" /><span>{{ $t('dashboard.activity7days') }}</span></div>
          <Line v-if="activityChartData" :data="activityChartData" :options="lineOptions" />
          <p v-else class="dp-placeholder">{{ $t('dashboard.noRecentActivity') }}</p>
        </div>
        <div class="dp-card">
          <div class="dp-card-head"><i class="pi pi-list" /><span>{{ $t('dashboard.recentActivity') }}</span></div>
          <div v-if="stats.recentActivity?.length" class="dp-timeline">
            <div v-for="act in stats.recentActivity" :key="act._id" class="dp-tl-item">
              <div class="dp-tl-dot"><i :class="actIcon(act.action)" /></div>
              <div class="dp-tl-body">
                <span class="dp-tl-label">{{ actLabel(act.action) }}</span>
                <span v-if="act.metadata?.title" class="dp-tl-target dp-mono">{{ act.metadata.title }}</span>
              </div>
              <span class="dp-xs dp-muted dp-mono">{{ formatTime(act.timestamp) }}</span>
            </div>
          </div>
          <p v-else class="dp-placeholder">{{ $t('dashboard.noActivityThisWeek') }}</p>
        </div>
      </template>
    </template>

    <!-- Proto badge -->
    <div class="dp-badge"><i class="pi pi-sparkles" /> PrimeVue 4 Aura — Prototype</div>
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

// PrimeVue components
import Button from 'primevue/button';
import ProgressBar from 'primevue/progressbar';
import SelectButton from 'primevue/selectbutton';
import Tag from 'primevue/tag';
import Badge from 'primevue/badge';
import Chip from 'primevue/chip';
import Divider from 'primevue/divider';
import Avatar from 'primevue/avatar';
import Knob from 'primevue/knob';
import MeterGroup from 'primevue/metergroup';

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

const tabOptions = computed(() => [
  { label: t('home.tabs.favorites'), value: 'favorites', icon: 'pi pi-star' },
  { label: t('home.tabs.active'), value: 'active', icon: 'pi pi-folder-open' },
  { label: t('home.tabs.closed'), value: 'closed', icon: 'pi pi-inbox' },
]);

const dashTabOptions = computed(() => [
  { label: t('dashboard.overview'), value: 'overview' },
  { label: t('dashboard.statistics'), value: 'stats' },
  { label: t('dashboard.activityTab'), value: 'activity' },
]);

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

// ── KPIs ──
const kpis = computed(() => [
  { icon: 'pi pi-folder', value: stats.value.totalDossiers, label: t('dashboard.dossiers'), bg: 'rgba(56,189,248,0.12)' },
  { icon: 'pi pi-user', value: stats.value.ownedDossiers, label: t('dashboard.owner'), bg: 'rgba(168,85,247,0.12)' },
  { icon: 'pi pi-users', value: stats.value.collabDossiers, label: t('dashboard.collaborations'), bg: 'rgba(52,211,153,0.12)' },
  { icon: 'pi pi-sitemap', value: stats.value.totalNodes, label: t('dashboard.elements'), bg: 'rgba(251,146,60,0.12)' },
]);

// ── Statuses ──
const statusItems = computed(() => {
  const c = stats.value.statusCounts || {};
  return [
    { key: 'open', label: t('dossier.statusOpen'), color: '#22c55e', count: c.open || 0 },
    { key: 'in_progress', label: t('dossier.statusInProgress'), color: '#38bdf8', count: c.in_progress || 0 },
    { key: 'closed', label: t('dossier.statusClosed'), color: '#f87171', count: c.closed || 0 },
  ];
});

const meterValues = computed(() => {
  const c = stats.value.statusCounts || {};
  const total = (c.open || 0) + (c.in_progress || 0) + (c.closed || 0);
  if (!total) return [];
  return [
    { label: t('dossier.statusOpen'), value: Math.round((c.open || 0) / total * 100), color: '#22c55e' },
    { label: t('dossier.statusInProgress'), value: Math.round((c.in_progress || 0) / total * 100), color: '#38bdf8' },
    { label: t('dossier.statusClosed'), value: Math.round((c.closed || 0) / total * 100), color: '#f87171' },
  ];
});

// ── Node types ──
const nodeTypeItems = computed(() => {
  const map: Record<string, { label: string; piIcon: string; color: string }> = {
    folder: { label: t('dashboard.nodeTypes.folders'), piIcon: 'pi pi-folder', color: '#94a3b8' },
    note: { label: t('dashboard.nodeTypes.notes'), piIcon: 'pi pi-file-edit', color: '#38bdf8' },
    mindmap: { label: t('dashboard.nodeTypes.mindmaps'), piIcon: 'pi pi-share-alt', color: '#a78bfa' },
    document: { label: t('dashboard.nodeTypes.documents'), piIcon: 'pi pi-file', color: '#34d399' },
    map: { label: t('dashboard.nodeTypes.maps'), piIcon: 'pi pi-map', color: '#fb923c' },
  };
  const counts = stats.value.nodeCountsByType || [];
  return Object.entries(map).map(([type, meta]) => {
    const found = counts.find((n: any) => n._id === type);
    return { type, ...meta, count: found?.count || 0 };
  });
});

// ── Streaks ──
const streakCards = computed(() => {
  const s = stats.value.streaks || { current: 0, best: 0 };
  const w = stats.value.weeklyTrend || { current: 0, previous: 0 };
  const topTitle = stats.value.topDossiersThisWeek?.[0]?.title || '-';
  return [
    { label: t('dashboard.currentStreak'), val: Math.min(s.current, 30), max: 30, display: String(s.current), color: s.current >= 7 ? '#f59e0b' : '#38bdf8' },
    { label: t('dashboard.bestStreak'), val: Math.min(s.best, 30), max: 30, display: String(s.best), color: '#a78bfa' },
    { label: t('dashboard.topDossier'), val: 0, max: 1, display: topTitle.length > 16 ? topTitle.slice(0, 16) + '...' : topTitle, color: '#34d399' },
    { label: t('dashboard.thisWeek'), val: Math.min(w.current, 50), max: 50, display: String(w.current), color: w.current >= w.previous ? '#22c55e' : '#f87171' },
  ];
});

// ── Helpers ──
function formatClosureDate(date: string | null): string { return date ? new Date(date).toLocaleDateString(locale.value) : '-'; }
function formatDate(d: string): string { return new Date(d).toLocaleDateString(locale.value); }
function formatShortDate(d: string): string { return new Date(d).toLocaleDateString(locale.value, { day: '2-digit', month: '2-digit' }); }
function formatTime(d: string): string { return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }

function nodePI(type: string): string {
  const m: Record<string, string> = { note: 'pi pi-file-edit', mindmap: 'pi pi-share-alt', document: 'pi pi-file', map: 'pi pi-map', dataset: 'pi pi-table', folder: 'pi pi-folder' };
  return m[type] || 'pi pi-file';
}

const actIcons: Record<string, string> = { 'login': 'pi pi-sign-in', 'dossier.create': 'pi pi-folder-plus', 'dossier.update': 'pi pi-pencil', 'dossier.delete': 'pi pi-trash', 'node.create': 'pi pi-file-plus', 'node.delete': 'pi pi-file-minus', 'collaborator.add': 'pi pi-user-plus', 'comment.create': 'pi pi-comment', 'snapshot.create': 'pi pi-history', 'profile.update': 'pi pi-user-edit', 'profile.password_change': 'pi pi-lock', '2fa.enable': 'pi pi-shield', '2fa.disable': 'pi pi-shield' };
const actKeys: Record<string, string> = { 'login': 'dashboard.actions.login', 'dossier.create': 'dashboard.actions.dossierCreate', 'dossier.update': 'dashboard.actions.dossierUpdate', 'dossier.delete': 'dashboard.actions.dossierDelete', 'node.create': 'dashboard.actions.nodeCreate', 'node.delete': 'dashboard.actions.nodeDelete', 'collaborator.add': 'dashboard.actions.collaboratorAdd', 'comment.create': 'dashboard.actions.commentCreate', 'snapshot.create': 'dashboard.actions.snapshotCreate', 'profile.update': 'dashboard.actions.profileUpdate', 'profile.password_change': 'dashboard.actions.passwordChange', '2fa.enable': 'dashboard.actions.twoFaEnable', '2fa.disable': 'dashboard.actions.twoFaDisable' };
function actIcon(a: string): string { return actIcons[a] || 'pi pi-circle'; }
function actLabel(a: string): string { const k = actKeys[a]; return k ? t(k) : a; }

// ── Charts ──
const accent = '#38bdf8';
const muted = '#64748b';
const gridColor = 'rgba(148,163,184,0.08)';
const chartFont = { family: "'Inter Variable', system-ui, sans-serif" };

const lineOptions = { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: muted, font: { size: 10, ...chartFont } }, grid: { color: gridColor } }, y: { ticks: { color: muted, font: { size: 10, ...chartFont }, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true } } };

const activityChartData = computed(() => {
  if (!stats.value.activityPerDay?.length) return null;
  const days = stats.value.activityPerDay;
  return { labels: days.map((d: any) => { const p = d._id.split('-'); return `${p[2]}/${p[1]}`; }), datasets: [{ data: days.map((d: any) => d.count), borderColor: accent, backgroundColor: accent + '18', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: accent, pointBorderColor: '#0f172a', pointBorderWidth: 2 }] };
});

const openDurationsChartData = computed(() => {
  const d = processingStats.value?.openDurations;
  if (!d?.length) return null;
  return { labels: d.map((x: any) => x.title.length > 25 ? x.title.slice(0, 25) + '...' : x.title), datasets: [{ data: d.map((x: any) => x.days), backgroundColor: d.map((x: any) => x.isUrgent ? '#f87171' : x.classification === 'priority' ? '#fbbf24' : '#38bdf8'), borderRadius: 6 }] };
});
const openDurationsOptions = { indexAxis: 'y' as const, responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: muted, font: { size: 10, ...chartFont } }, grid: { color: gridColor }, beginAtZero: true }, y: { ticks: { color: muted, font: { size: 11, ...chartFont } }, grid: { display: false } } } };

const typeColors: Record<string, string> = { note: '#38bdf8', mindmap: '#a78bfa', document: '#34d399', map: '#fb923c', dataset: '#22d3ee', folder: '#94a3b8' };
const typeLabels: Record<string, string> = { note: 'dashboard.nodeTypes.notes', mindmap: 'dashboard.nodeTypes.mindmaps', document: 'dashboard.nodeTypes.documents', map: 'dashboard.nodeTypes.maps', dataset: 'nodeTypes.dataset', folder: 'dashboard.nodeTypes.folders' };

const donutData = computed(() => {
  const d = stats.value.nodeCountsByType;
  if (!d?.length) return null;
  return { labels: d.map((n: any) => t(typeLabels[n._id] || n._id)), datasets: [{ data: d.map((n: any) => n.count), backgroundColor: d.map((n: any) => typeColors[n._id] || '#64748b'), borderWidth: 0, hoverOffset: 8 }] };
});
const donutOptions = { responsive: true, plugins: { legend: { position: 'bottom' as const, labels: { color: muted, font: { size: 11, ...chartFont }, padding: 16, usePointStyle: true, pointStyle: 'circle' } } }, cutout: '65%' };

const barData = computed(() => {
  const d = stats.value.topDossiersThisWeek;
  if (!d?.length) return null;
  return { labels: d.map((x: any) => x.title.length > 20 ? x.title.slice(0, 20) + '...' : x.title), datasets: [{ data: d.map((x: any) => x.count), backgroundColor: accent + '60', borderColor: accent, borderWidth: 1, borderRadius: 6 }] };
});
const barOptions = { indexAxis: 'y' as const, responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: muted, font: { size: 10, ...chartFont }, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true }, y: { ticks: { color: muted, font: { size: 11, ...chartFont } }, grid: { display: false } } } };

// ── Heatmap ──
const heatmapWeeks = computed(() => {
  const map = new Map((stats.value.heatmap || []).map((d: any) => [d.date, d.count]));
  const now = new Date();
  const result: { date: string; count: number }[][] = [];
  let week: { date: string; count: number }[] = [];
  for (let i = 182; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 864e5);
    const ds = d.toISOString().split('T')[0];
    if (d.getDay() === 1 && week.length) { result.push(week); week = []; }
    week.push({ date: ds, count: (map.get(ds) as number) || 0 });
  }
  if (week.length) result.push(week);
  return result;
});
function heatClass(c: number): string { return c === 0 ? 'dp-hm0' : c <= 2 ? 'dp-hm1' : c <= 5 ? 'dp-hm2' : c <= 10 ? 'dp-hm3' : 'dp-hm4'; }

// ── Lifecycle ──
onMounted(async () => {
  dossierStore.fetchDossiers(true);
  dossierStore.fetchFavorites();
  observer = new IntersectionObserver((e) => { if (e[0]?.isIntersecting && dossierStore.hasMoreDossiers && !dossierStore.loading) dossierStore.fetchDossiers(); }, { threshold: 0.1 });
  if (sentinelRef.value) observer.observe(sentinelRef.value as Element);
  try { const { data } = await api.get('/dossiers/dashboard'); stats.value = data; } finally { dashLoading.value = false; }
});
onBeforeUnmount(() => { observer?.disconnect(); });

function handleOpen(id: string) { dossierStore.openDossier(id); }
function handleToggleFavorite(id: string) { dossierStore.toggleFavorite(id); }
function handleOpenNode(n: any) { if (n.dossierId?._id) dossierStore.openDossier(n.dossierId._id); }
function triggerImport() { importInputRef.value?.click(); }
async function handleImport(e: Event) {
  const input = e.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return; input.value = '';
  try { const text = await file.text(); const data = JSON.parse(text); if (!data.dossier?.title) { await confirm({ title: t('home.invalidImport'), message: t('home.invalidImportMsg'), confirmText: t('common.ok'), cancelText: '' }); return; } const { data: nd } = await api.post('/dossiers/import/json', data); await dossierStore.fetchDossiers(true); dossierStore.openDossier(nd._id); } catch { await confirm({ title: t('common.error'), message: t('home.importError'), confirmText: t('common.ok'), cancelText: '', variant: 'danger' }); }
}
async function handleDelete(id: string) { const ok = await confirm({ title: t('home.deleteDossier'), message: t('home.deleteDossierConfirm'), confirmText: t('common.delete'), variant: 'danger' }); if (ok) dossierStore.deleteDossier(id); }
</script>

<style scoped>
/* ─── BASE ─── */
.dp { max-width: 1400px; margin: 0 auto; padding: 28px 40px 80px; font-family: 'Inter Variable', system-ui, sans-serif; color: var(--me-text-primary); }
.dp-mono { font-family: 'JetBrains Mono', monospace; }
.dp-xs { font-size: 11px; }
.dp-muted { color: var(--me-text-muted); }

/* ─── TOPBAR ─── */
.dp-topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.dp-topbar-left { display: flex; align-items: center; gap: 12px; }
.dp-topbar-right { display: flex; align-items: center; gap: 6px; }
.dp-page-title { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }

/* ─── SEGMENTED (SelectButton) ─── */
.dp-seg { margin-bottom: 20px; }
:deep(.dp-seg .p-selectbutton) { border-radius: 10px; overflow: hidden; border: 1px solid var(--me-border); background: var(--me-bg-elevated); }
:deep(.dp-seg .p-togglebutton) {
  font-size: 13px; font-weight: 500; padding: 7px 16px;
  color: var(--me-text-muted); background: transparent; border: none;
  transition: all 0.2s;
}
:deep(.dp-seg .p-togglebutton:hover) { color: var(--me-text-primary); }
:deep(.dp-seg .p-togglebutton.p-togglebutton-checked),
:deep(.dp-seg .p-togglebutton[data-p-checked="true"]) {
  background: var(--me-accent) !important; color: #fff !important; font-weight: 600;
}
.dp-seg--sm :deep(.p-togglebutton) { font-size: 12px; padding: 5px 14px; }

/* ─── LOADER ─── */
.dp-loader { height: 3px; border-radius: 4px; margin-bottom: 16px; }

/* ─── GRID ─── */
.dp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; margin-bottom: 8px; }
.dp-grid--compact { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }

/* ─── CLOSED CARDS ─── */
.dp-closed {
  padding: 14px 16px; border-radius: 10px; cursor: pointer;
  background: var(--me-bg-elevated); border: 1px solid var(--me-border);
  transition: all 0.2s; opacity: 0.7;
}
.dp-closed:hover { opacity: 1; border-color: var(--me-accent); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(56,189,248,0.08); }
.dp-closed-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.dp-closed-title { font-size: 14px; font-weight: 600; color: var(--me-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
:deep(.dp-closed-ref) { font-size: 10px !important; }

/* ─── EMPTY ─── */
.dp-empty { text-align: center; padding: 60px 20px; color: var(--me-text-muted); }
.dp-empty i { font-size: 2rem; margin-bottom: 12px; display: block; }
.dp-empty p { font-size: 14px; }

/* ─── SECTION HEADER ─── */
.dp-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.dp-section-title { font-size: 18px; font-weight: 700; letter-spacing: -0.2px; }

/* ─── KPI ROW ─── */
.dp-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
.dp-kpis--4 { margin-bottom: 20px; }
.dp-kpi {
  display: flex; align-items: center; gap: 14px; padding: 18px 20px;
  border-radius: 14px; background: var(--me-bg-elevated); border: 1px solid var(--me-border);
  transition: all 0.25s;
}
.dp-kpi:hover { border-color: var(--me-border-hover); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
.dp-kpi-icon {
  width: 44px; height: 44px; border-radius: 12px; display: flex;
  align-items: center; justify-content: center; font-size: 1.1rem;
  color: var(--me-accent); flex-shrink: 0;
}
.dp-kpi-val { font-size: 28px; font-weight: 700; line-height: 1.1; }
.dp-kpi-lbl { font-size: 12px; color: var(--me-text-muted); margin-top: 2px; }

/* ─── STREAK CARDS ─── */
.dp-streak-card {
  display: flex; align-items: center; gap: 14px; padding: 16px 20px;
  border-radius: 14px; background: var(--me-bg-elevated); border: 1px solid var(--me-border);
}
.dp-streak-val { font-size: 16px; font-weight: 700; }
.dp-streak-lbl { font-size: 11px; color: var(--me-text-muted); margin-top: 2px; }

/* ─── CARDS ─── */
.dp-card {
  padding: 22px; border-radius: 14px; margin-bottom: 14px;
  background: var(--me-bg-elevated); border: 1px solid var(--me-border);
}
.dp-card-head {
  display: flex; align-items: center; gap: 8px; margin-bottom: 16px;
  font-size: 13px; font-weight: 700; color: var(--me-text-primary);
}
.dp-card-head i { color: var(--me-accent); font-size: 0.9rem; }

/* ─── DUO LAYOUT ─── */
.dp-duo { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

/* ─── STACKED LIST ─── */
.dp-stack { display: flex; flex-direction: column; gap: 2px; }
.dp-row {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  border-radius: 10px; cursor: pointer; transition: background 0.15s;
}
.dp-row:hover { background: var(--me-accent-glow); }
.dp-row--flat { cursor: default; }
.dp-row--flat:hover { background: transparent; }
:deep(.dp-row-av) { width: 32px; height: 32px; font-size: 0.8rem; background: var(--me-bg-glass); flex-shrink: 0; }
.dp-row-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.dp-row-name { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ─── DOTS ─── */
.dp-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dp-dot--success { background: #22c55e; }
.dp-dot--info { background: #38bdf8; }
.dp-dot--danger { background: #f87171; }
.dp-dot--urgent { background: #ef4444; }
.dp-dot--high { background: #f59e0b; }
.dp-dot--normal { background: #38bdf8; }
.dp-dot--low { background: #6b7280; }

/* ─── METER ─── */
.dp-meter { margin-bottom: 16px; }
.dp-meter-legend { display: flex; flex-wrap: wrap; gap: 16px; }
.dp-meter-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--me-text-secondary); }
.dp-meter-item b { color: var(--me-text-primary); }

/* ─── CHIPS ─── */
.dp-chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
:deep(.dp-chip-row .p-chip) { font-size: 12px; font-family: 'JetBrains Mono', monospace; }

/* ─── CHARTS ─── */
.dp-donut { max-width: 280px; margin: 0 auto; }

/* ─── HEATMAP ─── */
.dp-heatmap-scroll { overflow-x: auto; padding-bottom: 4px; }
.dp-heatmap { display: flex; gap: 3px; }
.dp-heatmap-col { display: flex; flex-direction: column; gap: 3px; }
.dp-hm { width: 12px; height: 12px; border-radius: 3px; transition: transform 0.15s; }
.dp-hm:hover { transform: scale(1.4); }
.dp-hm0 { background: var(--me-bg-glass); }
.dp-hm1 { background: rgba(56,189,248,0.2); }
.dp-hm2 { background: rgba(56,189,248,0.4); }
.dp-hm3 { background: rgba(56,189,248,0.65); }
.dp-hm4 { background: #38bdf8; }
.dp-heatmap-legend { display: flex; align-items: center; gap: 4px; margin-top: 10px; justify-content: flex-end; }

/* ─── TIMELINE ─── */
.dp-timeline { display: flex; flex-direction: column; gap: 0; max-height: 360px; overflow-y: auto; }
.dp-tl-item {
  display: flex; align-items: flex-start; gap: 12px; padding: 10px 0;
  border-bottom: 1px solid var(--me-border);
}
.dp-tl-item:last-child { border-bottom: none; }
.dp-tl-dot {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--me-accent-glow); color: var(--me-accent); font-size: 0.8rem;
}
.dp-tl-body { flex: 1; min-width: 0; }
.dp-tl-label { font-size: 13px; font-weight: 500; }
.dp-tl-target { display: block; font-size: 11px; color: var(--me-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ─── PLACEHOLDER ─── */
.dp-placeholder { text-align: center; padding: 24px 0; font-size: 13px; color: var(--me-text-muted); }

/* ─── PROTO BADGE ─── */
.dp-badge {
  position: fixed; bottom: 16px; right: 16px; z-index: 100;
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 20px;
  background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.25);
  color: #a5b4fc; font-size: 11px; font-family: 'JetBrains Mono', monospace;
  backdrop-filter: blur(12px);
}

/* ─── PrimeVue Divider ─── */
:deep(.p-divider) { margin: 28px 0 !important; }
:deep(.p-divider-horizontal::before) { border-color: var(--me-border) !important; }

/* ─── PrimeVue Knob ─── */
:deep(.p-knob-text) { fill: var(--me-text-primary) !important; font-family: 'JetBrains Mono', monospace; font-weight: 700; }
:deep(.p-knob-range) { stroke: var(--me-bg-glass) !important; }

/* ─── PrimeVue MeterGroup ─── */
:deep(.p-metergroup-meters) { height: 8px; border-radius: 4px; }

/* ─── RESPONSIVE ─── */
@media (max-width: 1024px) {
  .dp { padding: 24px; }
  .dp-kpis { grid-template-columns: repeat(2, 1fr); }
  .dp-duo { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .dp { padding: 16px; }
  .dp-kpis { grid-template-columns: 1fr; }
  .dp-topbar { flex-direction: column; align-items: flex-start; gap: 12px; }
  .dp-section-head { flex-direction: column; align-items: flex-start; }
  .dp-grid { grid-template-columns: 1fr; }
}
</style>
