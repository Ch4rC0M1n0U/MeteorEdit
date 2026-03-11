<template>
  <div class="notif-prefs">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-bell-cog-outline</v-icon>
        {{ $t('profile.notifications') }}
      </h2>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <div class="branding-card glass-card fade-in fade-in-delay-1">
      <!-- Global toggles -->
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('notifications.doNotDisturb') }}</p>
          <p class="sec-desc">{{ $t('notifications.doNotDisturbDesc') }}</p>
        </div>
        <v-switch v-model="prefs.doNotDisturb" color="warning" hide-details @update:model-value="save" />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('notifications.soundLabel') }}</p>
          <p class="sec-desc">{{ $t('notifications.soundDesc') }}</p>
        </div>
        <v-switch v-model="prefs.soundEnabled" color="primary" hide-details @update:model-value="save" />
      </div>

      <div class="sec-divider" style="margin: 16px 0;" />

      <!-- Per-type preferences -->
      <h3 class="sec-card-title mono mb-3">{{ $t('notifications.perType') }}</h3>
      <div class="notif-type-grid">
        <div class="notif-type-header" />
        <div class="notif-type-header mono">{{ $t('notifications.inApp') }}</div>
        <div class="notif-type-header mono">{{ $t('notifications.emailChannel') }}</div>

        <template v-for="nt in notifTypes" :key="nt.key">
          <div class="notif-type-label">
            <v-icon size="16" class="mr-1">{{ nt.icon }}</v-icon>
            {{ nt.label }}
          </div>
          <div class="notif-type-toggle">
            <v-switch v-model="prefs.inApp[nt.key]" color="primary" density="compact" hide-details @update:model-value="save" />
          </div>
          <div class="notif-type-toggle">
            <v-switch v-model="prefs.email[nt.key]" color="primary" density="compact" hide-details @update:model-value="save" />
          </div>
        </template>
      </div>
    </div>

    <v-snackbar v-model="saved" :timeout="2000" color="success" location="bottom right">
      {{ $t('notifications.preferencesSaved') }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';

const { t } = useI18n();
const loading = ref(true);
const saved = ref(false);

const notifTypes = computed(() => [
  { key: 'collaborator.added', label: t('notifications.types.collaboratorAdded'), icon: 'mdi-account-plus-outline' },
  { key: 'collaborator.removed', label: t('notifications.types.collaboratorRemoved'), icon: 'mdi-account-minus-outline' },
  { key: 'dossier.updated', label: t('notifications.types.dossierUpdated'), icon: 'mdi-folder-edit-outline' },
  { key: 'dossier.shared', label: t('notifications.types.dossierShared'), icon: 'mdi-folder-account-outline' },
  { key: 'node.updated', label: t('notifications.types.nodeUpdated'), icon: 'mdi-note-edit-outline' },
  { key: 'mention', label: t('notifications.types.mention'), icon: 'mdi-at' },
  { key: 'task.assigned', label: t('notifications.types.taskAssigned'), icon: 'mdi-checkbox-marked-outline' },
  { key: 'task.deadline', label: t('notifications.types.taskDeadline'), icon: 'mdi-clock-alert-outline' },
  { key: 'task.completed', label: t('notifications.types.taskCompleted'), icon: 'mdi-check-circle-outline' },
  { key: 'comment.reply', label: t('notifications.types.commentReply'), icon: 'mdi-comment-outline' },
  { key: 'system.announcement', label: t('notifications.types.systemAnnouncement'), icon: 'mdi-bullhorn-outline' },
]);

const notifTypeKeys = [
  'collaborator.added', 'collaborator.removed', 'dossier.updated', 'dossier.shared',
  'node.updated', 'mention', 'task.assigned', 'task.deadline', 'task.completed',
  'comment.reply', 'system.announcement',
];

const defaultPrefs = () => {
  const inApp: Record<string, boolean> = {};
  const email: Record<string, boolean> = {};
  for (const key of notifTypeKeys) {
    inApp[key] = true;
    email[key] = false;
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
