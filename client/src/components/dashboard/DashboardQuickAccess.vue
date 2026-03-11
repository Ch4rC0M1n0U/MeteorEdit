<template>
  <div class="dash-quick">
    <!-- Last accessed nodes -->
    <div class="dash-card glass-card">
      <h3 class="dash-card-title mono">
        <v-icon size="16" class="mr-1">mdi-history</v-icon>
        {{ $t('dashboard.lastOpened') }}
      </h3>
      <div v-if="lastAccessed.length" class="dash-quick-list">
        <div
          v-for="node in lastAccessed"
          :key="node._id"
          class="dash-quick-item"
          @click="$emit('openNode', node)"
        >
          <v-icon size="16" class="dash-quick-icon">{{ nodeIcon(node.type) }}</v-icon>
          <div class="dash-quick-info">
            <span class="dash-quick-name">{{ node.title }}</span>
            <span class="dash-quick-dossier mono">{{ node.dossierId?.title || '' }}</span>
          </div>
        </div>
      </div>
      <p v-else class="dash-empty-text">{{ $t('dashboard.noRecentElements') }}</p>
    </div>

    <!-- Assigned tasks -->
    <div class="dash-card glass-card">
      <h3 class="dash-card-title mono">
        <v-icon size="16" class="mr-1">mdi-checkbox-marked-circle-outline</v-icon>
        {{ $t('dashboard.assignedTasks') }}
      </h3>
      <div v-if="assignedTasks.length" class="dash-quick-list">
        <div
          v-for="(t, i) in assignedTasks"
          :key="i"
          class="dash-quick-item"
        >
          <span :class="['priority-dot', `priority-${t.task?.priority || 'normal'}`]" />
          <div class="dash-quick-info">
            <span class="dash-quick-name">{{ t.task?.title || t.title }}</span>
            <span v-if="t.task?.dueDate" class="dash-quick-date mono">{{ formatDate(t.task.dueDate) }}</span>
          </div>
        </div>
      </div>
      <p v-else class="dash-empty-text">{{ $t('dashboard.noAssignedTasks') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
  lastAccessed: any[];
  assignedTasks: any[];
}>();

defineEmits<{ openNode: [node: any] }>();

const { locale } = useI18n();

function nodeIcon(type: string): string {
  const icons: Record<string, string> = {
    note: 'mdi-note-text-outline',
    mindmap: 'mdi-graph-outline',
    document: 'mdi-file-document-outline',
    map: 'mdi-map-outline',
    dataset: 'mdi-table',
    folder: 'mdi-folder-outline',
  };
  return icons[type] || 'mdi-file-outline';
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString(locale.value, { day: '2-digit', month: '2-digit' });
}
</script>

<style scoped>
.dash-quick {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}
.dash-card { padding: 18px; }
.dash-card-title { font-size: 13px; font-weight: 700; color: var(--me-text-primary); margin-bottom: 12px; display: flex; align-items: center; }
.dash-quick-list { display: flex; flex-direction: column; gap: 2px; }
.dash-quick-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: var(--me-radius-xs);
  cursor: pointer; transition: background 0.15s;
}
.dash-quick-item:hover { background: var(--me-accent-glow); }
.dash-quick-icon { color: var(--me-accent); flex-shrink: 0; }
.dash-quick-info { display: flex; flex-direction: column; min-width: 0; }
.dash-quick-name { font-size: 13px; color: var(--me-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dash-quick-dossier { font-size: 11px; color: var(--me-text-muted); }
.dash-quick-date { font-size: 11px; color: var(--me-text-muted); }
.dash-empty-text { font-size: 12px; color: var(--me-text-muted); text-align: center; padding: 16px 0; }
.priority-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.priority-urgent { background: #ef4444; }
.priority-high { background: #f59e0b; }
.priority-normal { background: #38bdf8; }
.priority-low { background: #6b7280; }
@media (max-width: 900px) { .dash-quick { grid-template-columns: 1fr; } }
</style>
