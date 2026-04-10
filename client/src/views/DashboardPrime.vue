<template>
  <div class="app-shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <!-- ─── SIDEBAR ─── -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-brand" @click="sidebarCollapsed = !sidebarCollapsed">
          <div class="brand-icon">
            <img :src="meLogo" alt="MeteorEdit" class="brand-logo" />
          </div>
          <transition name="fade-text">
            <div v-if="!sidebarCollapsed" class="brand-text">
              <span class="brand-name">{{ brandingStore.appName }}</span>
              <span class="brand-version">v3.6.0</span>
            </div>
          </transition>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <span v-if="!sidebarCollapsed" class="nav-label">{{ $t('nav.main') || 'Principal' }}</span>
          <button
            v-for="item in mainNavItems"
            :key="item.key"
            class="nav-item"
            :class="{ 'nav-item--active': activeSection === item.key }"
            @click="activeSection = item.key"
            :title="sidebarCollapsed ? item.label : undefined"
          >
            <i :class="item.icon" class="nav-icon" />
            <transition name="fade-text">
              <span v-if="!sidebarCollapsed" class="nav-text">{{ item.label }}</span>
            </transition>
            <Badge v-if="item.badge && !sidebarCollapsed" :value="item.badge" severity="info" class="nav-badge" />
          </button>
        </div>

        <div class="nav-section">
          <span v-if="!sidebarCollapsed" class="nav-label">{{ $t('nav.tools') || 'Outils' }}</span>
          <button
            v-for="item in toolNavItems"
            :key="item.key"
            class="nav-item"
            :class="{ 'nav-item--active': activeSection === item.key }"
            @click="activeSection = item.key"
            :title="sidebarCollapsed ? item.label : undefined"
          >
            <i :class="item.icon" class="nav-icon" />
            <transition name="fade-text">
              <span v-if="!sidebarCollapsed" class="nav-text">{{ item.label }}</span>
            </transition>
          </button>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="nav-section">
          <button class="nav-item" @click="themeStore.toggle()" :title="themeStore.isDark ? 'Mode clair' : 'Mode sombre'">
            <i :class="themeStore.isDark ? 'pi pi-sun' : 'pi pi-moon'" class="nav-icon" />
            <transition name="fade-text">
              <span v-if="!sidebarCollapsed" class="nav-text">{{ themeStore.isDark ? 'Clair' : 'Sombre' }}</span>
            </transition>
          </button>
          <button class="nav-item nav-item--user" :title="sidebarCollapsed ? authStore.user?.firstName : undefined">
            <Avatar
              :label="initials"
              :image="avatarUrl || undefined"
              shape="circle"
              class="nav-avatar"
            />
            <transition name="fade-text">
              <div v-if="!sidebarCollapsed" class="nav-user-info">
                <span class="nav-user-name">{{ authStore.user?.firstName }} {{ authStore.user?.lastName }}</span>
                <span class="nav-user-role">{{ authStore.isAdmin ? 'Admin' : 'Analyste' }}</span>
              </div>
            </transition>
          </button>
        </div>
      </div>
    </aside>

    <!-- ─── MAIN CONTENT ─── -->
    <div class="main-area">
      <!-- TOP BAR -->
      <header class="topbar">
        <div class="topbar-left">
          <h1 class="page-title">{{ pageTitle }}</h1>
          <Tag :value="pageSubtitle" severity="secondary" rounded class="page-tag" />
        </div>
        <div class="topbar-center">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText v-model="searchQuery" :placeholder="$t('common.search') || 'Rechercher...'" class="topbar-search" />
          </IconField>
        </div>
        <div class="topbar-right">
          <Button icon="pi pi-bell" text rounded severity="secondary" class="topbar-btn" />
          <Button icon="pi pi-cog" text rounded severity="secondary" class="topbar-btn" />
        </div>
      </header>

      <!-- CONTENT -->
      <main class="content" @scroll="handleScroll">
        <!-- ─── DOSSIERS SECTION ─── -->
        <section v-if="activeSection === 'dossiers'" class="section fade-in">
          <div class="section-toolbar">
            <SelectButton v-model="activeTab" :options="tabOptions" optionLabel="label" optionValue="value" class="seg-control" />
            <div class="toolbar-actions">
              <Button icon="pi pi-upload" :label="$t('home.import')" outlined size="small" @click="triggerImport" />
              <CreateDossierDialog />
            </div>
            <input ref="importInputRef" type="file" accept=".json" style="display:none" @change="handleImport" />
          </div>

          <ProgressBar v-if="dossierStore.loading" mode="indeterminate" class="section-loader" />

          <!-- Dossier grid -->
          <div v-if="activeTab === 'favorites'" class="card-grid">
            <template v-if="favoriteDossiers.length">
              <DossierCard v-for="d in favoriteDossiers" :key="d._id" :dossier="d" :is-fav="true" @open="handleOpen" @delete="handleDelete" @toggle-favorite="handleToggleFavorite" />
            </template>
            <div v-else class="empty-state">
              <i class="pi pi-star empty-icon" />
              <h3>{{ $t('home.tabs.noFavorites') }}</h3>
              <p>{{ $t('home.tabs.noFavoritesHint') }}</p>
            </div>
          </div>
          <div v-else-if="activeTab === 'active'" class="card-grid">
            <template v-if="activeDossiers.length">
              <DossierCard v-for="d in activeDossiers" :key="d._id" :dossier="d" :is-fav="dossierStore.isFavorite(d._id)" @open="handleOpen" @delete="handleDelete" @toggle-favorite="handleToggleFavorite" />
            </template>
            <div v-else class="empty-state">
              <i class="pi pi-folder-open empty-icon" />
              <h3>{{ $t('home.noDossiers') }}</h3>
              <p>{{ $t('home.noDossiersHint') }}</p>
            </div>
          </div>
          <div v-else class="card-grid card-grid--compact">
            <template v-if="closedDossiers.length">
              <div v-for="d in closedDossiers" :key="d._id" class="closed-card" @click="handleOpen(d._id)">
                <div class="closed-card-header">
                  <Tag v-if="d.referenceNumber" :value="d.referenceNumber" severity="contrast" rounded />
                  <span class="text-xs text-muted mono">{{ formatClosureDate(d.closureDate) }}</span>
                </div>
                <span class="closed-card-title">{{ d.title }}</span>
              </div>
            </template>
            <div v-else class="empty-state">
              <i class="pi pi-inbox empty-icon" />
              <h3>{{ $t('home.tabs.noClosed') }}</h3>
            </div>
          </div>

          <!-- ─── DASHBOARD SECTION ─── -->
          <Divider class="section-divider" />

          <!-- KPIs -->
          <div class="kpi-section">
            <img :src="meLogo" alt="" class="kpi-watermark" />
            <div class="kpi-grid">
              <div v-for="kpi in kpiCards" :key="kpi.key" class="kpi-card">
              <div class="kpi-icon-wrap" :style="{ background: kpi.bgColor }">
                <i :class="kpi.icon" class="kpi-icon" :style="{ color: kpi.iconColor }" />
              </div>
              <div class="kpi-data">
                <span class="kpi-value mono">{{ kpi.value }}</span>
                <span class="kpi-label">{{ kpi.label }}</span>
              </div>
              <div v-if="kpi.trend" class="kpi-trend" :class="kpi.trend > 0 ? 'kpi-trend--up' : 'kpi-trend--down'">
                <i :class="kpi.trend > 0 ? 'pi pi-arrow-up-right' : 'pi pi-arrow-down-right'" />
                <span>{{ Math.abs(kpi.trend) }}%</span>
              </div>
              </div>
            </div>
          </div>

          <!-- Dashboard tabs -->
          <Tabs v-model:value="dashTab" class="dash-tabs">
            <TabList>
              <Tab value="overview"><i class="pi pi-home mr-2" />{{ $t('dashboard.overview') }}</Tab>
              <Tab value="stats"><i class="pi pi-chart-bar mr-2" />{{ $t('dashboard.statistics') }}</Tab>
              <Tab value="activity"><i class="pi pi-history mr-2" />{{ $t('dashboard.activityTab') }}</Tab>
            </TabList>
            <TabPanels>
              <!-- OVERVIEW -->
              <TabPanel value="overview">
                <div class="overview-grid">
                  <!-- Quick Access -->
                  <div class="panel-card">
                    <div class="panel-header">
                      <i class="pi pi-clock" />
                      <h3>{{ $t('dashboard.lastOpened') }}</h3>
                    </div>
                    <div v-if="stats.lastAccessedNodes?.length" class="quick-list">
                      <div v-for="node in stats.lastAccessedNodes" :key="node._id" class="quick-item" @click="handleOpenNode(node)">
                        <i :class="nodeIcon(node.type)" class="quick-item-icon" />
                        <div class="quick-item-info">
                          <span class="quick-item-name">{{ node.title }}</span>
                          <span class="quick-item-dossier mono">{{ node.dossierId?.title || '' }}</span>
                        </div>
                      </div>
                    </div>
                    <div v-else class="empty-mini">{{ $t('dashboard.noRecentElements') }}</div>
                  </div>

                  <!-- Tasks -->
                  <div class="panel-card">
                    <div class="panel-header">
                      <i class="pi pi-check-circle" />
                      <h3>{{ $t('dashboard.assignedTasks') }}</h3>
                    </div>
                    <div v-if="stats.assignedTasks?.length" class="quick-list">
                      <div v-for="(task, i) in stats.assignedTasks" :key="i" class="quick-item">
                        <span :class="['priority-dot', `priority-${task.task?.priority || 'normal'}`]" />
                        <div class="quick-item-info">
                          <span class="quick-item-name">{{ task.task?.title || task.title }}</span>
                          <span v-if="task.task?.dueDate" class="quick-item-dossier mono">{{ formatDate(task.task.dueDate) }}</span>
                        </div>
                      </div>
                    </div>
                    <div v-else class="empty-mini">{{ $t('dashboard.noAssignedTasks') }}</div>
                  </div>

                  <!-- Recent Dossiers -->
                  <div class="panel-card panel-card--wide">
                    <div class="panel-header">
                      <i class="pi pi-folder" />
                      <h3>{{ $t('dashboard.recentlyModifiedDossiers') }}</h3>
                    </div>
                    <div v-if="recentOpenDossiers.length" class="recent-list">
                      <div v-for="d in recentOpenDossiers" :key="d._id" class="recent-item" @click="handleOpen(d._id)">
                        <span :class="['status-dot', `status-dot--${statusDotClass(d.status)}`]" />
                        <span class="recent-item-title">{{ d.title }}</span>
                        <Tag :value="statusLabel(d.status)" :severity="statusSeverity(d.status)" rounded class="recent-tag" />
                        <span class="recent-item-date mono">{{ formatDate(d.updatedAt) }}</span>
                      </div>
                    </div>
                    <div v-else class="empty-mini">{{ $t('dashboard.noRecentActivity') }}</div>
                  </div>
                </div>
              </TabPanel>

              <!-- STATISTICS -->
              <TabPanel value="stats">
                <div class="stats-grid">
                  <!-- Status Distribution -->
                  <div class="panel-card">
                    <div class="panel-header">
                      <i class="pi pi-chart-pie" />
                      <h3>{{ $t('dashboard.dossierStatuses') }}</h3>
                    </div>
                    <div class="status-bars">
                      <div v-for="s in statusItems" :key="s.key" class="status-bar-row">
                        <div class="status-bar-head">
                          <span :class="['status-dot', `status-dot--${s.dot}`]" />
                          <span class="status-bar-name">{{ s.label }}</span>
                          <span class="status-bar-count mono">{{ s.count }}</span>
                        </div>
                        <div class="status-bar-track">
                          <div class="status-bar-fill" :style="{ width: s.pct + '%', background: s.color }" />
                        </div>
                      </div>
                    </div>
                    <Divider />
                    <div class="panel-header" style="margin-top: 4px;">
                      <i class="pi pi-sitemap" />
                      <h3>{{ $t('dashboard.elementTypes') }}</h3>
                    </div>
                    <div class="node-types">
                      <div v-for="n in nodeTypeItems" :key="n.type" class="node-type-row">
                        <i :class="nodeIcon(n.type)" class="node-type-icon" />
                        <span class="node-type-label">{{ n.label }}</span>
                        <span class="node-type-count mono">{{ n.count }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Charts -->
                  <div class="panel-card">
                    <div class="panel-header">
                      <i class="pi pi-chart-bar" />
                      <h3>{{ $t('dashboard.topActiveDossiers') }}</h3>
                    </div>
                    <Bar v-if="barData" :data="barData" :options="barOptions" />
                    <div v-else class="empty-mini">{{ $t('dashboard.notEnoughData') }}</div>
                  </div>

                  <!-- Donut -->
                  <div class="panel-card">
                    <div class="panel-header">
                      <i class="pi pi-chart-pie" />
                      <h3>{{ $t('dashboard.distributionByType') }}</h3>
                    </div>
                    <div class="donut-wrap">
                      <Doughnut v-if="donutData" :data="donutData" :options="donutOptions" />
                    </div>
                  </div>

                  <!-- Streaks -->
                  <div class="panel-card">
                    <div class="panel-header">
                      <i class="pi pi-bolt" />
                      <h3>Streaks &amp; Tendance</h3>
                    </div>
                    <div class="streak-grid">
                      <div class="streak-item">
                        <Knob :modelValue="Math.min(stats.streaks?.current || 0, 30)" :max="30" :strokeWidth="6" :size="80" valueColor="var(--p-primary-400)" rangeColor="var(--surface-200)" readonly />
                        <span class="streak-label">{{ $t('dashboard.currentStreak') }}</span>
                        <span class="streak-value mono">{{ stats.streaks?.current || 0 }}j</span>
                      </div>
                      <div class="streak-item">
                        <Knob :modelValue="Math.min(stats.streaks?.best || 0, 30)" :max="30" :strokeWidth="6" :size="80" valueColor="var(--p-orange-400)" rangeColor="var(--surface-200)" readonly />
                        <span class="streak-label">{{ $t('dashboard.bestStreak') }}</span>
                        <span class="streak-value mono">{{ stats.streaks?.best || 0 }}j</span>
                      </div>
                      <div class="streak-item">
                        <div class="trend-badge" :class="(stats.weeklyTrend?.current || 0) >= (stats.weeklyTrend?.previous || 0) ? 'trend-badge--up' : 'trend-badge--down'">
                          <i :class="(stats.weeklyTrend?.current || 0) >= (stats.weeklyTrend?.previous || 0) ? 'pi pi-arrow-up' : 'pi pi-arrow-down'" />
                        </div>
                        <span class="streak-label">{{ $t('dashboard.thisWeek') }}</span>
                        <span class="streak-value mono">{{ stats.weeklyTrend?.current || 0 }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Heatmap (full width) -->
                  <div class="panel-card panel-card--full">
                    <div class="panel-header">
                      <i class="pi pi-calendar" />
                      <h3>{{ $t('dashboard.contribution6months') }}</h3>
                    </div>
                    <DashboardHeatmap :heatmap="stats.heatmap || []" />
                  </div>
                </div>
              </TabPanel>

              <!-- ACTIVITY -->
              <TabPanel value="activity">
                <div class="activity-layout">
                  <div class="panel-card panel-card--wide">
                    <div class="panel-header">
                      <i class="pi pi-chart-line" />
                      <h3>{{ $t('dashboard.activity7days') }}</h3>
                    </div>
                    <Line v-if="activityChartData" :data="activityChartData" :options="lineOptions" />
                    <div v-else class="empty-mini">{{ $t('dashboard.noRecentActivity') }}</div>
                  </div>

                  <div class="panel-card panel-card--wide">
                    <div class="panel-header">
                      <i class="pi pi-list" />
                      <h3>{{ $t('dashboard.recentActivity') }}</h3>
                    </div>
                    <div v-if="stats.recentActivity?.length" class="activity-timeline">
                      <div v-for="act in stats.recentActivity" :key="act._id" class="timeline-item">
                        <div class="timeline-dot" />
                        <div class="timeline-content">
                          <div class="timeline-head">
                            <span class="timeline-action">{{ actionLabel(act.action) }}</span>
                            <span class="timeline-time mono">{{ formatTime(act.timestamp) }}</span>
                          </div>
                          <span v-if="act.metadata?.title" class="timeline-target">{{ act.metadata.title }}</span>
                        </div>
                      </div>
                    </div>
                    <div v-else class="empty-mini">{{ $t('dashboard.noActivityThisWeek') }}</div>
                  </div>
                </div>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Line, Bar, Doughnut } from 'vue-chartjs';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Title, Tooltip, Filler, Legend,
} from 'chart.js';

import Avatar from 'primevue/avatar';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Divider from 'primevue/divider';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import Knob from 'primevue/knob';
import ProgressBar from 'primevue/progressbar';
import SelectButton from 'primevue/selectbutton';
import Tab from 'primevue/tab';
import TabList from 'primevue/tablist';
import TabPanel from 'primevue/tabpanel';
import TabPanels from 'primevue/tabpanels';
import Tabs from 'primevue/tabs';
import Tag from 'primevue/tag';

import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import { useDossierStore } from '../stores/dossier';
import { useBrandingStore } from '../stores/branding';
import { useConfirm } from '../composables/useConfirm';
import api, { SERVER_URL } from '../services/api';

import DossierCard from '../components/dossier/DossierCard.vue';
import CreateDossierDialog from '../components/dossier/CreateDossierDialog.vue';
import DashboardHeatmap from '../components/dashboard/DashboardHeatmap.vue';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Filler, Legend);

const { t, locale } = useI18n();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const dossierStore = useDossierStore();
const brandingStore = useBrandingStore();
const { confirm } = useConfirm();

const sidebarCollapsed = ref(false);
const activeSection = ref('dossiers');
const activeTab = ref('active');
const dashTab = ref('overview');
const searchQuery = ref('');
const importInputRef = ref<HTMLInputElement | null>(null);
const loading = ref(true);
const stats = ref<any>({
  totalDossiers: 0, ownedDossiers: 0, collabDossiers: 0, totalNodes: 0,
  statusCounts: { open: 0, in_progress: 0, closed: 0 },
  nodeCountsByType: [], recentActivity: [], activityPerDay: [],
  recentDossiers: [], lastAccessedNodes: [], assignedTasks: [],
  streaks: { current: 0, best: 0 }, weeklyTrend: { current: 0, previous: 0 },
  heatmap: [], topDossiersThisWeek: [],
});

const initials = computed(() => {
  const f = authStore.user?.firstName?.[0] || '';
  const l = authStore.user?.lastName?.[0] || '';
  return (f + l).toUpperCase();
});

const avatarUrl = computed(() => authStore.user?.avatarPath ? `${SERVER_URL}/${authStore.user.avatarPath}` : null);

const meLogo = computed(() => themeStore.isDark ? '/logo-me-red.png' : '/logo-me-blue.png');

const pageTitle = computed(() => {
  const map: Record<string, string> = {
    dossiers: t('home.myDossiers'),
    search: t('common.search'),
    templates: t('nav.templates'),
    help: t('nav.help'),
  };
  return map[activeSection.value] || t('home.myDossiers');
});

const pageSubtitle = computed(() => {
  if (activeSection.value === 'dossiers') return `${dossierStore.dossiers.length} dossier${dossierStore.dossiers.length > 1 ? 's' : ''}`;
  return '';
});

const mainNavItems = computed(() => [
  { key: 'dossiers', icon: 'pi pi-folder', label: t('home.myDossiers'), badge: dossierStore.dossiers.length || null },
  { key: 'search', icon: 'pi pi-search', label: t('common.search') || 'Recherche' },
  { key: 'templates', icon: 'pi pi-file-edit', label: t('nav.templates') },
]);

const toolNavItems = computed(() => [
  { key: 'help', icon: 'pi pi-question-circle', label: t('nav.help') },
  ...(authStore.isAdmin ? [{ key: 'admin', icon: 'pi pi-shield', label: t('nav.admin') }] : []),
]);

const tabOptions = computed(() => [
  { label: t('home.tabs.favorites'), value: 'favorites' },
  { label: t('home.tabs.active'), value: 'active' },
  { label: t('home.tabs.closed'), value: 'closed' },
]);

const favoriteDossiers = computed(() => dossierStore.dossiers.filter(d => dossierStore.isFavorite(d._id)));
const activeDossiers = computed(() => dossierStore.dossiers.filter(d => d.status === 'open' || d.status === 'in_progress'));
const closedDossiers = computed(() => dossierStore.dossiers.filter(d => d.status === 'closed'));
const recentOpenDossiers = computed(() => (stats.value.recentDossiers || []).filter((r: any) => r.status !== 'closed'));

const kpiCards = computed(() => {
  const weekDelta = stats.value.weeklyTrend?.previous
    ? Math.round(((stats.value.weeklyTrend.current - stats.value.weeklyTrend.previous) / stats.value.weeklyTrend.previous) * 100)
    : 0;
  return [
    { key: 'total', icon: 'pi pi-folder', label: t('dashboard.dossiers'), value: stats.value.totalDossiers, bgColor: 'rgba(99, 145, 214, 0.12)', iconColor: '#6391d6', trend: null },
    { key: 'owned', icon: 'pi pi-user', label: t('dashboard.owner'), value: stats.value.ownedDossiers, bgColor: 'rgba(129, 178, 154, 0.12)', iconColor: '#81b29a', trend: null },
    { key: 'collab', icon: 'pi pi-users', label: t('dashboard.collaborations'), value: stats.value.collabDossiers, bgColor: 'rgba(186, 152, 209, 0.12)', iconColor: '#ba98d1', trend: null },
    { key: 'nodes', icon: 'pi pi-sitemap', label: t('dashboard.elements'), value: stats.value.totalNodes, bgColor: 'rgba(224, 175, 104, 0.12)', iconColor: '#e0af68', trend: weekDelta || null },
  ];
});

// Status items
const statusItems = computed(() => {
  const c = stats.value.statusCounts || {};
  const total = (c.open || 0) + (c.in_progress || 0) + (c.closed || 0);
  return [
    { key: 'open', label: t('dossier.statusOpen'), dot: 'active', color: '#81b29a', count: c.open || 0, pct: total ? (c.open || 0) / total * 100 : 0 },
    { key: 'in_progress', label: t('dossier.statusInProgress'), dot: 'warning', color: '#6391d6', count: c.in_progress || 0, pct: total ? (c.in_progress || 0) / total * 100 : 0 },
    { key: 'closed', label: t('dossier.statusClosed'), dot: 'error', color: '#c97b7b', count: c.closed || 0, pct: total ? (c.closed || 0) / total * 100 : 0 },
  ];
});

// Node types
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

// Charts
const chartTextColor = computed(() => getComputedStyle(document.documentElement).getPropertyValue('--me-text-muted').trim() || '#94a3b8');
const chartGridColor = 'rgba(148, 163, 184, 0.08)';

const typeColors: Record<string, string> = {
  note: '#6391d6', mindmap: '#ba98d1', document: '#81b29a', map: '#e0af68', dataset: '#7ec4cf', folder: '#a0aec0',
};

const donutData = computed(() => {
  if (!stats.value.nodeCountsByType?.length) return null;
  const items = stats.value.nodeCountsByType;
  return {
    labels: items.map((n: any) => t(nodeTypeMap.value[n._id]?.label || n._id) || n._id),
    datasets: [{ data: items.map((n: any) => n.count), backgroundColor: items.map((n: any) => typeColors[n._id] || '#a0aec0'), borderWidth: 0 }],
  };
});

const donutOptions = { responsive: true, plugins: { legend: { position: 'bottom' as const, labels: { color: chartTextColor.value, font: { size: 11 } } } }, cutout: '65%' };

const barData = computed(() => {
  const top = stats.value.topDossiersThisWeek || [];
  if (!top.length) return null;
  return {
    labels: top.map((d: any) => d.title.length > 22 ? d.title.slice(0, 22) + '...' : d.title),
    datasets: [{ data: top.map((d: any) => d.count), backgroundColor: 'rgba(99, 145, 214, 0.5)', borderColor: '#6391d6', borderWidth: 1, borderRadius: 6 }],
  };
});

const barOptions = {
  indexAxis: 'y' as const, responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: chartTextColor.value, font: { size: 10 }, stepSize: 1 }, grid: { color: chartGridColor }, beginAtZero: true },
    y: { ticks: { color: chartTextColor.value, font: { size: 11 } }, grid: { display: false } },
  },
};

const lineOptions = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: chartTextColor.value, font: { size: 10 } }, grid: { color: chartGridColor } },
    y: { ticks: { color: chartTextColor.value, font: { size: 10 }, stepSize: 1 }, grid: { color: chartGridColor }, beginAtZero: true },
  },
};

const activityChartData = computed(() => {
  if (!stats.value.activityPerDay?.length) return null;
  const days = stats.value.activityPerDay;
  return {
    labels: days.map((d: any) => { const p = d._id.split('-'); return `${p[2]}/${p[1]}`; }),
    datasets: [{
      data: days.map((d: any) => d.count),
      borderColor: '#6391d6', backgroundColor: 'rgba(99, 145, 214, 0.1)',
      fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#6391d6',
    }],
  };
});

// Action labels
const actionLabelKeys: Record<string, string> = {
  'login': 'dashboard.actions.login', 'dossier.create': 'dashboard.actions.dossierCreate',
  'dossier.update': 'dashboard.actions.dossierUpdate', 'dossier.delete': 'dashboard.actions.dossierDelete',
  'node.create': 'dashboard.actions.nodeCreate', 'node.delete': 'dashboard.actions.nodeDelete',
  'collaborator.add': 'dashboard.actions.collaboratorAdd', 'comment.create': 'dashboard.actions.commentCreate',
  'snapshot.create': 'dashboard.actions.snapshotCreate', 'profile.update': 'dashboard.actions.profileUpdate',
};

function actionLabel(action: string): string { return actionLabelKeys[action] ? t(actionLabelKeys[action]) : action; }

function nodeIcon(type: string): string {
  const map: Record<string, string> = { note: 'pi pi-file-edit', mindmap: 'pi pi-share-alt', document: 'pi pi-file', map: 'pi pi-map', dataset: 'pi pi-table', folder: 'pi pi-folder' };
  return map[type] || 'pi pi-file';
}

function statusDotClass(status: string): string { return status === 'open' ? 'active' : status === 'in_progress' ? 'warning' : 'error'; }
function statusLabel(status: string): string {
  return status === 'open' ? t('dossier.statusOpen') : status === 'in_progress' ? t('dossier.statusInProgress') : t('dossier.statusClosed');
}
function statusSeverity(status: string): "success" | "info" | "danger" | "warn" | "secondary" | "contrast" | undefined {
  return status === 'open' ? 'success' : status === 'in_progress' ? 'info' : 'danger';
}

function formatDate(d: string): string { return new Date(d).toLocaleDateString(locale.value); }
function formatClosureDate(d: string | null): string { return d ? new Date(d).toLocaleDateString(locale.value) : '-'; }
function formatTime(d: string): string { return new Date(d).toLocaleString(locale.value, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }

function handleOpen(id: string) { dossierStore.openDossier(id); }
function handleToggleFavorite(id: string) { dossierStore.toggleFavorite(id); }
function handleOpenNode(node: any) { if (node.dossierId?._id) dossierStore.openDossier(node.dossierId._id); }
function triggerImport() { importInputRef.value?.click(); }
function handleScroll() { /* infinite scroll placeholder */ }

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
  } catch { await confirm({ title: t('common.error'), message: t('home.importError'), confirmText: t('common.ok'), cancelText: '', variant: 'danger' }); }
}

async function handleDelete(id: string) {
  const ok = await confirm({ title: t('home.deleteDossier'), message: t('home.deleteDossierConfirm'), confirmText: t('common.delete'), variant: 'danger' });
  if (ok) dossierStore.deleteDossier(id);
}

onMounted(async () => {
  dossierStore.fetchDossiers(true);
  dossierStore.fetchFavorites();
  try { const { data } = await api.get('/dossiers/dashboard'); stats.value = data; } finally { loading.value = false; }
});
</script>

<style>
/* ═══════════════════════════════════════════════════
   PROTO — Police Belge Pastel SaaS
   Palette: Slate-Blue, Sage-Green, Soft-Purple, Warm-Gold
   ═══════════════════════════════════════════════════ */

.app-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
  font-family: var(--me-font-body);
  background: var(--me-bg-deep);
  color: var(--me-text-primary);
}

/* ─── SIDEBAR ─── */
.sidebar {
  width: 240px;
  background: var(--me-bg-surface);
  border-right: 1px solid var(--me-border);
  display: flex;
  flex-direction: column;
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  z-index: 50;
}
.sidebar-collapsed .sidebar { width: 64px; }

.sidebar-header {
  padding: 16px 12px;
  border-bottom: 1px solid var(--me-border);
}
.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 8px;
  transition: background 0.15s;
}
.sidebar-brand:hover { background: var(--me-accent-glow); }

.brand-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
.brand-logo { width: 36px; height: 36px; object-fit: contain; }
.brand-text { display: flex; flex-direction: column; min-width: 0; }
.brand-name { font-weight: 700; font-size: 15px; color: var(--me-text-primary); white-space: nowrap; }
.brand-version { font-size: 10px; color: var(--me-text-muted); font-family: var(--me-font-mono); }

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.sidebar-footer {
  padding: 8px;
  border-top: 1px solid var(--me-border);
}

.nav-section { display: flex; flex-direction: column; gap: 2px; margin-bottom: 16px; }
.nav-section:last-child { margin-bottom: 0; }
.nav-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--me-text-muted);
  padding: 8px 12px 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  background: none;
  color: var(--me-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  width: 100%;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
}
.sidebar-collapsed .nav-item { justify-content: center; padding: 10px; }
.nav-item:hover { background: var(--me-accent-glow); color: var(--me-text-primary); }
.nav-item--active { background: rgba(99, 145, 214, 0.12); color: #6391d6; font-weight: 600; }
.nav-item--active .nav-icon { color: #6391d6; }

.nav-icon { font-size: 16px; flex-shrink: 0; width: 20px; text-align: center; color: var(--me-text-muted); transition: color 0.15s; }
.nav-item:hover .nav-icon { color: var(--me-text-primary); }
.nav-text { overflow: hidden; text-overflow: ellipsis; }
.nav-badge { margin-left: auto; }

.nav-item--user { gap: 10px; padding: 8px; }
.nav-avatar { width: 28px !important; height: 28px !important; font-size: 11px !important; flex-shrink: 0; }
.nav-user-info { display: flex; flex-direction: column; min-width: 0; }
.nav-user-name { font-size: 12px; font-weight: 600; color: var(--me-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav-user-role { font-size: 10px; color: var(--me-text-muted); }

.fade-text-enter-active, .fade-text-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fade-text-enter-from, .fade-text-leave-to { opacity: 0; transform: translateX(-4px); }

/* ─── MAIN AREA ─── */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* ─── TOPBAR ─── */
.topbar {
  height: 52px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  gap: 16px;
  flex-shrink: 0;
}
.topbar-left { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.page-title { font-size: 16px; font-weight: 700; color: var(--me-text-primary); }
.page-tag { font-size: 11px; }
.topbar-center { flex: 1; max-width: 400px; margin: 0 auto; }
.topbar-search { width: 100%; font-size: 13px; }
.topbar-right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.topbar-btn { width: 36px !important; height: 36px !important; }

/* ─── CONTENT ─── */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.section { max-width: 1400px; margin: 0 auto; }

.section-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 12px;
  flex-wrap: wrap;
}
.seg-control { flex-shrink: 0; }
.toolbar-actions { display: flex; align-items: center; gap: 8px; }
.section-loader { margin-bottom: 16px; border-radius: 4px; }
.section-divider { margin: 32px 0 24px; }

/* ─── CARD GRID ─── */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
.card-grid--compact {
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}

/* ─── CLOSED CARDS ─── */
.closed-card {
  background: var(--me-bg-glass);
  border: 1px solid var(--me-border);
  border-radius: 10px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0.7;
}
.closed-card:hover { opacity: 1; transform: translateY(-1px); border-color: var(--me-border-hover); }
.closed-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.closed-card-title { font-size: 14px; font-weight: 600; color: var(--me-text-secondary); }

/* ─── EMPTY STATE ─── */
.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
}
.empty-icon { font-size: 40px; color: var(--me-text-muted); margin-bottom: 12px; display: block; }
.empty-state h3 { font-size: 15px; color: var(--me-text-primary); margin-bottom: 6px; }
.empty-state p { font-size: 13px; color: var(--me-text-muted); }
.empty-mini { font-size: 12px; color: var(--me-text-muted); text-align: center; padding: 20px 0; }

/* ─── KPI SECTION ─── */
.kpi-section {
  position: relative;
  margin-bottom: 24px;
}
.kpi-watermark {
  position: absolute;
  right: 24px;
  top: 50%;
  transform: translateY(-50%);
  width: 120px;
  height: 120px;
  object-fit: contain;
  opacity: 0.04;
  pointer-events: none;
  user-select: none;
  z-index: 0;
}

/* ─── KPI GRID ─── */
.kpi-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 24px;
}
.kpi-card {
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  border-radius: 10px;
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  transition: all 0.2s;
}
.kpi-card:hover { border-color: var(--me-border-hover); box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
.kpi-icon-wrap {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.kpi-icon { font-size: 18px; }
.kpi-data { display: flex; flex-direction: column; min-width: 0; }
.kpi-value { font-size: 22px; font-weight: 700; color: var(--me-text-primary); line-height: 1; }
.kpi-label { font-size: 12px; color: var(--me-text-muted); margin-top: 2px; }
.kpi-trend { display: flex; align-items: center; gap: 2px; font-size: 11px; margin-left: auto; padding: 2px 8px; border-radius: 12px; font-weight: 600; }
.kpi-trend--up { color: #81b29a; background: rgba(129, 178, 154, 0.12); }
.kpi-trend--down { color: #c97b7b; background: rgba(201, 123, 123, 0.12); }

/* ─── DASH TABS ─── */
.dash-tabs { margin-bottom: 20px; }
.dash-tabs .p-tab { font-size: 13px; }

/* ─── PANEL CARDS ─── */
.panel-card {
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  border-radius: 10px;
  padding: 20px;
  transition: border-color 0.2s;
}
.panel-card:hover { border-color: var(--me-border-hover); }
.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.panel-header i { color: #6391d6; font-size: 15px; }
.panel-header h3 { font-size: 13px; font-weight: 700; color: var(--me-text-primary); }

/* ─── OVERVIEW GRID ─── */
.overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.panel-card--wide { grid-column: 1 / -1; }

/* ─── QUICK ACCESS ─── */
.quick-list { display: flex; flex-direction: column; gap: 2px; }
.quick-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.quick-item:hover { background: var(--me-accent-glow); }
.quick-item-icon { color: #6391d6; font-size: 14px; flex-shrink: 0; }
.quick-item-info { display: flex; flex-direction: column; min-width: 0; }
.quick-item-name { font-size: 13px; color: var(--me-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.quick-item-dossier { font-size: 11px; color: var(--me-text-muted); }

.priority-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.priority-urgent { background: #c97b7b; }
.priority-high { background: #e0af68; }
.priority-normal { background: #6391d6; }
.priority-low { background: #a0aec0; }

/* ─── RECENT LIST ─── */
.recent-list { display: flex; flex-direction: column; gap: 2px; }
.recent-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.recent-item:hover { background: var(--me-accent-glow); }
.recent-item-title { flex: 1; font-size: 13px; color: var(--me-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recent-tag { font-size: 10px; }
.recent-item-date { font-size: 11px; color: var(--me-text-muted); flex-shrink: 0; }

/* ─── STATS GRID ─── */
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.panel-card--full { grid-column: 1 / -1; }

.status-bars { display: flex; flex-direction: column; gap: 10px; }
.status-bar-row { }
.status-bar-head { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.status-bar-name { font-size: 12px; color: var(--me-text-secondary); flex: 1; }
.status-bar-count { font-size: 12px; color: var(--me-text-muted); }
.status-bar-track { height: 6px; background: var(--me-bg-elevated); border-radius: 3px; overflow: hidden; }
.status-bar-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }

.node-types { display: flex; flex-direction: column; gap: 6px; }
.node-type-row { display: flex; align-items: center; gap: 10px; padding: 3px 0; }
.node-type-icon { color: #6391d6; font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; }
.node-type-label { font-size: 12px; color: var(--me-text-secondary); flex: 1; }
.node-type-count { font-size: 12px; color: var(--me-text-muted); }

.donut-wrap { max-width: 240px; margin: 0 auto; }

/* ─── STREAKS ─── */
.streak-grid { display: flex; gap: 24px; justify-content: center; align-items: center; padding: 12px 0; flex-wrap: wrap; }
.streak-item { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.streak-label { font-size: 11px; color: var(--me-text-muted); }
.streak-value { font-size: 14px; font-weight: 700; color: var(--me-text-primary); }
.trend-badge {
  width: 48px; height: 48px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 18px;
}
.trend-badge--up { background: rgba(129, 178, 154, 0.15); color: #81b29a; }
.trend-badge--down { background: rgba(201, 123, 123, 0.15); color: #c97b7b; }

/* ─── ACTIVITY ─── */
.activity-layout { display: flex; flex-direction: column; gap: 16px; }
.activity-timeline { display: flex; flex-direction: column; gap: 0; max-height: 350px; overflow-y: auto; }
.timeline-item {
  display: flex;
  gap: 12px;
  padding: 10px 0;
  border-left: 2px solid var(--me-border);
  margin-left: 8px;
  padding-left: 16px;
  position: relative;
}
.timeline-dot {
  position: absolute;
  left: -5px;
  top: 14px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6391d6;
  border: 2px solid var(--me-bg-surface);
}
.timeline-content { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.timeline-head { display: flex; align-items: center; gap: 8px; }
.timeline-action { font-size: 13px; color: var(--me-text-primary); font-weight: 500; }
.timeline-time { font-size: 11px; color: var(--me-text-muted); }
.timeline-target { font-size: 12px; color: var(--me-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ─── STATUS DOTS ─── */
.status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.status-dot--active { background: #81b29a; box-shadow: 0 0 6px rgba(129, 178, 154, 0.5); }
.status-dot--warning { background: #6391d6; box-shadow: 0 0 6px rgba(99, 145, 214, 0.5); }
.status-dot--error { background: #c97b7b; box-shadow: 0 0 6px rgba(201, 123, 123, 0.5); }

/* ─── UTILITIES ─── */
.mono { font-family: var(--me-font-mono); }
.text-xs { font-size: 11px; }
.text-muted { color: var(--me-text-muted); }
.mr-2 { margin-right: 8px; }

/* ─── RESPONSIVE ─── */
@media (max-width: 1200px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .stats-grid { grid-template-columns: 1fr; }
  .overview-grid { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .sidebar { display: none; }
  .kpi-grid { grid-template-columns: 1fr; }
  .card-grid { grid-template-columns: 1fr; }
  .topbar-center { display: none; }
  .content { padding: 16px; }
}

/* ─── ANIMATIONS ─── */
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.fade-in { animation: fadeIn 0.35s ease forwards; }
</style>
