<!--
  HomeView.vue — Tableau de bord MeteorEdit v3
  ============================================================
  Layout : header + KPI strip (4 cards) + 2 colonnes (dossiers récents 1fr | sidebar widgets 320 px)
  Wiring : dossierStore, authStore, brandingStore, messagingStore (notifs)
  Topbar  : <AppTopbar> est rendu par App.vue ; les actions contextuelles
            (Importer / Nouveau dossier) sont injectées via Teleport vers
            <slot name="actions"> (id="topbar-actions" pour compat legacy).
  ============================================================
-->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useDossierStore } from '@/stores/dossier';
import Button from 'primevue/button';
import KpiCard from '@/components/shared/KpiCard.vue';
import SectionHeader from '@/components/shared/SectionHeader.vue';
import TaskList, { type Task } from '@/components/shared/TaskList.vue';
import ActivityTimeline, { type ActivityItem } from '@/components/shared/ActivityTimeline.vue';
import DossierCard, { type DossierLike } from '@/components/dossier/DossierCard.vue';
import CreateDossierDialog from '@/components/dossier/CreateDossierDialog.vue';

const { t, locale } = useI18n();
const router = useRouter();
const auth = useAuthStore();
const dossiers = useDossierStore();

const activeTab = ref<'mine' | 'team' | 'all'>('mine');

const tabs = computed(() => [
  { label: t('home.tabs.mine'), value: 'mine' },
  { label: t('home.tabs.team'), value: 'team' },
  { label: t('home.tabs.all'),  value: 'all' },
]);

const greeting = computed(() => {
  const name = auth.user?.firstName || auth.user?.name?.split(' ')[0] || '';
  return name ? t('home.greetingNamed', { name }) : t('home.greeting');
});

const dateLabel = computed(() => {
  const now = new Date();
  const date = new Intl.DateTimeFormat(locale.value, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(now);
  // Numéro de semaine ISO
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date} · ${t('home.weekShort')} ${week}`;
});

// KPIs — branchés sur dossierStore
const openCount       = computed(() => dossiers.openCount ?? 0);
const inProgressCount = computed(() => dossiers.inProgressCount ?? 0);
const tasksTodayCount = computed(() => dossiers.tasksTodayCount ?? 0);
const closedThisYear  = computed(() => dossiers.closedThisYearCount ?? 0);

const recentDossiers = computed<DossierLike[]>(() => {
  // Mapping selon onglet — à brancher sur dossierStore.list quand prêt
  if (activeTab.value === 'mine')  return dossiers.recentMine ?? [];
  if (activeTab.value === 'team')  return dossiers.recentTeam ?? [];
  return dossiers.recentAll ?? [];
});

// Tâches & activité — TODO brancher sur stores réels (placeholders)
const tasks = computed<Task[]>(() => dossiers.tasksToday ?? []);
const activity = computed<ActivityItem[]>(() => dossiers.teamActivity ?? []);

const importInputRef = ref<HTMLInputElement | null>(null);
function triggerImport() { importInputRef.value?.click(); }
function handleImport(e: Event) {
  // Conserve la logique d'import legacy — déléguer à dossierStore.importJson
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) dossiers.importJson?.(file);
}

function openDossier(id: string) {
  // MeteorEdit n'utilise PAS de route /dossiers/:id — l'ouverture se fait via
  // le store (currentDossier ref), et HomeView affiche <DossierView v-else /> conditionnellement.
  dossiers.openDossier(id);
}

onMounted(() => {
  dossiers.fetchDashboard?.();
});
</script>

<template>
  <div class="dashboard home-page">
    <!-- Actions contextuelles téléportées vers la topbar (compat legacy : id="topbar-actions") -->
    <Teleport to="#topbar-actions" defer>
      <Button
        icon="pi pi-upload"
        :label="t('home.import')"
        outlined
        size="small"
        class="topbar-action-btn"
        @click="triggerImport"
      />
      <CreateDossierDialog />
    </Teleport>
    <input ref="importInputRef" type="file" accept=".json" style="display:none" @change="handleImport" />

    <!-- ============================================================
         HEADER — salutation + date + actions (filtres / personnaliser)
         ============================================================ -->
    <div class="dashboard__head">
      <div>
        <h1 class="dashboard__greet">{{ greeting }}</h1>
        <p class="dashboard__date">{{ dateLabel }}</p>
      </div>
      <div class="dashboard__actions">
        <Button
          icon="pi pi-filter"
          :label="t('home.filters')"
          outlined size="small"
        />
        <Button
          icon="pi pi-sliders-h"
          :label="t('home.customize')"
          outlined size="small"
        />
      </div>
    </div>

    <!-- ============================================================
         KPI STRIP — 4 cards
         "Dossiers actifs" / "En cours" / "Tâches aujourd'hui" / "Clôturés cette année"
         (remplace "Entités suivies" + "Captures OSINT" demandés au brief v3 → v3.35)
         ============================================================ -->
    <div class="kpi-grid home-kpis">
      <KpiCard
        icon="pi-folder-open"
        category="open"
        :label="t('home.kpis.active')"
        :value="openCount + inProgressCount"
        :trend="t('home.kpis.activeTrend', { open: openCount, progress: inProgressCount })"
        trendKind="neutral"
      />
      <KpiCard
        icon="pi-spinner-dotted"
        category="progress"
        :label="t('home.kpis.inProgress')"
        :value="inProgressCount"
        :trend="t('home.kpis.inProgressTrend')"
        trendKind="up"
      />
      <KpiCard
        icon="pi-check-square"
        category="tasks"
        :label="t('home.kpis.tasksToday')"
        :value="tasksTodayCount"
        :trend="t('home.kpis.tasksTodayTrend')"
        trendKind="warn"
      />
      <KpiCard
        icon="pi-check-circle"
        category="closed"
        :label="t('home.kpis.closedThisYear')"
        :value="closedThisYear"
        :trend="t('home.kpis.closedThisYearTrend', { year: new Date().getFullYear() })"
        trendKind="neutral"
      />
    </div>

    <!-- ============================================================
         LAYOUT 2 COLONNES — dossiers (1fr) + widgets (320 px)
         ============================================================ -->
    <div class="dash-cols">
      <!-- MAIN — Dossiers récents -->
      <section class="dash-main">
        <SectionHeader
          :title="t('home.recentDossiers')"
          :hint="recentDossiers.length ? String(recentDossiers.length) : undefined"
          :tabs="tabs"
          v-model="activeTab"
        />
        <div v-if="recentDossiers.length" class="dossier-grid">
          <DossierCard
            v-for="d in recentDossiers"
            :key="d._id"
            :dossier="d"
            @open="openDossier"
          />
        </div>
        <div v-else class="dossier-grid__empty">
          <i class="pi pi-folder-open" />
          <h3>{{ t('home.noDossiers') }}</h3>
          <p>{{ t('home.noDossiersHint') }}</p>
        </div>
      </section>

      <!-- ASIDE — Widgets (tâches + activité) -->
      <aside class="dash-aside">
        <section>
          <SectionHeader
            :title="t('home.todayTasks')"
            :hint="tasks.length ? String(tasks.length) : undefined"
          />
          <TaskList :tasks="tasks" @toggle="(id) => dossiers.toggleTask?.(id)" />
        </section>

        <section>
          <SectionHeader :title="t('home.teamActivity')" />
          <ActivityTimeline :items="activity" />
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* ============================================================
   DASHBOARD CONTAINER
   ============================================================ */
.dashboard {
  overflow-y: auto;
  padding: 28px 32px 48px;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font);
}

/* ============================================================
   HEADER
   ============================================================ */
.dashboard__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 22px;
  gap: 16px;
}
.dashboard__greet {
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.018em;
  margin: 0 0 4px;
  color: var(--ink);
  text-wrap: pretty;
}
.dashboard__date {
  font-size: 12px;
  color: var(--ink-3);
  letter-spacing: 0.04em;
  margin: 0;
  text-transform: capitalize;
}
.dashboard__actions { display: flex; gap: 8px; flex-shrink: 0; }
.dashboard__actions :deep(.p-button) {
  height: 30px;
  font-size: 12px;
  padding: 0 12px;
  background: var(--surface) !important;
  border: 1px solid var(--line) !important;
  color: var(--ink-2) !important;
  border-radius: var(--r-md);
}
.dashboard__actions :deep(.p-button:hover) {
  background: var(--bg) !important;
  border-color: var(--line-2) !important;
  color: var(--ink) !important;
}
.dashboard__actions :deep(.p-button-icon) { font-size: 13px; color: var(--ink-3); }

/* ============================================================
   KPI STRIP
   ============================================================ */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 28px;
}
@media (max-width: 1100px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }

/* ============================================================
   2-COLONNES — main + aside 320 px
   ============================================================ */
.dash-cols {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 24px;
  align-items: start;
}
@media (max-width: 1280px) {
  .dash-cols { grid-template-columns: 1fr; }
}

.dash-main { min-width: 0; }
.dash-aside {
  display: flex;
  flex-direction: column;
  gap: 24px;
  position: sticky;
  top: 0;
}

/* ============================================================
   GRILLE DOSSIERS — auto-fill min 280 px
   ============================================================ */
.dossier-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.dossier-grid__empty {
  background: var(--surface);
  border: 1px dashed var(--line-2);
  border-radius: var(--r-lg);
  padding: 48px 24px;
  text-align: center;
  color: var(--ink-3);
}
.dossier-grid__empty .pi {
  font-size: 28px;
  color: var(--ink-4);
  margin-bottom: 12px;
}
.dossier-grid__empty h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 4px;
}
.dossier-grid__empty p { font-size: 12.5px; margin: 0; }

/* ============================================================
   DARK MODE
   ============================================================ */
[data-theme="dark"] .dashboard { background: var(--bg); }
[data-theme="dark"] .dashboard__actions :deep(.p-button) {
  background: var(--surface) !important;
  border-color: var(--line) !important;
}
</style>
