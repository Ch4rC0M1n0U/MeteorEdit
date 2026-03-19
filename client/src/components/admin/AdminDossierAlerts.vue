<template>
  <div class="admin-dossier-alerts">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-timer-alert-outline</v-icon>
        {{ $t('admin.dossierAlerts') }}
      </h2>
      <p class="admin-section-subtitle">{{ $t('admin.dossierAlertsDesc') }}</p>
    </div>

    <div class="alerts-grid fade-in fade-in-delay-1">
      <!-- Thresholds -->
      <div class="glass-card alerts-card">
        <h3 class="alerts-card-title mono">{{ $t('admin.dossierAlerts') }}</h3>

        <div class="alerts-row">
          <div class="alerts-field">
            <label class="alerts-label mono">{{ $t('admin.alertRoutine') }}</label>
            <v-text-field
              v-model.number="form.routine"
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
              v-model.number="form.priority"
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
              v-model.number="form.urgent"
              type="number"
              density="compact"
              hide-details
              :min="1"
              :max="365"
            />
          </div>
        </div>
      </div>

      <!-- Custom messages -->
      <div class="glass-card alerts-card">
        <h3 class="alerts-card-title mono">Messages</h3>

        <div class="alerts-msg-field">
          <label class="alerts-label mono">{{ $t('admin.alertRoutineMsg') }}</label>
          <v-text-field
            v-model="form.routineMessage"
            density="compact"
            hide-details
            :placeholder="$t('admin.alertMsgPlaceholder')"
          />
        </div>
        <div class="alerts-msg-field">
          <label class="alerts-label mono">{{ $t('admin.alertPriorityMsg') }}</label>
          <v-text-field
            v-model="form.priorityMessage"
            density="compact"
            hide-details
            :placeholder="$t('admin.alertMsgPlaceholder')"
          />
        </div>
        <div class="alerts-msg-field">
          <label class="alerts-label mono">{{ $t('admin.alertUrgentMsg') }}</label>
          <v-text-field
            v-model="form.urgentMessage"
            density="compact"
            hide-details
            :placeholder="$t('admin.alertMsgPlaceholder')"
          />
        </div>
      </div>
    </div>

    <div class="alerts-actions fade-in fade-in-delay-2">
      <button class="me-btn-primary" @click="save" :disabled="saving">
        <v-icon size="16" class="mr-1">mdi-content-save-outline</v-icon>
        {{ saving ? $t('admin.savingSettings') : $t('admin.saveSettings') }}
      </button>
      <span v-if="saved" class="alerts-saved mono">
        <v-icon size="14" color="success" class="mr-1">mdi-check</v-icon>
        {{ $t('admin.settingsSaved') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';

const { t } = useI18n();

const form = reactive({
  routine: 30,
  priority: 14,
  urgent: 7,
  routineMessage: '',
  priorityMessage: '',
  urgentMessage: '',
});

const saving = ref(false);
const saved = ref(false);

onMounted(async () => {
  try {
    const { data } = await api.get('/admin/settings');
    if (data?.dossierAlerts) {
      const da = data.dossierAlerts;
      if (typeof da.routine === 'number') form.routine = da.routine;
      if (typeof da.priority === 'number') form.priority = da.priority;
      if (typeof da.urgent === 'number') form.urgent = da.urgent;
      if (typeof da.routineMessage === 'string') form.routineMessage = da.routineMessage;
      if (typeof da.priorityMessage === 'string') form.priorityMessage = da.priorityMessage;
      if (typeof da.urgentMessage === 'string') form.urgentMessage = da.urgentMessage;
    }
  } catch {
    // use defaults
  }
});

async function save() {
  saving.value = true;
  saved.value = false;
  try {
    await api.put('/admin/settings', {
      dossierAlerts: {
        routine: Number(form.routine) || 30,
        priority: Number(form.priority) || 14,
        urgent: Number(form.urgent) || 7,
        routineMessage: form.routineMessage,
        priorityMessage: form.priorityMessage,
        urgentMessage: form.urgentMessage,
      },
    });
    saved.value = true;
    setTimeout(() => { saved.value = false; }, 3000);
  } catch (err) {
    console.error('Failed to save dossier alerts:', err);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.admin-dossier-alerts {
  max-width: 800px;
}
.admin-section-header {
  margin-bottom: 24px;
}
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
}
.alerts-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.alerts-card {
  padding: 20px;
}
.alerts-card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--me-text-primary);
  margin-bottom: 16px;
}
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
</style>
