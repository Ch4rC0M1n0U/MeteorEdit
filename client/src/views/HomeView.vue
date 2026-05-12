<template>
  <div v-if="!dossierStore.currentDossier" class="home-page">
    <div class="home-header fade-in">
      <div class="home-header-text">
        <h1 class="home-title">{{ greeting }}</h1>
        <p class="home-subtitle">
          <span class="mono">{{ dateLabel }}</span>
          <span v-if="totalCount > 0" class="mono home-subtitle-sep">·</span>
          <span v-if="totalCount > 0" class="mono">{{ totalCount }} {{ totalCount > 1 ? 'dossiers' : 'dossier' }}</span>
        </p>
      </div>
      <div class="home-header-actions">
        <Button icon="pi pi-upload" :label="$t('home.import')" outlined size="small" @click="triggerImport" />
        <CreateDossierDialog />
      </div>
      <input ref="importInputRef" type="file" accept=".json" style="display: none;" @change="handleImport" />
    </div>

    <!-- KPI bandeau (v3.30) — résumé rapide juste sous le greeting -->
    <div v-if="totalCount > 0" class="home-kpis fade-in fade-in-delay-1">
      <div class="home-kpi">
        <span class="home-kpi-icon home-kpi-icon--open"><i class="pi pi-folder-open" /></span>
        <div class="home-kpi-text">
          <span class="home-kpi-label mono">{{ $t('home.kpis.open') }}</span>
          <span class="home-kpi-value mono">{{ openCount }}</span>
        </div>
      </div>
      <div class="home-kpi-sep" aria-hidden="true" />
      <div class="home-kpi">
        <span class="home-kpi-icon home-kpi-icon--progress"><i class="pi pi-spinner-dotted" /></span>
        <div class="home-kpi-text">
          <span class="home-kpi-label mono">{{ $t('home.kpis.inProgress') }}</span>
          <span class="home-kpi-value mono">{{ inProgressCount }}</span>
        </div>
      </div>
      <div class="home-kpi-sep" aria-hidden="true" />
      <div class="home-kpi">
        <span class="home-kpi-icon home-kpi-icon--closed"><i class="pi pi-check-circle" /></span>
        <div class="home-kpi-text">
          <span class="home-kpi-label mono">{{ $t('home.kpis.closedThisYear') }}</span>
          <span class="home-kpi-value mono">{{ closedThisYearCount }}</span>
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

function formatClosureDate(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString(locale.value);
}

onMounted(() => {
  dossierStore.fetchDossiers(true);
  dossierStore.fetchFavorites();

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
.home-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 28px 32px 40px;
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
  font-size: 24px;
  font-weight: 700;
  color: var(--me-text-primary);
  letter-spacing: -0.5px;
  line-height: 1.2;
  margin: 0;
}
.home-subtitle {
  font-size: 13px;
  color: var(--me-text-muted);
  margin: 4px 0 0;
}
.home-subtitle-sep {
  margin: 0 6px;
  opacity: 0.5;
}

/* KPI bandeau (v3.30) — 3 stats horizontales sous le greeting */
.home-kpis {
  display: flex;
  align-items: stretch;
  gap: 0;
  margin-bottom: 24px;
  padding: 14px 20px;
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius);
  box-shadow: var(--me-shadow-sm);
}
.home-kpi {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.home-kpi-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}
.home-kpi-icon--open {
  background: rgba(var(--me-accent-rgb), 0.12);
  color: var(--me-accent);
}
.home-kpi-icon--progress {
  background: rgba(251, 191, 36, 0.12);
  color: var(--me-warning);
}
.home-kpi-icon--closed {
  background: rgba(52, 211, 153, 0.12);
  color: var(--me-success);
}
.home-kpi-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  min-width: 0;
}
.home-kpi-label {
  font-size: 11px;
  color: var(--me-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.home-kpi-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--me-text-primary);
  margin-top: 2px;
}
.home-kpi-sep {
  width: 1px;
  background: var(--me-border);
  margin: 4px 18px;
  align-self: stretch;
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
  color: var(--me-text-muted);
  margin-bottom: 12px;
  display: block;
}
.home-empty h3 {
  color: var(--me-text-primary);
  margin-bottom: 8px;
}
.text-muted {
  color: var(--me-text-muted);
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
