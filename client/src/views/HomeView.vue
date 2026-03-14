<template>
  <div v-if="!dossierStore.currentDossier" class="home-page">
    <div class="home-header fade-in">
      <div>
        <h1 class="home-title mono">{{ $t('home.myDossiers') }}</h1>
        <p class="home-subtitle">{{ $t('home.dossierCount', { count: dossierStore.dossiers.length }) }}</p>
      </div>
      <div class="home-header-actions">
        <button class="home-import-btn" @click="triggerImport" :title="$t('home.importJson')">
          <v-icon size="16" class="mr-1">mdi-upload-outline</v-icon>
          <span class="mono">{{ $t('home.import') }}</span>
        </button>
        <CreateDossierDialog />
      </div>
      <input ref="importInputRef" type="file" accept=".json" style="display: none;" @change="handleImport" />
    </div>

    <v-progress-linear v-if="dossierStore.loading" indeterminate color="primary" class="mb-4" style="border-radius: 4px;" />

    <div v-if="favoriteDossiers.length" class="favorites-section fade-in">
      <h2 class="section-title mono"><v-icon size="18" class="mr-1">mdi-star</v-icon> {{ $t('home.favorites') }}</h2>
      <div class="dossier-grid">
        <DossierCard
          v-for="dossier in favoriteDossiers"
          :key="'fav-' + dossier._id"
          :dossier="dossier"
          :is-fav="true"
          @open="handleOpen"
          @delete="handleDelete"
          @toggle-favorite="handleToggleFavorite"
        />
      </div>
    </div>

    <div v-if="dossierStore.dossiers.length" class="dossier-grid">
      <DossierCard
        v-for="(dossier, i) in dossierStore.dossiers"
        :key="dossier._id"
        :dossier="dossier"
        :is-fav="dossierStore.isFavorite(dossier._id)"
        :class="['fade-in', `fade-in-delay-${Math.min(i + 1, 4)}`]"
        @open="handleOpen"
        @delete="handleDelete"
        @toggle-favorite="handleToggleFavorite"
      />
    </div>

    <div ref="sentinelRef" style="height: 1px;" />
    <v-progress-linear v-if="dossierStore.loading && dossierStore.dossiers.length > 0" indeterminate color="primary" class="mt-2" style="border-radius: 4px;" />

    <div v-if="!dossierStore.dossiers.length && !dossierStore.loading" class="home-empty fade-in">
      <v-icon size="48" color="primary" class="mb-4">mdi-folder-open-outline</v-icon>
      <h3 class="mono">{{ $t('home.noDossiers') }}</h3>
      <p class="text-muted">{{ $t('home.noDossiersHint') }}</p>
    </div>

    <UserDashboard @open-dossier="handleOpen" />
  </div>

  <DossierView v-else />
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDossierStore } from '../stores/dossier';
import { useConfirm } from '../composables/useConfirm';
import api from '../services/api';
import DossierCard from '../components/dossier/DossierCard.vue';
import CreateDossierDialog from '../components/dossier/CreateDossierDialog.vue';
import DossierView from '../components/dossier/DossierView.vue';
import UserDashboard from '../components/dashboard/UserDashboard.vue';

const { t } = useI18n();
const dossierStore = useDossierStore();
const { confirm } = useConfirm();
const importInputRef = ref<HTMLInputElement | null>(null);
const sentinelRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

const favoriteDossiers = computed(() =>
  dossierStore.dossiers.filter(d => dossierStore.isFavorite(d._id))
);

onMounted(() => {
  dossierStore.fetchDossiers(true);
  dossierStore.fetchFavorites();

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && dossierStore.hasMoreDossiers && !dossierStore.loading) {
        dossierStore.fetchDossiers();
      }
    },
    { threshold: 0.1 }
  );
  if (sentinelRef.value) observer.observe(sentinelRef.value);
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
  max-width: 1800px;
  margin: 0 auto;
  padding: 32px 48px;
}
.home-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 32px;
}
.home-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.home-subtitle {
  font-size: 13px;
  color: var(--me-text-muted);
  margin-top: 4px;
  font-family: var(--me-font-mono);
}
.favorites-section {
  margin-bottom: 32px;
}
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--me-text-primary);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}
.dossier-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
.home-empty {
  text-align: center;
  padding: 80px 20px;
}
.home-empty h3 {
  color: var(--me-text-primary);
  margin-bottom: 8px;
}
.home-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.home-import-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border-radius: 8px;
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.home-import-btn:hover {
  border-color: var(--me-accent);
  color: var(--me-accent);
  background: var(--me-accent-glow);
}
.text-muted {
  color: var(--me-text-muted);
  font-size: 14px;
}
</style>
