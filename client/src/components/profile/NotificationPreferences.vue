<template>
  <div class="notif-prefs">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-bell-cog-outline</v-icon>
        Notifications
      </h2>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <div class="branding-card glass-card fade-in fade-in-delay-1">
      <!-- Global toggles -->
      <div class="sec-option">
        <div>
          <p class="sec-label">Ne pas deranger</p>
          <p class="sec-desc">Desactive les notifications push en temps reel</p>
        </div>
        <v-switch v-model="prefs.doNotDisturb" color="warning" hide-details @update:model-value="save" />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">Son de notification</p>
          <p class="sec-desc">Jouer un son lors de la reception d'une notification</p>
        </div>
        <v-switch v-model="prefs.soundEnabled" color="primary" hide-details @update:model-value="save" />
      </div>

      <div class="sec-divider" style="margin: 16px 0;" />

      <!-- Per-type preferences -->
      <h3 class="sec-card-title mono mb-3">Par type de notification</h3>
      <div class="notif-type-grid">
        <div class="notif-type-header" />
        <div class="notif-type-header mono">In-app</div>
        <div class="notif-type-header mono">Email</div>

        <template v-for="t in notifTypes" :key="t.key">
          <div class="notif-type-label">
            <v-icon size="16" class="mr-1">{{ t.icon }}</v-icon>
            {{ t.label }}
          </div>
          <div class="notif-type-toggle">
            <v-switch v-model="prefs.inApp[t.key]" color="primary" density="compact" hide-details @update:model-value="save" />
          </div>
          <div class="notif-type-toggle">
            <v-switch v-model="prefs.email[t.key]" color="primary" density="compact" hide-details @update:model-value="save" />
          </div>
        </template>
      </div>
    </div>

    <v-snackbar v-model="saved" :timeout="2000" color="success" location="bottom right">
      Preferences enregistrees
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import api from '../../services/api';

const loading = ref(true);
const saved = ref(false);

const notifTypes = [
  { key: 'collaborator.added', label: 'Ajout collaborateur', icon: 'mdi-account-plus-outline' },
  { key: 'collaborator.removed', label: 'Retrait collaborateur', icon: 'mdi-account-minus-outline' },
  { key: 'dossier.updated', label: 'Dossier modifie', icon: 'mdi-folder-edit-outline' },
  { key: 'dossier.shared', label: 'Dossier partage', icon: 'mdi-folder-account-outline' },
  { key: 'node.updated', label: 'Element modifie', icon: 'mdi-note-edit-outline' },
  { key: 'mention', label: 'Mention', icon: 'mdi-at' },
  { key: 'task.assigned', label: 'Tache assignee', icon: 'mdi-checkbox-marked-outline' },
  { key: 'task.deadline', label: 'Rappel deadline', icon: 'mdi-clock-alert-outline' },
  { key: 'task.completed', label: 'Tache terminee', icon: 'mdi-check-circle-outline' },
  { key: 'comment.reply', label: 'Reponse commentaire', icon: 'mdi-comment-outline' },
  { key: 'system.announcement', label: 'Annonce systeme', icon: 'mdi-bullhorn-outline' },
];

const defaultPrefs = () => {
  const inApp: Record<string, boolean> = {};
  const email: Record<string, boolean> = {};
  for (const t of notifTypes) {
    inApp[t.key] = true;
    email[t.key] = false;
  }
  return { inApp, email, doNotDisturb: false, soundEnabled: true };
};

const prefs = reactive(defaultPrefs());

onMounted(async () => {
  try {
    const { data } = await api.get('/auth/notification-preferences');
    if (data.inApp) Object.assign(prefs.inApp, data.inApp);
    if (data.email) Object.assign(prefs.email, data.email);
    if (typeof data.doNotDisturb === 'boolean') prefs.doNotDisturb = data.doNotDisturb;
    if (typeof data.soundEnabled === 'boolean') prefs.soundEnabled = data.soundEnabled;
  } catch {} finally {
    loading.value = false;
  }
});

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
function save() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await api.patch('/auth/notification-preferences', { ...prefs });
      saved.value = true;
    } catch {}
  }, 300);
}
</script>

<style scoped>
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.branding-card { padding: 20px; }
.sec-option { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 4px 0; }
.sec-label { font-size: 13px; font-weight: 600; color: var(--me-text-primary); }
.sec-desc { font-size: 12px; color: var(--me-text-muted); margin-top: 2px; }
.sec-divider { height: 1px; background: var(--me-border); margin: 10px 0; opacity: 0.5; }
.sec-card-title { font-size: 14px; font-weight: 700; color: var(--me-text-primary); }
.mb-3 { margin-bottom: 12px; }
.mb-4 { margin-bottom: 16px; }
.notif-type-grid {
  display: grid;
  grid-template-columns: 1fr 80px 80px;
  gap: 4px 8px;
  align-items: center;
}
.notif-type-header { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--me-text-muted); text-align: center; }
.notif-type-label { font-size: 13px; color: var(--me-text-secondary); display: flex; align-items: center; padding: 4px 0; }
.notif-type-toggle { display: flex; justify-content: center; }
</style>
