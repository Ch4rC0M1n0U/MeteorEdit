<template>
  <div class="profile-activity">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-history</v-icon>
        Journal d'activite
      </h2>
    </div>

    <!-- Filters + Export -->
    <div class="branding-card glass-card fade-in fade-in-delay-1">
      <div class="activity-toolbar">
        <v-select
          v-model="selectedActions"
          :items="actionGroups"
          item-title="label"
          item-value="value"
          label="Filtrer par type"
          density="compact"
          hide-details
          multiple
          chips
          closable-chips
          clearable
          class="activity-filter"
        />
        <button class="me-btn-ghost" @click="exportCsv" :disabled="exporting">
          <v-icon size="14" class="mr-1">mdi-download-outline</v-icon>
          {{ exporting ? 'Export...' : 'Export CSV' }}
        </button>
      </div>
    </div>

    <!-- Activity list -->
    <div class="branding-card glass-card fade-in fade-in-delay-2">
      <div v-if="loading" class="activity-loading">
        <v-progress-circular indeterminate size="24" width="2" />
      </div>

      <div v-else-if="activities.length === 0" class="activity-empty">
        <v-icon size="40" class="mb-2" style="opacity: 0.3">mdi-clock-outline</v-icon>
        <p>Aucune activite sur les 7 derniers jours</p>
      </div>

      <div v-else class="activity-list">
        <div v-for="item in activities" :key="item._id" class="activity-item">
          <div class="activity-icon-wrapper">
            <v-icon size="18" :color="getActionColor(item.action)">
              {{ getActionIcon(item.action) }}
            </v-icon>
          </div>
          <div class="activity-content">
            <div class="activity-main">
              <span class="activity-label">{{ getActionLabel(item.action) }}</span>
              <span v-if="item.metadata?.title" class="activity-target">
                — {{ item.metadata.title }}
              </span>
            </div>
            <div class="activity-meta">
              <span class="activity-time">{{ formatTime(item.createdAt) }}</span>
              <span v-if="item.ip" class="activity-ip">{{ item.ip }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="activities.length > 0" class="activity-pagination">
        <button class="me-btn-ghost" :disabled="page <= 1" @click="page--; fetchActivities()">
          <v-icon size="14">mdi-chevron-left</v-icon>
          Precedent
        </button>
        <span class="activity-page mono">Page {{ page }}</span>
        <button class="me-btn-ghost" :disabled="activities.length < limit" @click="page++; fetchActivities()">
          Suivant
          <v-icon size="14">mdi-chevron-right</v-icon>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import api from '../../services/api'

interface ActivityItem {
  _id: string
  action: string
  metadata?: { title?: string; [key: string]: unknown }
  ip?: string
  createdAt: string
}

const ACTION_MAP: Record<string, { icon: string; label: string; color: string }> = {
  'login': { icon: 'mdi-login-variant', label: 'Connexion', color: '#4fc3f7' },
  'dossier.create': { icon: 'mdi-folder-plus-outline', label: 'Dossier cree', color: '#81c784' },
  'dossier.update': { icon: 'mdi-folder-edit-outline', label: 'Dossier modifie', color: '#fff176' },
  'dossier.delete': { icon: 'mdi-folder-remove-outline', label: 'Dossier supprime', color: '#e57373' },
  'node.create': { icon: 'mdi-file-plus-outline', label: 'Element cree', color: '#81c784' },
  'node.delete': { icon: 'mdi-file-remove-outline', label: 'Element supprime', color: '#e57373' },
  'node.restore': { icon: 'mdi-file-restore-outline', label: 'Element restaure', color: '#4fc3f7' },
  'collaborator.add': { icon: 'mdi-account-plus-outline', label: 'Collaborateur ajoute', color: '#81c784' },
  'collaborator.remove': { icon: 'mdi-account-minus-outline', label: 'Collaborateur retire', color: '#e57373' },
  'comment.create': { icon: 'mdi-comment-plus-outline', label: 'Commentaire ajoute', color: '#81c784' },
  'comment.delete': { icon: 'mdi-comment-remove-outline', label: 'Commentaire supprime', color: '#e57373' },
  'snapshot.create': { icon: 'mdi-history', label: 'Snapshot cree', color: '#ce93d8' },
  'snapshot.restore': { icon: 'mdi-backup-restore', label: 'Snapshot restaure', color: '#4fc3f7' },
  'profile.update': { icon: 'mdi-account-edit-outline', label: 'Profil modifie', color: '#fff176' },
  'profile.avatar_upload': { icon: 'mdi-camera-outline', label: 'Avatar modifie', color: '#fff176' },
  'profile.password_change': { icon: 'mdi-lock-reset', label: 'Mot de passe change', color: '#ffb74d' },
  '2fa.enable': { icon: 'mdi-shield-check-outline', label: '2FA active', color: '#81c784' },
  '2fa.disable': { icon: 'mdi-shield-off-outline', label: '2FA desactive', color: '#e57373' },
}

const actionGroups = [
  { label: 'Connexion', value: 'login' },
  { label: 'Dossiers', value: 'dossier.*' },
  { label: 'Elements', value: 'node.*' },
  { label: 'Collaborateurs', value: 'collaborator.*' },
  { label: 'Commentaires', value: 'comment.*' },
  { label: 'Snapshots', value: 'snapshot.*' },
  { label: 'Profil', value: 'profile.*' },
  { label: 'Securite', value: '2fa.*' },
]

const activities = ref<ActivityItem[]>([])
const loading = ref(false)
const exporting = ref(false)
const page = ref(1)
const limit = 20
const selectedActions = ref<string[]>([])

function getActionIcon(action: string): string {
  return ACTION_MAP[action]?.icon ?? 'mdi-circle-outline'
}

function getActionLabel(action: string): string {
  return ACTION_MAP[action]?.label ?? action
}

function getActionColor(action: string): string {
  return ACTION_MAP[action]?.color ?? '#90a4ae'
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return "A l'instant"
  if (diffMin < 60) return `Il y a ${diffMin} min`

  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `Il y a ${diffH}h`

  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const hours = d.getHours().toString().padStart(2, '0')
  const mins = d.getMinutes().toString().padStart(2, '0')
  return `${day}/${month} ${hours}:${mins}`
}

async function fetchActivities() {
  loading.value = true
  try {
    const params: Record<string, string | number> = { page: page.value, limit }
    if (selectedActions.value.length > 0) {
      params.action = selectedActions.value.join(',')
    }
    const { data } = await api.get('/auth/activity', { params })
    activities.value = Array.isArray(data) ? data : data.activities ?? []
  } catch {
    activities.value = []
  } finally {
    loading.value = false
  }
}

async function exportCsv() {
  exporting.value = true
  try {
    const { data } = await api.get('/auth/activity', {
      params: { format: 'csv' },
      responseType: 'blob',
    })
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `activite-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  } catch {
    // silent fail
  } finally {
    exporting.value = false
  }
}

watch(selectedActions, () => {
  page.value = 1
  fetchActivities()
})

onMounted(() => {
  fetchActivities()
})
</script>

<style scoped>
/* Shared profile styles */
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.branding-card { padding: 20px; margin-bottom: 0; }
.me-btn-ghost { padding: 8px 16px; border-radius: var(--me-radius-xs); background: none; border: 1px solid var(--me-border); color: var(--me-text-secondary); cursor: pointer; font-size: 13px; display: flex; align-items: center; }
.me-btn-ghost:hover { border-color: var(--me-border-hover); color: var(--me-text-primary); }
.me-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

.profile-activity {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.activity-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.activity-filter {
  flex: 1;
  max-width: 480px;
}

.activity-loading {
  display: flex;
  justify-content: center;
  padding: 32px 0;
}

.activity-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 0;
  color: var(--me-text-secondary, rgba(255, 255, 255, 0.4));
  font-size: 13px;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 8px;
  border-radius: 6px;
  transition: background 0.15s;
}

.activity-item:hover {
  background: rgba(255, 255, 255, 0.03);
}

.activity-icon-wrapper {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-main {
  font-size: 13px;
  line-height: 1.4;
}

.activity-label {
  font-weight: 500;
  color: var(--me-text-primary, rgba(255, 255, 255, 0.9));
}

.activity-target {
  color: var(--me-text-secondary, rgba(255, 255, 255, 0.5));
}

.activity-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
  font-size: 11px;
  color: var(--me-text-secondary, rgba(255, 255, 255, 0.35));
}

.activity-ip {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 10px;
  opacity: 0.7;
}

.activity-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--me-border, rgba(255, 255, 255, 0.06));
}

.activity-page {
  font-size: 12px;
  color: var(--me-text-secondary, rgba(255, 255, 255, 0.5));
}
</style>
