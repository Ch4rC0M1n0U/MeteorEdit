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
            <th>Cree le</th>
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
            <td class="mono at-date">{{ new Date(user.createdAt).toLocaleDateString('fr-FR') }}</td>
            <td>
              <div class="at-actions">
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
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
  createdAt: string;
}

const users = ref<AdminUser[]>([]);
const loading = ref(false);

async function fetchUsers() {
  loading.value = true;
  try {
    const { data } = await api.get<AdminUser[]>('/admin/users');
    users.value = data;
  } finally {
    loading.value = false;
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
</style>
