<template>
  <div class="ssm glass-card">
    <!-- Header -->
    <div class="ssm-header">
      <div class="ssm-header-left">
        <div class="ssm-header-icon">
          <v-icon size="20">mdi-shield-account-outline</v-icon>
        </div>
        <div>
          <h3 class="ssm-title mono">{{ $t('social.session.title') }}</h3>
          <p class="ssm-subtitle">{{ $t('social.session.subtitle') }}</p>
        </div>
      </div>
      <div class="ssm-header-right">
        <span class="ssm-counter mono">
          <span class="ssm-counter-num">{{ connectedCount }}</span>
          <span class="ssm-counter-sep">/</span>
          <span class="ssm-counter-total">{{ platformList.length }}</span>
        </span>
      </div>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="ssm-loader" />

    <!-- Platform grid -->
    <div class="ssm-platforms">
      <div
        v-for="p in platformList"
        :key="p.key"
        :class="['ssm-platform', { 'ssm-platform--connected': isConnected(p.key) }]"
      >
        <div class="ssm-platform-left">
          <div class="ssm-platform-icon" :style="iconStyle(p, isConnected(p.key))">
            <v-icon size="20" :color="isConnected(p.key) ? '#fff' : p.color">{{ p.icon }}</v-icon>
          </div>
          <div class="ssm-platform-details">
            <span class="ssm-platform-name">{{ p.name }}</span>
            <span v-if="isConnected(p.key)" class="ssm-platform-date mono">
              {{ formatDate(getConnectedDate(p.key)) }}
            </span>
            <span v-else class="ssm-platform-date ssm-platform-date--off mono">
              {{ $t('social.session.notConnected') }}
            </span>
          </div>
        </div>

        <button
          v-if="!isConnected(p.key)"
          class="ssm-btn ssm-btn--connect"
          @click="openLoginDialog(p)"
        >
          {{ $t('social.session.connect') }}
        </button>
        <button
          v-else
          class="ssm-btn ssm-btn--disconnect"
          @click="confirmDisconnect(p)"
        >
          {{ $t('social.session.disconnect') }}
        </button>
      </div>
    </div>

    <!-- Login Dialog -->
    <v-dialog v-model="loginDialog" max-width="420" persistent>
      <div class="ssm-dialog glass-card">
        <div class="ssm-dialog-header">
          <div class="ssm-dialog-icon" :style="iconStyle(loginPlatform!, true)">
            <v-icon size="22" color="#fff">{{ loginPlatform?.icon }}</v-icon>
          </div>
          <span class="ssm-dialog-title">
            {{ $t('social.session.connectTo', { platform: loginPlatform?.name }) }}
          </span>
          <button class="ssm-close-btn" @click="cancelLogin" :disabled="loginLoading">
            <v-icon size="16">mdi-close</v-icon>
          </button>
        </div>

        <div class="ssm-dialog-body">
          <!-- Waiting state -->
          <div v-if="loginLoading" class="ssm-dialog-status">
            <div class="ssm-pulse-ring">
              <v-progress-circular indeterminate :color="loginPlatform?.color" size="56" width="3" />
            </div>
            <p class="ssm-dialog-msg">{{ $t('social.session.loginInProgress') }}</p>
            <p class="ssm-dialog-hint">{{ $t('social.session.loginHint') }}</p>
            <div class="ssm-dialog-timer mono">
              {{ formatTimer(loginElapsed) }} / 5:00
            </div>
          </div>

          <!-- Success state -->
          <div v-else-if="loginResult === 'success'" class="ssm-dialog-status">
            <div class="ssm-result-icon ssm-result-icon--success">
              <v-icon size="32" color="#fff">mdi-check</v-icon>
            </div>
            <p class="ssm-dialog-msg ssm-dialog-msg--success">{{ $t('social.session.loginSuccess') }}</p>
          </div>

          <!-- Error state -->
          <div v-else-if="loginResult === 'error'" class="ssm-dialog-status">
            <div class="ssm-result-icon ssm-result-icon--error">
              <v-icon size="32" color="#fff">mdi-close</v-icon>
            </div>
            <p class="ssm-dialog-msg ssm-dialog-msg--error">{{ loginErrorMessage }}</p>
          </div>

          <!-- Timeout state -->
          <div v-else-if="loginResult === 'timeout'" class="ssm-dialog-status">
            <div class="ssm-result-icon ssm-result-icon--warning">
              <v-icon size="32" color="#fff">mdi-clock-alert-outline</v-icon>
            </div>
            <p class="ssm-dialog-msg ssm-dialog-msg--error">{{ $t('social.session.loginTimeout') }}</p>
          </div>

          <!-- Initial state -->
          <div v-else class="ssm-dialog-status">
            <div class="ssm-dialog-icon-lg" :style="iconStyle(loginPlatform!, true)">
              <v-icon size="36" color="#fff">{{ loginPlatform?.icon }}</v-icon>
            </div>
            <p class="ssm-dialog-msg">{{ $t('social.session.loginReady') }}</p>
            <p class="ssm-dialog-hint">{{ $t('social.session.loginReadyHint') }}</p>
          </div>
        </div>

        <div class="ssm-dialog-actions">
          <button
            v-if="!loginLoading && loginResult === null"
            class="ssm-btn ssm-btn--primary"
            @click="startLogin"
          >
            <v-icon size="14" class="mr-1">mdi-launch</v-icon>
            {{ $t('social.session.launchLogin') }}
          </button>
          <button
            v-if="loginResult === 'error' || loginResult === 'timeout'"
            class="ssm-btn ssm-btn--primary"
            @click="retryLogin"
          >
            <v-icon size="14" class="mr-1">mdi-refresh</v-icon>
            {{ $t('social.session.retry') }}
          </button>
          <button
            v-if="!loginLoading"
            class="ssm-btn ssm-btn--ghost"
            @click="closeLoginDialog"
          >
            {{ $t('common.close') }}
          </button>
        </div>
      </div>
    </v-dialog>

    <!-- Disconnect Confirm Dialog -->
    <v-dialog v-model="disconnectDialog" max-width="380">
      <div class="ssm-dialog glass-card">
        <div class="ssm-dialog-header">
          <div class="ssm-result-icon ssm-result-icon--error" style="width:32px;height:32px;">
            <v-icon size="18" color="#fff">mdi-link-off</v-icon>
          </div>
          <span class="ssm-dialog-title">{{ $t('social.session.confirmDisconnect') }}</span>
          <button class="ssm-close-btn" @click="disconnectDialog = false">
            <v-icon size="16">mdi-close</v-icon>
          </button>
        </div>

        <div class="ssm-dialog-body">
          <p class="ssm-dialog-msg">
            {{ $t('social.session.confirmDisconnectMsg', { platform: disconnectPlatform?.name }) }}
          </p>
        </div>

        <div class="ssm-dialog-actions">
          <button class="ssm-btn ssm-btn--ghost" @click="disconnectDialog = false" :disabled="disconnecting">
            {{ $t('common.cancel') }}
          </button>
          <button
            class="ssm-btn ssm-btn--danger"
            :disabled="disconnecting"
            @click="doDisconnect"
          >
            <v-icon size="14" class="mr-1">mdi-delete-outline</v-icon>
            {{ disconnecting ? $t('social.session.disconnecting') : $t('social.session.disconnect') }}
          </button>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';

interface Platform {
  key: string;
  name: string;
  icon: string;
  color: string;
}

interface CookieRecord {
  platform: string;
  updatedAt: string;
}

const { t, locale } = useI18n();

const platformList: Platform[] = [
  { key: 'youtube', name: 'YouTube', icon: 'mdi-youtube', color: '#FF0000' },
  { key: 'instagram', name: 'Instagram', icon: 'mdi-instagram', color: '#E1306C' },
  { key: 'tiktok', name: 'TikTok', icon: 'mdi-music-note-outline', color: '#010101' },
  { key: 'snapchat', name: 'Snapchat', icon: 'mdi-snapchat', color: '#FFFC00' },
  { key: 'facebook', name: 'Facebook', icon: 'mdi-facebook', color: '#1877F2' },
  { key: 'x', name: 'X', icon: 'mdi-twitter', color: '#1DA1F2' },
  { key: 'whatsapp', name: 'WhatsApp', icon: 'mdi-whatsapp', color: '#25D366' },
  { key: 'threads', name: 'Threads', icon: 'mdi-at', color: '#000000' },
  { key: 'linkedin', name: 'LinkedIn', icon: 'mdi-linkedin', color: '#0A66C2' },
];

// --- State ---
const loading = ref(false);
const connectedPlatforms = ref<CookieRecord[]>([]);

const connectedCount = computed(() =>
  platformList.filter(p => isConnected(p.key)).length
);

// Login dialog
const loginDialog = ref(false);
const loginPlatform = ref<Platform | null>(null);
const loginLoading = ref(false);
const loginResult = ref<'success' | 'error' | 'timeout' | null>(null);
const loginErrorMessage = ref('');
const loginElapsed = ref(0);
let loginTimerInterval: ReturnType<typeof setInterval> | null = null;
let loginAbortController: AbortController | null = null;

// Disconnect dialog
const disconnectDialog = ref(false);
const disconnectPlatform = ref<Platform | null>(null);
const disconnecting = ref(false);

// --- Helpers ---
function isConnected(key: string): boolean {
  return connectedPlatforms.value.some(c => c.platform === key);
}

function getConnectedDate(key: string): string {
  const record = connectedPlatforms.value.find(c => c.platform === key);
  return record?.updatedAt || '';
}

function iconStyle(platform: Platform, filled: boolean) {
  if (!platform) return {};
  if (filled) return { background: platform.color };
  return { background: `${platform.color}18` };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(locale.value, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// --- API ---
async function fetchStatus() {
  loading.value = true;
  try {
    const { data } = await api.get('/social/cookies');
    connectedPlatforms.value = data;
  } catch {
    connectedPlatforms.value = [];
  } finally {
    loading.value = false;
  }
}

// --- Login flow ---
function openLoginDialog(platform: Platform) {
  loginPlatform.value = platform;
  loginResult.value = null;
  loginErrorMessage.value = '';
  loginLoading.value = false;
  loginElapsed.value = 0;
  loginDialog.value = true;
}

function startLogin() {
  if (!loginPlatform.value) return;

  loginLoading.value = true;
  loginResult.value = null;
  loginErrorMessage.value = '';
  loginElapsed.value = 0;

  loginTimerInterval = setInterval(() => {
    loginElapsed.value++;
  }, 1000);

  loginAbortController = new AbortController();

  api.post(`/social/login/${loginPlatform.value.key}`, {}, {
    signal: loginAbortController.signal,
    timeout: 6 * 60 * 1000,
  })
    .then(() => {
      loginResult.value = 'success';
      fetchStatus();
    })
    .catch((err) => {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      if (err.response?.status === 408) {
        loginResult.value = 'timeout';
      } else {
        loginResult.value = 'error';
        loginErrorMessage.value = err.response?.data?.message || t('social.session.loginError');
      }
    })
    .finally(() => {
      loginLoading.value = false;
      clearLoginTimer();
    });
}

function cancelLogin() {
  if (loginLoading.value && loginAbortController) {
    loginAbortController.abort();
  }
  closeLoginDialog();
}

function closeLoginDialog() {
  loginDialog.value = false;
  loginLoading.value = false;
  clearLoginTimer();
  loginAbortController = null;
}

function retryLogin() {
  loginResult.value = null;
  loginErrorMessage.value = '';
  startLogin();
}

function clearLoginTimer() {
  if (loginTimerInterval) {
    clearInterval(loginTimerInterval);
    loginTimerInterval = null;
  }
}

// --- Disconnect flow ---
function confirmDisconnect(platform: Platform) {
  disconnectPlatform.value = platform;
  disconnectDialog.value = true;
}

async function doDisconnect() {
  if (!disconnectPlatform.value) return;
  disconnecting.value = true;
  try {
    await api.delete(`/social/cookies/${disconnectPlatform.value.key}`);
    await fetchStatus();
    disconnectDialog.value = false;
  } catch {
    // Silently fail, user can retry
  } finally {
    disconnecting.value = false;
  }
}

// --- Lifecycle ---
onMounted(fetchStatus);

onUnmounted(() => {
  clearLoginTimer();
  if (loginAbortController) loginAbortController.abort();
});
</script>

<style scoped>
.ssm {
  padding: 0;
  overflow: hidden;
}

/* Header */
.ssm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-elevated);
}
.ssm-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.ssm-header-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--me-accent-glow);
  color: var(--me-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ssm-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--me-text-primary);
  margin: 0;
  line-height: 1.3;
}
.ssm-subtitle {
  font-size: 11px;
  color: var(--me-text-muted);
  margin: 2px 0 0;
  font-family: var(--me-font-mono);
}
.ssm-counter {
  display: flex;
  align-items: baseline;
  gap: 2px;
  padding: 6px 14px;
  border-radius: 20px;
  background: var(--me-bg-deep);
  border: 1px solid var(--me-border);
  font-size: 13px;
}
.ssm-counter-num {
  color: var(--me-accent);
  font-weight: 700;
  font-size: 16px;
}
.ssm-counter-sep {
  color: var(--me-text-muted);
  opacity: 0.5;
}
.ssm-counter-total {
  color: var(--me-text-muted);
  font-size: 13px;
}
.ssm-loader {
  margin: 0;
}

/* Platform list */
.ssm-platforms {
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 4px;
  max-height: 420px;
  overflow-y: auto;
}

.ssm-platform {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: var(--me-radius-sm);
  border: 1px solid transparent;
  transition: all 0.2s;
}
.ssm-platform:hover {
  background: var(--me-bg-elevated);
  border-color: var(--me-border);
}
.ssm-platform--connected {
  background: var(--me-bg-elevated);
  border-color: var(--me-border);
}
.ssm-platform--connected:hover {
  border-color: var(--me-border-hover);
}

.ssm-platform-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.ssm-platform-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.ssm-platform-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.ssm-platform-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--me-text-primary);
  line-height: 1.3;
}
.ssm-platform-date {
  font-size: 11px;
  color: var(--me-text-muted);
  line-height: 1.3;
  margin-top: 1px;
}
.ssm-platform-date--off {
  opacity: 0.5;
}

/* Buttons */
.ssm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 7px 16px;
  border-radius: var(--me-radius-xs);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  white-space: nowrap;
  gap: 4px;
}
.ssm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ssm-btn--connect {
  background: var(--me-accent);
  color: var(--me-bg-deep);
  font-weight: 600;
}
.ssm-btn--connect:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: 0 2px 12px var(--me-accent-glow);
}
.ssm-btn--disconnect {
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-muted);
  font-size: 12px;
  padding: 6px 12px;
}
.ssm-btn--disconnect:hover:not(:disabled) {
  border-color: #f87171;
  color: #f87171;
  background: rgba(248, 113, 113, 0.08);
}
.ssm-btn--primary {
  background: var(--me-accent);
  color: var(--me-bg-deep);
  font-weight: 600;
}
.ssm-btn--primary:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: 0 2px 12px var(--me-accent-glow);
}
.ssm-btn--danger {
  background: #f87171;
  color: #fff;
  font-weight: 600;
}
.ssm-btn--danger:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: 0 2px 12px rgba(248, 113, 113, 0.3);
}
.ssm-btn--ghost {
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
}
.ssm-btn--ghost:hover:not(:disabled) {
  border-color: var(--me-border-hover);
  color: var(--me-text-primary);
  background: var(--me-bg-elevated);
}

/* Close button */
.ssm-close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: none;
  border: 1px solid transparent;
  color: var(--me-text-muted);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}
.ssm-close-btn:hover {
  color: var(--me-text-primary);
  background: var(--me-bg-elevated);
  border-color: var(--me-border);
}

/* Dialog */
.ssm-dialog {
  padding: 0;
  overflow: hidden;
}
.ssm-dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-elevated);
}
.ssm-dialog-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ssm-dialog-icon-lg {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ssm-dialog-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--me-text-primary);
  flex: 1;
}
.ssm-dialog-body {
  padding: 28px 24px;
}
.ssm-dialog-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
  padding: 8px 0;
}
.ssm-dialog-msg {
  font-size: 14px;
  color: var(--me-text-primary);
  font-weight: 500;
}
.ssm-dialog-msg--success {
  color: #34d399;
}
.ssm-dialog-msg--error {
  color: #f87171;
}
.ssm-dialog-hint {
  font-size: 12px;
  color: var(--me-text-muted);
  max-width: 300px;
  line-height: 1.6;
}
.ssm-dialog-timer {
  font-size: 13px;
  color: var(--me-text-muted);
  padding: 5px 14px;
  border-radius: 20px;
  background: var(--me-bg-deep);
  border: 1px solid var(--me-border);
}
.ssm-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--me-border);
}

/* Result icons */
.ssm-result-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ssm-result-icon--success {
  background: #34d399;
  box-shadow: 0 4px 20px rgba(52, 211, 153, 0.3);
}
.ssm-result-icon--error {
  background: #f87171;
  box-shadow: 0 4px 20px rgba(248, 113, 113, 0.3);
}
.ssm-result-icon--warning {
  background: #fbbf24;
  box-shadow: 0 4px 20px rgba(251, 191, 36, 0.3);
}

/* Pulse animation for loading */
.ssm-pulse-ring {
  position: relative;
}
.ssm-pulse-ring::before {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 2px solid var(--me-accent);
  opacity: 0.2;
  animation: ssm-pulse 2s ease-in-out infinite;
}

@keyframes ssm-pulse {
  0%, 100% { opacity: 0.1; transform: scale(0.95); }
  50% { opacity: 0.3; transform: scale(1.05); }
}

/* Utilities */
.mr-1 { margin-right: 4px; }
</style>
