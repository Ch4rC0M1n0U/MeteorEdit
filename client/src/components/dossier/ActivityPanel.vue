<template>
  <div class="activity-panel">
    <div class="ap-header">
      <h3 class="ap-title mono">
        <v-icon size="18" class="mr-2">mdi-history</v-icon>
        Historique
      </h3>
      <span class="ap-count mono">{{ total }} evenement{{ total > 1 ? 's' : '' }}</span>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-2" />

    <div class="ap-timeline">
      <div v-for="log in logs" :key="log._id" class="ap-entry">
        <div class="ap-dot" />
        <div class="ap-content">
          <div class="ap-action">
            <span class="ap-badge" :class="getBadgeClass(log.action)">
              <v-icon size="12">{{ getIcon(log.action) }}</v-icon>
              {{ getLabel(log.action) }}
            </span>
            <span class="ap-time mono">{{ formatTime(log.timestamp) }}</span>
          </div>
          <div class="ap-actor" v-if="log.userId">
            {{ log.userId.firstName }} {{ log.userId.lastName }}
          </div>
          <div class="ap-details" v-if="getDetails(log)">{{ getDetails(log) }}</div>
        </div>
      </div>

      <div v-if="!loading && logs.length === 0" class="ap-empty">
        Aucune activite enregistree
      </div>
    </div>

    <div v-if="logs.length < total" class="ap-load-more">
      <button class="ap-more-btn" @click="loadMore" :disabled="loading">
        Charger plus
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import api from '../../services/api';
import { useDossierStore } from '../../stores/dossier';
import type { ActivityLog } from '../../types';

const dossierStore = useDossierStore();

const logs = ref<ActivityLog[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);

const actionMap: Record<string, { label: string; icon: string; accent?: boolean }> = {
  'dossier.create': { label: 'Creation', icon: 'mdi-folder-plus-outline', accent: true },
  'dossier.update': { label: 'Modification', icon: 'mdi-folder-edit-outline', accent: true },
  'dossier.delete': { label: 'Suppression', icon: 'mdi-folder-remove-outline' },
  'collaborator.add': { label: 'Collaborateur ajoute', icon: 'mdi-account-plus-outline', accent: true },
  'collaborator.remove': { label: 'Collaborateur retire', icon: 'mdi-account-minus-outline' },
  'task.create': { label: 'Tache creee', icon: 'mdi-checkbox-marked-outline', accent: true },
  'task.update': { label: 'Tache modifiee', icon: 'mdi-pencil-outline' },
  'task.delete': { label: 'Tache supprimee', icon: 'mdi-trash-can-outline' },
};

function getLabel(action: string): string { return actionMap[action]?.label || action; }
function getIcon(action: string): string { return actionMap[action]?.icon || 'mdi-information-outline'; }
function getBadgeClass(action: string): string { return actionMap[action]?.accent ? 'ap-badge--accent' : 'ap-badge--default'; }

function formatTime(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'A l\'instant';
  if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)}h`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getDetails(log: ActivityLog): string {
  const m = log.metadata || {};
  const parts: string[] = [];
  if (m.title) parts.push(m.title);
  if (m.email) parts.push(m.email);
  return parts.join(' — ');
}

async function fetchLogs(reset = false) {
  if (!dossierStore.currentDossier) return;
  if (reset) { page.value = 1; logs.value = []; }
  loading.value = true;
  try {
    const { data } = await api.get(`/dossiers/${dossierStore.currentDossier._id}/activity`, {
      params: { page: page.value, limit: 30 },
    });
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

watch(() => dossierStore.currentDossier?._id, () => fetchLogs(true));
onMounted(() => fetchLogs(true));
</script>

<style scoped>
.activity-panel { padding: 24px; }
.ap-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.ap-title { font-size: 16px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.ap-count { font-size: 13px; color: var(--me-text-muted); }

.ap-timeline { position: relative; padding-left: 20px; }
.ap-timeline::before {
  content: '';
  position: absolute; left: 5px; top: 0; bottom: 0;
  width: 2px; background: var(--me-border);
}

.ap-entry { position: relative; margin-bottom: 16px; }
.ap-dot {
  position: absolute; left: -20px; top: 4px;
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--me-bg-elevated); border: 2px solid var(--me-accent);
}
.ap-content { padding-left: 4px; }
.ap-action { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.ap-badge {
  font-size: 11px; font-family: var(--me-font-mono);
  padding: 2px 8px; border-radius: 4px; font-weight: 600;
  display: inline-flex; align-items: center; gap: 4px;
}
.ap-badge--accent { background: var(--me-accent-glow); color: var(--me-accent); }
.ap-badge--default { background: var(--me-bg-elevated); color: var(--me-text-muted); }

.ap-time { font-size: 11px; color: var(--me-text-muted); }
.ap-actor { font-size: 12px; color: var(--me-text-secondary); margin-top: 2px; font-weight: 500; }
.ap-details { font-size: 11px; color: var(--me-text-muted); margin-top: 2px; }

.ap-empty { text-align: center; padding: 32px; color: var(--me-text-muted); font-size: 13px; }

.ap-load-more { display: flex; justify-content: center; margin-top: 16px; }
.ap-more-btn {
  padding: 8px 16px; border-radius: 8px;
  background: none; border: 1px solid var(--me-border);
  color: var(--me-text-secondary); font-size: 13px; cursor: pointer;
  transition: all 0.15s;
}
.ap-more-btn:hover { border-color: var(--me-accent); color: var(--me-text-primary); }
.ap-more-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.mr-2 { margin-right: 8px; }
.mb-2 { margin-bottom: 8px; }
</style>
