<!--
  TaskList.vue — liste tâches "À faire — aujourd'hui"
  Props : tasks = [{ _id, title, dossierTitle?, due (ISO|'today'|'tomorrow'), done }]
-->
<script setup lang="ts">
import Checkbox from 'primevue/checkbox';
import { useI18n } from 'vue-i18n';

export interface Task {
  _id: string;
  title: string;
  dossierTitle?: string;
  dossierCode?: string;
  due?: string;          // ISO or 'today' / 'tomorrow' label
  done?: boolean;
}

const props = defineProps<{ tasks: Task[] }>();
const emit = defineEmits<{ (e: 'toggle', id: string): void }>();
const { t, locale } = useI18n();

function formatDue(due?: string): { label: string; isToday: boolean } {
  if (!due) return { label: '', isToday: false };
  if (due === 'today' || due === 'tomorrow') return { label: t(`task.due.${due}`), isToday: due === 'today' };
  const d = new Date(due);
  const isToday = new Date().toDateString() === d.toDateString();
  return {
    label: new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit' }).format(d),
    isToday,
  };
}
</script>

<template>
  <div class="task-list">
    <div
      v-for="task in tasks"
      :key="task._id"
      class="task"
      :class="{ 'task--done': task.done }"
    >
      <Checkbox
        :modelValue="task.done"
        :binary="true"
        class="task__check"
        @update:modelValue="emit('toggle', task._id)"
      />
      <div class="task__body">
        <div class="task__title">{{ task.title }}</div>
        <div v-if="task.dossierTitle || task.dossierCode" class="task__sub">
          <span v-if="task.dossierCode" class="num">{{ task.dossierCode }}</span>
          <span v-if="task.dossierCode && task.dossierTitle"> · </span>
          <span v-if="task.dossierTitle">{{ task.dossierTitle }}</span>
        </div>
      </div>
      <div v-if="task.due" class="task__due num" :class="{ 'task__due--today': formatDue(task.due).isToday }">
        {{ formatDue(task.due).label }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-list {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  overflow: hidden;
}
.task {
  display: grid;
  grid-template-columns: 18px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  font-size: 12.5px;
}
.task:last-child { border-bottom: 0; }
.task--done .task__title { color: var(--ink-3); text-decoration: line-through; }

.task__check :deep(.p-checkbox-box) {
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--ink-4);
  border-radius: 3px;
  background: transparent;
}
.task__check :deep(.p-checkbox-box.p-highlight) {
  background: var(--accent);
  border-color: var(--accent);
}
.task__check :deep(.p-checkbox-icon) { font-size: 9px; color: var(--on-accent); }

.task__title { color: var(--ink); font-weight: 500; }
.task__sub {
  font-size: 11px;
  color: var(--ink-3);
  margin-top: 1px;
}
.task__due {
  font-size: 11px;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}
.task__due--today { color: var(--err); font-weight: 600; }
</style>
