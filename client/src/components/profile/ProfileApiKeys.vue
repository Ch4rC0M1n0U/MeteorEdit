<template>
  <div class="admin-clipper">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-key-variant</v-icon>
        {{ t('admin.apiKeys') }}
      </h2>
      <p class="admin-section-subtitle">{{ t('admin.apiKeysSubtitle') }}</p>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <!-- Server URL -->
    <div class="sec-card glass-card fade-in fade-in-delay-1">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-server-network</v-icon>
        <h3 class="sec-card-title mono">{{ t('admin.serverUrl') }}</h3>
      </div>
      <div class="sec-option">
        <div style="flex: 1; min-width: 0;">
          <p class="sec-label">{{ t('admin.serverUrl') }}</p>
          <div class="copy-field">
            <code class="copy-field-value">{{ serverUrl }}</code>
            <button class="me-btn-ghost copy-btn" @click="copyToClipboard(serverUrl)">
              <v-icon size="16">mdi-content-copy</v-icon>
            </button>
          </div>
        </div>
      </div>
      <div class="sec-divider" />
      <div class="sec-option" style="flex-direction: column; align-items: flex-start;">
        <p class="sec-label">{{ t('admin.keyAuthHeader') }}</p>
        <div class="auth-methods">
          <code class="auth-method">X-API-Key: &lt;your-key&gt;</code>
          <span class="auth-or">{{ t('common.or') }}</span>
          <code class="auth-method">Authorization: ApiKey &lt;your-key&gt;</code>
        </div>
      </div>
    </div>

    <!-- External API Keys -->
    <div class="sec-card glass-card fade-in fade-in-delay-2">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-cloud-key-outline</v-icon>
        <h3 class="sec-card-title mono">{{ t('admin.externalApiKeys') }}</h3>
      </div>
      <div class="sec-option" style="flex-direction: column; align-items: flex-start; gap: 8px;">
        <p class="sec-label">{{ t('admin.googleApiKey') }}</p>
        <p class="sec-desc">{{ t('admin.googleApiKeyDesc') }}</p>
        <div style="display: flex; gap: 8px; width: 100%; align-items: center;">
          <v-text-field
            v-model="googleApiKey"
            density="compact"
            hide-details
            :type="showGoogleKey ? 'text' : 'password'"
            placeholder="AIza..."
            style="flex: 1;"
          />
          <button class="me-btn-ghost" @click="showGoogleKey = !showGoogleKey">
            <v-icon size="16">{{ showGoogleKey ? 'mdi-eye-off' : 'mdi-eye' }}</v-icon>
          </button>
          <button class="me-btn me-btn-sm" @click="saveGoogleApiKey" :disabled="savingGoogleKey">
            <v-icon size="14" class="mr-1">mdi-content-save</v-icon>
            {{ t('common.save') }}
          </button>
        </div>
        <span v-if="googleKeySaved" class="sec-saved mono">
          <v-icon size="12" color="success" class="mr-1">mdi-check</v-icon>
          {{ t('admin.settingsSaved') }}
        </span>
      </div>
    </div>

    <!-- Generate key button -->
    <div class="sec-card glass-card fade-in fade-in-delay-3">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-key-plus</v-icon>
        <h3 class="sec-card-title mono">{{ t('admin.generateKey') }}</h3>
        <div style="flex: 1;" />
        <button class="me-btn me-btn-sm" @click="showCreateDialog = true">
          <v-icon size="16" class="mr-1">mdi-plus</v-icon>
          {{ t('admin.generateKey') }}
        </button>
      </div>

      <!-- Newly created key display -->
      <div v-if="newlyCreatedKey" class="new-key-banner">
        <v-icon size="18" color="warning" class="mr-2">mdi-alert</v-icon>
        <div style="flex: 1; min-width: 0;">
          <p class="sec-label" style="color: var(--me-warning, #f59e0b);">{{ t('admin.keyCopyWarning') }}</p>
          <div class="copy-field" style="margin-top: 6px;">
            <code class="copy-field-value">{{ newlyCreatedKey }}</code>
            <button class="me-btn-ghost copy-btn" @click="copyToClipboard(newlyCreatedKey!)">
              <v-icon size="16">mdi-content-copy</v-icon>
            </button>
          </div>
        </div>
      </div>

      <!-- Keys table -->
      <div v-if="keys.length === 0 && !loading" class="empty-state">
        <v-icon size="40" color="var(--me-text-muted)">mdi-key-remove</v-icon>
        <p class="empty-text">{{ t('admin.keyNoKeys') }}</p>
      </div>

      <div v-else-if="keys.length > 0" class="keys-table-wrap">
        <table class="keys-table">
          <thead>
            <tr>
              <th>{{ t('admin.keyName') }}</th>
              <th>{{ t('admin.keyPrefix') }}</th>
              <th>{{ t('admin.keyPermissions') }}</th>
              <th>{{ t('admin.keyLastUsed') }}</th>
              <th>{{ t('admin.keyCreated') }}</th>
              <th>{{ t('admin.keyExpires') }}</th>
              <th>{{ t('admin.keyStatus') }}</th>
              <th>{{ t('admin.keyActions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="key in keys" :key="key._id">
              <td class="key-name">{{ key.name }}</td>
              <td><code class="key-prefix">{{ key.prefix }}...</code></td>
              <td>
                <div class="perm-chips">
                  <span v-for="p in key.permissions" :key="p" class="perm-chip">{{ permLabel(p) }}</span>
                </div>
              </td>
              <td>{{ key.lastUsedAt ? formatDate(key.lastUsedAt) : t('admin.keyNever') }}</td>
              <td>{{ formatDate(key.createdAt) }}</td>
              <td>{{ key.expiresAt ? formatDate(key.expiresAt) : t('admin.keyNoExpiry') }}</td>
              <td>
                <v-switch
                  :model-value="key.isActive"
                  density="compact"
                  hide-details
                  color="primary"
                  @update:model-value="toggleActive(key)"
                />
              </td>
              <td>
                <button class="me-btn-ghost me-btn-danger-ghost" @click="confirmRevoke(key)">
                  <v-icon size="16">mdi-delete-outline</v-icon>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create dialog -->
    <v-dialog v-model="showCreateDialog" max-width="480" persistent>
      <div class="dialog-card glass-card">
        <div class="dialog-header">
          <h3 class="dialog-title mono">{{ t('admin.generateKey') }}</h3>
          <button class="me-btn-ghost" @click="closeCreateDialog">
            <v-icon size="18">mdi-close</v-icon>
          </button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label class="form-label">{{ t('admin.keyName') }} *</label>
            <v-text-field
              v-model="createForm.name"
              density="compact"
              hide-details
              :placeholder="t('admin.keyName')"
            />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('admin.keyPermissions') }}</label>
            <div class="perm-checkboxes">
              <v-checkbox
                v-model="createForm.permissions"
                value="read"
                :label="t('admin.keyPermRead')"
                density="compact"
                hide-details
              />
              <v-checkbox
                v-model="createForm.permissions"
                value="write"
                :label="t('admin.keyPermWrite')"
                density="compact"
                hide-details
              />
              <v-checkbox
                v-model="createForm.permissions"
                value="clip"
                :label="t('admin.keyPermClip')"
                density="compact"
                hide-details
              />
              <v-checkbox
                v-model="createForm.permissions"
                value="export"
                :label="t('admin.keyPermExport')"
                density="compact"
                hide-details
              />
              <v-checkbox
                v-model="createForm.permissions"
                value="root"
                :label="t('admin.keyPermRoot')"
                density="compact"
                hide-details
                color="error"
              />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('admin.keyExpires') }}</label>
            <v-text-field
              v-model="createForm.expiresAt"
              type="date"
              density="compact"
              hide-details
              :placeholder="t('admin.keyNoExpiry')"
            />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="me-btn-ghost" @click="closeCreateDialog">{{ t('common.cancel') }}</button>
          <button class="me-btn" :disabled="!createForm.name.trim() || creating" @click="createKey">
            <v-icon v-if="creating" size="16" class="mr-1 spin">mdi-loading</v-icon>
            {{ t('common.create') }}
          </button>
        </div>
      </div>
    </v-dialog>

    <!-- Revoke confirmation dialog -->
    <v-dialog v-model="showRevokeDialog" max-width="400" persistent>
      <div class="dialog-card glass-card">
        <div class="dialog-header">
          <h3 class="dialog-title mono">{{ t('admin.keyRevoke') }}</h3>
          <button class="me-btn-ghost" @click="showRevokeDialog = false">
            <v-icon size="18">mdi-close</v-icon>
          </button>
        </div>
        <div class="dialog-body">
          <p>{{ t('admin.keyRevokeConfirm') }}</p>
          <p v-if="keyToRevoke" class="revoke-key-name">
            <strong>{{ keyToRevoke.name }}</strong> ({{ keyToRevoke.prefix }}...)
          </p>
        </div>
        <div class="dialog-footer">
          <button class="me-btn-ghost" @click="showRevokeDialog = false">{{ t('common.cancel') }}</button>
          <button class="me-btn me-btn-danger" :disabled="revoking" @click="revokeKey">
            <v-icon v-if="revoking" size="16" class="mr-1 spin">mdi-loading</v-icon>
            {{ t('admin.keyRevoke') }}
          </button>
        </div>
      </div>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar" :timeout="2500" color="success" location="bottom right">
      {{ snackbarText }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';

const { t, locale } = useI18n();

interface ApiKey {
  _id: string;
  name: string;
  prefix: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

const loading = ref(true);
const keys = ref<ApiKey[]>([]);
const newlyCreatedKey = ref<string | null>(null);

// External API keys
const googleApiKey = ref('');
const showGoogleKey = ref(false);
const savingGoogleKey = ref(false);
const googleKeySaved = ref(false);

const showCreateDialog = ref(false);
const creating = ref(false);
const createForm = ref({
  name: '',
  permissions: ['read'] as string[],
  expiresAt: '',
});

const showRevokeDialog = ref(false);
const revoking = ref(false);
const keyToRevoke = ref<ApiKey | null>(null);

const snackbar = ref(false);
const snackbarText = ref('');

const serverUrl = computed(() => window.location.origin + '/api');

const permLabel = (p: string): string => {
  const map: Record<string, string> = {
    read: t('admin.keyPermRead'),
    write: t('admin.keyPermWrite'),
    clip: t('admin.keyPermClip'),
    export: t('admin.keyPermExport'),
    root: t('admin.keyPermRoot'),
  };
  return map[p] || p;
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(locale.value);
}

async function fetchKeys() {
  loading.value = true;
  try {
    const { data } = await api.get('/api-keys');
    keys.value = data;
  } catch {
    // ignore
  } finally {
    loading.value = false;
  }
}

function closeCreateDialog() {
  showCreateDialog.value = false;
  createForm.value = { name: '', permissions: ['read'], expiresAt: '' };
}

async function createKey() {
  creating.value = true;
  try {
    const body: Record<string, unknown> = {
      name: createForm.value.name.trim(),
      permissions: createForm.value.permissions,
    };
    if (createForm.value.expiresAt) {
      body.expiresAt = createForm.value.expiresAt;
    }
    const { data } = await api.post('/api-keys', body);
    newlyCreatedKey.value = data.key;
    closeCreateDialog();
    await fetchKeys();
  } catch {
    // ignore
  } finally {
    creating.value = false;
  }
}

async function toggleActive(key: ApiKey) {
  try {
    await api.patch(`/api-keys/${key._id}`, { isActive: !key.isActive });
    key.isActive = !key.isActive;
  } catch {
    // ignore
  }
}

function confirmRevoke(key: ApiKey) {
  keyToRevoke.value = key;
  showRevokeDialog.value = true;
}

async function revokeKey() {
  if (!keyToRevoke.value) return;
  revoking.value = true;
  try {
    await api.delete(`/api-keys/${keyToRevoke.value._id}`);
    showRevokeDialog.value = false;
    keyToRevoke.value = null;
    await fetchKeys();
  } catch {
    // ignore
  } finally {
    revoking.value = false;
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    snackbarText.value = t('admin.keyCopied');
    snackbar.value = true;
  });
}

async function loadExternalKeys() {
  try {
    const { data } = await api.get('/auth/me');
    if (data.preferences?.googleApiKey) {
      googleApiKey.value = '\u2022'.repeat(20);
    }
  } catch { /* */ }
}

async function saveGoogleApiKey() {
  savingGoogleKey.value = true;
  googleKeySaved.value = false;
  try {
    const payload: Record<string, string> = {};
    if (googleApiKey.value && !googleApiKey.value.startsWith('\u2022')) {
      payload.googleApiKey = googleApiKey.value;
    }
    await api.put('/auth/preferences', payload);
    googleKeySaved.value = true;
    googleApiKey.value = '\u2022'.repeat(20);
    setTimeout(() => { googleKeySaved.value = false; }, 3000);
  } catch { /* */ } finally {
    savingGoogleKey.value = false;
  }
}

onMounted(() => {
  fetchKeys();
  loadExternalKeys();
});
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
.sec-saved { font-size: 12px; color: var(--me-success, #4ade80); display: flex; align-items: center; }
.sec-divider { height: 1px; background: var(--me-border); margin: 10px 0; opacity: 0.5; }

.copy-field {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--me-bg-deeper, var(--me-bg-surface));
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-xs);
  padding: 6px 10px;
}
.copy-field-value {
  flex: 1;
  font-size: 13px;
  font-family: var(--me-font-mono);
  color: var(--me-text-primary);
  word-break: break-all;
  user-select: all;
}
.copy-btn {
  padding: 4px;
  flex-shrink: 0;
}

.auth-methods {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 6px;
}
.auth-method {
  font-size: 12px;
  font-family: var(--me-font-mono);
  background: var(--me-bg-deeper, var(--me-bg-surface));
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-xs);
  padding: 4px 8px;
  color: var(--me-text-secondary);
}
.auth-or {
  font-size: 12px;
  color: var(--me-text-muted);
}

.new-key-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--me-radius-xs);
  margin-bottom: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 0;
}
.empty-text {
  font-size: 13px;
  color: var(--me-text-muted);
}

.keys-table-wrap {
  overflow-x: auto;
}
.keys-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.keys-table th {
  text-align: left;
  font-weight: 700;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--me-text-muted);
  padding: 8px 10px;
  border-bottom: 1px solid var(--me-border);
  white-space: nowrap;
}
.keys-table td {
  padding: 10px;
  border-bottom: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  vertical-align: middle;
}
.keys-table tbody tr:hover {
  background: var(--me-accent-glow);
}
.key-name {
  font-weight: 600;
  color: var(--me-text-primary) !important;
}
.key-prefix {
  font-family: var(--me-font-mono);
  font-size: 12px;
  background: var(--me-bg-deeper, var(--me-bg-surface));
  padding: 2px 6px;
  border-radius: var(--me-radius-xs);
}

.perm-chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.perm-chip {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--me-accent-glow);
  color: var(--me-accent);
  white-space: nowrap;
}

.revoke-key-name {
  margin-top: 8px;
  font-size: 13px;
  color: var(--me-text-secondary);
}

/* Dialog styles */
.dialog-card {
  padding: 0;
  border-radius: var(--me-radius-sm);
  overflow: hidden;
}
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--me-border);
}
.dialog-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.dialog-body {
  padding: 20px;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--me-border);
}

.form-group {
  margin-bottom: 16px;
}
.form-group:last-child {
  margin-bottom: 0;
}
.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-primary);
  margin-bottom: 6px;
}
.perm-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.me-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: var(--me-accent);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.me-btn:hover { filter: brightness(1.15); }
.me-btn:disabled { opacity: 0.5; cursor: not-allowed; filter: none; }
.me-btn-sm { padding: 6px 12px; font-size: 12px; }
.me-btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--me-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.me-btn-ghost:hover { background: rgba(255,255,255,0.06); color: var(--me-text-primary); }
.me-btn-danger {
  background: var(--me-danger, #ef4444) !important;
  color: #fff !important;
}
.me-btn-danger-ghost {
  color: var(--me-danger, #ef4444) !important;
}
.me-btn-danger-ghost:hover {
  background: rgba(239, 68, 68, 0.1);
}

.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
