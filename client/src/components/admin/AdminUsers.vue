<template>
  <div class="admin-users">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-account-group-outline</v-icon>
        Utilisateurs
      </h2>
      <p class="admin-section-subtitle">{{ users.length }} utilisateur{{ users.length > 1 ? 's' : '' }}</p>
    </div>

    <div class="admin-table-wrap glass-card fade-in fade-in-delay-1">
      <v-progress-linear v-if="loading" indeterminate color="primary" />
      <table class="admin-table">
        <thead>
          <tr>
            <th>Utilisateur</th>
            <th>Email</th>
            <th>Role</th>
            <th>Statut</th>
            <th>2FA</th>
            <th>Derniere connexion</th>
            <th>Actions</th>
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
              <span class="ml-2">{{ user.isActive ? 'Actif' : 'Inactif' }}</span>
            </td>
            <td>
              <span :class="['at-badge', user.twoFactorEnabled ? 'at-badge-success' : 'at-badge-default']">
                {{ user.twoFactorEnabled ? 'Active' : 'Non' }}
              </span>
            </td>
            <td class="mono at-date">{{ user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-' }}</td>
            <td>
              <div class="at-actions">
                <button class="at-action-btn" @click="openEdit(user)" title="Modifier">
                  <v-icon size="16">mdi-pencil-outline</v-icon>
                </button>
                <button class="at-action-btn" @click="toggleActive(user)" :title="user.isActive ? 'Desactiver' : 'Activer'">
                  <v-icon size="16">{{ user.isActive ? 'mdi-account-off-outline' : 'mdi-account-check-outline' }}</v-icon>
                </button>
                <button class="at-action-btn" @click="toggleRole(user)" :title="user.role === 'admin' ? 'Retirer admin' : 'Promouvoir admin'">
                  <v-icon size="16">mdi-shield-account-outline</v-icon>
                </button>
                <button class="at-action-btn at-action-danger" @click="handleDelete(user)" title="Supprimer">
                  <v-icon size="16">mdi-trash-can-outline</v-icon>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit dialog -->
    <v-dialog v-model="editDialog" max-width="520" persistent>
      <div class="edit-dialog glass-card">
        <div class="edit-dialog-header">
          <h3 class="mono">Modifier l'utilisateur</h3>
          <button class="at-action-btn" @click="editDialog = false">
            <v-icon size="18">mdi-close</v-icon>
          </button>
        </div>

        <div class="edit-dialog-body">
          <div class="form-grid">
            <v-text-field v-model="editForm.firstName" label="Prenom" density="compact" hide-details />
            <v-text-field v-model="editForm.lastName" label="Nom" density="compact" hide-details />
          </div>
          <v-text-field v-model="editForm.email" label="Email" type="email" density="compact" hide-details class="mt-3" />
          <v-select v-model="editForm.role" :items="roleOptions" label="Role" density="compact" hide-details class="mt-3" />
          <v-switch v-model="editForm.isActive" label="Compte actif" color="primary" hide-details class="mt-3" />

          <v-alert v-if="editError" type="error" variant="tonal" class="mt-3" closable @click:close="editError = ''">{{ editError }}</v-alert>
          <v-alert v-if="editSuccess" type="success" variant="tonal" class="mt-3" closable @click:close="editSuccess = ''">{{ editSuccess }}</v-alert>

          <!-- Admin actions -->
          <div class="edit-section mt-4">
            <h4 class="edit-section-title mono">Actions administrateur</h4>

            <div class="admin-action-row">
              <div>
                <p class="admin-action-label">Reinitialiser le mot de passe</p>
                <p class="admin-action-desc">Genere un mot de passe temporaire</p>
              </div>
              <button class="me-btn-ghost" @click="handleResetPassword">
                <v-icon size="14" class="mr-1">mdi-lock-reset</v-icon>
                Reinitialiser
              </button>
            </div>

            <div class="admin-action-row" v-if="editingUser?.twoFactorEnabled">
              <div>
                <p class="admin-action-label">Reinitialiser la 2FA</p>
                <p class="admin-action-desc">Desactive la 2FA de cet utilisateur</p>
              </div>
              <button class="me-btn-ghost" @click="handleReset2FA">
                <v-icon size="14" class="mr-1">mdi-shield-off-outline</v-icon>
                Reinitialiser
              </button>
            </div>
          </div>

          <!-- Temp password display -->
          <div v-if="tempPassword" class="temp-password-box mt-3">
            <v-alert type="info" variant="tonal">
              <p class="mono" style="font-size: 13px;">Mot de passe temporaire :</p>
              <code class="temp-password-code">{{ tempPassword }}</code>
              <p style="font-size: 11px; margin-top: 4px; color: var(--me-text-muted);">Communiquez ce mot de passe a l'utilisateur. Il ne sera plus affiche.</p>
            </v-alert>
          </div>
        </div>

        <div class="edit-dialog-footer">
          <button class="me-btn-ghost" @click="editDialog = false">Annuler</button>
          <button class="me-btn-primary" @click="saveEdit" :disabled="editSaving">
            {{ editSaving ? 'Sauvegarde...' : 'Sauvegarder' }}
          </button>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import api from '../../services/api';
import { useConfirm } from '../../composables/useConfirm';

const { confirm } = useConfirm();

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

const roleOptions = [
  { title: 'Utilisateur', value: 'user' },
  { title: 'Administrateur', value: 'admin' },
];

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
    editSuccess.value = 'Modifications sauvegardees';
  } catch (e: any) {
    editError.value = e.response?.data?.message || 'Erreur';
  } finally {
    editSaving.value = false;
  }
}

async function handleResetPassword() {
  if (!editingUser.value) return;
  const ok = await confirm({
    title: 'Reinitialiser le mot de passe',
    message: `Generer un nouveau mot de passe temporaire pour ${editingUser.value.firstName} ${editingUser.value.lastName} ?`,
    confirmText: 'Reinitialiser',
    variant: 'danger',
  });
  if (!ok) return;
  try {
    const { data } = await api.post(`/admin/users/${editingUser.value._id}/reset-password`);
    tempPassword.value = data.tempPassword;
    editSuccess.value = 'Mot de passe reinitialise';
  } catch (e: any) {
    editError.value = e.response?.data?.message || 'Erreur';
  }
}

async function handleReset2FA() {
  if (!editingUser.value) return;
  const ok = await confirm({
    title: 'Reinitialiser la 2FA',
    message: `Desactiver la 2FA pour ${editingUser.value.firstName} ${editingUser.value.lastName} ?`,
    confirmText: 'Reinitialiser',
    variant: 'danger',
  });
  if (!ok) return;
  try {
    await api.post(`/admin/users/${editingUser.value._id}/reset-2fa`);
    editingUser.value.twoFactorEnabled = false;
    const idx = users.value.findIndex(u => u._id === editingUser.value!._id);
    if (idx >= 0) users.value[idx].twoFactorEnabled = false;
    editSuccess.value = '2FA reinitialise';
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
    title: 'Supprimer utilisateur',
    message: `Supprimer l'utilisateur ${user.firstName} ${user.lastName} ? Cette action est irreversible.`,
    confirmText: 'Supprimer',
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
