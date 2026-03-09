<template>
  <div v-if="!dossierStore.currentDossier" class="home-page">
    <div class="home-header fade-in">
      <div>
        <h1 class="home-title mono">Mes dossiers</h1>
        <p class="home-subtitle">{{ dossierStore.dossiers.length }} dossier{{ dossierStore.dossiers.length > 1 ? 's' : '' }}</p>
      </div>
      <CreateDossierDialog />
    </div>

    <v-progress-linear v-if="dossierStore.loading" indeterminate color="primary" class="mb-4" style="border-radius: 4px;" />

    <div v-if="dossierStore.dossiers.length" class="dossier-grid">
      <DossierCard
        v-for="(dossier, i) in dossierStore.dossiers"
        :key="dossier._id"
        :dossier="dossier"
        :class="['fade-in', `fade-in-delay-${Math.min(i + 1, 4)}`]"
        @open="handleOpen"
        @delete="handleDelete"
      />
    </div>

    <div v-else-if="!dossierStore.loading" class="home-empty fade-in">
      <v-icon size="48" color="primary" class="mb-4">mdi-folder-open-outline</v-icon>
      <h3 class="mono">Aucun dossier</h3>
      <p class="text-muted">Creez votre premier dossier pour commencer.</p>
    </div>

    <UserDashboard @open-dossier="handleOpen" />
  </div>

  <DossierView v-else />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useDossierStore } from '../stores/dossier';
import { useConfirm } from '../composables/useConfirm';
import DossierCard from '../components/dossier/DossierCard.vue';
import CreateDossierDialog from '../components/dossier/CreateDossierDialog.vue';
import DossierView from '../components/dossier/DossierView.vue';
import UserDashboard from '../components/dashboard/UserDashboard.vue';

const dossierStore = useDossierStore();
const { confirm } = useConfirm();

onMounted(() => {
  dossierStore.fetchDossiers();
});

function handleOpen(id: string) {
  dossierStore.openDossier(id);
}

async function handleDelete(id: string) {
  const ok = await confirm({
    title: 'Supprimer le dossier',
    message: 'Supprimer ce dossier et tout son contenu ? Cette action est irreversible.',
    confirmText: 'Supprimer',
    variant: 'danger',
  });
  if (ok) dossierStore.deleteDossier(id);
}
</script>

<style scoped>
.home-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
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
.text-muted {
  color: var(--me-text-muted);
  font-size: 14px;
}
</style>
