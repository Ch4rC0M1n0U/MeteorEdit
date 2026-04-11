<template>
  <div class="setup-page">
    <div class="setup-container">
      <!-- Header -->
      <div class="setup-header">
        <div class="setup-logo">
          <span class="mdi mdi-shield-search" style="font-size: 40px; color: white;"></span>
        </div>
        <h1 class="setup-title mono">MeteorEdit</h1>
        <p class="setup-subtitle">{{ $t('setup.subtitle') }}</p>
        <div v-if="devMode" class="dev-badge">
          <span class="mdi mdi-bug-outline" style="font-size: 14px; margin-right: 4px;"></span>
          {{ $t('setup.devMode') }}
        </div>
        <div class="setup-version mono">v{{ version }}</div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="setup-loading">
        <ProgressSpinner style="width: 40px; height: 40px;" />
        <p style="margin-top: 12px;" class="text-muted">{{ $t('setup.checking') }}</p>
      </div>

      <!-- Stepper -->
      <div v-else class="setup-stepper">
        <!-- Step indicators -->
        <div class="step-indicators">
          <div v-for="(_s, i) in steps" :key="i" class="step-dot" :class="{ active: currentStep === i, done: currentStep > i }" @click="currentStep > i ? currentStep = i : null">
            <i v-if="currentStep > i" class="pi pi-check" style="font-size: 14px;"></i>
            <span v-else>{{ i + 1 }}</span>
          </div>
        </div>

        <!-- Step 1: Diagnostics -->
        <div v-if="currentStep === 0" class="setup-step fade-in">
          <h2 class="step-title">
            <span class="mdi mdi-stethoscope" style="font-size: 20px; margin-right: 8px;"></span>
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
              <Tag v-else :severity="svc.status === 'ok' ? 'success' : svc.status === 'unconfigured' ? 'warn' : 'danger'" :value="svc.status" />
            </div>
          </div>

          <!-- Env checks -->
          <div v-if="status?.env" class="env-section mt-4">
            <h3 class="env-title mono">
              <i class="pi pi-cog" style="font-size: 16px; margin-right: 4px;"></i>
              {{ $t('setup.envCheck') }}
            </h3>
            <div class="env-grid">
              <div class="env-item" v-for="(val, key) in envDisplay" :key="key">
                <span class="env-key mono">{{ key }}</span>
                <span :class="['mdi', val?.ok ? 'mdi-check-circle' : 'mdi-alert-circle']" :style="{ fontSize: '16px', color: val?.ok ? '#22c55e' : '#f59e0b' }"></span>
                <span class="env-val">{{ val?.label }}</span>
              </div>
            </div>
          </div>

          <!-- Stats -->
          <div v-if="status?.stats" class="stats-row mt-4">
            <div class="stat-chip">
              <span class="mdi mdi-account-outline" style="font-size: 14px; margin-right: 4px;"></span>
              {{ status.stats.userCount }} {{ $t('setup.users') }}
            </div>
            <div class="stat-chip">
              <span class="mdi mdi-shield-account" style="font-size: 14px; margin-right: 4px;"></span>
              {{ status.stats.adminCount }} {{ $t('setup.admins') }}
            </div>
            <div class="stat-chip" :class="{ ok: status.stats.hasSettings }">
              <span class="mdi mdi-database-check" style="font-size: 14px; margin-right: 4px;"></span>
              {{ status.stats.hasSettings ? $t('setup.settingsOk') : $t('setup.noSettings') }}
            </div>
          </div>

          <div class="step-actions">
            <button v-if="!devMode && !status?.setupRequired" class="setup-btn setup-btn--outlined" @click="$router.push('/login')">
              <span class="mdi mdi-arrow-left" style="font-size: 16px; margin-right: 4px;"></span>
              {{ $t('setup.backToLogin') }}
            </button>
            <button class="setup-btn btn-accent" @click="currentStep = 1" :disabled="!mongoOk">
              {{ $t('setup.next') }}
              <span class="mdi mdi-arrow-right" style="font-size: 16px; margin-left: 4px;"></span>
            </button>
          </div>
        </div>

        <!-- Step 2: Admin account -->
        <div v-if="currentStep === 1" class="setup-step fade-in">
          <h2 class="step-title">
            <span class="mdi mdi-shield-account" style="font-size: 20px; margin-right: 8px;"></span>
            {{ $t('setup.adminAccount') }}
          </h2>
          <p class="step-desc">{{ devMode ? $t('setup.adminAccountDescDev') : $t('setup.adminAccountDesc') }}</p>

          <form @submit.prevent="currentStep = 2">
            <div class="form-grid">
              <div class="setup-field">
                <label class="setup-field-label">{{ $t('auth.firstName') }}</label>
                <InputText v-model="adminForm.firstName" required />
              </div>
              <div class="setup-field">
                <label class="setup-field-label">{{ $t('auth.lastName') }}</label>
                <InputText v-model="adminForm.lastName" required />
              </div>
            </div>
            <div class="setup-field" style="margin-top: 8px;">
              <label class="setup-field-label">{{ $t('auth.email') }}</label>
              <InputText v-model="adminForm.email" type="email" required />
            </div>
            <div class="setup-field" style="margin-top: 8px;">
              <label class="setup-field-label">{{ $t('auth.password') }}</label>
              <Password v-model="adminForm.password" :feedback="false" toggleMask :inputStyle="{ width: '100%' }" />
            </div>

            <div class="step-actions">
              <button type="button" class="setup-btn setup-btn--outlined" @click="currentStep = 0">
                <span class="mdi mdi-arrow-left" style="font-size: 16px; margin-right: 4px;"></span>
                {{ $t('common.back') }}
              </button>
              <button type="submit" class="setup-btn btn-accent" :disabled="!adminValid">
                {{ $t('setup.next') }}
                <span class="mdi mdi-arrow-right" style="font-size: 16px; margin-left: 4px;"></span>
              </button>
            </div>
          </form>
        </div>

        <!-- Step 3: App settings -->
        <div v-if="currentStep === 2" class="setup-step fade-in">
          <h2 class="step-title">
            <span class="mdi mdi-palette-outline" style="font-size: 20px; margin-right: 8px;"></span>
            {{ $t('setup.appSettings') }}
          </h2>
          <p class="step-desc">{{ $t('setup.appSettingsDesc') }}</p>

          <div class="setup-field" style="margin-top: 12px;">
            <label class="setup-field-label">{{ $t('admin.appName') }}</label>
            <InputText v-model="settingsForm.appName" />
          </div>

          <div class="color-row" style="margin-top: 12px;">
            <label class="settings-label mono">{{ $t('admin.accentColor') }}</label>
            <input type="color" v-model="settingsForm.accentColor" class="color-input" />
            <span class="color-hex mono">{{ settingsForm.accentColor }}</span>
          </div>

          <div class="setup-field" style="margin-top: 12px;">
            <label class="setup-field-label">{{ $t('admin.loginMessage') }}</label>
            <InputText v-model="settingsForm.loginMessage" />
          </div>

          <div class="setup-field" style="margin-top: 12px;">
            <label class="setup-field-label">{{ $t('setup.defaultLanguage') }}</label>
            <Select v-model="settingsForm.language" :options="languageOptions" optionLabel="title" optionValue="value" />
          </div>

          <div class="switch-row" style="margin-top: 12px;">
            <label class="settings-label mono" style="margin-bottom: 0;">{{ $t('setup.enableRegistration') }}</label>
            <ToggleSwitch v-model="settingsForm.registrationEnabled" />
          </div>

          <div class="step-actions">
            <button class="setup-btn setup-btn--outlined" @click="currentStep = 1">
              <span class="mdi mdi-arrow-left" style="font-size: 16px; margin-right: 4px;"></span>
              {{ $t('common.back') }}
            </button>
            <button class="setup-btn btn-accent" @click="currentStep = 3">
              {{ $t('setup.next') }}
              <span class="mdi mdi-arrow-right" style="font-size: 16px; margin-left: 4px;"></span>
            </button>
          </div>
        </div>

        <!-- Step 4: Summary & confirm -->
        <div v-if="currentStep === 3" class="setup-step fade-in">
          <h2 class="step-title">
            <span class="mdi mdi-check-decagram" style="font-size: 20px; margin-right: 8px;"></span>
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

          <Message v-if="devMode" severity="info" style="margin-top: 12px;">
            <span class="mdi mdi-bug-outline" style="font-size: 16px; margin-right: 4px;"></span>
            {{ $t('setup.devModeInfo') }}
          </Message>

          <Message v-if="setupError" severity="error" :closable="true" @close="setupError = ''" style="margin-top: 12px;">
            {{ setupError }}
          </Message>

          <Message v-if="setupSuccess" severity="success" style="margin-top: 12px;">
            <i class="pi pi-check" style="font-size: 16px; margin-right: 4px;"></i>
            {{ setupSuccess }}
          </Message>

          <!-- Dev simulation result -->
          <div v-if="devResult" class="dev-result glass-card mt-3">
            <h4 class="summary-label mono">{{ $t('setup.simulationResult') }}</h4>
            <div class="dev-result-item" v-for="(val, key) in devResult.simulation" :key="key">
              <span class="mono">{{ key }}:</span>
              <span>{{ val }}</span>
            </div>
          </div>

          <div class="step-actions">
            <button class="setup-btn setup-btn--outlined" @click="currentStep = 2">
              <span class="mdi mdi-arrow-left" style="font-size: 16px; margin-right: 4px;"></span>
              {{ $t('common.back') }}
            </button>
            <button v-if="!setupSuccess" class="setup-btn btn-accent" :disabled="submitting" @click="doSetup">
              <span :class="['mdi', devMode ? 'mdi-play-outline' : 'mdi-rocket-launch-outline']" style="font-size: 16px; margin-right: 4px;"></span>
              {{ devMode ? $t('setup.simulate') : $t('setup.install') }}
            </button>
            <button v-if="setupSuccess && !devMode" class="setup-btn btn-accent" @click="$router.push('/login')">
              <span class="mdi mdi-login-variant" style="font-size: 16px; margin-right: 4px;"></span>
              {{ $t('setup.goToLogin') }}
            </button>
            <button v-if="devMode && devResult" class="setup-btn setup-btn--outlined" @click="resetDev">
              <i class="pi pi-refresh" style="font-size: 16px; margin-right: 4px;"></i>
              {{ $t('setup.resetSimulation') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import api from '../services/api';
import ProgressSpinner from 'primevue/progressspinner';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Select from 'primevue/select';
import ToggleSwitch from 'primevue/toggleswitch';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const devMode = computed(() => route.query.dev === 'true');
const version = ref('3.3.0-beta.1');
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

    // If setup already done and NOT in dev mode, redirect to login
    if (!data.setupRequired && !devMode.value) {
      router.replace('/login');
      return;
    }
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
.setup-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 20px;
  border-radius: var(--me-radius-xs, 8px);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
  white-space: nowrap;
}
.setup-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.setup-btn--outlined {
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
}
.setup-btn--outlined:hover:not(:disabled) {
  border-color: var(--me-border-hover);
  color: var(--me-text-primary);
  background: var(--me-bg-elevated);
}
.setup-field { display: flex; flex-direction: column; gap: 4px; }
.setup-field-label { font-size: 13px; font-weight: 500; color: var(--me-text-secondary); }
</style>
