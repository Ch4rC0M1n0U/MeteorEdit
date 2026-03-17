<template>
  <div class="setup-page">
    <div class="setup-container">
      <!-- Header -->
      <div class="setup-header">
        <div class="setup-logo">
          <v-icon size="40" color="white">mdi-shield-search</v-icon>
        </div>
        <h1 class="setup-title mono">MeteorEdit</h1>
        <p class="setup-subtitle">{{ $t('setup.subtitle') }}</p>
        <div v-if="devMode" class="dev-badge">
          <v-icon size="14" class="mr-1">mdi-bug-outline</v-icon>
          {{ $t('setup.devMode') }}
        </div>
        <div class="setup-version mono">v{{ version }}</div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="setup-loading">
        <v-progress-circular indeterminate color="var(--me-accent)" size="40" />
        <p class="mt-3 text-muted">{{ $t('setup.checking') }}</p>
      </div>

      <!-- Stepper -->
      <div v-else class="setup-stepper">
        <!-- Step indicators -->
        <div class="step-indicators">
          <div v-for="(s, i) in steps" :key="i" class="step-dot" :class="{ active: currentStep === i, done: currentStep > i }" @click="currentStep > i ? currentStep = i : null">
            <v-icon v-if="currentStep > i" size="14">mdi-check</v-icon>
            <span v-else>{{ i + 1 }}</span>
          </div>
        </div>

        <!-- Step 1: Diagnostics -->
        <div v-if="currentStep === 0" class="setup-step fade-in">
          <h2 class="step-title">
            <v-icon size="20" class="mr-2">mdi-stethoscope</v-icon>
            {{ $t('setup.diagnostics') }}
          </h2>
          <p class="step-desc">{{ $t('setup.diagnosticsDesc') }}</p>

          <!-- Service checks -->
          <div class="service-list">
            <div v-for="svc in status?.services" :key="svc.name" class="service-item glass-card">
              <div class="service-status-dot" :class="svc.status" />
              <div class="service-info">
                <span class="service-name mono">{{ svc.name }}</span>
                <span class="service-msg">{{ svc.message }}</span>
              </div>
              <span v-if="svc.version" class="service-version mono">v{{ svc.version }}</span>
              <v-chip v-else :color="svc.status === 'ok' ? 'success' : svc.status === 'unconfigured' ? 'warning' : 'error'" size="x-small" variant="tonal">
                {{ svc.status }}
              </v-chip>
            </div>
          </div>

          <!-- Env checks -->
          <div v-if="status?.env" class="env-section mt-4">
            <h3 class="env-title mono">
              <v-icon size="16" class="mr-1">mdi-cog-outline</v-icon>
              {{ $t('setup.envCheck') }}
            </h3>
            <div class="env-grid">
              <div class="env-item" v-for="(val, key) in envDisplay" :key="key">
                <span class="env-key mono">{{ key }}</span>
                <v-icon :color="val.ok ? '#22c55e' : '#f59e0b'" size="16">{{ val.ok ? 'mdi-check-circle' : 'mdi-alert-circle' }}</v-icon>
                <span class="env-val">{{ val.label }}</span>
              </div>
            </div>
          </div>

          <!-- Stats -->
          <div v-if="status?.stats" class="stats-row mt-4">
            <div class="stat-chip">
              <v-icon size="14" class="mr-1">mdi-account-outline</v-icon>
              {{ status.stats.userCount }} {{ $t('setup.users') }}
            </div>
            <div class="stat-chip">
              <v-icon size="14" class="mr-1">mdi-shield-account</v-icon>
              {{ status.stats.adminCount }} {{ $t('setup.admins') }}
            </div>
            <div class="stat-chip" :class="{ ok: status.stats.hasSettings }">
              <v-icon size="14" class="mr-1">mdi-database-check</v-icon>
              {{ status.stats.hasSettings ? $t('setup.settingsOk') : $t('setup.noSettings') }}
            </div>
          </div>

          <div class="step-actions">
            <v-btn v-if="!devMode && !status?.setupRequired" variant="outlined" @click="$router.push('/login')">
              <v-icon start size="16">mdi-arrow-left</v-icon>
              {{ $t('setup.backToLogin') }}
            </v-btn>
            <v-btn color="primary" class="btn-accent" @click="currentStep = 1" :disabled="!mongoOk">
              {{ $t('setup.next') }}
              <v-icon end size="16">mdi-arrow-right</v-icon>
            </v-btn>
          </div>
        </div>

        <!-- Step 2: Admin account -->
        <div v-if="currentStep === 1" class="setup-step fade-in">
          <h2 class="step-title">
            <v-icon size="20" class="mr-2">mdi-shield-account</v-icon>
            {{ $t('setup.adminAccount') }}
          </h2>
          <p class="step-desc">{{ devMode ? $t('setup.adminAccountDescDev') : $t('setup.adminAccountDesc') }}</p>

          <v-form @submit.prevent="currentStep = 2">
            <div class="form-grid">
              <v-text-field v-model="adminForm.firstName" :label="$t('auth.firstName')" prepend-inner-icon="mdi-account-outline" variant="outlined" density="comfortable" required />
              <v-text-field v-model="adminForm.lastName" :label="$t('auth.lastName')" prepend-inner-icon="mdi-account-outline" variant="outlined" density="comfortable" required />
            </div>
            <v-text-field v-model="adminForm.email" :label="$t('auth.email')" type="email" prepend-inner-icon="mdi-email-outline" variant="outlined" density="comfortable" required class="mt-2" />
            <v-text-field v-model="adminForm.password" :label="$t('auth.password')" :type="showPw ? 'text' : 'password'" prepend-inner-icon="mdi-lock-outline" :append-inner-icon="showPw ? 'mdi-eye-off' : 'mdi-eye'" @click:append-inner="showPw = !showPw" variant="outlined" density="comfortable" required :rules="[v => v.length >= 8 || $t('setup.passwordMin')]" class="mt-2" />

            <div class="step-actions">
              <v-btn variant="outlined" @click="currentStep = 0">
                <v-icon start size="16">mdi-arrow-left</v-icon>
                {{ $t('common.back') }}
              </v-btn>
              <v-btn color="primary" class="btn-accent" type="submit" :disabled="!adminValid">
                {{ $t('setup.next') }}
                <v-icon end size="16">mdi-arrow-right</v-icon>
              </v-btn>
            </div>
          </v-form>
        </div>

        <!-- Step 3: App settings -->
        <div v-if="currentStep === 2" class="setup-step fade-in">
          <h2 class="step-title">
            <v-icon size="20" class="mr-2">mdi-palette-outline</v-icon>
            {{ $t('setup.appSettings') }}
          </h2>
          <p class="step-desc">{{ $t('setup.appSettingsDesc') }}</p>

          <v-text-field v-model="settingsForm.appName" :label="$t('admin.appName')" prepend-inner-icon="mdi-rename-outline" variant="outlined" density="comfortable" class="mt-3" />

          <div class="color-row mt-3">
            <label class="settings-label mono">{{ $t('admin.accentColor') }}</label>
            <input type="color" v-model="settingsForm.accentColor" class="color-input" />
            <span class="color-hex mono">{{ settingsForm.accentColor }}</span>
          </div>

          <v-text-field v-model="settingsForm.loginMessage" :label="$t('admin.loginMessage')" prepend-inner-icon="mdi-message-text-outline" variant="outlined" density="comfortable" class="mt-3" />

          <v-select v-model="settingsForm.language" :items="languageOptions" :label="$t('setup.defaultLanguage')" prepend-inner-icon="mdi-translate" variant="outlined" density="comfortable" class="mt-3" />

          <div class="switch-row mt-3">
            <label class="settings-label mono mb-0">{{ $t('setup.enableRegistration') }}</label>
            <v-switch v-model="settingsForm.registrationEnabled" color="primary" density="compact" hide-details />
          </div>

          <div class="step-actions">
            <v-btn variant="outlined" @click="currentStep = 1">
              <v-icon start size="16">mdi-arrow-left</v-icon>
              {{ $t('common.back') }}
            </v-btn>
            <v-btn color="primary" class="btn-accent" @click="currentStep = 3">
              {{ $t('setup.next') }}
              <v-icon end size="16">mdi-arrow-right</v-icon>
            </v-btn>
          </div>
        </div>

        <!-- Step 4: Summary & confirm -->
        <div v-if="currentStep === 3" class="setup-step fade-in">
          <h2 class="step-title">
            <v-icon size="20" class="mr-2">mdi-check-decagram</v-icon>
            {{ $t('setup.summary') }}
          </h2>
          <p class="step-desc">{{ devMode ? $t('setup.summaryDescDev') : $t('setup.summaryDesc') }}</p>

          <div class="summary-card glass-card">
            <div class="summary-section">
              <h4 class="summary-label mono">{{ $t('setup.adminAccount') }}</h4>
              <p>{{ adminForm.firstName }} {{ adminForm.lastName }}</p>
              <p class="text-muted">{{ adminForm.email }}</p>
            </div>
            <div class="summary-section">
              <h4 class="summary-label mono">{{ $t('setup.appSettings') }}</h4>
              <p>{{ settingsForm.appName }}</p>
              <div class="summary-color">
                <span class="color-dot" :style="{ background: settingsForm.accentColor }" />
                <span class="mono">{{ settingsForm.accentColor }}</span>
              </div>
              <p class="text-muted">{{ $t('setup.registration') }}: {{ settingsForm.registrationEnabled ? $t('setup.enabled') : $t('setup.disabled') }}</p>
            </div>
          </div>

          <v-alert v-if="devMode" type="info" variant="tonal" class="mt-3" density="compact">
            <v-icon start size="16">mdi-bug-outline</v-icon>
            {{ $t('setup.devModeInfo') }}
          </v-alert>

          <v-alert v-if="setupError" type="error" variant="tonal" class="mt-3" closable @click:close="setupError = ''">
            {{ setupError }}
          </v-alert>

          <v-alert v-if="setupSuccess" type="success" variant="tonal" class="mt-3">
            <v-icon start size="16">mdi-check-circle</v-icon>
            {{ setupSuccess }}
          </v-alert>

          <!-- Dev simulation result -->
          <div v-if="devResult" class="dev-result glass-card mt-3">
            <h4 class="summary-label mono">{{ $t('setup.simulationResult') }}</h4>
            <div class="dev-result-item" v-for="(val, key) in devResult.simulation" :key="key">
              <span class="mono">{{ key }}:</span>
              <span>{{ val }}</span>
            </div>
          </div>

          <div class="step-actions">
            <v-btn variant="outlined" @click="currentStep = 2">
              <v-icon start size="16">mdi-arrow-left</v-icon>
              {{ $t('common.back') }}
            </v-btn>
            <v-btn v-if="!setupSuccess" color="primary" class="btn-accent" :loading="submitting" @click="doSetup">
              <v-icon start size="16">{{ devMode ? 'mdi-play-outline' : 'mdi-rocket-launch-outline' }}</v-icon>
              {{ devMode ? $t('setup.simulate') : $t('setup.install') }}
            </v-btn>
            <v-btn v-if="setupSuccess && !devMode" color="primary" class="btn-accent" @click="$router.push('/login')">
              <v-icon start size="16">mdi-login-variant</v-icon>
              {{ $t('setup.goToLogin') }}
            </v-btn>
            <v-btn v-if="devMode && devResult" variant="outlined" @click="resetDev">
              <v-icon start size="16">mdi-refresh</v-icon>
              {{ $t('setup.resetSimulation') }}
            </v-btn>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import api from '../services/api';

const { t } = useI18n();
const route = useRoute();

const devMode = computed(() => route.query.dev === 'true');
const version = ref('3.0.0-beta.1');
const loading = ref(true);
const currentStep = ref(0);
const showPw = ref(false);
const submitting = ref(false);
const setupError = ref('');
const setupSuccess = ref('');
const devResult = ref<any>(null);

interface SetupStatus {
  setupRequired: boolean;
  isDev: boolean;
  stats: { adminCount: number; userCount: number; hasSettings: boolean };
  services: { name: string; status: string; message: string; version?: string }[];
  env: Record<string, any>;
  version: string;
}

const status = ref<SetupStatus | null>(null);

const steps = ['diagnostics', 'admin', 'settings', 'summary'];

const adminForm = ref({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
});

const settingsForm = ref({
  appName: 'MeteorEdit',
  accentColor: '#38bdf8',
  loginMessage: '',
  language: 'fr',
  registrationEnabled: true,
});

const languageOptions = [
  { title: 'Francais', value: 'fr' },
  { title: 'English', value: 'en' },
  { title: 'Nederlands', value: 'nl' },
];

const adminValid = computed(() => {
  return adminForm.value.firstName && adminForm.value.lastName && adminForm.value.email && adminForm.value.password.length >= 8;
});

const mongoOk = computed(() => {
  return status.value?.services?.some(s => s.name === 'mongodb' && s.status === 'ok') ?? false;
});

const envDisplay = computed(() => {
  if (!status.value?.env) return {};
  const env = status.value.env;
  return {
    NODE_ENV: { ok: env.nodeEnv === 'production', label: env.nodeEnv },
    JWT_SECRET: { ok: env.hasJwtSecret, label: env.hasJwtSecret ? 'Configured' : 'Default (insecure!)' },
    JWT_REFRESH_SECRET: { ok: env.hasRefreshSecret, label: env.hasRefreshSecret ? 'Configured' : 'Default (insecure!)' },
    COOKIE_KEY: { ok: env.hasCookieKey, label: env.hasCookieKey ? 'Configured' : 'Default (insecure!)' },
    MONGODB_URI: { ok: true, label: env.mongodbUri },
    UPLOAD_DIR: { ok: true, label: env.uploadDir },
  };
});

async function fetchStatus() {
  loading.value = true;
  try {
    const params = devMode.value ? '?dev=true' : '';
    const { data } = await api.get(`/setup/status${params}`);
    status.value = data;
    version.value = data.version || version.value;
  } catch (e: any) {
    status.value = null;
  } finally {
    loading.value = false;
  }
}

async function doSetup() {
  submitting.value = true;
  setupError.value = '';
  setupSuccess.value = '';
  devResult.value = null;

  try {
    const params = devMode.value ? '?dev=true' : '';
    const { data } = await api.post(`/setup/initialize${params}`, {
      admin: adminForm.value,
      settings: settingsForm.value,
    });

    if (data.isDev) {
      devResult.value = data;
      setupSuccess.value = data.message;
    } else {
      setupSuccess.value = data.message;
    }
  } catch (e: any) {
    setupError.value = e.response?.data?.message || t('setup.error');
  } finally {
    submitting.value = false;
  }
}

function resetDev() {
  devResult.value = null;
  setupSuccess.value = '';
  setupError.value = '';
}

onMounted(fetchStatus);
</script>

<style scoped>
.setup-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    linear-gradient(135deg, rgba(56, 189, 248, 0.06) 0%, transparent 60%),
    var(--me-bg-deep);
  padding: 24px;
}

.setup-container {
  width: 100%;
  max-width: 640px;
}

.setup-header {
  text-align: center;
  margin-bottom: 32px;
}

.setup-logo {
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: linear-gradient(135deg, var(--me-accent), rgba(56, 189, 248, 0.7));
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 8px 32px rgba(56, 189, 248, 0.25);
}

.setup-title {
  font-size: 28px;
  font-weight: 800;
  color: var(--me-text-primary);
}

.setup-subtitle {
  font-size: 14px;
  color: var(--me-text-muted);
  margin-top: 4px;
}

.setup-version {
  font-size: 11px;
  color: var(--me-text-muted);
  margin-top: 8px;
  letter-spacing: 1px;
}

.dev-badge {
  display: inline-flex;
  align-items: center;
  margin-top: 12px;
  padding: 4px 12px;
  border-radius: 20px;
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.setup-loading {
  text-align: center;
  padding: 60px 0;
}

/* Step indicators */
.step-indicators {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 28px;
}

.step-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-muted);
  background: var(--me-bg-card);
  border: 2px solid var(--me-border);
  transition: all 0.3s ease;
  cursor: default;
}

.step-dot.active {
  border-color: var(--me-accent);
  color: var(--me-accent);
  box-shadow: 0 0 12px var(--me-accent-glow);
}

.step-dot.done {
  background: var(--me-accent);
  border-color: var(--me-accent);
  color: white;
  cursor: pointer;
}

/* Steps */
.setup-step {
  background: var(--me-bg-card);
  border: 1px solid var(--me-border);
  border-radius: 16px;
  padding: 28px;
}

.step-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--me-text-primary);
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.step-desc {
  font-size: 13px;
  color: var(--me-text-muted);
  margin-bottom: 20px;
}

/* Service list */
.service-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.service-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
}

.service-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.service-status-dot.ok { background: #22c55e; box-shadow: 0 0 6px rgba(34, 197, 94, 0.4); }
.service-status-dot.error { background: #ef4444; box-shadow: 0 0 6px rgba(239, 68, 68, 0.4); }
.service-status-dot.unconfigured { background: #f59e0b; box-shadow: 0 0 6px rgba(245, 158, 11, 0.4); }

.service-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.service-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-primary);
  text-transform: capitalize;
}

.service-msg {
  font-size: 11px;
  color: var(--me-text-muted);
}

.service-version {
  font-size: 11px;
  color: var(--me-accent);
}

/* Env section */
.env-section {
  border-top: 1px solid var(--me-border);
  padding-top: 16px;
}

.env-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--me-text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
}

.env-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.env-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.env-key {
  color: var(--me-text-muted);
  min-width: 160px;
}

.env-val {
  color: var(--me-text-secondary);
}

/* Stats */
.stats-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--me-text-secondary);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--me-border);
}

.stat-chip.ok {
  border-color: rgba(34, 197, 94, 0.3);
  color: #22c55e;
}

/* Form */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* Color row */
.color-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-input {
  width: 40px;
  height: 40px;
  border: 2px solid var(--me-border);
  border-radius: 8px;
  cursor: pointer;
  background: transparent;
  padding: 2px;
}

.color-hex {
  font-size: 12px;
  color: var(--me-text-muted);
}

/* Switch */
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settings-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--me-text-muted);
}

/* Summary */
.summary-card {
  padding: 20px;
  border-radius: 12px;
}

.summary-section {
  margin-bottom: 16px;
}

.summary-section:last-child {
  margin-bottom: 0;
}

.summary-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--me-accent);
  margin-bottom: 6px;
}

.summary-color {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.color-dot {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}

.text-muted {
  color: var(--me-text-muted);
  font-size: 13px;
}

/* Dev result */
.dev-result {
  padding: 16px;
  border-radius: 10px;
  border: 1px dashed rgba(245, 158, 11, 0.3);
}

.dev-result-item {
  display: flex;
  gap: 8px;
  font-size: 12px;
  padding: 3px 0;
  color: var(--me-text-secondary);
}

.dev-result-item .mono {
  color: var(--me-text-muted);
  min-width: 180px;
}

/* Actions */
.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}

.mb-0 { margin-bottom: 0 !important; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.mt-4 { margin-top: 16px; }

@media (max-width: 600px) {
  .setup-container {
    max-width: 100%;
  }
  .setup-step {
    padding: 20px 16px;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
  .env-key {
    min-width: 100px;
  }
}
</style>
