<template>
  <div class="admin-users">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <span class="mdi mdi-account-group-outline" style="font-size: 20px; margin-right: 8px;"></span>
        {{ $t('admin.users') }}
      </h2>
      <p class="admin-section-subtitle">{{ $t('admin.userCount', { count: users.length }) }}</p>
    </div>

    <div class="admin-table-wrap glass-card fade-in fade-in-delay-1">
      <ProgressBar v-if="loading" mode="indeterminate" />
      <table class="admin-table">
        <thead>
          <tr>
            <th>{{ $t('admin.user') }}</th>
            <th>{{ $t('common.email') }}</th>
            <th>{{ $t('admin.role') }}</th>
            <th>{{ $t('common.status') }}</th>
            <th>{{ $t('admin.twoFA') }}</th>
            <th>{{ $t('admin.lastLogin') }}</th>
            <th>{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user._id">
            <td class="at-user">
              <span class="at-avatar">{{ (user.firstName[0] + user.lastName[0]).toUpperCase() }}</span>
              {{ user.firstName }} {{ user.lastName }}
            </td>
            <td class="mono at-email">{{ user.email }}</td>
            <td>
              <span :class="['at-badge', user.role === 'admin' ? 'at-badge-accent' : 'at-badge-default']">
                {{ user.role }}
              </span>
            </td>
            <td>
              <span :class="['status-dot', user.isActive ? 'status-dot--active' : 'status-dot--error']" />
              <span class="ml-2">{{ user.isActive ? $t('admin.active') : $t('admin.inactive') }}</span>
            </td>
            <td>
              <span :class="['at-badge', user.twoFactorEnabled ? 'at-badge-success' : 'at-badge-default']">
                {{ user.twoFactorEnabled ? $t('admin.enabled') : $t('admin.notEnabled') }}
              </span>
            </td>
            <td class="mono at-date">{{ user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-' }}</td>
            <td>
              <div class="at-actions">
                <button class="at-action-btn" @click="openEdit(user)" :title="$t('common.edit')">
                  <i class="pi pi-pencil" style="font-size: 16px;"></i>
                </button>
                <button class="at-action-btn" @click="toggleActive(user)" :title="user.isActive ? $t('admin.deactivate') : $t('admin.activate')">
                  <span :class="['mdi', user.isActive ? 'mdi-account-off-outline' : 'mdi-account-check-outline']" style="font-size: 16px;"></span>
                </button>
                <button class="at-action-btn" @click="toggleRole(user)" :title="user.role === 'admin' ? $t('admin.demoteAdmin') : $t('admin.promoteAdmin')">
                  <span class="mdi mdi-shield-account-outline" style="font-size: 16px;"></span>
                </button>
                <button class="at-action-btn at-action-danger" @click="handleDelete(user)" :title="$t('common.delete')">
                  <i class="pi pi-trash" style="font-size: 16px;"></i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit dialog -->
    <Dialog v-model:visible="editDialog" modal :style="{ width: '520px' }" :closable="false"><template #container>
      <div class="edit-dialog glass-card">
        <div class="edit-dialog-header">
          <h3 class="mono">{{ $t('admin.editUser') }}</h3>
          <button class="at-action-btn" @click="editDialog = false">
            <i class="pi pi-times" style="font-size: 18px;"></i>
          </button>
        </div>

        <div class="edit-dialog-body">
          <div class="form-grid">
            <InputText v-model="editForm.firstName" :label="$t('admin.firstName')" />
            <InputText v-model="editForm.lastName" :label="$t('admin.lastName')" />
          </div>
          <InputText v-model="editForm.email" :label="$t('common.email')" type="email" class="mt-3" />
          <Select v-model="editForm.role" :options="roleOptions" option-label="label" option-value="value" class="mt-3" />
          <ToggleSwitch v-model="editForm.isActive" class="mt-3" />

          <Message v-if="editError" severity="error" closable @close="editError = ''" style="margin-top: 12px;">{{ editError }}</Message>
          <Message v-if="editSuccess" severity="success" closable @close="editSuccess = ''" style="margin-top: 12px;">{{ editSuccess }}</Message>

          <!-- Admin actions -->
          <div class="edit-section mt-4">
            <h4 class="edit-section-title mono">{{ $t('admin.adminActions') }}</h4>

            <div class="admin-action-row">
              <div>
                <p class="admin-action-label">{{ $t('admin.resetPassword') }}</p>
                <p class="admin-action-desc">{{ $t('admin.resetPasswordHint') }}</p>
              </div>
              <button class="me-btn-ghost" @click="handleResetPassword">
                <span class="mdi mdi-lock-reset" style="font-size: 14px; margin-right: 4px;"></span>
                {{ $t('admin.reset') }}
              </button>
            </div>

            <div class="admin-action-row" v-if="editingUser?.twoFactorEnabled">
              <div>
                <p class="admin-action-label">{{ $t('admin.reset2FA') }}</p>
                <p class="admin-action-desc">{{ $t('admin.reset2FAHint') }}</p>
              </div>
              <button class="me-btn-ghost" @click="handleReset2FA">
                <span class="mdi mdi-shield-off-outline" style="font-size: 14px; margin-right: 4px;"></span>
                {{ $t('admin.reset') }}
              </button>
            </div>
          </div>

          <!-- Temp password display -->
          <div v-if="tempPassword" class="temp-password-box mt-3">
            <Message severity="info">
              <p class="mono" style="font-size: 13px;">{{ $t('admin.tempPassword') }}</p>
              <code class="temp-password-code">{{ tempPassword }}</code>
              <p style="font-size: 11px; margin-top: 4px; color: var(--me-text-muted);">{{ $t('admin.tempPasswordHint') }}</p>
            </Message>
          </div>
        </div>

        <div class="edit-dialog-footer">
          <button class="me-btn-ghost" @click="editDialog = false">{{ $t('common.cancel') }}</button>
          <button class="me-btn-primary" @click="saveEdit" :disabled="editSaving">
            {{ editSaving ? $t('admin.saving') : $t('common.save') }}
          </button>
        </div>
      </div>
    </template></Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';
import { useConfirm } from '../../composables/useConfirm';
import ProgressBar from 'primevue/progressbar';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import ToggleSwitch from 'primevue/toggleswitch';
import Message from 'primevue/message';
import Dialog from 'primevue/dialog';

const { confirm } = useConfirm();
const { t } = useI18n();

interface AdminUser {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const users = ref<AdminUser[]>([]);
const loading = ref(false);

const editDialog = ref(false);
const editingUser = ref<AdminUser | null>(null);
const editSaving = ref(false);
const editError = ref('');
const editSuccess = ref('');
const tempPassword = ref('');

const editForm = reactive({
  firstName: '',
  lastName: '',
  email: '',
  role: 'user',
  isActive: true,
});

const roleOptions = computed(() => [
  { label: t('admin.userRole'), value: 'user' },
  { label: t('admin.adminRole'), value: 'admin' },
]);

async function fetchUsers() {
  loading.value = true;
  try {
    const { data } = await api.get<AdminUser[]>('/admin/users');
    users.value = data;
  } finally {
    loading.value = false;
  }
}

function openEdit(user: AdminUser) {
  editingUser.value = user;
  editForm.firstName = user.firstName;
  editForm.lastName = user.lastName;
  editForm.email = user.email;
  editForm.role = user.role;
  editForm.isActive = user.isActive;
  editError.value = '';
  editSuccess.value = '';
  tempPassword.value = '';
  editDialog.value = true;
}

async function saveEdit() {
  if (!editingUser.value) return;
  editSaving.value = true;
  editError.value = '';
  try {
    const { data } = await api.patch(`/admin/users/${editingUser.value._id}`, { ...editForm });
    const idx = users.value.findIndex(u => u._id === editingUser.value!._id);
    if (idx >= 0) users.value[idx] = data;
    editingUser.value = data;
    editSuccess.value = t('admin.modificationsSaved');
  } catch (e: any) {
    editError.value = e.response?.data?.message || 'Erreur';
  } finally {
    editSaving.value = false;
  }
}

async function handleResetPassword() {
  if (!editingUser.value) return;
  const ok = await confirm({
    title: t('admin.resetPassword'),
    message: t('admin.resetPasswordConfirm', { name: `${editingUser.value.firstName} ${editingUser.value.lastName}` }),
    confirmText: t('admin.reset'),
    variant: 'danger',
  });
  if (!ok) return;
  try {
    const { data } = await api.post(`/admin/users/${editingUser.value._id}/reset-password`);
    tempPassword.value = data.tempPassword;
    editSuccess.value = t('admin.passwordResetSuccess');
  } catch (e: any) {
    editError.value = e.response?.data?.message || 'Erreur';
  }
}

async function handleReset2FA() {
  if (!editingUser.value) return;
  const ok = await confirm({
    title: t('admin.reset2FA'),
    message: t('admin.reset2FAConfirm', { name: `${editingUser.value.firstName} ${editingUser.value.lastName}` }),
    confirmText: t('admin.reset'),
    variant: 'danger',
  });
  if (!ok) return;
  try {
    await api.post(`/admin/users/${editingUser.value._id}/reset-2fa`);
    editingUser.value.twoFactorEnabled = false;
    const idx = users.value.findIndex(u => u._id === editingUser.value!._id);
    if (idx >= 0) users.value[idx].twoFactorEnabled = false;
    editSuccess.value = t('admin.twoFAResetSuccess');
  } catch (e: any) {
    editError.value = e.response?.data?.message || 'Erreur';
  }
}

async function toggleActive(user: AdminUser) {
  const { data } = await api.patch(`/admin/users/${user._id}`, { isActive: !user.isActive });
  const idx = users.value.findIndex(u => u._id === user._id);
  if (idx >= 0) users.value[idx] = data;
}

async function toggleRole(user: AdminUser) {
  const newRole = user.role === 'admin' ? 'user' : 'admin';
  const { data } = await api.patch(`/admin/users/${user._id}`, { role: newRole });
  const idx = users.value.findIndex(u => u._id === user._id);
  if (idx >= 0) users.value[idx] = data;
}

async function handleDelete(user: AdminUser) {
  const ok = await confirm({
    title: t('admin.deleteUser'),
    message: t('admin.deleteUserConfirm', { name: `${user.firstName} ${user.lastName}` }),
    confirmText: t('common.delete'),
    variant: 'danger',
  });
  if (ok) {
    await api.delete(`/admin/users/${user._id}`);
    users.value = users.value.filter(u => u._id !== user._id);
  }
}

onMounted(fetchUsers);
</script>

<style scoped>
.admin-section-header { margin-bottom: 20px; }
.admin-section-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--me-text-primary);
  display: flex;
  align-items: center;
}
.admin-section-subtitle {
  font-size: 13px;
  color: var(--me-text-muted);
  margin-top: 4px;
  font-family: var(--me-font-mono);
}
.admin-table-wrap { overflow: hidden; padding: 0; }
.admin-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.admin-table thead { background: var(--me-bg-elevated); }
.admin-table th {
  text-align: left;
  padding: 12px 16px;
  font-family: var(--me-font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--me-text-muted);
  font-weight: 600;
  border-bottom: 1px solid var(--me-border);
}
.admin-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--me-border);
  color: var(--me-text-secondary);
}
.admin-table tbody tr:hover { background: var(--me-accent-glow); }
.at-user {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
  color: var(--me-text-primary);
}
.at-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  font-size: 10px;
  font-weight: 700;
  font-family: var(--me-font-mono);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--me-text-muted);
}
.at-email { font-size: 12px; color: var(--me-text-muted); }
.at-date { font-size: 12px; color: var(--me-text-muted); }
.at-badge {
  font-size: 11px;
  font-family: var(--me-font-mono);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.at-badge-accent { background: var(--me-accent-glow); color: var(--me-accent); }
.at-badge-success { background: rgba(52, 211, 153, 0.1); color: #34d399; }
.at-badge-default { background: var(--me-bg-elevated); color: var(--me-text-muted); }
.at-actions { display: flex; gap: 4px; }
.at-action-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--me-radius-xs);
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.at-action-btn:hover { background: var(--me-accent-glow); color: var(--me-text-primary); }
.at-action-danger:hover { background: rgba(248, 113, 113, 0.1); color: var(--me-error); }
.ml-2 { margin-left: 8px; }

/* Edit dialog */
.edit-dialog {
  padding: 0;
  border-radius: var(--me-radius-sm);
  overflow: hidden;
}
.edit-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--me-border);
}
.edit-dialog-header h3 {
  font-size: 15px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.edit-dialog-body {
  padding: 20px;
}
.edit-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--me-border);
}
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.mt-3 { margin-top: 12px; }
.mt-4 { margin-top: 16px; }
.mr-1 { margin-right: 4px; }

.edit-section {
  border-top: 1px solid var(--me-border);
  padding-top: 16px;
}
.edit-section-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--me-text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
}
.admin-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--me-border);
}
.admin-action-row:last-child { border-bottom: none; }
.admin-action-label { font-size: 13px; color: var(--me-text-primary); font-weight: 500; }
.admin-action-desc { font-size: 11px; color: var(--me-text-muted); margin-top: 2px; }

.temp-password-code {
  display: block;
  padding: 8px 12px;
  margin-top: 6px;
  background: var(--me-bg-deep);
  border: 1px solid var(--me-border);
  border-radius: 4px;
  font-family: var(--me-font-mono);
  font-size: 16px;
  font-weight: 700;
  color: var(--me-accent);
  letter-spacing: 1px;
  user-select: all;
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
.me-btn-primary:hover { box-shadow: 0 0 16px var(--me-accent-glow); }
.me-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.me-btn-ghost {
  padding: 8px 16px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
}
.me-btn-ghost:hover { border-color: var(--me-border-hover); color: var(--me-text-primary); }
</style>
