<template>
  <div class="admin-clipper">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-send</v-icon>
        {{ t('telegram.connectionTitle') }}
      </h2>
      <p class="admin-section-subtitle">{{ t('telegram.connectionDesc') }}</p>
    </div>

    <v-progress-linear v-if="loadingStatus" indeterminate color="primary" class="mb-4" />

    <!-- Connected state -->
    <div v-if="connected" class="sec-card glass-card fade-in fade-in-delay-1">
      <div class="sec-card-header">
        <v-icon size="18" color="success">mdi-check-circle</v-icon>
        <h3 class="sec-card-title mono">{{ t('telegram.connected') }}</h3>
      </div>
      <div class="sec-option">
        <div class="tg-connected-info">
          <span class="tg-status-dot tg-status-dot--online" />
          <span class="tg-connected-text">
            {{ t('telegram.connectedAs') }}
            <strong v-if="connectedUser.username">{{ connectedUser.username }}</strong>
            <strong v-else>{{ connectedUser.firstName }} {{ connectedUser.lastName }}</strong>
          </span>
        </div>
        <button class="me-btn me-btn-ghost me-btn-danger" :disabled="disconnecting" @click="doDisconnect">
          <v-progress-circular v-if="disconnecting" indeterminate size="14" width="2" class="mr-1" />
          <v-icon v-else size="14" class="mr-1">mdi-logout</v-icon>
          {{ t('telegram.disconnect') }}
        </button>
      </div>
    </div>

    <!-- Not connected - wizard -->
    <div v-else class="sec-card glass-card fade-in fade-in-delay-1">
      <div class="sec-card-header">
        <v-icon size="18" color="warning">mdi-alert-circle-outline</v-icon>
        <h3 class="sec-card-title mono">{{ t('telegram.notConnected') }}</h3>
      </div>

      <!-- Step 1: Phone number -->
      <div v-if="step === 1" class="tg-step">
        <label class="sec-label">{{ t('telegram.enterPhone') }}</label>
        <div class="tg-phone-row">
          <select v-model="phonePrefix" class="tg-prefix-select">
            <option v-for="p in phonePrefixes" :key="p.code" :value="p.code">
              {{ p.code }} {{ p.country }}
            </option>
          </select>
          <input
            v-model="phoneNumber"
            type="tel"
            class="tg-input"
            :placeholder="t('telegram.phonePlaceholder')"
            @keydown.enter="sendCode"
          />
        </div>
        <div class="tg-step-actions">
          <button
            class="me-btn me-btn-accent"
            :disabled="!phoneNumber.trim() || sendingCode"
            @click="sendCode"
          >
            <v-progress-circular v-if="sendingCode" indeterminate size="14" width="2" class="mr-1" />
            <v-icon v-else size="14" class="mr-1">mdi-send</v-icon>
            {{ sendingCode ? t('telegram.sendingCode') : t('telegram.sendCode') }}
          </button>
        </div>
      </div>

      <!-- Step 2: OTP code -->
      <div v-if="step === 2" class="tg-step">
        <label class="sec-label">{{ t('telegram.enterCode') }}</label>
        <input
          v-model="otpCode"
          type="text"
          class="tg-input"
          :placeholder="t('telegram.codePlaceholder')"
          maxlength="10"
          @keydown.enter="verifyCode"
        />
        <div class="tg-step-actions">
          <button class="me-btn me-btn-ghost" @click="step = 1">
            <v-icon size="14" class="mr-1">mdi-arrow-left</v-icon>
            {{ t('common.back') }}
          </button>
          <button
            class="me-btn me-btn-accent"
            :disabled="!otpCode.trim() || verifying"
            @click="verifyCode"
          >
            <v-progress-circular v-if="verifying" indeterminate size="14" width="2" class="mr-1" />
            <v-icon v-else size="14" class="mr-1">mdi-check</v-icon>
            {{ verifying ? t('telegram.verifying') : t('telegram.verify') }}
          </button>
        </div>
      </div>

      <!-- Step 3: 2FA password -->
      <div v-if="step === 3" class="tg-step">
        <label class="sec-label">{{ t('telegram.enter2FA') }}</label>
        <input
          v-model="password2FA"
          type="password"
          class="tg-input"
          @keydown.enter="verifyWith2FA"
        />
        <div class="tg-step-actions">
          <button class="me-btn me-btn-ghost" @click="step = 2">
            <v-icon size="14" class="mr-1">mdi-arrow-left</v-icon>
            {{ t('common.back') }}
          </button>
          <button
            class="me-btn me-btn-accent"
            :disabled="!password2FA.trim() || verifying"
            @click="verifyWith2FA"
          >
            <v-progress-circular v-if="verifying" indeterminate size="14" width="2" class="mr-1" />
            <v-icon v-else size="14" class="mr-1">mdi-check</v-icon>
            {{ verifying ? t('telegram.verifying') : t('telegram.verify') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Error message -->
    <v-snackbar v-model="snackbar" :timeout="4000" :color="snackbarColor" location="bottom right">
      {{ snackbarText }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';

const { t } = useI18n();

const loadingStatus = ref(false);
const connected = ref(false);
const connectedUser = ref<{ username?: string; firstName?: string; lastName?: string }>({});
const step = ref(1);

const phonePrefix = ref('+32');
const phoneNumber = ref('');
const otpCode = ref('');
const password2FA = ref('');

const sendingCode = ref(false);
const verifying = ref(false);
const disconnecting = ref(false);

const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('error');

const phonePrefixes = [
  { code: '+32', country: 'BE' },
  { code: '+33', country: 'FR' },
  { code: '+31', country: 'NL' },
  { code: '+49', country: 'DE' },
  { code: '+44', country: 'GB' },
  { code: '+1', country: 'US' },
  { code: '+41', country: 'CH' },
  { code: '+352', country: 'LU' },
  { code: '+39', country: 'IT' },
  { code: '+34', country: 'ES' },
  { code: '+48', country: 'PL' },
  { code: '+380', country: 'UA' },
  { code: '+90', country: 'TR' },
];

function showError(msg: string) {
  snackbarText.value = msg;
  snackbarColor.value = 'error';
  snackbar.value = true;
}

function showSuccess(msg: string) {
  snackbarText.value = msg;
  snackbarColor.value = 'success';
  snackbar.value = true;
}

async function checkStatus() {
  loadingStatus.value = true;
  try {
    const { data } = await api.get('/telegram/auth/status');
    connected.value = data.connected || false;
    if (data.connected && data.user) {
      connectedUser.value = data.user;
    }
  } catch {
    connected.value = false;
  } finally {
    loadingStatus.value = false;
  }
}

async function sendCode() {
  if (!phoneNumber.value.trim()) return;
  sendingCode.value = true;
  try {
    const fullPhone = phonePrefix.value + phoneNumber.value.replace(/\s/g, '');
    await api.post('/telegram/auth/send-code', { phone: fullPhone });
    step.value = 2;
  } catch (err: any) {
    showError(err.response?.data?.error || 'Error sending code');
  } finally {
    sendingCode.value = false;
  }
}

async function verifyCode() {
  if (!otpCode.value.trim()) return;
  verifying.value = true;
  try {
    const fullPhone = phonePrefix.value + phoneNumber.value.replace(/\s/g, '');
    const { data } = await api.post('/telegram/auth/sign-in', {
      phone: fullPhone,
      code: otpCode.value.trim(),
    });
    if (data.requires2FA) {
      step.value = 3;
    } else {
      connected.value = true;
      connectedUser.value = data.user || {};
      showSuccess(t('telegram.connected'));
    }
  } catch (err: any) {
    if (err.response?.data?.requires2FA) {
      step.value = 3;
    } else {
      showError(err.response?.data?.error || 'Error verifying code');
    }
  } finally {
    verifying.value = false;
  }
}

async function verifyWith2FA() {
  if (!password2FA.value.trim()) return;
  verifying.value = true;
  try {
    const fullPhone = phonePrefix.value + phoneNumber.value.replace(/\s/g, '');
    const { data } = await api.post('/telegram/auth/sign-in', {
      phone: fullPhone,
      code: otpCode.value.trim(),
      password: password2FA.value,
    });
    connected.value = true;
    connectedUser.value = data.user || {};
    showSuccess(t('telegram.connected'));
  } catch (err: any) {
    showError(err.response?.data?.error || 'Error verifying 2FA');
  } finally {
    verifying.value = false;
  }
}

async function doDisconnect() {
  disconnecting.value = true;
  try {
    await api.post('/telegram/auth/logout');
    connected.value = false;
    connectedUser.value = {};
    step.value = 1;
    phoneNumber.value = '';
    otpCode.value = '';
    password2FA.value = '';
    showSuccess(t('telegram.notConnected'));
  } catch (err: any) {
    showError(err.response?.data?.error || 'Error disconnecting');
  } finally {
    disconnecting.value = false;
  }
}

onMounted(() => {
  checkStatus();
});
</script>

<style scoped>
.admin-clipper { display: flex; flex-direction: column; gap: 20px; }
.admin-section-header { margin-bottom: 4px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; margin: 0; }
.admin-section-subtitle { font-size: 13px; color: var(--me-text-muted); margin: 6px 0 0; }

.sec-card { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.sec-card-header { display: flex; align-items: center; gap: 8px; }
.sec-card-title { font-size: 14px; font-weight: 600; color: var(--me-text-primary); margin: 0; }
.sec-option { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.sec-label { font-size: 13px; font-weight: 500; color: var(--me-text-secondary); margin: 0 0 6px; }

.tg-step { display: flex; flex-direction: column; gap: 10px; }

.tg-phone-row { display: flex; gap: 8px; align-items: center; }

.tg-prefix-select {
  padding: 8px 10px;
  border-radius: var(--me-radius-xs);
  border: 1px solid var(--me-border);
  background: var(--me-bg-deep);
  color: var(--me-text-primary);
  font-size: 13px;
  font-family: var(--me-font-mono);
  outline: none;
  min-width: 100px;
}

.tg-prefix-select:focus {
  border-color: var(--me-accent);
}

.tg-input {
  flex: 1;
  padding: 8px 12px;
  border-radius: var(--me-radius-xs);
  border: 1px solid var(--me-border);
  background: var(--me-bg-deep);
  color: var(--me-text-primary);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}

.tg-input:focus {
  border-color: var(--me-accent);
}

.tg-input::placeholder {
  color: var(--me-text-muted);
}

.tg-step-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
}

.tg-connected-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tg-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tg-status-dot--online {
  background: #4caf50;
  box-shadow: 0 0 6px rgba(76, 175, 80, 0.5);
}

.tg-connected-text {
  font-size: 14px;
  color: var(--me-text-secondary);
}

.tg-connected-text strong {
  color: var(--me-text-primary);
}

/* Button styles (scoped) */
.me-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 14px;
  border-radius: var(--me-radius-xs);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
  text-decoration: none;
  font-family: inherit;
  line-height: 1.4;
}

.me-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.me-btn-accent {
  background: var(--me-accent);
  color: var(--me-bg-deep);
  border-color: var(--me-accent);
}

.me-btn-accent:hover:not(:disabled) {
  filter: brightness(1.1);
}

.me-btn-ghost {
  background: none;
  color: var(--me-text-secondary);
  border-color: var(--me-border);
}

.me-btn-ghost:hover:not(:disabled) {
  background: var(--me-accent-glow);
  color: var(--me-accent);
  border-color: var(--me-accent);
}

.me-btn-danger {
  color: #f44336;
  border-color: rgba(244, 67, 54, 0.3);
}

.me-btn-danger:hover:not(:disabled) {
  background: rgba(244, 67, 54, 0.1);
  color: #f44336;
  border-color: #f44336;
}
</style>
