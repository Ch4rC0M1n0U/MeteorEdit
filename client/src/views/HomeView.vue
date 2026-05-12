<template>
  <div v-if="!dossierStore.currentDossier" class="home-page">
    <!-- v3.35 — Actions Importer + Nouveau dossier téléportées dans la topbar -->
    <Teleport v-if="topbarReady" to="#topbar-actions">
      <Button icon="pi pi-upload" :label="$t('home.import')" outlined size="small" class="topbar-action-btn" @click="triggerImport" />
      <CreateDossierDialog />
    </Teleport>

    <div class="home-header fade-in">
      <div class="home-header-text">
        <h1 class="home-title">{{ greeting }}</h1>
        <p class="home-subtitle">
          <span>{{ dateLabel }}</span>
          <span v-if="totalCount > 0" class="home-subtitle-sep">·</span>
          <span v-if="totalCount > 0">{{ totalCount }} {{ totalCount > 1 ? 'dossiers' : 'dossier' }}</span>
        </p>
      </div>
      <input ref="importInputRef" type="file" accept=".json" style="display: none;" @change="handleImport" />
    </div>

    <!-- v3.35 — KPI strip 4 cards alignées sur le brief (markup card-style indépendant) -->
    <div v-if="totalCount > 0" class="home-kpis fade-in fade-in-delay-1">
      <div class="home-kpi">
        <span class="home-kpi-icon home-kpi-icon--open"><i class="pi pi-folder-open" /></span>
        <div class="home-kpi-text">
          <span class="home-kpi-label">{{ $t('home.kpis.active') }}</span>
          <span class="home-kpi-value num">{{ openCount + inProgressCount }}</span>
          <span class="home-kpi-trend">{{ $t('home.kpis.activeTrend', { open: openCount, progress: inProgressCount }) }}</span>
        </div>
      </div>
      <div class="home-kpi">
        <span class="home-kpi-icon home-kpi-icon--progress"><i class="pi pi-spinner-dotted" /></span>
        <div class="home-kpi-text">
          <span class="home-kpi-label">{{ $t('home.kpis.inProgress') }}</span>
          <span class="home-kpi-value num">{{ inProgressCount }}</span>
          <span class="home-kpi-trend">{{ $t('home.kpis.inProgressTrend') }}</span>
        </div>
      </div>
      <div class="home-kpi">
        <span class="home-kpi-icon home-kpi-icon--tasks"><i class="pi pi-check-square" /></span>
        <div class="home-kpi-text">
          <span class="home-kpi-label">{{ $t('home.kpis.tasksToday') }}</span>
          <span class="home-kpi-value num">{{ tasksTodayCount }}</span>
          <span class="home-kpi-trend">{{ $t('home.kpis.tasksTodayTrend') }}</span>
        </div>
      </div>
      <div class="home-kpi">
        <span class="home-kpi-icon home-kpi-icon--closed"><i class="pi pi-check-circle" /></span>
        <div class="home-kpi-text">
          <span class="home-kpi-label">{{ $t('home.kpis.closedThisYear') }}</span>
          <span class="home-kpi-value num">{{ closedThisYearCount }}</span>
          <span class="home-kpi-trend">{{ $t('home.kpis.closedThisYearTrend', { year: new Date().getFullYear() }) }}</span>
        </div>
      </div>
    </div>

    <ProgressBar v-if="dossierStore.loading" mode="indeterminate" class="mb-4 section-loader" />

    <!-- Tabbed dossier list -->
    <SelectButton v-model="activeTab" :options="tabOptions" optionLabel="label" optionValue="value" class="home-seg mb-4" />

    <!-- Tab: Favorites -->
    <div v-if="activeTab === 'favorites'" class="dossier-grid">
      <template v-if="favoriteDossiers.length">
        <DossierCard
          v-for="dossier in favoriteDossiers"
          :key="'fav-' + dossier._id"
          :dossier="dossier"
          :is-fav="true"
          @open="handleOpen"
          @delete="handleDelete"
          @toggle-favorite="handleToggleFavorite"
        />
      </template>
      <div v-else class="home-empty fade-in">
        <i class="pi pi-star empty-icon" />
        <h3>{{ $t('home.tabs.noFavorites') }}</h3>
        <p class="text-muted">{{ $t('home.tabs.noFavoritesHint') }}</p>
      </div>
    </div>

    <!-- Tab: Active -->
    <div v-else-if="activeTab === 'active'" class="dossier-grid">
      <template v-if="activeDossiers.length">
        <DossierCard
          v-for="(dossier, i) in activeDossiers"
          :key="dossier._id"
          :dossier="dossier"
          :is-fav="dossierStore.isFavorite(dossier._id)"
          :class="['fade-in', `fade-in-delay-${Math.min(i + 1, 4)}`]"
          @open="handleOpen"
          @delete="handleDelete"
          @toggle-favorite="handleToggleFavorite"
        />
      </template>
      <div v-else class="home-empty fade-in">
        <i class="pi pi-folder-open empty-icon" />
        <h3>{{ $t('home.noDossiers') }}</h3>
        <p class="text-muted">{{ $t('home.noDossiersHint') }}</p>
      </div>
    </div>

    <!-- Tab: Closed -->
    <div v-else class="dossier-grid dossier-grid--compact">
      <template v-if="closedDossiers.length">
        <div
          v-for="dossier in closedDossiers"
          :key="'closed-' + dossier._id"
          class="closed-card glass-card"
          @click="handleOpen(dossier._id)"
        >
          <div class="closed-card-header">
            <span class="closed-card-date mono">{{ formatClosureDate(dossier.closureDate) }}</span>
          </div>
          <h4 class="closed-card-title">{{ dossier.title }}</h4>
        </div>
      </template>
      <div v-else class="home-empty fade-in">
        <i class="pi pi-inbox empty-icon" />
        <h3>{{ $t('home.tabs.noClosed') }}</h3>
      </div>
    </div>

    <div ref="sentinelRef" style="height: 1px;" />
    <ProgressBar v-if="dossierStore.loading && dossierStore.dossiers.length > 0" mode="indeterminate" class="mt-2 section-loader" />

    <UserDashboard @open-dossier="handleOpen" />
  </div>

  <DossierView v-else />
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import ProgressBar from 'primevue/progressbar';
import SelectButton from 'primevue/selectbutton';
import Tag from 'primevue/tag';
import { useDossierStore } from '../stores/dossier';
import { useAuthStore } from '../stores/auth';
import { useConfirm } from '../composables/useConfirm';
import api from '../services/api';
import DossierCard from '../components/dossier/DossierCard.vue';
import CreateDossierDialog from '../components/dossier/CreateDossierDialog.vue';
import DossierView from '../components/dossier/DossierView.vue';
import UserDashboard from '../components/dashboard/UserDashboard.vue';

const { t, locale } = useI18n();
const dossierStore = useDossierStore();
const authStore = useAuthStore();

// "Bonjour {firstName}." — falls back to a neutral title when the user
// has no firstName yet (e.g. just after registration before profile setup).
const greeting = computed(() => {
  const name = authStore.user?.firstName?.trim();
  return name ? t('home.greetingName', { name }) : t('home.greetingNeutral');
});

// "lundi 11 mai 2026 · Semaine 19" — full localized date + ISO week number.
const dateLabel = computed(() => {
  const now = new Date();
  const dateStr = now.toLocaleDateString(locale.value, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  return t('home.todayWithWeek', { date: dateStr, week: getIsoWeek(now) });
});

// ISO 8601 week number — week containing the year's first Thursday is week 1.
// Matches Belgian/French convention used by police case management.
function getIsoWeek(d: Date): number {
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(((diff / 86400000) - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}
const { confirm } = useConfirm();
const importInputRef = ref<HTMLInputElement | null>(null);
const sentinelRef = ref<HTMLElement | null>(null);
const activeTab = ref('active');
let observer: IntersectionObserver | null = null;

const tabOptions = computed(() => [
  { label: t('home.tabs.favorites'), value: 'favorites' },
  { label: t('home.tabs.active'), value: 'active' },
  { label: t('home.tabs.closed'), value: 'closed' },
]);

const totalCount = computed(() => dossierStore.dossiers.length);

const favoriteDossiers = computed(() =>
  dossierStore.dossiers.filter(d => dossierStore.isFavorite(d._id))
);

const activeDossiers = computed(() =>
  dossierStore.dossiers.filter(d => d.status === 'open' || d.status === 'in_progress')
);

const closedDossiers = computed(() =>
  dossierStore.dossiers.filter(d => d.status === 'closed')
);

// KPI bandeau (v3.30) — 3 chiffres rapides au-dessus des onglets, mirroir du visuel
// `03-home-light.png`. Comptés client-side sur la liste déjà chargée.
const openCount = computed(() => dossierStore.dossiers.filter(d => d.status === 'open').length);
const inProgressCount = computed(() => dossierStore.dossiers.filter(d => d.status === 'in_progress').length);
const closedThisYearCount = computed(() => {
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
  return dossierStore.dossiers.filter((d) => {
    if (d.status !== 'closed') return false;
    const ref = d.closureDate ?? d.updatedAt;
    return ref ? new Date(ref).getTime() >= yearStart : false;
  }).length;
});

// v3.35 — Tâches prévues aujourd'hui (agrégé multi-dossier via endpoint serveur)
const tasksTodayCount = ref(0);
async function fetchTasksToday() {
  try {
    const { data } = await api.get('/tasks/today/count');
    tasksTodayCount.value = data.count || 0;
  } catch {
    tasksTodayCount.value = 0;
  }
}

// v3.35 — Délai pour que le Teleport target #topbar-actions soit monté
const topbarReady = ref(false);

function formatClosureDate(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString(locale.value);
}

onMounted(() => {
  dossierStore.fetchDossiers(true);
  dossierStore.fetchFavorites();
  fetchTasksToday();
  // v3.35 — Active le Teleport après le 1er tick (la topbar est garantie montée)
  setTimeout(() => { topbarReady.value = true; }, 0);

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && dossierStore.hasMoreDossiers && !dossierStore.loading) {
        dossierStore.fetchDossiers();
      }
    },
    { threshold: 0.1 }
  );
  if (sentinelRef.value) observer.observe(sentinelRef.value as Element);
});

onBeforeUnmount(() => {
  observer?.disconnect();
});

function handleOpen(id: string) {
  dossierStore.openDossier(id);
}

function handleToggleFavorite(id: string) {
  dossierStore.toggleFavorite(id);
}

function triggerImport() {
  importInputRef.value?.click();
}

async function handleImport(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.dossier?.title) {
      await confirm({ title: t('home.invalidImport'), message: t('home.invalidImportMsg'), confirmText: t('common.ok'), cancelText: '' });
      return;
    }
    const { data: newDossier } = await api.post('/dossiers/import/json', data);
    await dossierStore.fetchDossiers(true);
    dossierStore.openDossier(newDossier._id);
  } catch (err) {
    console.error('Import failed:', err);
    await confirm({ title: t('common.error'), message: t('home.importError'), confirmText: t('common.ok'), cancelText: '', variant: 'danger' });
  }
}

async function handleDelete(id: string) {
  const ok = await confirm({
    title: t('home.deleteDossier'),
    message: t('home.deleteDossierConfirm'),
    confirmText: t('common.delete'),
    variant: 'danger',
  });
  if (ok) dossierStore.deleteDossier(id);
}
</script>

<style scoped>
/* ─── v3.33 — Tokens locaux scopés à HomeView (light + dark warm) ─── */
.home-page {
  --v3-bg: var(--me-bg-deep);
  --v3-bg-2: var(--me-bg-surface);
  --v3-bg-3: var(--me-bg-elevated);
  --v3-ink: var(--me-text-primary);
  --v3-ink-2: var(--me-text-secondary);
  --v3-ink-3: var(--me-text-muted);
  --v3-line: var(--me-border);
  --v3-accent: var(--me-accent);
  --v3-grid: rgba(99, 145, 214, 0.10);
}
:global([data-theme='light']) .home-page {
  --v3-bg: #FAFAF7;
  --v3-bg-2: #FFFFFF;
  --v3-bg-3: #F5F4EF;
  --v3-ink: #1C1B18;
  --v3-ink-2: #45433D;
  --v3-ink-3: #6F6C63;
  --v3-line: #E7E5DD;
  --v3-accent: #2E4FA8;
  --v3-grid: rgba(46, 79, 168, 0.10);
}

.home-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 28px 32px 40px;
  min-height: 100%;
}

/* v3.33 — bg cream warm appliqué au parent .main-content uniquement quand HomeView est monté */
:global(.main-content):has(.home-page) {
  background: var(--v3-bg);
}
.home-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.home-header-text { min-width: 0; }
.home-title {
  /* v3 tweak : titre institutionnel, poids 650, tracking serré */
  font-size: 26px;
  font-weight: 650;
  color: var(--v3-ink);
  letter-spacing: -0.8px;
  line-height: 1.15;
  margin: 0;
}
.home-subtitle {
  font-size: 13px;
  color: var(--v3-ink-3);
  margin: 4px 0 0;
}
.home-subtitle-sep {
  margin: 0 6px;
  opacity: 0.5;
}

/* v3.35 — KPI strip : 4 cards horizontales (grid responsive) */
.home-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 28px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
}
@media (max-width: 1100px) {
  .home-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 600px) {
  .home-kpis { grid-template-columns: 1fr; }
}
.home-kpi {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
  padding: 16px 20px;
  background: var(--v3-bg-2);
  border: 1px solid var(--v3-line);
  border-radius: 7px;
  box-shadow: 0 1px 0 rgba(28, 27, 24, 0.03), 0 1px 2px rgba(28, 27, 24, 0.02);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.home-kpi:hover {
  border-color: var(--v3-accent);
  box-shadow: 0 1px 0 rgba(28, 27, 24, 0.04), 0 4px 12px rgba(46, 79, 168, 0.08);
}
.home-kpi-icon {
  /* v3 tweak : icône plus carrée, radius discret */
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}
.home-kpi-icon--open {
  background: rgba(46, 79, 168, 0.10);
  color: var(--v3-accent);
}
.home-kpi-icon--progress {
  background: rgba(176, 122, 31, 0.12);
  color: #B07A1F;
}
.home-kpi-icon--tasks {
  background: rgba(122, 92, 143, 0.12);
  color: #7A5C8F;
}
.home-kpi-icon--closed {
  background: rgba(91, 133, 80, 0.12);
  color: #5B8550;
}
.home-kpi-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  min-width: 0;
  flex: 1;
}
.home-kpi-label {
  font-size: 11px;
  color: var(--v3-ink-3);
  letter-spacing: 0.04em;
  font-weight: 600;
}
.home-kpi-value {
  /* v3 tweak : chiffre KPI imposant, encre noire, tracking serré */
  font-size: 28px;
  font-weight: 650;
  color: var(--v3-ink);
  margin-top: 4px;
  letter-spacing: -0.7px;
  line-height: 1;
}
.home-kpi-trend {
  margin-top: 6px;
  font-size: 11px;
  color: var(--v3-ink-3);
  letter-spacing: 0.02em;
  line-height: 1.4;
}
.home-kpi-sep {
  /* Séparateur supprimé (cards séparées maintenant) */
  display: none;
}
@media (max-width: 720px) {
  .home-kpis { flex-direction: column; padding: 12px 16px; }
  .home-kpi-sep { width: auto; height: 1px; margin: 8px 0; }
}
.home-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.home-seg { margin-bottom: 20px; }
.dossier-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
.dossier-grid--compact {
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}
.home-empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
}
.empty-icon {
  font-size: 40px;
  color: var(--v3-ink-3);
  margin-bottom: 12px;
  display: block;
}
.home-empty h3 {
  color: var(--v3-ink);
  margin-bottom: 8px;
  font-weight: 650;
  letter-spacing: -0.3px;
}
.text-muted {
  color: var(--v3-ink-3);
  font-size: 14px;
}
.section-loader { border-radius: 4px; }
.mb-4 { margin-bottom: 16px; }
.mt-2 { margin-top: 8px; }

/* Compact closed cards */
.closed-card {
  padding: 14px 16px;
  cursor: pointer;
  transition: all var(--me-dur) var(--me-ease);
  opacity: 0.75;
}
.closed-card:hover {
  opacity: 1;
  transform: translateY(-1px);
  border-color: var(--me-border-hover);
}
.closed-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.closed-card-ref { font-size: 10px; }
.closed-card-date {
  font-size: 11px;
  color: var(--me-text-muted);
}
.closed-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--me-text-secondary);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
