<template>
  <div class="admin-audit">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-shield-check</v-icon>
        Journal d'audit
      </h2>
      <p class="admin-section-subtitle">Suivi detaille de toutes les actions</p>
    </div>

    <!-- KPI Cards -->
    <div class="audit-kpi-row fade-in fade-in-delay-1">
      <div class="kpi-card glass-card">
        <div class="kpi-icon"><v-icon size="24">mdi-calendar-today</v-icon></div>
        <div class="kpi-data">
          <span class="kpi-value mono">{{ stats.today }}</span>
          <span class="kpi-label">Actions aujourd'hui</span>
        </div>
      </div>
      <div class="kpi-card glass-card">
        <div class="kpi-icon"><v-icon size="24">mdi-calendar-week</v-icon></div>
        <div class="kpi-data">
          <span class="kpi-value mono">{{ stats.week }}</span>
          <span class="kpi-label">Actions cette semaine</span>
        </div>
      </div>
      <div class="kpi-card glass-card">
        <div class="kpi-icon"><v-icon size="24">mdi-account-star</v-icon></div>
        <div class="kpi-data">
          <span class="kpi-value mono">{{ topUserName }}</span>
          <span class="kpi-label">Utilisateur le plus actif</span>
          <span class="kpi-sub mono" v-if="topUserCount">{{ topUserCount }} actions</span>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="audit-filters fade-in fade-in-delay-1">
      <input v-model="filterFrom" type="date" class="al-date-input mono" />
      <span class="al-date-sep">&mdash;</span>
      <input v-model="filterTo" type="date" class="al-date-input mono" />
      <v-select
        v-model="filterUser"
        :items="userItems"
        label="Utilisateur"
        density="compact"
        clearable
        hide-details
        variant="outlined"
        style="max-width: 200px;"
      />
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
      <v-select
        v-model="filterTargetType"
        :items="targetTypeItems"
        label="Type cible"
        density="compact"
        clearable
        hide-details
        variant="outlined"
        style="max-width: 160px;"
      />
      <input
        v-model="filterSearch"
        type="text"
        class="al-date-input mono"
        placeholder="Rechercher..."
        style="min-width: 160px;"
      />
      <button class="me-btn-ghost" @click="exportCSV" title="Exporter CSV">
        <v-icon size="16" class="mr-1">mdi-download</v-icon>
        CSV
      </button>
    </div>

    <!-- Table -->
    <div class="admin-table-wrap glass-card fade-in fade-in-delay-2">
      <v-progress-linear v-if="loading" indeterminate color="primary" />
      <table class="admin-table">
        <thead>
          <tr>
            <th style="width: 36px;"></th>
            <th>Date</th>
            <th>Utilisateur</th>
            <th>Action</th>
            <th>Cible</th>
            <th>IP</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="log in logs" :key="log._id">
            <tr @click="toggleExpand(log._id)" class="audit-row">
              <td>
                <v-icon size="14" class="expand-icon" :class="{ 'expand-icon--open': expandedId === log._id }">
                  mdi-chevron-right
                </v-icon>
              </td>
              <td class="mono at-date">{{ formatDate(log.timestamp) }}</td>
              <td class="at-user-cell">
                <template v-if="log.userId">
                  {{ log.userId.firstName }} {{ log.userId.lastName }}
                </template>
                <span v-else class="at-badge at-badge-default">supprime</span>
              </td>
              <td>
                <span :class="['at-badge', getBadgeClass(log.action)]">
                  <v-icon size="12" class="mr-1">{{ getActionIcon(log.action) }}</v-icon>
                  {{ getActionLabel(log.action) }}
                </span>
              </td>
              <td class="mono at-date">{{ log.targetType || '-' }}</td>
              <td class="mono at-date">{{ log.ip || '-' }}</td>
              <td class="at-details">{{ getDetails(log) }}</td>
            </tr>
            <tr v-if="expandedId === log._id" class="audit-expanded-row">
              <td colspan="7">
                <div class="audit-expanded-content">
                  <div class="audit-meta-grid">
                    <div class="audit-meta-item">
                      <span class="audit-meta-label">Action</span>
                      <span class="audit-meta-value mono">{{ log.action }}</span>
                    </div>
                    <div class="audit-meta-item">
                      <span class="audit-meta-label">Type cible</span>
                      <span class="audit-meta-value mono">{{ log.targetType }}</span>
                    </div>
                    <div class="audit-meta-item">
                      <span class="audit-meta-label">ID cible</span>
                      <span class="audit-meta-value mono">{{ log.targetId || '-' }}</span>
                    </div>
                    <div class="audit-meta-item">
                      <span class="audit-meta-label">IP</span>
                      <span class="audit-meta-value mono">{{ log.ip || '-' }}</span>
                    </div>
                    <div class="audit-meta-item" v-if="log.userAgent">
                      <span class="audit-meta-label">User Agent</span>
                      <span class="audit-meta-value mono audit-ua">{{ log.userAgent }}</span>
                    </div>
                  </div>
                  <div class="audit-meta-json" v-if="log.metadata && Object.keys(log.metadata).length > 0">
                    <span class="audit-meta-label">Metadata</span>
                    <pre class="mono">{{ JSON.stringify(log.metadata, null, 2) }}</pre>
                  </div>
                </div>
              </td>
            </tr>
          </template>
          <tr v-if="!loading && logs.length === 0">
            <td colspan="7" style="text-align: center; padding: 24px;">Aucun evenement</td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="audit-pagination" v-if="totalPages > 1">
        <button class="me-btn-ghost" :disabled="page <= 1" @click="goPage(page - 1)">
          <v-icon size="16">mdi-chevron-left</v-icon>
        </button>
        <span class="mono audit-page-info">{{ page }} / {{ totalPages }}</span>
        <button class="me-btn-ghost" :disabled="page >= totalPages" @click="goPage(page + 1)">
          <v-icon size="16">mdi-chevron-right</v-icon>
        </button>
        <span class="mono audit-total-info">{{ total }} resultats</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import api from '../../services/api';

interface LogUser {
  firstName: string;
  lastName: string;
  email: string;
}

interface AuditLog {
  _id: string;
  userId: LogUser | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, any>;
  ip: string;
  userAgent: string;
  timestamp: string;
}

interface AuditStats {
  today: number;
  week: number;
  topUsers: Array<{ userId: string; firstName: string; lastName: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
}

interface UserItem {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

const actionMap: Record<string, { label: string; icon: string }> = {
  'auth.login': { label: 'Connexion', icon: 'mdi-login' },
  'auth.login_failed': { label: 'Echec connexion', icon: 'mdi-login-variant' },
  'auth.register': { label: 'Inscription', icon: 'mdi-account-plus' },
  'login': { label: 'Connexion', icon: 'mdi-login' },
  'register': { label: 'Inscription', icon: 'mdi-account-plus' },
  'dossier.create': { label: 'Creation dossier', icon: 'mdi-folder-plus-outline' },
  'dossier.delete': { label: 'Suppression dossier', icon: 'mdi-folder-remove-outline' },
  'dossier.update': { label: 'Modification dossier', icon: 'mdi-folder-edit-outline' },
  'node.create': { label: 'Creation noeud', icon: 'mdi-file-plus-outline' },
  'node.update': { label: 'Modification noeud', icon: 'mdi-file-edit-outline' },
  'node.delete': { label: 'Suppression noeud', icon: 'mdi-file-remove-outline' },
  'node.restore': { label: 'Restauration noeud', icon: 'mdi-file-restore-outline' },
  'node.move': { label: 'Deplacement noeud', icon: 'mdi-file-move-outline' },
  'node.purge': { label: 'Purge noeud', icon: 'mdi-delete-forever-outline' },
  'node.empty_trash': { label: 'Vider corbeille', icon: 'mdi-delete-sweep-outline' },
  'collaborator.add': { label: 'Ajout collaborateur', icon: 'mdi-account-plus-outline' },
  'collaborator.remove': { label: 'Retrait collaborateur', icon: 'mdi-account-minus-outline' },
  'user.role_change': { label: 'Changement role', icon: 'mdi-shield-account-outline' },
  'user.activate': { label: 'Activation compte', icon: 'mdi-account-check-outline' },
  'user.deactivate': { label: 'Desactivation compte', icon: 'mdi-account-off-outline' },
  'user.delete': { label: 'Suppression compte', icon: 'mdi-account-remove-outline' },
  'admin.reset_password': { label: 'Reset mot de passe', icon: 'mdi-lock-reset' },
  'admin.reset_2fa': { label: 'Reset 2FA', icon: 'mdi-shield-off-outline' },
  'clip.create': { label: 'Web clip', icon: 'mdi-paperclip' },
  'ai.generate_report': { label: 'Rapport IA', icon: 'mdi-robot-outline' },
  'ai.summarize': { label: 'Resume IA', icon: 'mdi-text-box-outline' },
  'ai.model_pull': { label: 'Modele IA pull', icon: 'mdi-download' },
  'ai.model_delete': { label: 'Modele IA supprime', icon: 'mdi-delete-outline' },
  'entity.enrich': { label: 'Enrichissement entite', icon: 'mdi-magnify-plus-outline' },
  'export.json': { label: 'Export JSON', icon: 'mdi-code-json' },
  'export.pdf': { label: 'Export PDF', icon: 'mdi-file-pdf-box' },
  'profile.update': { label: 'Profil modifie', icon: 'mdi-account-edit-outline' },
  'profile.password_change': { label: 'Mot de passe modifie', icon: 'mdi-key-outline' },
  'profile.avatar_upload': { label: 'Avatar upload', icon: 'mdi-camera-outline' },
  '2fa.enable': { label: '2FA active', icon: 'mdi-shield-check-outline' },
  '2fa.disable': { label: '2FA desactive', icon: 'mdi-shield-off-outline' },
  'settings.branding_update': { label: 'Apparence modifiee', icon: 'mdi-palette-outline' },
  'settings.security_update': { label: 'Securite modifiee', icon: 'mdi-shield-lock-outline' },
  'settings.ai_update': { label: 'Config IA modifiee', icon: 'mdi-robot-outline' },
  'settings.maintenance_on': { label: 'Maintenance activee', icon: 'mdi-wrench-outline' },
  'settings.maintenance_off': { label: 'Maintenance desactivee', icon: 'mdi-wrench-outline' },
  'settings.storage_update': { label: 'Stockage modifie', icon: 'mdi-harddisk' },
  'settings.email_update': { label: 'Config SMTP modifiee', icon: 'mdi-email-outline' },
  'settings.email_test': { label: 'Test email envoye', icon: 'mdi-email-check-outline' },
  'settings.clipper_update': { label: 'Config clipper modifiee', icon: 'mdi-scissors-cutting' },
  'settings.defaults_update': { label: 'Parametres par defaut modifies', icon: 'mdi-cog-outline' },
  'settings.network_update': { label: 'Config reseau modifiee', icon: 'mdi-lan' },
  'settings.announcement_update': { label: 'Banniere d\'annonce modifiee', icon: 'mdi-bullhorn-outline' },
  'settings.backup_export': { label: 'Sauvegarde exportee', icon: 'mdi-cloud-download-outline' },
  'settings.backup_import': { label: 'Sauvegarde importee', icon: 'mdi-cloud-upload-outline' },
  'settings.logo_upload': { label: 'Logo uploade', icon: 'mdi-image-outline' },
  'settings.logo_delete': { label: 'Logo supprime', icon: 'mdi-image-off-outline' },
  'settings.favicon_upload': { label: 'Favicon uploade', icon: 'mdi-emoticon-outline' },
  'settings.favicon_delete': { label: 'Favicon supprime', icon: 'mdi-emoticon-outline' },
  'settings.login_background_upload': { label: 'Image fond connexion uploadee', icon: 'mdi-image-outline' },
  'settings.login_background_delete': { label: 'Image fond connexion supprimee', icon: 'mdi-image-off-outline' },
  'task.create': { label: 'Creation tache', icon: 'mdi-checkbox-outline' },
  'task.update': { label: 'Modification tache', icon: 'mdi-checkbox-marked-outline' },
  'task.delete': { label: 'Suppression tache', icon: 'mdi-checkbox-blank-off-outline' },
  'snapshot.create': { label: 'Snapshot cree', icon: 'mdi-history' },
  'snapshot.restore': { label: 'Snapshot restaure', icon: 'mdi-backup-restore' },
  'snapshot.delete': { label: 'Snapshot supprime', icon: 'mdi-delete-clock-outline' },
  'comment.create': { label: 'Commentaire', icon: 'mdi-comment-plus-outline' },
  'comment.delete': { label: 'Commentaire supprime', icon: 'mdi-comment-remove-outline' },
};

const actionItems = computed(() => {
  const uniqueActions = new Set<string>();
  // Add known actions
  Object.keys(actionMap).forEach(a => uniqueActions.add(a));
  // Add actions from stats
  stats.value.topActions.forEach(a => uniqueActions.add(a.action));
  return Array.from(uniqueActions).sort().map(a => ({
    title: actionMap[a]?.label || a,
    value: a,
  }));
});

const targetTypeItems = [
  { title: 'Dossier', value: 'dossier' },
  { title: 'Utilisateur', value: 'user' },
  { title: 'Systeme', value: 'system' },
  { title: 'Noeud', value: 'node' },
];

const logs = ref<AuditLog[]>([]);
const total = ref(0);
const page = ref(1);
const limit = 30;
const loading = ref(false);
const expandedId = ref<string | null>(null);
const stats = ref<AuditStats>({ today: 0, week: 0, topUsers: [], topActions: [] });
const users = ref<UserItem[]>([]);

const filterFrom = ref('');
const filterTo = ref('');
const filterUser = ref<string | null>(null);
const filterAction = ref<string | null>(null);
const filterTargetType = ref<string | null>(null);
const filterSearch = ref('');

const totalPages = computed(() => Math.ceil(total.value / limit));

const userItems = computed(() =>
  users.value.map(u => ({
    title: `${u.firstName} ${u.lastName}`,
    value: u._id,
  }))
);

const topUserName = computed(() => {
  const top = stats.value.topUsers[0];
  if (!top) return '-';
  return `${top.firstName} ${top.lastName}`.trim() || '-';
});

const topUserCount = computed(() => stats.value.topUsers[0]?.count || 0);

function getBadgeClass(action: string): string {
  if (action.startsWith('auth.') || action === 'login' || action === 'register') return 'at-badge-blue';
  if (action.startsWith('dossier.') || action.startsWith('collaborator.')) return 'at-badge-green';
  if (action.startsWith('node.') || action.startsWith('snapshot.')) return 'at-badge-orange';
  if (action.startsWith('admin.') || action.startsWith('user.') || action.startsWith('settings.')) return 'at-badge-red';
  if (action.startsWith('clip.') || action.startsWith('comment.')) return 'at-badge-purple';
  if (action.startsWith('ai.') || action.startsWith('entity.')) return 'at-badge-cyan';
  if (action.startsWith('export.')) return 'at-badge-default';
  if (action.startsWith('profile.') || action.startsWith('2fa.')) return 'at-badge-blue';
  if (action.startsWith('task.')) return 'at-badge-orange';
  return 'at-badge-default';
}

function getActionLabel(action: string): string {
  return actionMap[action]?.label || action;
}

function getActionIcon(action: string): string {
  return actionMap[action]?.icon || 'mdi-information-outline';
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getDetails(log: AuditLog): string {
  const meta = log.metadata || {};
  const parts: string[] = [];
  if (meta.title) parts.push(meta.title);
  if (meta.email) parts.push(meta.email);
  if (meta.model) parts.push(meta.model);
  if (meta.reason) parts.push(meta.reason);
  return parts.join(' - ') || '-';
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}

async function fetchLogs() {
  loading.value = true;
  try {
    const params: Record<string, any> = { page: page.value, limit };
    if (filterUser.value) params.userId = filterUser.value;
    if (filterAction.value) params.action = filterAction.value;
    if (filterTargetType.value) params.targetType = filterTargetType.value;
    if (filterFrom.value) params.startDate = filterFrom.value;
    if (filterTo.value) params.endDate = filterTo.value;
    if (filterSearch.value.trim()) params.search = filterSearch.value.trim();
    const { data } = await api.get('/admin/audit-logs', { params });
    logs.value = data.logs;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

async function fetchStats() {
  try {
    const { data } = await api.get('/admin/audit-stats');
    stats.value = data;
  } catch { /* ignore */ }
}

async function fetchUsers() {
  try {
    const { data } = await api.get('/admin/users');
    users.value = data;
  } catch { /* ignore */ }
}

function goPage(p: number) {
  page.value = p;
  fetchLogs();
}

let searchTimeout: number | null = null;
watch(filterSearch, () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = window.setTimeout(() => {
    page.value = 1;
    fetchLogs();
  }, 400);
});

watch([filterUser, filterAction, filterTargetType, filterFrom, filterTo], () => {
  page.value = 1;
  fetchLogs();
});

function exportCSV() {
  if (logs.value.length === 0) return;
  const headers = ['Date', 'Utilisateur', 'Email', 'Action', 'Type cible', 'ID cible', 'IP', 'User Agent', 'Details'];
  const rows = logs.value.map(log => [
    new Date(log.timestamp).toISOString(),
    log.userId ? `${log.userId.firstName} ${log.userId.lastName}` : 'supprime',
    log.userId?.email || '',
    log.action,
    log.targetType,
    log.targetId || '',
    log.ip || '',
    log.userAgent || '',
    JSON.stringify(log.metadata || {}),
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(() => {
  fetchStats();
  fetchUsers();
  fetchLogs();
});
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

/* KPI */
.audit-kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.kpi-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
}
.kpi-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--me-radius-xs);
  background: var(--me-accent-glow);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--me-accent);
  flex-shrink: 0;
}
.kpi-data {
  display: flex;
  flex-direction: column;
}
.kpi-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.kpi-label {
  font-size: 12px;
  color: var(--me-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.kpi-sub {
  font-size: 11px;
  color: var(--me-text-muted);
}

/* Filters */
.audit-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
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
  padding: 10px 16px;
  border-bottom: 1px solid var(--me-border);
  color: var(--me-text-secondary);
}
.admin-table tbody tr:hover { background: var(--me-accent-glow); }

.audit-row { cursor: pointer; }

.at-user-cell {
  font-weight: 500;
  color: var(--me-text-primary);
}
.at-date { font-size: 12px; color: var(--me-text-muted); }
.at-details { font-size: 12px; color: var(--me-text-muted); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

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
.at-badge-default { background: var(--me-bg-elevated); color: var(--me-text-muted); }
.at-badge-blue { background: rgba(66, 133, 244, 0.12); color: #5b9aff; }
.at-badge-green { background: rgba(52, 168, 83, 0.12); color: #4caf50; }
.at-badge-orange { background: rgba(251, 140, 0, 0.12); color: #fb8c00; }
.at-badge-red { background: rgba(234, 67, 53, 0.12); color: #ef5350; }
.at-badge-purple { background: rgba(156, 39, 176, 0.12); color: #ba68c8; }
.at-badge-cyan { background: rgba(0, 188, 212, 0.12); color: #26c6da; }

/* Expand */
.expand-icon {
  transition: transform 0.15s;
  color: var(--me-text-muted);
}
.expand-icon--open {
  transform: rotate(90deg);
}

.audit-expanded-row td {
  padding: 0 !important;
  border-bottom: 1px solid var(--me-border);
}
.audit-expanded-content {
  padding: 16px 24px 16px 52px;
  background: var(--me-bg-deep);
}
.audit-meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.audit-meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.audit-meta-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--me-text-muted);
  font-family: var(--me-font-mono);
  font-weight: 600;
}
.audit-meta-value {
  font-size: 13px;
  color: var(--me-text-primary);
  word-break: break-all;
}
.audit-ua {
  font-size: 11px;
  color: var(--me-text-muted);
  max-width: 500px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.audit-meta-json {
  margin-top: 8px;
}
.audit-meta-json pre {
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-xs);
  padding: 12px;
  font-size: 12px;
  color: var(--me-text-secondary);
  overflow-x: auto;
  margin-top: 4px;
}

/* Pagination */
.audit-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--me-border);
}
.audit-page-info {
  font-size: 13px;
  color: var(--me-text-secondary);
}
.audit-total-info {
  font-size: 12px;
  color: var(--me-text-muted);
  margin-left: 8px;
}

.mr-1 { margin-right: 4px; }
.mr-2 { margin-right: 8px; }

.me-btn-ghost {
  padding: 6px 12px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  cursor: pointer;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
}
.me-btn-ghost:hover { border-color: var(--me-border-hover); color: var(--me-text-primary); }
.me-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
