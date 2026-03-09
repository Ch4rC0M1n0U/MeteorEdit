<template>
  <v-dialog v-model="dialog" max-width="500">
    <template #activator="{ props }">
      <button v-bind="props" class="me-btn-primary">
        <v-icon size="18" class="mr-1">mdi-plus</v-icon>
        Nouveau dossier
      </button>
    </template>

    <div class="glass-card dialog-card">
      <div class="dialog-header">
        <h3 class="mono">Nouveau dossier</h3>
        <button class="me-close-btn" @click="dialog = false">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>
      <div class="dialog-body">
        <!-- Icon picker -->
        <div class="icon-picker-section">
          <span class="icon-picker-label mono">Icone du dossier</span>
          <div class="icon-picker-grid">
            <button
              v-for="ic in dossierIcons"
              :key="ic"
              :class="['icon-picker-item', { 'icon-picker-item--active': selectedIcon === ic }]"
              @click="selectedIcon = selectedIcon === ic ? null : ic"
              type="button"
            >
              <v-icon size="20">{{ ic }}</v-icon>
            </button>
          </div>
        </div>
        <v-text-field v-model="title" label="Titre du dossier" autofocus class="mb-2" />
        <v-textarea v-model="description" label="Description" rows="3" />
      </div>
      <div class="dialog-footer">
        <button class="me-btn-ghost" @click="dialog = false">Annuler</button>
        <button class="me-btn-primary" @click="handleCreate" :disabled="!title.trim()">Creer</button>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useDossierStore } from '../../stores/dossier';
import { DOSSIER_ICONS } from '../../constants/dossierIcons';

const dossierStore = useDossierStore();
const dialog = ref(false);
const title = ref('');
const description = ref('');
const selectedIcon = ref<string | null>(null);
const dossierIcons = DOSSIER_ICONS;

async function handleCreate() {
  await dossierStore.createDossier({
    title: title.value,
    description: description.value,
    icon: selectedIcon.value,
  });
  title.value = '';
  description.value = '';
  selectedIcon.value = null;
  dialog.value = false;
}
</script>

<style scoped>
.dialog-card {
  overflow: hidden;
}
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--me-border);
}
.dialog-header h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.me-close-btn {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}
.me-close-btn:hover {
  color: var(--me-text-primary);
  background: var(--me-accent-glow);
}
.dialog-body {
  padding: 20px 24px;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--me-border);
}
.me-btn-ghost {
  padding: 8px 16px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s;
}
.me-btn-ghost:hover {
  border-color: var(--me-border-hover);
  color: var(--me-text-primary);
}
.me-btn-primary {
  display: inline-flex;
  align-items: center;
  padding: 8px 18px;
  border-radius: var(--me-radius-sm);
  background: var(--me-accent);
  border: none;
  color: var(--me-bg-deep);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}
.me-btn-primary:hover {
  box-shadow: 0 0 20px var(--me-accent-glow), 0 4px 12px rgba(0,0,0,0.3);
  transform: translateY(-1px);
}
.me-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
/* Icon picker */
.icon-picker-section {
  margin-bottom: 16px;
}
.icon-picker-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--me-text-muted);
  margin-bottom: 8px;
}
.icon-picker-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.icon-picker-item {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid transparent;
  color: var(--me-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.icon-picker-item:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
.icon-picker-item--active {
  background: var(--me-accent-glow);
  border-color: var(--me-accent);
  color: var(--me-accent);
}
</style>
