<template>
  <div class="admin-storage">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-harddisk</v-icon>
        Stockage
      </h2>
      <p class="admin-section-subtitle">Gestion des uploads et de l'espace disque</p>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <!-- Limites d'upload -->
    <div class="sec-card glass-card fade-in fade-in-delay-1">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-upload-outline</v-icon>
        <h3 class="sec-card-title mono">Limites d'upload</h3>
      </div>
      <div class="sec-option">
        <div>
          <p class="sec-label">Taille max par fichier (MB)</p>
          <p class="sec-desc">Limite de taille pour chaque fichier uploade</p>
        </div>
        <v-text-field
          v-model.number="form.maxFileSizeMB"
          type="number"
          density="compact"
          hide-details
          style="max-width: 120px;"
          :min="1"
          :max="10240"
          @blur="save"
        />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">Types de fichiers autorises</p>
          <p class="sec-desc">Types MIME et extensions separes par des virgules</p>
        </div>
        <v-text-field
          v-model="form.allowedFileTypes"
          density="compact"
          hide-details
          style="max-width: 360px;"
          placeholder="image/*,.pdf,.docx,.xlsx"
          @blur="save"
        />
      </div>
    </div>

    <!-- Utilisation du stockage -->
    <div class="sec-card glass-card fade-in fade-in-delay-2">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-chart-pie</v-icon>
        <h3 class="sec-card-title mono">Utilisation du stockage</h3>
      </div>
      <div class="sec-option">
        <div>
          <p class="sec-label">Fichiers totaux</p>
          <p class="sec-desc">Nombre de fichiers stockes sur le serveur</p>
        </div>
        <span class="storage-value mono">{{ storageInfo.totalFiles }}</span>
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">Espace utilise</p>
          <p class="sec-desc">Taille totale des fichiers uploades</p>
        </div>
        <span class="storage-value mono">{{ formatBytes(storageInfo.totalSize) }}</span>
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">Nettoyer les fichiers orphelins</p>
          <p class="sec-desc">Supprimer les fichiers qui ne sont plus references par aucun dossier</p>
        </div>
        <v-btn
          variant="outlined"
          color="warning"
          size="small"
          prepend-icon="mdi-broom"
          disabled
        >
          Nettoyer
        </v-btn>
      </div>
    </div>

    <v-snackbar v-model="saved" :timeout="2000" color="success" location="bottom right">
      Parametres enregistres
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../../services/api';

const loading = ref(true);
const saved = ref(false);

const form = ref({
  maxFileSizeMB: 50,
  allowedFileTypes: 'image/*,.pdf,.docx,.xlsx,.csv,.txt',
});

const storageInfo = ref({
  totalFiles: 0,
  totalSize: 0,
});

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

onMounted(async () => {
  try {
    const { data } = await api.get('/settings/branding');
    form.value.maxFileSizeMB = data.maxFileSizeMB || 50;
    form.value.allowedFileTypes = data.allowedFileTypes || 'image/*,.pdf,.docx,.xlsx,.csv,.txt';
  } catch {} finally {
    loading.value = false;
  }

  try {
    const { data } = await api.get('/admin/storage-info');
    storageInfo.value.totalFiles = data.totalFiles || 0;
    storageInfo.value.totalSize = data.totalSize || 0;
  } catch {}
});

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function save() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await api.put('/admin/settings', form.value);
      saved.value = true;
    } catch {}
  }, 300);
}
</script>

<style scoped>
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.admin-section-subtitle { font-size: 13px; color: var(--me-text-muted); margin-top: 4px; font-family: var(--me-font-mono); }

.sec-card { padding: 20px; margin-bottom: 16px; }
.sec-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--me-border); }
.sec-card-title { font-size: 14px; font-weight: 700; color: var(--me-text-primary); }

.sec-option { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 4px 0; }
.sec-label { font-size: 13px; font-weight: 600; color: var(--me-text-primary); }
.sec-desc { font-size: 12px; color: var(--me-text-muted); margin-top: 2px; }
.sec-divider { height: 1px; background: var(--me-border); margin: 10px 0; opacity: 0.5; }

.storage-value { font-size: 14px; font-weight: 700; color: var(--me-accent); }
</style>
