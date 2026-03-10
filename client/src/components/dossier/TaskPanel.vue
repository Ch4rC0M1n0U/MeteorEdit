<template>
  <div class="task-panel">
    <div class="tp-header">
      <h3 class="tp-title mono">
        <v-icon size="18" class="mr-2">mdi-checkbox-marked-outline</v-icon>
        Taches
      </h3>
      <div class="tp-stats mono">
        <span class="tp-stat">{{ doneCount }}/{{ tasks.length }}</span>
      </div>
      <button class="tp-add-btn" @click="showCreate = true">
        <v-icon size="16">mdi-plus</v-icon> Nouvelle tache
      </button>
    </div>

    <!-- Filters -->
    <div class="tp-filters">
      <button
        v-for="f in statusFilters" :key="f.value"
        class="tp-filter-btn" :class="{ active: filterStatus === f.value }"
        @click="filterStatus = filterStatus === f.value ? null : f.value"
      >
        {{ f.label }}
      </button>
    </div>

    <!-- Progress bar -->
    <div class="tp-progress" v-if="tasks.length">
      <div class="tp-progress-bar" :style="{ width: progressPct + '%' }" />
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-2" />

    <!-- Task list -->
    <div class="tp-list">
      <div
        v-for="task in filteredTasks" :key="task._id"
        class="tp-task glass-card"
        :class="{ 'tp-task--done': task.status === 'done' }"
      >
        <button class="tp-check" :class="'tp-check--' + task.status" @click="cycleStatus(task)">
          <v-icon size="18">{{
            task.status === 'done' ? 'mdi-checkbox-marked' :
            task.status === 'in_progress' ? 'mdi-progress-check' : 'mdi-checkbox-blank-outline'
          }}</v-icon>
        </button>

        <div class="tp-task-body" @click="editTask(task)">
          <div class="tp-task-title">{{ task.title }}</div>
          <div class="tp-task-meta">
            <span v-if="task.assigneeId" class="tp-assignee">
              <v-icon size="12">mdi-account</v-icon>
              {{ task.assigneeId.firstName }} {{ task.assigneeId.lastName }}
            </span>
            <span v-if="task.dueDate" class="tp-due" :class="{ 'tp-due--late': isOverdue(task) }">
              <v-icon size="12">mdi-calendar</v-icon>
              {{ formatDate(task.dueDate) }}
            </span>
            <span :class="'tp-priority tp-priority--' + task.priority">{{ task.priority }}</span>
          </div>
        </div>

        <button class="tp-delete-btn" @click="handleDelete(task)" title="Supprimer">
          <v-icon size="14">mdi-trash-can-outline</v-icon>
        </button>
      </div>

      <div v-if="!loading && filteredTasks.length === 0" class="tp-empty">
        Aucune tache{{ filterStatus ? ' avec ce filtre' : '' }}
      </div>
    </div>

    <!-- Create / Edit Dialog -->
    <v-dialog v-model="showCreate" max-width="440" persistent>
      <div class="tp-dialog glass-card">
        <div class="tp-dialog-header">
          <v-icon size="20" class="tp-dialog-icon">mdi-checkbox-marked-outline</v-icon>
          <span>{{ editingTask ? 'Modifier la tache' : 'Nouvelle tache' }}</span>
          <button class="tp-dialog-close" @click="closeDialog">
            <v-icon size="18">mdi-close</v-icon>
          </button>
        </div>

        <div class="tp-dialog-body">
          <div class="tp-field">
            <label class="tp-field-label">Titre *</label>
            <input v-model="form.title" class="tp-input" placeholder="Titre de la tache" />
          </div>
          <div class="tp-field">
            <label class="tp-field-label">Description</label>
            <textarea v-model="form.description" class="tp-input tp-textarea" rows="3" placeholder="Description optionnelle" />
          </div>
          <div class="tp-field-row">
            <div class="tp-field">
              <label class="tp-field-label">Priorite</label>
              <select v-model="form.priority" class="tp-input">
                <option value="low">Basse</option>
                <option value="medium">Moyenne</option>
                <option value="high">Haute</option>
              </select>
            </div>
            <div class="tp-field">
              <label class="tp-field-label">Echeance</label>
              <input v-model="form.dueDate" type="date" class="tp-input mono" />
            </div>
          </div>
          <div class="tp-field">
            <label class="tp-field-label">Assigner a</label>
            <select v-model="form.assigneeId" class="tp-input">
              <option value="">Non assigne</option>
              <option v-for="u in assignableUsers" :key="u._id" :value="u._id">
                {{ u.firstName }} {{ u.lastName }}
              </option>
            </select>
          </div>
        </div>

        <div class="tp-dialog-footer">
          <button class="tp-btn tp-btn--cancel" @click="closeDialog">Annuler</button>
          <button class="tp-btn tp-btn--save" @click="saveTask" :disabled="!form.title.trim()">
            {{ editingTask ? 'Modifier' : 'Creer' }}
          </button>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import api, { SERVER_URL } from '../../services/api';
import { useDossierStore } from '../../stores/dossier';
import { useConfirm } from '../../composables/useConfirm';
import type { Task, CollaboratorUser } from '../../types';

const dossierStore = useDossierStore();
const { confirm } = useConfirm();

const tasks = ref<Task[]>([]);
const loading = ref(false);
const showCreate = ref(false);
const editingTask = ref<Task | null>(null);
const filterStatus = ref<string | null>(null);
const assignableUsers = ref<CollaboratorUser[]>([]);

const statusFilters = [
  { label: 'A faire', value: 'todo' },
  { label: 'En cours', value: 'in_progress' },
  { label: 'Termine', value: 'done' },
];

const form = ref({
  title: '',
  description: '',
  priority: 'medium' as string,
  dueDate: '',
  assigneeId: '',
});

const doneCount = computed(() => tasks.value.filter(t => t.status === 'done').length);
const progressPct = computed(() => tasks.value.length ? (doneCount.value / tasks.value.length) * 100 : 0);
const filteredTasks = computed(() => {
  let list = tasks.value;
  if (filterStatus.value) list = list.filter(t => t.status === filterStatus.value);
  return list.sort((a, b) => {
    const statusOrder = { todo: 0, in_progress: 1, done: 2 };
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
});

function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.status === 'done') return false;
  return new Date(task.dueDate) < new Date();
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
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
  // Add owner and collaborators
  const collabs = dossier.collaborators || [];
  for (const c of collabs) {
    if (typeof c === 'object' && c._id) users.push(c as CollaboratorUser);
  }
  // Also fetch owner info if not in collaborators
  try {
    const { data } = await api.get(`/dossiers/${dossier._id}`);
    if (data.owner && typeof data.owner === 'object') {
      const ownerInList = users.some(u => u._id === data.owner._id);
      if (!ownerInList) users.unshift(data.owner);
    }
    if (data.collaborators) {
      for (const c of data.collaborators) {
        if (typeof c === 'object' && c._id && !users.some(u => u._id === c._id)) {
          users.push(c);
        }
      }
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
    dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
    assigneeId: task.assigneeId?._id || '',
  };
  showCreate.value = true;
}

function closeDialog() {
  showCreate.value = false;
  editingTask.value = null;
  form.value = { title: '', description: '', priority: 'medium', dueDate: '', assigneeId: '' };
}

async function saveTask() {
  if (!dossierStore.currentDossier || !form.value.title.trim()) return;
  const payload = {
    title: form.value.title.trim(),
    description: form.value.description.trim(),
    priority: form.value.priority,
    dueDate: form.value.dueDate || null,
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
    title: 'Supprimer la tache',
    message: `Supprimer "${task.title}" ?`,
    confirmText: 'Supprimer',
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
.task-panel { padding: 24px; }
.tp-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.tp-title { font-size: 16px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.tp-stats { font-size: 13px; color: var(--me-text-muted); }
.tp-add-btn {
  margin-left: auto;
  display: flex; align-items: center; gap: 4px;
  padding: 6px 14px; border-radius: 8px;
  background: var(--me-accent); color: #fff;
  border: none; font-size: 13px; font-weight: 500; cursor: pointer;
  transition: filter 0.15s;
}
.tp-add-btn:hover { filter: brightness(1.15); }

.tp-filters { display: flex; gap: 6px; margin-bottom: 12px; }
.tp-filter-btn {
  padding: 4px 12px; border-radius: 6px;
  background: none; border: 1px solid var(--me-border);
  color: var(--me-text-muted); font-size: 12px; cursor: pointer;
  transition: all 0.15s;
}
.tp-filter-btn:hover { border-color: var(--me-accent); color: var(--me-text-primary); }
.tp-filter-btn.active { background: var(--me-accent-glow); border-color: var(--me-accent); color: var(--me-accent); }

.tp-progress { height: 4px; background: var(--me-bg-elevated); border-radius: 2px; margin-bottom: 16px; overflow: hidden; }
.tp-progress-bar { height: 100%; background: var(--me-accent); border-radius: 2px; transition: width 0.3s; }

.tp-list { display: flex; flex-direction: column; gap: 6px; }
.tp-task {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px; border-radius: 8px;
  transition: all 0.15s;
}
.tp-task:hover { background: var(--me-accent-glow); }
.tp-task--done { opacity: 0.55; }
.tp-task--done .tp-task-title { text-decoration: line-through; }

.tp-check {
  background: none; border: none; cursor: pointer;
  color: var(--me-text-muted); padding: 2px; flex-shrink: 0;
  transition: color 0.15s;
}
.tp-check--done { color: var(--me-accent); }
.tp-check--in_progress { color: #facc15; }

.tp-task-body { flex: 1; min-width: 0; cursor: pointer; }
.tp-task-title { font-size: 13px; font-weight: 500; color: var(--me-text-primary); margin-bottom: 4px; }
.tp-task-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tp-assignee { font-size: 11px; color: var(--me-text-muted); display: flex; align-items: center; gap: 3px; }
.tp-due { font-size: 11px; color: var(--me-text-muted); display: flex; align-items: center; gap: 3px; }
.tp-due--late { color: var(--me-error, #ef4444); }

.tp-priority {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  padding: 1px 6px; border-radius: 4px; font-family: var(--me-font-mono);
}
.tp-priority--high { background: rgba(239, 68, 68, 0.12); color: #ef4444; }
.tp-priority--medium { background: rgba(250, 204, 21, 0.12); color: #facc15; }
.tp-priority--low { background: rgba(52, 211, 153, 0.12); color: #34d399; }

.tp-delete-btn {
  background: none; border: none; cursor: pointer;
  color: var(--me-text-muted); padding: 4px; border-radius: 4px;
  opacity: 0; transition: all 0.15s; flex-shrink: 0;
}
.tp-task:hover .tp-delete-btn { opacity: 1; }
.tp-delete-btn:hover { color: var(--me-error, #ef4444); background: rgba(239, 68, 68, 0.1); }

.tp-empty { text-align: center; padding: 32px; color: var(--me-text-muted); font-size: 13px; }

/* Dialog */
.tp-dialog { padding: 0; border-radius: 12px; overflow: hidden; background: var(--me-bg-surface); border: 1px solid var(--me-border); }
.tp-dialog-header { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--me-border); font-size: 14px; font-weight: 600; color: var(--me-text-primary); }
.tp-dialog-icon { color: var(--me-accent); }
.tp-dialog-close { margin-left: auto; background: none; border: none; color: var(--me-text-muted); cursor: pointer; padding: 4px; border-radius: 6px; display: flex; transition: all 0.15s; }
.tp-dialog-close:hover { background: rgba(255,255,255,0.08); color: var(--me-text-primary); }
.tp-dialog-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
.tp-field { display: flex; flex-direction: column; gap: 4px; }
.tp-field-label { font-size: 12px; color: var(--me-text-secondary); font-weight: 500; }
.tp-field-row { display: flex; gap: 12px; }
.tp-field-row .tp-field { flex: 1; }
.tp-input {
  padding: 8px 12px; border-radius: 8px; border: 1px solid var(--me-border);
  background: var(--me-bg-deep); color: var(--me-text-primary); font-size: 13px;
  outline: none; transition: border-color 0.15s; font-family: inherit;
}
.tp-input:focus { border-color: var(--me-accent); }
.tp-textarea { resize: vertical; min-height: 60px; }
.tp-dialog-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--me-border); }
.tp-btn { padding: 7px 16px; border-radius: 8px; border: none; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
.tp-btn--cancel { background: none; color: var(--me-text-muted); }
.tp-btn--cancel:hover { background: rgba(255,255,255,0.06); color: var(--me-text-primary); }
.tp-btn--save { background: var(--me-accent); color: #fff; }
.tp-btn--save:hover { filter: brightness(1.15); }
.tp-btn--save:disabled { opacity: 0.5; cursor: not-allowed; }

.mr-2 { margin-right: 8px; }
.mb-2 { margin-bottom: 8px; }
</style>
