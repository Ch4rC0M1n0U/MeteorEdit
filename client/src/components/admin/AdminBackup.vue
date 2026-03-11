<template>
  <div class="admin-backup">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-backup-restore</v-icon>
        Sauvegarde & Restauration
      </h2>
      <p class="admin-section-subtitle">{{ $t('admin.backupSubtitle') }}</p>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" closable class="mb-4" @click:close="error = ''">
      {{ error }}
    </v-alert>

    <v-alert v-if="success" type="success" variant="tonal" closable class="mb-4" @click:close="success = ''">
      {{ success }}
    </v-alert>

    <!-- Export -->
    <div class="sec-card glass-card fade-in fade-in-delay-1">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-cloud-download-outline</v-icon>
        <h3 class="sec-card-title mono">{{ $t('admin.exportBackup') }}</h3>
      </div>
      <p class="sec-desc mb-4">
        {{ $t('admin.exportBackupDesc') }}
      </p>
      <button class="me-btn-primary" @click="exportBackup" :disabled="exporting">
        <v-icon size="14" class="mr-1">mdi-download</v-icon>
        {{ exporting ? $t('admin.exportInProgress') : $t('admin.backupExport') }}
      </button>
    </div>

    <!-- Restore -->
    <div class="sec-card glass-card fade-in fade-in-delay-2">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-cloud-upload-outline</v-icon>
        <h3 class="sec-card-title mono">{{ $t('admin.restoreBackup') }}</h3>
      </div>
      <p class="sec-desc mb-2">
        <strong style="color: var(--me-error);">{{ $t('admin.restoreWarningStrong') }}</strong> {{ $t('admin.restoreWarningText') }}
      </p>
      <div class="upload-zone" @dragover.prevent @drop.prevent="dropBackup">
        <div v-if="backupFile" class="upload-preview">
          <v-icon size="24" color="var(--me-accent)">mdi-file-code-outline</v-icon>
          <span class="upload-file-name">{{ backupFile.name }}</span>
          <button class="upload-remove-btn" @click="backupFile = null" :title="$t('admin.removeFile')">
            <v-icon size="14">mdi-close</v-icon>
          </button>
        </div>
        <div v-else class="upload-placeholder" @click="triggerFileInput">
          <v-icon size="28" color="var(--me-text-muted)">mdi-cloud-upload-outline</v-icon>
          <span>{{ $t('admin.dragOrClickJson') }}</span>
        </div>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="handleFileSelect" />
      </div>
      <div class="restore-actions">
        <button
          class="me-btn-danger"
          @click="restoreBackup"
          :disabled="!backupFile || restoring"
        >
          <v-icon size="14" class="mr-1">mdi-upload</v-icon>
          {{ restoring ? $t('admin.restoreInProgress') : $t('admin.backupRestore') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';
import { useConfirm } from '../../composables/useConfirm';

const { confirm } = useConfirm();
const { t } = useI18n();

const error = ref('');
const success = ref('');
const exporting = ref(false);
const restoring = ref(false);
const backupFile = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

function triggerFileInput() {
  fileInput.value?.click();
}

function handleFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) backupFile.value = file;
}

function dropBackup(e: DragEvent) {
  const file = e.dataTransfer?.files[0];
  if (file && file.name.endsWith('.json')) {
    backupFile.value = file;
  }
}

async function exportBackup() {
  exporting.value = true;
  error.value = '';
  try {
    const response = await api.get('/admin/backup/export', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `meteoredit-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch {
    error.value = t('admin.exportError');
  } finally {
    exporting.value = false;
  }
}

async function restoreBackup() {
  if (!backupFile.value) return;

  const ok = await confirm({
    title: t('admin.restorationTitle'),
    message: t('admin.restorationConfirm'),
    confirmText: t('admin.backupRestore'),
    variant: 'danger',
  });
  if (!ok) return;

  restoring.value = true;
  error.value = '';
  success.value = '';
  try {
    const fd = new FormData();
    fd.append('backup', backupFile.value);
    await api.post('/admin/backup/import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    success.value = t('admin.restoreSuccess');
    backupFile.value = null;
  } catch {
    error.value = t('admin.restoreError');
  } finally {
    restoring.value = false;
  }
}
</script>

<style scoped>
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.admin-section-subtitle { font-size: 13px; color: var(--me-text-muted); margin-top: 4px; font-family: var(--me-font-mono); }

.sec-card { padding: 20px; margin-bottom: 16px; }
.sec-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--me-border); }
.sec-card-title { font-size: 14px; font-weight: 700; color: var(--me-text-primary); }

.sec-desc { font-size: 12px; color: var(--me-text-muted); margin-top: 2px; }

.upload-zone {
  border: 2px dashed var(--me-border);
  border-radius: var(--me-radius-sm);
  padding: 16px;
  text-align: center;
  transition: all 0.15s;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 12px;
}
.upload-zone:hover {
  border-color: var(--me-accent);
  background: var(--me-accent-glow);
}
.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: var(--me-text-muted);
  font-size: 13px;
}
.upload-preview {
  display: flex;
  align-items: center;
  gap: 12px;
}
.upload-file-name {
  font-size: 13px;
  color: var(--me-text-primary);
  font-family: var(--me-font-mono);
}
.upload-remove-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid var(--me-border);
  border-radius: 50%;
  color: var(--me-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.upload-remove-btn:hover {
  background: rgba(248, 113, 113, 0.1);
  border-color: var(--me-error);
  color: var(--me-error);
}

.restore-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.me-btn-primary {
  padding: 8px 16px;
  border-radius: var(--me-radius-xs);
  background: var(--me-accent);
  border: none;
  color: var(--me-bg-deep);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
}
.me-btn-primary:hover {
  box-shadow: 0 0 16px var(--me-accent-glow);
}
.me-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.me-btn-danger {
  padding: 8px 16px;
  border-radius: var(--me-radius-xs);
  background: #ef4444;
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
}
.me-btn-danger:hover {
  box-shadow: 0 0 16px rgba(239, 68, 68, 0.4);
}
.me-btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mr-1 { margin-right: 4px; }
.mb-2 { margin-bottom: 8px; }
.mb-4 { margin-bottom: 16px; }
</style>
