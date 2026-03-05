<template>
  <div class="admin-activity">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-history</v-icon>
        Activite
      </h2>
      <p class="admin-section-subtitle">{{ total }} evenement{{ total > 1 ? 's' : '' }}</p>
    </div>

    <div class="al-filters fade-in">
      <v-select
        v-model="filterAction"
        :items="actionItems"
        label="Action"
        density="compact"
        clearable
        hide-details
        variant="outlined"
        style="max-width: 220px;"
      />
      <input v-model="filterFrom" type="date" class="al-date-input mono" />
      <span class="al-date-sep">&mdash;</span>
      <input v-model="filterTo" type="date" class="al-date-input mono" />
    </div>

    <div class="admin-table-wrap glass-card fade-in fade-in-delay-1">
      <v-progress-linear v-if="loading" indeterminate color="primary" />
      <table class="admin-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Utilisateur</th>
            <th>Action</th>
            <th>Details</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log._id">
            <td class="mono at-date">{{ formatDate(log.timestamp) }}</td>
            <td class="at-user-cell">
              <template v-if="log.userId">
                {{ log.userId.firstName }} {{ log.userId.lastName }}
              </template>
              <span v-else class="at-badge at-badge-default">supprime</span>
            </td>
            <td>
              <span :class="['at-badge', isAccentAction(log.action) ? 'at-badge-accent' : 'at-badge-default']">
                <v-icon size="12" class="mr-1">{{ getActionIcon(log.action) }}</v-icon>
                {{ getActionLabel(log.action) }}
              </span>
            </td>
            <td class="at-details">{{ getDetails(log) }}</td>
            <td class="mono at-date">{{ log.ip || '-' }}</td>
          </tr>
          <tr v-if="!loading && logs.length === 0">
            <td colspan="5" style="text-align: center; padding: 24px;">Aucune activite</td>
          </tr>
        </tbody>
      </table>

      <div v-if="logs.length < total" class="al-load-more">
        <button class="me-btn-ghost" @click="loadMore" :disabled="loading">
          Charger plus
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import api from '../../services/api';

interface LogUser {
  firstName: string;
  lastName: string;
  email: string;
}

interface ActivityLog {
  _id: string;
  userId: LogUser | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, any>;
  ip: string;
  timestamp: string;
}

const actionMap: Record<string, { label: string; icon: string }> = {
  'login': { label: 'Connexion', icon: 'mdi-login' },
  'dossier.create': { label: 'Creation dossier', icon: 'mdi-folder-plus-outline' },
  'dossier.delete': { label: 'Suppression dossier', icon: 'mdi-folder-remove-outline' },
  'dossier.update': { label: 'Modification dossier', icon: 'mdi-folder-edit-outline' },
  'collaborator.add': { label: 'Ajout collaborateur', icon: 'mdi-account-plus-outline' },
  'collaborator.remove': { label: 'Retrait collaborateur', icon: 'mdi-account-minus-outline' },
  'user.role_change': { label: 'Changement role', icon: 'mdi-shield-account-outline' },
  'user.activate': { label: 'Activation compte', icon: 'mdi-account-check-outline' },
  'user.deactivate': { label: 'Desactivation compte', icon: 'mdi-account-off-outline' },
  'user.delete': { label: 'Suppression compte', icon: 'mdi-account-remove-outline' },
  'admin.reset_password': { label: 'Reset mot de passe', icon: 'mdi-lock-reset' },
  'admin.reset_2fa': { label: 'Reset 2FA', icon: 'mdi-shield-off-outline' },
};

const actionItems = Object.entries(actionMap).map(([value, { label }]) => ({ title: label, value }));

const logs = ref<ActivityLog[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const filterAction = ref<string | null>(null);
const filterFrom = ref('');
const filterTo = ref('');

function getActionLabel(action: string): string {
  return actionMap[action]?.label || action;
}

function getActionIcon(action: string): string {
  return actionMap[action]?.icon || 'mdi-information-outline';
}

function isAccentAction(action: string): boolean {
  return action.startsWith('dossier.') || action === 'login';
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDetails(log: ActivityLog): string {
  const meta = log.metadata || {};
  const parts: string[] = [];
  if (meta.title) parts.push(meta.title);
  if (meta.email) parts.push(meta.email);
  return parts.join(' - ') || '-';
}

async function fetchLogs(reset = false) {
  if (reset) {
    page.value = 1;
    logs.value = [];
  }
  loading.value = true;
  try {
    const params: Record<string, any> = { page: page.value, limit: 30 };
    if (filterAction.value) params.action = filterAction.value;
    if (filterFrom.value) params.from = filterFrom.value;
    if (filterTo.value) params.to = filterTo.value;
    const { data } = await api.get('/admin/logs', { params });
    if (reset) {
      logs.value = data.logs;
    } else {
      logs.value.push(...data.logs);
    }
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function loadMore() {
  page.value++;
  fetchLogs(false);
}

watch([filterAction, filterFrom, filterTo], () => {
  fetchLogs(true);
});

onMounted(() => fetchLogs(true));
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

/* Filters */
.al-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.al-date-input {
  padding: 6px 10px;
  font-size: 13px;
  background: var(--me-bg-deep);
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-xs);
  color: var(--me-text-primary);
  outline: none;
  transition: border-color 0.15s;
}
.al-date-input:focus {
  border-color: var(--me-accent);
}
.al-date-sep {
  color: var(--me-text-muted);
  font-size: 14px;
}

/* Table */
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

.at-user-cell {
  font-weight: 500;
  color: var(--me-text-primary);
}
.at-date { font-size: 12px; color: var(--me-text-muted); }
.at-details { font-size: 12px; color: var(--me-text-muted); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.at-badge {
  font-size: 11px;
  font-family: var(--me-font-mono);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}
.at-badge-accent { background: var(--me-accent-glow); color: var(--me-accent); }
.at-badge-default { background: var(--me-bg-elevated); color: var(--me-text-muted); }

.mr-1 { margin-right: 4px; }
.mr-2 { margin-right: 8px; }

/* Load more */
.al-load-more {
  display: flex;
  justify-content: center;
  padding: 16px;
  border-top: 1px solid var(--me-border);
}
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
.me-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
