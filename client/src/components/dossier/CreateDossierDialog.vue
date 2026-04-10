<template>
  <Button icon="pi pi-plus" :label="$t('dossier.newDossier')" @click="dialog = true" />

  <Dialog v-model:visible="dialog" :header="$t('dossier.newDossier')" modal :style="{ width: '500px' }" class="create-dossier-dialog">
    <div class="dialog-body">
      <!-- Icon picker (keeps MDI icons for specialized police/OSINT icons) -->
      <div class="icon-picker-section">
        <span class="icon-picker-label mono">{{ $t('dossier.dossierIcon') }}</span>
        <div class="icon-picker-grid">
          <button
            v-for="ic in dossierIcons"
            :key="ic"
            :class="['icon-picker-item', { 'icon-picker-item--active': selectedIcon === ic }]"
            @click="selectedIcon = selectedIcon === ic ? null : ic"
            type="button"
          >
            <span class="mdi" :class="ic" style="font-size: 20px;" />
          </button>
        </div>
      </div>

      <div class="field">
        <label for="dossier-title" class="field-label">{{ $t('dossier.dossierTitle') }}</label>
        <InputText id="dossier-title" v-model="title" :placeholder="$t('dossier.dossierTitle')" autofocus class="w-full" />
      </div>

      <div class="field">
        <label for="dossier-desc" class="field-label">{{ $t('common.description') }}</label>
        <Textarea id="dossier-desc" v-model="description" :placeholder="$t('common.description')" rows="3" class="w-full" />
      </div>
    </div>

    <template #footer>
      <Button :label="$t('common.cancel')" text severity="secondary" @click="dialog = false" />
      <Button :label="$t('common.create')" icon="pi pi-check" @click="handleCreate" :disabled="!title.trim()" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
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
.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label {
  font-size: 12px; font-weight: 600; color: var(--me-text-muted);
  text-transform: uppercase; letter-spacing: 0.5px;
}
.w-full { width: 100%; }

/* Icon picker */
.icon-picker-section { margin-bottom: 4px; }
.icon-picker-label {
  display: block; font-size: 11px; text-transform: uppercase;
  letter-spacing: 1px; color: var(--me-text-muted); margin-bottom: 8px;
}
.icon-picker-grid { display: flex; flex-wrap: wrap; gap: 4px; }
.icon-picker-item {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 8px; background: none;
  border: 1px solid transparent;
  color: var(--me-text-muted); cursor: pointer; transition: all 0.15s;
}
.icon-picker-item:hover { background: var(--me-accent-glow); color: var(--me-text-primary); }
.icon-picker-item--active { background: var(--me-accent-glow); border-color: var(--me-accent); color: var(--me-accent); }
</style>
