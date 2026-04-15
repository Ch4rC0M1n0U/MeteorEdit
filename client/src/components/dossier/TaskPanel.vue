<template>
  <div class="task-panel">

    <!-- En-tête -->
    <div class="tp-header">
      <div class="tp-header-left">
        <span class="mdi mdi-checkbox-marked-outline tp-header-icon"></span>
        <span class="tp-header-title">{{ $t('tasks.title') }}</span>
        <Tag :value="`${doneCount}/${tasks.length}`" severity="secondary" rounded class="tp-count-tag" />
      </div>
      <Button
        icon="pi pi-plus"
        :label="$t('tasks.newTask')"
        size="small"
        @click="showCreate = true"
      />
    </div>

    <!-- Barre de progression -->
    <ProgressBar
      v-if="tasks.length"
      :value="progressPct"
      :show-value="false"
      class="tp-progress"
    />

    <!-- Filtres -->
    <SelectButton
      v-model="filterStatus"
      :options="statusFilters"
      option-label="label"
      option-value="value"
      :allow-empty="true"
      class="tp-filters"
      size="small"
    >
      <template #option="{ option }">
        <span class="tp-filter-option">
          <span :class="'tp-filter-dot tp-filter-dot--' + option.value"></span>
          {{ option.label }}
          <span class="tp-filter-count">{{ countByStatus(option.value) }}</span>
        </span>
      </template>
    </SelectButton>

    <!-- Spinner -->
    <div v-if="loading" class="tp-loading">
      <ProgressSpinner style="width: 24px; height: 24px;" />
    </div>

    <!-- Liste des tâches -->
    <div class="tp-list">
      <div
        v-for="task in filteredTasks"
        :key="task._id"
        class="tp-task"
        :class="'tp-task--' + task.status"
      >
        <!-- Indicateur statut -->
        <button class="tp-check" @click="cycleStatus(task)" :title="$t('tasks.cycleStatus')">
          <span :class="'mdi ' + statusIcon(task.status)" class="tp-check-icon"></span>
        </button>

        <!-- Corps -->
        <div class="tp-task-body" @click="editTask(task)">
          <div class="tp-task-title">{{ task.title }}</div>
          <div v-if="task.description" class="tp-task-desc">{{ task.description }}</div>
          <div class="tp-task-meta">
            <Tag
              :value="priorityLabel(task.priority)"
              :severity="prioritySeverity(task.priority)"
              rounded
              class="tp-priority-tag"
            />
            <span v-if="task.assigneeId" class="tp-meta-chip">
              <i class="pi pi-user"></i>
              {{ task.assigneeId.firstName }}
            </span>
            <span v-if="task.dueDate" class="tp-meta-chip" :class="{ 'tp-meta-chip--late': isOverdue(task) }">
              <i class="pi pi-calendar"></i>
              {{ formatDate(task.dueDate) }}
            </span>
          </div>
        </div>

        <!-- Supprimer -->
        <Button
          icon="pi pi-trash"
          text
          rounded
          severity="danger"
          size="small"
          class="tp-delete-btn"
          @click.stop="handleDelete(task)"
          :title="$t('common.delete')"
        />
      </div>

      <div v-if="!loading && filteredTasks.length === 0" class="tp-empty">
        <span class="mdi mdi-check-all tp-empty-icon"></span>
        <p>{{ filterStatus ? $t('tasks.noTasksFiltered') : $t('tasks.noTasks') }}</p>
      </div>
    </div>

    <!-- Dialog création / édition -->
    <Dialog
      v-model:visible="showCreate"
      modal
      :header="editingTask ? $t('tasks.editTask') : $t('tasks.newTask')"
      :style="{ width: '440px' }"
      :closable="true"
      @hide="closeDialog"
    >
      <div class="tp-form">
        <div class="tp-field">
          <label class="tp-label">{{ $t('tasks.taskTitle') }} *</label>
          <InputText
            v-model="form.title"
            :placeholder="$t('tasks.taskTitlePlaceholder')"
            class="w-full"
            autofocus
          />
        </div>

        <div class="tp-field">
          <label class="tp-label">{{ $t('tasks.description') }}</label>
          <Textarea
            v-model="form.description"
            :placeholder="$t('tasks.descPlaceholder')"
            :rows="3"
            class="w-full"
            auto-resize
          />
        </div>

        <div class="tp-field-row">
          <div class="tp-field">
            <label class="tp-label">{{ $t('tasks.priority') }}</label>
            <Select
              v-model="form.priority"
              :options="priorityOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </div>
          <div class="tp-field">
            <label class="tp-label">{{ $t('tasks.dueDate') }}</label>
            <DatePicker
              v-model="form.dueDateObj"
              date-format="dd/mm/yy"
              :show-icon="true"
              class="w-full"
            />
          </div>
        </div>

        <div class="tp-field">
          <label class="tp-label">{{ $t('tasks.assignTo') }}</label>
          <Select
            v-model="form.assigneeId"
            :options="assigneeOptions"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </div>
      </div>

      <template #footer>
        <Button :label="$t('common.cancel')" text severity="secondary" @click="closeDialog" />
        <Button
          :label="editingTask ? $t('tasks.modify') : $t('common.create')"
          icon="pi pi-check"
          @click="saveTask"
          :disabled="!form.title.trim()"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Select from 'primevue/select';
import DatePicker from 'primevue/datepicker';
import SelectButton from 'primevue/selectbutton';
import ProgressBar from 'primevue/progressbar';
import ProgressSpinner from 'primevue/progressspinner';
import Tag from 'primevue/tag';
import api from '../../services/api';
import { useDossierStore } from '../../stores/dossier';
import { useConfirm } from '../../composables/useConfirm';
import type { Task, CollaboratorUser } from '../../types';

const { t, locale } = useI18n();
const dossierStore = useDossierStore();
const { confirm } = useConfirm();

const tasks = ref<Task[]>([]);
const loading = ref(false);
const showCreate = ref(false);
const editingTask = ref<Task | null>(null);
const filterStatus = ref<string | null>(null);
const assignableUsers = ref<CollaboratorUser[]>([]);

const statusFilters = computed(() => [
  { label: t('tasks.toDo'), value: 'todo' },
  { label: t('tasks.inProgress'), value: 'in_progress' },
  { label: t('tasks.done'), value: 'done' },
]);

const priorityOptions = computed(() => [
  { label: t('tasks.priorityLow'), value: 'low' },
  { label: t('tasks.priorityMedium'), value: 'medium' },
  { label: t('tasks.priorityHigh'), value: 'high' },
]);

const assigneeOptions = computed(() => [
  { label: t('tasks.unassigned'), value: '' },
  ...assignableUsers.value.map(u => ({ label: `${u.firstName} ${u.lastName}`, value: u._id })),
]);

const form = ref({
  title: '',
  description: '',
  priority: 'medium' as string,
  dueDateObj: null as Date | null,
  assigneeId: '',
});

const doneCount = computed(() => tasks.value.filter(t => t.status === 'done').length);
const progressPct = computed(() => tasks.value.length ? Math.round((doneCount.value / tasks.value.length) * 100) : 0);

const filteredTasks = computed(() => {
  let list = tasks.value;
  if (filterStatus.value) list = list.filter(t => t.status === filterStatus.value);
  return [...list].sort((a, b) => {
    const so: Record<string, number> = { todo: 0, in_progress: 1, done: 2 };
    const po: Record<string, number> = { high: 0, medium: 1, low: 2 };
    if (so[a.status] !== so[b.status]) return so[a.status]! - so[b.status]!;
    return po[a.priority]! - po[b.priority]!;
  });
});

function countByStatus(status: string) {
  return tasks.value.filter(t => t.status === status).length;
}

function statusIcon(status: string) {
  return { todo: 'mdi-checkbox-blank-outline', in_progress: 'mdi-progress-check', done: 'mdi-checkbox-marked' }[status] ?? 'mdi-checkbox-blank-outline';
}

function priorityLabel(priority: string) {
  return { low: t('tasks.priorityLow'), medium: t('tasks.priorityMedium'), high: t('tasks.priorityHigh') }[priority] ?? priority;
}

function prioritySeverity(priority: string): 'success' | 'warn' | 'danger' | 'secondary' {
  return { high: 'danger', medium: 'warn', low: 'success' }[priority] as any ?? 'secondary';
}

function isOverdue(task: Task) {
  if (!task.dueDate || task.status === 'done') return false;
  return new Date(task.dueDate) < new Date();
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(locale.value, { day: '2-digit', month: '2-digit' });
}

async function fetchTasks() {
  if (!dossierStore.currentDossier) return;
  loading.value = true;
  try {
    const { data } = await api.get(`/dossiers/${dossierStore.currentDossier._id}/tasks`);
    tasks.value = data;
  } finally {
    loading.value = false;
  }
}

async function fetchAssignableUsers() {
  if (!dossierStore.currentDossier) return;
  const dossier = dossierStore.currentDossier;
  const users: CollaboratorUser[] = [];
  for (const c of (dossier.collaborators || [])) {
    if (typeof c === 'object' && c._id) users.push(c as CollaboratorUser);
  }
  try {
    const { data } = await api.get(`/dossiers/${dossier._id}`);
    if (data.owner && typeof data.owner === 'object' && !users.some((u: any) => u._id === data.owner._id)) {
      users.unshift(data.owner);
    }
    for (const c of (data.collaborators || [])) {
      if (typeof c === 'object' && c._id && !users.some((u: any) => u._id === c._id)) users.push(c);
    }
  } catch { /* use what we have */ }
  assignableUsers.value = users;
}

function editTask(task: Task) {
  editingTask.value = task;
  form.value = {
    title: task.title,
    description: task.description,
    priority: task.priority,
    dueDateObj: task.dueDate ? new Date(task.dueDate) : null,
    assigneeId: task.assigneeId?._id || '',
  };
  showCreate.value = true;
}

function closeDialog() {
  showCreate.value = false;
  editingTask.value = null;
  form.value = { title: '', description: '', priority: 'medium', dueDateObj: null, assigneeId: '' };
}

async function saveTask() {
  if (!dossierStore.currentDossier || !form.value.title.trim()) return;
  const payload = {
    title: form.value.title.trim(),
    description: form.value.description.trim(),
    priority: form.value.priority,
    dueDate: form.value.dueDateObj ? form.value.dueDateObj.toISOString() : null,
    assigneeId: form.value.assigneeId || null,
  };
  try {
    if (editingTask.value) {
      const { data } = await api.put(`/tasks/${editingTask.value._id}`, payload);
      const idx = tasks.value.findIndex(t => t._id === data._id);
      if (idx !== -1) tasks.value[idx] = data;
    } else {
      const { data } = await api.post(`/dossiers/${dossierStore.currentDossier._id}/tasks`, payload);
      tasks.value.unshift(data);
    }
    closeDialog();
  } catch (err) {
    console.error('Task save error:', err);
  }
}

async function cycleStatus(task: Task) {
  const next: Record<string, string> = { todo: 'in_progress', in_progress: 'done', done: 'todo' };
  try {
    const { data } = await api.put(`/tasks/${task._id}`, { status: next[task.status] });
    const idx = tasks.value.findIndex(t => t._id === data._id);
    if (idx !== -1) tasks.value[idx] = data;
  } catch (err) {
    console.error('Status update error:', err);
  }
}

async function handleDelete(task: Task) {
  const ok = await confirm({
    title: t('tasks.deleteTask'),
    message: t('tasks.deleteTaskConfirm', { title: task.title }),
    confirmText: t('common.delete'),
    variant: 'danger',
  });
  if (!ok) return;
  try {
    await api.delete(`/tasks/${task._id}`);
    tasks.value = tasks.value.filter(t => t._id !== task._id);
  } catch (err) {
    console.error('Delete error:', err);
  }
}

watch(() => dossierStore.currentDossier?._id, () => {
  fetchTasks();
  fetchAssignableUsers();
});

onMounted(() => {
  fetchTasks();
  fetchAssignableUsers();
});
</script>

<style scoped>
.task-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 12px;
}

/* Header */
.tp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.tp-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tp-header-icon {
  font-size: 18px;
  color: var(--me-accent);
}
.tp-header-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.tp-count-tag {
  font-size: 11px;
}

/* Progress */
.tp-progress {
  height: 4px;
  border-radius: 2px;
}
:deep(.tp-progress .p-progressbar-value) {
  background: var(--me-accent);
  border-radius: 2px;
}
:deep(.tp-progress.p-progressbar) {
  background: var(--me-bg-elevated);
  border-radius: 2px;
}

/* Filters */
.tp-filters {
  width: 100%;
}
:deep(.tp-filters.p-selectbutton) {
  display: flex;
  width: 100%;
}
:deep(.tp-filters .p-togglebutton) {
  flex: 1;
  font-size: 12px;
  padding: 5px 8px;
  justify-content: center;
}
.tp-filter-option {
  display: flex;
  align-items: center;
  gap: 5px;
}
.tp-filter-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.tp-filter-dot--todo { background: var(--me-text-muted); }
.tp-filter-dot--in_progress { background: #facc15; }
.tp-filter-dot--done { background: #22c55e; }
.tp-filter-count {
  font-size: 10px;
  font-weight: 700;
  background: var(--me-bg-elevated);
  border-radius: 9px;
  padding: 0 5px;
  min-width: 16px;
  text-align: center;
  line-height: 16px;
}

/* Loading */
.tp-loading {
  display: flex;
  justify-content: center;
  padding: 8px;
}

/* Task list */
.tp-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.tp-task {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 10px;
  border-radius: 8px;
  border: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  transition: all 0.15s;
  border-left: 3px solid transparent;
}
.tp-task:hover {
  background: var(--me-bg-elevated);
  border-color: var(--me-border);
}
.tp-task--todo { border-left-color: var(--me-text-muted); }
.tp-task--in_progress { border-left-color: #facc15; }
.tp-task--done { border-left-color: #22c55e; opacity: 0.6; }
.tp-task--done .tp-task-title { text-decoration: line-through; color: var(--me-text-muted); }

.tp-check {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  flex-shrink: 0;
  margin-top: 1px;
  border-radius: 4px;
  transition: all 0.15s;
}
.tp-check:hover { background: var(--me-accent-glow); }
.tp-check-icon {
  font-size: 18px;
  display: block;
  color: var(--me-text-muted);
}
.tp-task--in_progress .tp-check-icon { color: #facc15; }
.tp-task--done .tp-check-icon { color: #22c55e; }

.tp-task-body {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}
.tp-task-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--me-text-primary);
  margin-bottom: 4px;
  line-height: 1.4;
}
.tp-task-desc {
  font-size: 11px;
  color: var(--me-text-muted);
  margin-bottom: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tp-task-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.tp-priority-tag {
  font-size: 10px;
  padding: 1px 6px;
}
.tp-meta-chip {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--me-text-muted);
  background: var(--me-bg-elevated);
  border-radius: 10px;
  padding: 1px 7px;
}
.tp-meta-chip i { font-size: 10px; }
.tp-meta-chip--late { color: #ef4444; background: rgba(239, 68, 68, 0.1); }

.tp-delete-btn {
  opacity: 0;
  flex-shrink: 0;
  transition: opacity 0.15s;
}
.tp-task:hover .tp-delete-btn { opacity: 1; }

.tp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: var(--me-text-muted);
  gap: 8px;
}
.tp-empty-icon { font-size: 32px; opacity: 0.4; }
.tp-empty p { font-size: 13px; margin: 0; }

/* Form */
.tp-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0 8px;
}
.tp-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.tp-field-row {
  display: flex;
  gap: 12px;
}
.tp-field-row .tp-field { flex: 1; }
.tp-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--me-text-secondary);
}
.w-full { width: 100%; }
</style>
