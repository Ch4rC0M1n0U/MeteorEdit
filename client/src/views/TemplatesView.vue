<template>
  <div class="templates-page">
    <div class="templates-header fade-in">
      <div>
        <h1 class="templates-title mono">Mes modeles</h1>
        <p class="templates-subtitle">{{ templateStore.templates.length }} modele{{ templateStore.templates.length > 1 ? 's' : '' }}</p>
      </div>
    </div>

    <ProgressBar v-if="templateStore.loading" mode="indeterminate" style="height: 4px; border-radius: 4px; margin-bottom: 16px;" />

    <div v-if="templateStore.templates.length" class="templates-grid">
      <div
        v-for="tpl in templateStore.templates"
        :key="tpl._id"
        class="tpl-card glass-card"
      >
        <div class="tpl-card-header">
          <span class="mdi mdi-file-document-check-outline" style="font-size: 20px; color: var(--me-accent); margin-right: 8px;"></span>
          <span class="tpl-card-title">{{ tpl.title }}</span>
          <div class="tpl-card-actions">
            <button class="tpl-action-btn" @click="openEdit(tpl)" title="Modifier">
              <i class="pi pi-pencil" style="font-size: 16px;"></i>
            </button>
            <button class="tpl-action-btn tpl-action-danger" @click="handleDelete(tpl._id)" title="Supprimer">
              <i class="pi pi-trash" style="font-size: 16px;"></i>
            </button>
          </div>
        </div>
        <p v-if="tpl.description" class="tpl-card-desc">{{ tpl.description }}</p>
        <div class="tpl-card-meta mono">
          {{ formatDate(tpl.updatedAt) }}
        </div>
      </div>
    </div>

    <div v-else-if="!templateStore.loading" class="templates-empty fade-in">
      <span class="mdi mdi-file-document-check-outline" style="font-size: 48px; color: var(--me-accent); margin-bottom: 16px;"></span>
      <h3 class="mono">Aucun modele</h3>
      <p class="text-muted">Sauvegardez une note comme modele depuis l'editeur pour commencer.</p>
    </div>

  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ProgressBar from 'primevue/progressbar';
import { useTemplateStore } from '../stores/template';
import { useConfirm } from '../composables/useConfirm';
import type { NoteTemplate } from '../types';

const router = useRouter();
const templateStore = useTemplateStore();
const { confirm } = useConfirm();

onMounted(() => {
  templateStore.fetchTemplates();
});

function openEdit(tpl: NoteTemplate) {
  router.push(`/templates/${tpl._id}/edit`);
}

async function handleDelete(id: string) {
  const ok = await confirm({
    title: 'Supprimer le modele',
    message: 'Supprimer ce modele ? Cette action est irreversible.',
    confirmText: 'Supprimer',
    variant: 'danger',
  });
  if (ok) await templateStore.deleteTemplate(id);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
</script>

<style scoped>
.templates-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 32px 24px;
}
.templates-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 32px;
}
.templates-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.templates-subtitle {
  font-size: 13px;
  color: var(--me-text-muted);
  margin-top: 4px;
  font-family: var(--me-font-mono);
}
.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.tpl-card {
  padding: 16px 20px;
}
.tpl-card-header {
  display: flex;
  align-items: center;
}
.tpl-card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--me-text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tpl-card-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  margin-left: 8px;
}
.tpl-action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}
.tpl-action-btn:hover {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.tpl-action-danger:hover {
  background: rgba(248, 113, 113, 0.1);
  color: var(--me-error);
}
.tpl-card-desc {
  font-size: 13px;
  color: var(--me-text-secondary);
  margin-top: 8px;
  line-height: 1.4;
}
.tpl-card-meta {
  font-size: 11px;
  color: var(--me-text-muted);
  margin-top: 8px;
}
.templates-empty {
  text-align: center;
  padding: 80px 20px;
}
.templates-empty h3 {
  color: var(--me-text-primary);
  margin-bottom: 8px;
}
.text-muted {
  color: var(--me-text-muted);
  font-size: 14px;
}
</style>
