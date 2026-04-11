<template>
  <div class="profile-data">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <span class="mdi mdi-database-outline" style="font-size: 20px; margin-right: 8px;"></span>
        {{ $t('data.title') }}
      </h2>
    </div>

    <!-- Storage Usage -->
    <div class="branding-card glass-card fade-in fade-in-delay-1">
      <h3 class="branding-card-title mono">
        <span class="mdi mdi-harddisk" style="font-size: 18px; margin-right: 8px;"></span>
        {{ $t('data.storage') }}
      </h3>
      <div v-if="storageLoading" class="storage-loading">
        <ProgressSpinner style="width: 24px; height: 24px;" strokeWidth="2" />
      </div>
      <div v-else class="storage-info">
        <div class="storage-bar mb-3">
          <div class="storage-bar-fill" :style="{ width: storagePercent + '%', background: storagePercent > 80 ? '#f87171' : storagePercent > 50 ? '#fb923c' : 'var(--me-accent)' }" />
        </div>
        <p class="storage-text mono">
          {{ $t('data.used', { size: formatBytes(storage.used), files: storage.files }) }}
        </p>
        <p class="storage-subtext">{{ $t('data.storageLimit', { size: formatBytes(MAX_STORAGE) }) }}</p>
      </div>
    </div>

    <!-- Export Data (RGPD) -->
    <div class="branding-card glass-card fade-in fade-in-delay-2">
      <h3 class="branding-card-title mono">
        <span class="mdi mdi-shield-account-outline" style="font-size: 18px; margin-right: 8px;"></span>
        {{ $t('data.rgpdExport') }}
      </h3>
      <p class="branding-card-desc">
        {{ $t('data.rgpdDesc') }}
      </p>
      <div class="branding-actions mt-3">
        <button class="me-btn-primary" @click="exportData" :disabled="exporting">
          <ProgressSpinner v-if="exporting" style="width: 14px; height: 14px; margin-right: 8px;" strokeWidth="2" />
          <i v-else class="pi pi-download" style="font-size: 16px; margin-right: 4px;"></i>
          {{ exporting ? $t('data.exporting') : $t('data.exportData') }}
        </button>
      </div>
      <Message v-if="exportError" severity="error" :closable="true" @close="exportError = ''" class="mt-3">
        {{ exportError }}
      </Message>
    </div>

    <!-- Danger Zone -->
    <div class="branding-card glass-card fade-in fade-in-delay-3 danger-zone">
      <h3 class="branding-card-title mono danger-title">
        <span class="mdi mdi-alert-octagon-outline" style="font-size: 18px; margin-right: 8px; color: #f87171;"></span>
        {{ $t('data.dangerZone') }}
      </h3>
      <p class="branding-card-desc">
        {{ $t('data.dangerDesc') }}
      </p>
      <div class="branding-actions mt-3">
        <button class="me-btn-danger" @click="showDeleteDialog = true">
          <i class="pi pi-trash" style="font-size: 16px; margin-right: 4px;"></i>
          {{ $t('data.deleteAccount') }}
        </button>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:visible="showDeleteDialog" modal :style="{ width: '480px' }" :closable="false">
      <template #container>
        <div class="glass-card dialog-card">
          <h3 class="dialog-title mono">
            <span class="mdi mdi-alert-outline" style="font-size: 20px; margin-right: 8px; color: #f87171;"></span>
            {{ $t('data.deleteConfirmTitle') }}
          </h3>
          <Message severity="error" class="mb-4">
            {{ $t('data.deleteConfirmAlert') }}
          </Message>
          <p class="dialog-desc mb-3">
            {{ $t('data.deleteConfirmPrompt') }}
          </p>
          <div class="mb-4">
            <label class="form-label-sm">{{ $t('auth.password') }}</label>
            <InputText
              v-model="deletePassword"
              type="password"
              class="w-full"
              @keyup.enter="deleteAccount"
            />
          </div>
          <Message v-if="deleteError" severity="error" :closable="true" @close="deleteError = ''" class="mb-3">
            {{ deleteError }}
          </Message>
          <div class="dialog-actions">
            <button class="me-btn-ghost" @click="cancelDelete" :disabled="deleting">{{ $t('common.cancel') }}</button>
            <button class="me-btn-danger" @click="deleteAccount" :disabled="!deletePassword || deleting">
              <ProgressSpinner v-if="deleting" style="width: 14px; height: 14px; margin-right: 8px;" strokeWidth="2" />
              {{ deleting ? $t('data.deleting') : $t('data.deletePermanently') }}
            </button>
          </div>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';

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
.profile-data { }

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
.storage-bar { height: 8px; background: var(--me-bg-elevated); border-radius: 4px; overflow: hidden; border: 1px solid var(--me-border); }
.storage-bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
.form-label-sm { display: block; font-size: 12px; color: var(--me-text-muted); margin-bottom: 4px; }
.w-full { width: 100%; }
</style>
