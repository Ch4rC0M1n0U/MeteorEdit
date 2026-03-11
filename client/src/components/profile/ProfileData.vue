<template>
  <div class="profile-data">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-database-outline</v-icon>
        {{ $t('data.title') }}
      </h2>
    </div>

    <!-- Storage Usage -->
    <div class="branding-card glass-card fade-in fade-in-delay-1">
      <h3 class="branding-card-title mono">
        <v-icon size="18" class="mr-2">mdi-harddisk</v-icon>
        {{ $t('data.storage') }}
      </h3>
      <div v-if="storageLoading" class="storage-loading">
        <v-progress-circular indeterminate size="24" width="2" />
      </div>
      <div v-else class="storage-info">
        <v-progress-linear
          :model-value="storagePercent"
          :color="storagePercent > 80 ? 'error' : storagePercent > 50 ? 'warning' : 'primary'"
          height="8"
          rounded
          class="mb-3"
        />
        <p class="storage-text mono">
          {{ $t('data.used', { size: formatBytes(storage.used), files: storage.files }) }}
        </p>
        <p class="storage-subtext">{{ $t('data.storageLimit', { size: formatBytes(MAX_STORAGE) }) }}</p>
      </div>
    </div>

    <!-- Export Data (RGPD) -->
    <div class="branding-card glass-card fade-in fade-in-delay-2">
      <h3 class="branding-card-title mono">
        <v-icon size="18" class="mr-2">mdi-shield-account-outline</v-icon>
        {{ $t('data.rgpdExport') }}
      </h3>
      <p class="branding-card-desc">
        {{ $t('data.rgpdDesc') }}
      </p>
      <div class="branding-actions mt-3">
        <button class="me-btn-primary" @click="exportData" :disabled="exporting">
          <v-progress-circular v-if="exporting" indeterminate size="14" width="2" class="mr-2" />
          <v-icon v-else size="16" class="mr-1">mdi-download</v-icon>
          {{ exporting ? $t('data.exporting') : $t('data.exportData') }}
        </button>
      </div>
      <v-alert v-if="exportError" type="error" variant="tonal" class="mt-3" closable @click:close="exportError = ''">
        {{ exportError }}
      </v-alert>
    </div>

    <!-- Danger Zone -->
    <div class="branding-card glass-card fade-in fade-in-delay-3 danger-zone">
      <h3 class="branding-card-title mono danger-title">
        <v-icon size="18" class="mr-2" color="error">mdi-alert-octagon-outline</v-icon>
        {{ $t('data.dangerZone') }}
      </h3>
      <p class="branding-card-desc">
        {{ $t('data.dangerDesc') }}
      </p>
      <div class="branding-actions mt-3">
        <button class="me-btn-danger" @click="showDeleteDialog = true">
          <v-icon size="16" class="mr-1">mdi-trash-can-outline</v-icon>
          {{ $t('data.deleteAccount') }}
        </button>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="480" persistent>
      <div class="glass-card dialog-card">
        <h3 class="dialog-title mono">
          <v-icon size="20" class="mr-2" color="error">mdi-alert-outline</v-icon>
          {{ $t('data.deleteConfirmTitle') }}
        </h3>
        <v-alert type="error" variant="tonal" class="mb-4">
          {{ $t('data.deleteConfirmAlert') }}
        </v-alert>
        <p class="dialog-desc mb-3">
          {{ $t('data.deleteConfirmPrompt') }}
        </p>
        <v-text-field
          v-model="deletePassword"
          :label="$t('auth.password')"
          type="password"
          density="compact"
          hide-details
          class="mb-4"
          @keyup.enter="deleteAccount"
        />
        <v-alert v-if="deleteError" type="error" variant="tonal" class="mb-3" closable @click:close="deleteError = ''">
          {{ deleteError }}
        </v-alert>
        <div class="dialog-actions">
          <button class="me-btn-ghost" @click="cancelDelete" :disabled="deleting">{{ $t('common.cancel') }}</button>
          <button class="me-btn-danger" @click="deleteAccount" :disabled="!deletePassword || deleting">
            <v-progress-circular v-if="deleting" indeterminate size="14" width="2" class="mr-2" />
            {{ deleting ? $t('data.deleting') : $t('data.deletePermanently') }}
          </button>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';

const { t } = useI18n();

const MAX_STORAGE = 500 * 1024 * 1024; // 500 Mo

// Storage
const storage = ref({ used: 0, files: 0 });
const storageLoading = ref(true);

const storagePercent = computed(() => {
  return Math.min((storage.value.used / MAX_STORAGE) * 100, 100);
});

async function fetchStorage() {
  storageLoading.value = true;
  try {
    const { data } = await api.get('/auth/storage');
    storage.value = data;
  } catch {
    // silent fail
  } finally {
    storageLoading.value = false;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 o';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

// Export
const exporting = ref(false);
const exportError = ref('');

async function exportData() {
  exporting.value = true;
  exportError.value = '';
  try {
    const response = await api.post('/auth/export-data', {}, { responseType: 'blob' });
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const contentDisposition = response.headers['content-disposition'];
    const filename = contentDisposition
      ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || 'export-donnees.zip'
      : 'export-donnees.zip';
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch {
    exportError.value = t('data.exportError');
  } finally {
    exporting.value = false;
  }
}

// Delete account
const showDeleteDialog = ref(false);
const deletePassword = ref('');
const deleteError = ref('');
const deleting = ref(false);

function cancelDelete() {
  showDeleteDialog.value = false;
  deletePassword.value = '';
  deleteError.value = '';
}

async function deleteAccount() {
  if (!deletePassword.value) return;
  deleting.value = true;
  deleteError.value = '';
  try {
    await api.delete('/auth/account', { data: { password: deletePassword.value } });
    localStorage.clear();
    window.location.href = '/login';
  } catch (err: any) {
    deleteError.value = err.response?.data?.message || t('data.deleteError');
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  fetchStorage();
});
</script>

<style scoped>
.profile-data { max-width: 640px; }

/* Shared profile styles */
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.branding-card { padding: 20px; margin-bottom: 16px; }
.branding-card-title { font-size: 14px; font-weight: 700; color: var(--me-text-primary); margin-bottom: 12px; display: flex; align-items: center; }
.branding-card-desc { font-size: 13px; color: var(--me-text-secondary); line-height: 1.5; }
.branding-actions { display: flex; justify-content: flex-end; }
.me-btn-primary { padding: 8px 16px; border-radius: var(--me-radius-xs); background: var(--me-accent); border: none; color: var(--me-bg-deep); cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; }
.me-btn-primary:hover { box-shadow: 0 0 16px var(--me-accent-glow); }
.me-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.me-btn-ghost { padding: 8px 16px; border-radius: var(--me-radius-xs); background: none; border: 1px solid var(--me-border); color: var(--me-text-secondary); cursor: pointer; font-size: 13px; display: flex; align-items: center; }
.me-btn-ghost:hover { border-color: var(--me-border-hover); color: var(--me-text-primary); }

/* Storage */
.storage-loading { display: flex; justify-content: center; padding: 16px 0; }
.storage-info { margin-top: 8px; }
.storage-text { font-size: 13px; color: var(--me-text-secondary); }
.storage-subtext { font-size: 12px; color: var(--me-text-muted); margin-top: 4px; }

/* Danger zone */
.danger-zone { border-color: rgba(248, 113, 113, 0.3) !important; }
.danger-title { color: #f87171; }
.me-btn-danger { display: inline-flex; align-items: center; gap: 4px; padding: 8px 16px; border-radius: var(--me-radius-xs); border: 1px solid rgba(248, 113, 113, 0.4); background: rgba(248, 113, 113, 0.1); color: #f87171; font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.15s; }
.me-btn-danger:hover:not(:disabled) { background: rgba(248, 113, 113, 0.2); border-color: #f87171; }
.me-btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

/* Dialog */
.dialog-card { padding: 24px; }
.dialog-title { font-size: 16px; font-weight: 700; color: var(--me-text-primary); margin-bottom: 16px; display: flex; align-items: center; }
.dialog-desc { font-size: 13px; color: var(--me-text-secondary); }
.dialog-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
</style>
