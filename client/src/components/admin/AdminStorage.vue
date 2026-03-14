<template>
  <div class="admin-storage">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-harddisk</v-icon>
        Stockage
      </h2>
      <p class="admin-section-subtitle">{{ $t('admin.storageSubtitle') }}</p>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <!-- Limites d'upload -->
    <div class="sec-card glass-card fade-in fade-in-delay-1">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-upload-outline</v-icon>
        <h3 class="sec-card-title mono">{{ $t('admin.uploadLimits') }}</h3>
      </div>
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.maxFileSizeMB') }}</p>
          <p class="sec-desc">{{ $t('admin.maxFileSizeDesc') }}</p>
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
          <p class="sec-label">{{ $t('admin.allowedFileTypes') }}</p>
          <p class="sec-desc">{{ $t('admin.allowedFileTypesDesc') }}</p>
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
        <h3 class="sec-card-title mono">{{ $t('admin.storageUsage') }}</h3>
      </div>
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.totalFiles') }}</p>
          <p class="sec-desc">{{ $t('admin.totalFilesDesc') }}</p>
        </div>
        <span class="storage-value mono">{{ storageInfo.totalFiles }}</span>
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.usedSpace') }}</p>
          <p class="sec-desc">{{ $t('admin.usedSpaceDesc') }}</p>
        </div>
        <span class="storage-value mono">{{ formatBytes(storageInfo.totalSize) }}</span>
      </div>
    </div>

    <!-- Fichiers orphelins -->
    <div class="sec-card glass-card fade-in fade-in-delay-3">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent-warm, #f59e0b)">mdi-broom</v-icon>
        <h3 class="sec-card-title mono">{{ $t('admin.cleanOrphans') }}</h3>
      </div>
      <p class="sec-desc" style="margin-bottom: 12px;">{{ $t('admin.cleanOrphansDesc') }}</p>

      <!-- Scan button -->
      <div v-if="!orphanScanned" class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.scanOrphansLabel') }}</p>
          <p class="sec-desc">{{ $t('admin.scanOrphansDesc') }}</p>
        </div>
        <v-btn
          variant="outlined"
          color="primary"
          size="small"
          prepend-icon="mdi-magnify"
          :loading="scanning"
          @click="scanOrphans"
        >
          {{ $t('admin.scan') }}
        </v-btn>
      </div>

      <!-- Results -->
      <template v-if="orphanScanned">
        <div class="orphan-stats">
          <div class="orphan-stat">
            <span class="orphan-stat-value mono">{{ orphanInfo.totalFiles }}</span>
            <span class="orphan-stat-label">{{ $t('admin.totalFiles') }}</span>
          </div>
          <div class="orphan-stat">
            <span class="orphan-stat-value mono">{{ orphanInfo.referencedFiles }}</span>
            <span class="orphan-stat-label">{{ $t('admin.referencedFiles') }}</span>
          </div>
          <div class="orphan-stat" :class="{ 'orphan-stat-warn': orphanInfo.orphanCount > 0 }">
            <span class="orphan-stat-value mono">{{ orphanInfo.orphanCount }}</span>
            <span class="orphan-stat-label">{{ $t('admin.orphanFiles') }}</span>
          </div>
          <div class="orphan-stat" :class="{ 'orphan-stat-warn': orphanInfo.orphanCount > 0 }">
            <span class="orphan-stat-value mono">{{ formatBytes(orphanInfo.orphanSizeBytes) }}</span>
            <span class="orphan-stat-label">{{ $t('admin.reclaimableSpace') }}</span>
          </div>
        </div>

        <!-- Orphan file list (collapsible) -->
        <details v-if="orphanInfo.orphans.length > 0" class="orphan-details">
          <summary class="orphan-summary">
            {{ $t('admin.orphanFileList') }} ({{ orphanInfo.orphans.length }})
          </summary>
          <div class="orphan-list">
            <div v-for="(f, i) in orphanInfo.orphans" :key="i" class="orphan-file">
              <span class="orphan-file-path mono">{{ f.relativePath }}</span>
              <span class="orphan-file-size mono">{{ formatBytes(f.size) }}</span>
            </div>
          </div>
        </details>

        <div class="orphan-actions">
          <v-btn
            variant="outlined"
            size="small"
            prepend-icon="mdi-refresh"
            @click="scanOrphans"
            :loading="scanning"
          >
            {{ $t('admin.rescan') }}
          </v-btn>
          <v-btn
            v-if="orphanInfo.orphanCount > 0"
            variant="flat"
            color="warning"
            size="small"
            prepend-icon="mdi-delete-sweep"
            :loading="cleaning"
            @click="handleClean"
          >
            {{ $t('admin.cleanOrphansBtn', { count: orphanInfo.orphanCount }) }}
          </v-btn>
        </div>
      </template>
    </div>

    <v-snackbar v-model="saved" :timeout="2000" color="success" location="bottom right">
      {{ $t('admin.settingsSaved') }}
    </v-snackbar>
    <v-snackbar v-model="cleanedSnackbar" :timeout="3000" color="success" location="bottom right">
      {{ cleanedMessage }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useConfirm } from '../../composables/useConfirm';
import api from '../../services/api';

const { t } = useI18n();
const { confirm } = useConfirm();

const loading = ref(true);
const saved = ref(false);
const scanning = ref(false);
const cleaning = ref(false);
const orphanScanned = ref(false);
const cleanedSnackbar = ref(false);
const cleanedMessage = ref('');

const form = ref({
  maxFileSizeMB: 50,
  allowedFileTypes: 'image/*,.pdf,.docx,.xlsx,.csv,.txt',
});

const storageInfo = ref({
  totalFiles: 0,
  totalSize: 0,
});

const orphanInfo = ref({
  totalFiles: 0,
  referencedFiles: 0,
  orphanCount: 0,
  orphanSizeBytes: 0,
  orphans: [] as { relativePath: string; size: number }[],
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
    storageInfo.value.totalSize = data.totalSizeBytes || 0;
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

async function scanOrphans() {
  scanning.value = true;
  try {
    const { data } = await api.get('/admin/storage/orphans');
    orphanInfo.value = data;
    orphanScanned.value = true;
  } catch {} finally {
    scanning.value = false;
  }
}

async function handleClean() {
  const ok = await confirm({
    title: t('admin.cleanOrphans'),
    message: t('admin.cleanOrphansConfirm', {
      count: orphanInfo.value.orphanCount,
      size: formatBytes(orphanInfo.value.orphanSizeBytes),
    }),
    confirmText: t('admin.clean'),
    variant: 'danger',
  });
  if (!ok) return;

  cleaning.value = true;
  try {
    const { data } = await api.delete('/admin/storage/orphans');
    cleanedMessage.value = t('admin.cleanOrphansResult', {
      count: data.deletedFiles,
      size: formatBytes(data.freedBytes),
    });
    cleanedSnackbar.value = true;

    // Update storage info
    storageInfo.value.totalFiles = data.totalFiles;
    storageInfo.value.totalSize = data.totalSizeBytes;

    // Reset orphan scan
    orphanScanned.value = false;
    orphanInfo.value = { totalFiles: 0, referencedFiles: 0, orphanCount: 0, orphanSizeBytes: 0, orphans: [] };
  } catch {} finally {
    cleaning.value = false;
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

.sec-option { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 4px 0; }
.sec-label { font-size: 13px; font-weight: 600; color: var(--me-text-primary); }
.sec-desc { font-size: 12px; color: var(--me-text-muted); margin-top: 2px; }
.sec-divider { height: 1px; background: var(--me-border); margin: 10px 0; opacity: 0.5; }

.storage-value { font-size: 14px; font-weight: 700; color: var(--me-accent); }

/* Orphan stats grid */
.orphan-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.orphan-stat {
  text-align: center;
  padding: 12px 8px;
  border-radius: var(--me-radius-sm);
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
}
.orphan-stat-warn {
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(245, 158, 11, 0.06);
}
.orphan-stat-value {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.orphan-stat-warn .orphan-stat-value {
  color: var(--me-accent-warm, #f59e0b);
}
.orphan-stat-label {
  font-size: 11px;
  color: var(--me-text-muted);
  margin-top: 4px;
  display: block;
}

/* File list */
.orphan-details {
  margin-bottom: 16px;
}
.orphan-summary {
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: var(--me-text-secondary);
  padding: 6px 0;
}
.orphan-summary:hover {
  color: var(--me-text-primary);
}
.orphan-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-xs);
  margin-top: 8px;
}
.orphan-file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  font-size: 11px;
  border-bottom: 1px solid var(--me-border);
}
.orphan-file:last-child {
  border-bottom: none;
}
.orphan-file-path {
  color: var(--me-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.orphan-file-size {
  color: var(--me-text-muted);
  flex-shrink: 0;
  margin-left: 12px;
}

/* Actions */
.orphan-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
</style>
