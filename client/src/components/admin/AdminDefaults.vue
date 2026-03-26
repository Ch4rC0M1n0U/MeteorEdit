<template>
  <div class="admin-defaults">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-folder-cog-outline</v-icon>
        {{ $t('admin.dossierConfig') }}
      </h2>
      <p class="admin-section-subtitle">{{ $t('admin.dossierConfigDesc') }}</p>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <!-- Retention des donnees -->
    <div class="sec-card glass-card fade-in fade-in-delay-1">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-database-clock-outline</v-icon>
        <h3 class="sec-card-title mono">{{ $t('admin.dataRetention') }}</h3>
      </div>
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.trashPurgeDays') }}</p>
          <p class="sec-desc">{{ $t('admin.trashPurgeDaysDesc') }}</p>
        </div>
        <v-text-field
          v-model.number="form.trashAutoDeleteDays"
          type="number"
          density="compact"
          hide-details
          style="max-width: 120px;"
          :min="0"
          :max="365"
          @blur="save"
        />
      </div>
    </div>

    <!-- Alertes de durée des dossiers -->
    <div class="sec-card glass-card fade-in fade-in-delay-2">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-timer-alert-outline</v-icon>
        <h3 class="sec-card-title mono">{{ $t('admin.dossierAlerts') }}</h3>
      </div>
      <p class="sec-desc" style="margin-bottom: 16px;">{{ $t('admin.dossierAlertsDesc') }}</p>

      <div class="alerts-row">
        <div class="alerts-field">
          <label class="alerts-label mono">{{ $t('admin.alertRoutine') }}</label>
          <v-text-field
            v-model.number="alertsForm.routine"
            type="number"
            density="compact"
            hide-details
            :min="1"
            :max="365"
          />
        </div>
        <div class="alerts-field">
          <label class="alerts-label mono">{{ $t('admin.alertPriority') }}</label>
          <v-text-field
            v-model.number="alertsForm.priority"
            type="number"
            density="compact"
            hide-details
            :min="1"
            :max="365"
          />
        </div>
        <div class="alerts-field">
          <label class="alerts-label mono">{{ $t('admin.alertUrgent') }}</label>
          <v-text-field
            v-model.number="alertsForm.urgent"
            type="number"
            density="compact"
            hide-details
            :min="1"
            :max="365"
          />
        </div>
      </div>

      <div class="alerts-messages" style="margin-top: 16px;">
        <h4 class="sec-card-title mono" style="font-size: 13px; margin-bottom: 12px;">Messages</h4>
        <div class="alerts-msg-field">
          <label class="alerts-label mono">{{ $t('admin.alertRoutineMsg') }}</label>
          <v-text-field
            v-model="alertsForm.routineMessage"
            density="compact"
            hide-details
            :placeholder="$t('admin.alertMsgPlaceholder')"
          />
        </div>
        <div class="alerts-msg-field">
          <label class="alerts-label mono">{{ $t('admin.alertPriorityMsg') }}</label>
          <v-text-field
            v-model="alertsForm.priorityMessage"
            density="compact"
            hide-details
            :placeholder="$t('admin.alertMsgPlaceholder')"
          />
        </div>
        <div class="alerts-msg-field">
          <label class="alerts-label mono">{{ $t('admin.alertUrgentMsg') }}</label>
          <v-text-field
            v-model="alertsForm.urgentMessage"
            density="compact"
            hide-details
            :placeholder="$t('admin.alertMsgPlaceholder')"
          />
        </div>
      </div>

      <div class="alerts-actions">
        <button class="alerts-save-btn" @click="saveAlerts" :disabled="savingAlerts">
          <v-icon size="16" class="mr-1">mdi-content-save-outline</v-icon>
          {{ savingAlerts ? $t('admin.savingSettings') : $t('admin.saveSettings') }}
        </button>
        <span v-if="alertsSaved" class="alerts-saved mono">
          <v-icon size="14" color="success" class="mr-1">mdi-check</v-icon>
          {{ $t('admin.settingsSaved') }}
        </span>
      </div>
    </div>

    <v-snackbar v-model="saved" :timeout="2000" color="success" location="bottom right">
      {{ $t('admin.settingsSaved') }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';

const { t } = useI18n();

const loading = ref(true);
const saved = ref(false);

const form = ref({
  trashAutoDeleteDays: 0,
});

const alertsForm = reactive({
  routine: 30,
  priority: 14,
  urgent: 7,
  routineMessage: '',
  priorityMessage: '',
  urgentMessage: '',
});

const savingAlerts = ref(false);
const alertsSaved = ref(false);

onMounted(async () => {
  try {
    const [brandingRes, settingsRes] = await Promise.all([
      api.get('/settings/branding'),
      api.get('/admin/settings').catch(() => ({ data: {} })),
    ]);
    form.value.trashAutoDeleteDays = brandingRes.data.trashAutoDeleteDays || 0;

    if (settingsRes.data?.dossierAlerts) {
      const da = settingsRes.data.dossierAlerts;
      if (typeof da.routine === 'number') alertsForm.routine = da.routine;
      if (typeof da.priority === 'number') alertsForm.priority = da.priority;
      if (typeof da.urgent === 'number') alertsForm.urgent = da.urgent;
      if (typeof da.routineMessage === 'string') alertsForm.routineMessage = da.routineMessage;
      if (typeof da.priorityMessage === 'string') alertsForm.priorityMessage = da.priorityMessage;
      if (typeof da.urgentMessage === 'string') alertsForm.urgentMessage = da.urgentMessage;
    }
  } catch {} finally {
    loading.value = false;
  }
});

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function save() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await api.put('/admin/settings', form.value);
      saved.value = true;
    } catch {}
  }, 300);
}

async function saveAlerts() {
  savingAlerts.value = true;
  alertsSaved.value = false;
  try {
    await api.put('/admin/settings', {
      dossierAlerts: {
        routine: Number(alertsForm.routine) || 30,
        priority: Number(alertsForm.priority) || 14,
        urgent: Number(alertsForm.urgent) || 7,
        routineMessage: alertsForm.routineMessage,
        priorityMessage: alertsForm.priorityMessage,
        urgentMessage: alertsForm.urgentMessage,
      },
    });
    alertsSaved.value = true;
    setTimeout(() => { alertsSaved.value = false; }, 3000);
  } catch (err) {
    console.error('Failed to save dossier alerts:', err);
  } finally {
    savingAlerts.value = false;
  }
}
</script>

<style scoped>
.admin-defaults {

}
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.admin-section-subtitle { font-size: 13px; color: var(--me-text-muted); margin-top: 4px; font-family: var(--me-font-mono); }

.sec-card { padding: 20px; margin-bottom: 16px; }
.sec-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--me-border); }
.sec-card-title { font-size: 14px; font-weight: 700; color: var(--me-text-primary); }

.sec-option { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 4px 0; }
.sec-label { font-size: 13px; font-weight: 600; color: var(--me-text-primary); }
.sec-desc { font-size: 12px; color: var(--me-text-muted); margin-top: 2px; }

.alerts-row {
  display: flex;
  gap: 16px;
}
.alerts-field {
  flex: 1;
}
.alerts-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--me-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}
.alerts-msg-field {
  margin-bottom: 12px;
}
.alerts-actions {
  margin-top: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.alerts-saved {
  font-size: 13px;
  color: var(--me-success, #4ade80);
}
.alerts-save-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: var(--me-accent);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.alerts-save-btn:hover { filter: brightness(1.15); }
.alerts-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
