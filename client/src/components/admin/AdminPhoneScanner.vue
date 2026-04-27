<template>
  <div class="apsc">
    <h2 class="apsc-title mono">{{ $t('adminPhoneScanner.title') }}</h2>
    <p class="apsc-subtitle">{{ $t('adminPhoneScanner.subtitle') }}</p>

    <!-- Stats -->
    <div class="apsc-section">
      <h3 class="apsc-section-title">{{ $t('adminPhoneScanner.stats') }}</h3>
      <div v-if="stats" class="apsc-stats">
        <div class="apsc-stat">
          <span class="apsc-stat-label">{{ $t('adminPhoneScanner.globalDailyUsage') }}</span>
          <span class="apsc-stat-value mono">
            {{ stats.globalDailyCounter.count }} / {{ stats.maxDailyChecksGlobal }}
          </span>
          <ProgressBar :value="globalUsagePercent" class="apsc-stat-bar" />
        </div>
        <div class="apsc-stat">
          <span class="apsc-stat-label">{{ $t('adminPhoneScanner.activeScans') }}</span>
          <span class="apsc-stat-value mono">{{ stats.activeScansCount }}</span>
        </div>
        <div class="apsc-stat">
          <span class="apsc-stat-label">{{ $t('adminPhoneScanner.queuedScans') }}</span>
          <span class="apsc-stat-value mono">{{ stats.queuedScansCount }}</span>
        </div>
        <div class="apsc-stat">
          <span class="apsc-stat-label">{{ $t('adminPhoneScanner.scans24h') }}</span>
          <span class="apsc-stat-value mono">{{ stats.recentScansCount }}</span>
        </div>
      </div>

      <div v-if="stats && stats.topUsers.length" class="apsc-top-users">
        <h4>{{ $t('adminPhoneScanner.topUsers24h') }}</h4>
        <table class="apsc-table">
          <thead>
            <tr>
              <th>{{ $t('common.user') }}</th>
              <th class="text-right">{{ $t('adminPhoneScanner.scansCount') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in stats.topUsers" :key="u.userId">
              <td>{{ u.firstName }} {{ u.lastName }} <span class="apsc-email">({{ u.email }})</span></td>
              <td class="text-right mono">{{ u.count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Settings -->
    <div class="apsc-section">
      <h3 class="apsc-section-title">{{ $t('adminPhoneScanner.settings') }}</h3>
      <div v-if="settings" class="apsc-settings">
        <div class="apsc-field">
          <label>{{ $t('adminPhoneScanner.maxDailyChecksGlobal') }}</label>
          <InputNumber v-model="settings.maxDailyChecksGlobal" :min="1" :max="10000" showButtons />
          <small>{{ $t('adminPhoneScanner.maxDailyChecksGlobalHelp') }}</small>
        </div>
        <div class="apsc-field">
          <label>{{ $t('adminPhoneScanner.maxDailyChecksPerUser') }}</label>
          <InputNumber v-model="settings.maxDailyChecksPerUser" :min="1" :max="1000" showButtons />
          <small>{{ $t('adminPhoneScanner.maxDailyChecksPerUserHelp') }}</small>
        </div>
        <div class="apsc-field-row">
          <div class="apsc-field">
            <label>{{ $t('adminPhoneScanner.minDelayMs') }}</label>
            <InputNumber v-model="settings.minDelayMs" :min="5000" :max="600000" :step="5000" showButtons />
            <small>{{ formatDelay(settings.minDelayMs) }}</small>
          </div>
          <div class="apsc-field">
            <label>{{ $t('adminPhoneScanner.maxDelayMs') }}</label>
            <InputNumber v-model="settings.maxDelayMs" :min="5000" :max="600000" :step="5000" showButtons />
            <small>{{ formatDelay(settings.maxDelayMs) }}</small>
          </div>
        </div>
        <div class="apsc-field-row">
          <div class="apsc-field">
            <label>{{ $t('adminPhoneScanner.combinationsWarn') }}</label>
            <InputNumber v-model="settings.combinationsWarnThreshold" :min="1" :max="10000" />
          </div>
          <div class="apsc-field">
            <label>{{ $t('adminPhoneScanner.combinationsBlock') }}</label>
            <InputNumber v-model="settings.combinationsBlockThreshold" :min="1" :max="10000" />
          </div>
        </div>
        <div class="apsc-field">
          <label>{{ $t('adminPhoneScanner.resultsTtlDays') }}</label>
          <InputNumber v-model="settings.resultsTtlDays" :min="1" :max="365" />
          <small>{{ $t('adminPhoneScanner.resultsTtlDaysHelp') }}</small>
        </div>

        <div class="apsc-actions">
          <Button
            :label="$t('common.save')"
            icon="pi pi-check"
            :loading="saving"
            @click="saveSettings"
          />
          <Button
            :label="$t('common.refresh')"
            icon="pi pi-refresh"
            outlined
            @click="loadAll"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import ProgressBar from 'primevue/progressbar';
import api from '../../services/api';

interface ScannerSettings {
  maxDailyChecksGlobal: number;
  maxDailyChecksPerUser: number;
  minDelayMs: number;
  maxDelayMs: number;
  combinationsWarnThreshold: number;
  combinationsBlockThreshold: number;
  resultsTtlDays: number;
  globalDailyCounter: { date: string; count: number };
}

interface TopUser {
  userId: string;
  count: number;
  email?: string;
  firstName?: string;
  lastName?: string;
}

interface ScannerStats {
  globalDailyCounter: { date: string; count: number };
  maxDailyChecksGlobal: number;
  maxDailyChecksPerUser: number;
  activeScansCount: number;
  queuedScansCount: number;
  recentScansCount: number;
  topUsers: TopUser[];
}

const { t } = useI18n();
const toast = useToast();
const settings = ref<ScannerSettings | null>(null);
const stats = ref<ScannerStats | null>(null);
const saving = ref(false);

const globalUsagePercent = computed(() => {
  if (!stats.value || !stats.value.maxDailyChecksGlobal) return 0;
  return Math.round((stats.value.globalDailyCounter.count / stats.value.maxDailyChecksGlobal) * 100);
});

async function loadAll(): Promise<void> {
  await Promise.all([loadSettings(), loadStats()]);
}

async function loadSettings(): Promise<void> {
  try {
    const { data } = await api.get<{ settings: ScannerSettings }>('/phone-scanner/admin/settings');
    settings.value = data.settings;
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Failed to load settings', detail: err.message, life: 4000 });
  }
}

async function loadStats(): Promise<void> {
  try {
    const { data } = await api.get<ScannerStats>('/phone-scanner/admin/stats');
    stats.value = data;
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Failed to load stats', detail: err.message, life: 4000 });
  }
}

async function saveSettings(): Promise<void> {
  if (!settings.value) return;
  saving.value = true;
  try {
    await api.put('/phone-scanner/admin/settings', settings.value);
    toast.add({ severity: 'success', summary: t('common.saved'), life: 3000 });
    await loadStats();
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Save failed', detail: err.message, life: 4000 });
  } finally {
    saving.value = false;
  }
}

function formatDelay(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}min ${s % 60}s`;
}

onMounted(loadAll);
</script>

<style scoped>
.apsc {
  padding: 24px;
  max-width: 900px;
}
.apsc-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--me-text-primary);
  margin: 0 0 4px 0;
}
.apsc-subtitle {
  font-size: 13px;
  color: var(--me-text-muted);
  margin: 0 0 24px 0;
}

.apsc-section {
  margin-bottom: 28px;
  padding: 20px;
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  border-radius: 10px;
}
.apsc-section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--me-text-primary);
  margin: 0 0 16px 0;
}

.apsc-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}
.apsc-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: var(--me-bg-surface);
  border-radius: 8px;
}
.apsc-stat-label { font-size: 11px; color: var(--me-text-secondary); text-transform: uppercase; }
.apsc-stat-value { font-size: 18px; font-weight: 700; color: var(--me-text-primary); }
.apsc-stat-bar { height: 4px !important; margin-top: 4px; }

.apsc-top-users h4 {
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-primary);
  margin: 0 0 8px 0;
}
.apsc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.apsc-table th, .apsc-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--me-border);
  text-align: left;
}
.apsc-table th {
  color: var(--me-text-secondary);
  font-size: 11px;
  text-transform: uppercase;
  font-weight: 600;
}
.text-right { text-align: right; }
.apsc-email { color: var(--me-text-muted); font-size: 11px; }

.apsc-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.apsc-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}
.apsc-field label {
  font-size: 12px;
  font-weight: 600;
  color: var(--me-text-secondary);
}
.apsc-field small {
  font-size: 11px;
  color: var(--me-text-muted);
}
.apsc-field-row {
  display: flex;
  gap: 12px;
}

.apsc-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
</style>
