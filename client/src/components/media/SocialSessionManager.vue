<template>
  <div class="ssm glass-card">
    <!-- Header -->
    <div class="ssm-header">
      <div class="ssm-header-left">
        <div class="ssm-header-icon">
          <span class="mdi mdi-shield-account-outline" style="font-size: 20px"></span>
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
        <button v-if="!embedded" class="ssm-close-btn" @click="$emit('close')">
          <i class="pi pi-times" style="font-size: 16px"></i>
        </button>
      </div>
    </div>

    <ProgressBar v-if="loading" mode="indeterminate" class="ssm-loader" style="height: 4px;" />

    <!-- ═══ VIEW: Platform list ═══ -->
    <div v-show="currentView === 'list'">
      <div class="ssm-platforms">
        <div
          v-for="p in platformList"
          :key="p.key"
          :class="['ssm-platform', { 'ssm-platform--connected': isConnected(p.key) }]"
        >
          <div class="ssm-platform-left">
            <div class="ssm-platform-icon" :style="iconStyle(p, isConnected(p.key))">
              <SocialIcon :platform="p.key" :size="20" :color="isConnected(p.key) ? '#fff' : p.color" />
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

          <div class="ssm-platform-actions">
            <Button
              v-if="!isConnected(p.key)"
              :label="$t('social.session.openSite')"
              icon="mdi mdi-open-in-new"
              size="small"
              @click="openPlatformSite(p)"
            />
            <Button
              icon="mdi mdi-cookie"
              size="small"
              severity="secondary"
              outlined
              @click="openImportView(p)"
              :title="$t('social.session.importCookies')"
            />
            <Button
              v-if="isConnected(p.key)"
              :label="$t('social.session.disconnect')"
              size="small"
              severity="danger"
              text
              @click="openDisconnectView(p)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ VIEW: Import cookies ═══ -->
    <div v-show="currentView === 'import'">
      <div class="ssm-view">
        <div class="ssm-view-header">
          <button class="ssm-back-btn" @click="currentView = 'list'">
            <span class="mdi mdi-arrow-left" style="font-size: 16px"></span>
          </button>
          <div class="ssm-view-header-icon" :style="importPlatform ? iconStyle(importPlatform, true) : {}">
            <span class="mdi mdi-cookie" style="font-size: 18px; color: #fff"></span>
          </div>
          <span class="ssm-view-title">
            {{ $t('social.session.importCookiesTitle', { platform: importPlatform?.name }) }}
          </span>
        </div>

        <div class="ssm-view-body">
          <p class="ssm-import-hint">
            {{ $t('social.session.importCookiesHint') }}
          </p>
          <ol class="ssm-import-steps">
            <li>
              {{ $t('social.session.importStep1') }}
              <a href="https://cookie-editor.com" target="_blank" rel="noopener" class="ssm-import-link">
                cookie-editor.com
                <span class="mdi mdi-open-in-new ml-1" style="font-size: 11px"></span>
              </a>
            </li>
            <li>{{ $t('social.session.importStep2', { domain: importPlatform?.name }) }}</li>
            <li>{{ $t('social.session.importStep3') }}</li>
          </ol>
          <Textarea
            v-model="importJson"
            :placeholder="$t('social.session.importPlaceholder')"
            rows="6"
            class="ssm-import-textarea mono"
            style="width: 100%;"
          />
          <p v-if="importError" class="ssm-import-error">{{ importError }}</p>
          <p v-if="importSuccess" class="ssm-import-success">{{ importSuccess }}</p>
        </div>

        <div class="ssm-view-actions">
          <Button
            :label="importing ? $t('social.session.importing') : $t('social.session.importAction')"
            icon="mdi mdi-import"
            :disabled="importing || !importJson.trim()"
            @click="doImportCookies"
          />
          <Button :label="$t('common.cancel')" severity="secondary" text :disabled="importing" @click="currentView = 'list'" />
        </div>
      </div>
    </div>

    <!-- ═══ VIEW: Login (Puppeteer) ═══ -->
    <div v-show="currentView === 'login'">
      <div class="ssm-view">
        <div class="ssm-view-header">
          <button class="ssm-back-btn" @click="cancelLogin">
            <span class="mdi mdi-arrow-left" style="font-size: 16px"></span>
          </button>
          <div class="ssm-view-header-icon" :style="loginPlatform ? iconStyle(loginPlatform, true) : {}">
            <SocialIcon v-if="loginPlatform" :platform="loginPlatform.key" :size="18" color="#fff" />
          </div>
          <span class="ssm-view-title">
            {{ $t('social.session.connectTo', { platform: loginPlatform?.name }) }}
          </span>
        </div>

        <div class="ssm-view-body">
          <!-- Waiting state -->
          <div v-if="loginLoading" class="ssm-dialog-status">
            <div class="ssm-pulse-ring">
              <ProgressSpinner style="width: 56px; height: 56px;" strokeWidth="3" />
            </div>
            <p class="ssm-dialog-msg">{{ $t('social.session.loginInProgress') }}</p>
            <p class="ssm-dialog-hint">{{ $t('social.session.loginHint') }}</p>
            <span class="ssm-dialog-timer mono">{{ formatTimer(loginElapsed) }}</span>
          </div>

          <!-- Success -->
          <div v-else-if="loginResult === 'success'" class="ssm-dialog-status">
            <div class="ssm-result-icon ssm-result-icon--success">
              <i class="pi pi-check" style="font-size: 28px; color: #fff"></i>
            </div>
            <p class="ssm-dialog-msg ssm-dialog-msg--success">{{ $t('social.session.loginSuccess') }}</p>
          </div>

          <!-- Error -->
          <div v-else-if="loginResult === 'error'" class="ssm-dialog-status">
            <div class="ssm-result-icon ssm-result-icon--error">
              <i class="pi pi-times" style="font-size: 28px; color: #fff"></i>
            </div>
            <p class="ssm-dialog-msg ssm-dialog-msg--error">{{ loginErrorMessage || $t('social.session.loginError') }}</p>
          </div>

          <!-- Timeout -->
          <div v-else-if="loginResult === 'timeout'" class="ssm-dialog-status">
            <div class="ssm-result-icon ssm-result-icon--warning">
              <span class="mdi mdi-clock-alert-outline" style="font-size: 28px; color: #fff"></span>
            </div>
            <p class="ssm-dialog-msg ssm-dialog-msg--error">{{ $t('social.session.loginTimeout') }}</p>
          </div>
        </div>

        <div class="ssm-view-actions">
          <Button
            v-if="loginResult === 'error' || loginResult === 'timeout'"
            :label="$t('social.session.retry')"
            icon="pi pi-refresh"
            @click="retryLogin"
          />
          <Button
            v-if="!loginLoading"
            :label="$t('common.close')"
            severity="secondary"
            text
            @click="currentView = 'list'"
          />
        </div>
      </div>
    </div>

    <!-- ═══ VIEW: Disconnect confirm ═══ -->
    <div v-show="currentView === 'disconnect'">
      <div class="ssm-view">
        <div class="ssm-view-header">
          <button class="ssm-back-btn" @click="currentView = 'list'">
            <span class="mdi mdi-arrow-left" style="font-size: 16px"></span>
          </button>
          <div class="ssm-result-icon ssm-result-icon--error" style="width:32px;height:32px;">
            <span class="mdi mdi-link-off" style="font-size: 18px; color: #fff"></span>
          </div>
          <span class="ssm-view-title">{{ $t('social.session.confirmDisconnect') }}</span>
        </div>

        <div class="ssm-view-body">
          <p class="ssm-dialog-msg">
            {{ $t('social.session.confirmDisconnectMsg', { platform: disconnectPlatform?.name }) }}
          </p>
        </div>

        <div class="ssm-view-actions">
          <Button :label="$t('common.cancel')" severity="secondary" text :disabled="disconnecting" @click="currentView = 'list'" />
          <Button
            :label="disconnecting ? $t('social.session.disconnecting') : $t('social.session.disconnect')"
            icon="pi pi-trash"
            severity="danger"
            :disabled="disconnecting"
            @click="doDisconnect"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';
import Button from 'primevue/button';
import SocialIcon from '../common/SocialIcon.vue';
import ProgressBar from 'primevue/progressbar';
import ProgressSpinner from 'primevue/progressspinner';
import Textarea from 'primevue/textarea';

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

defineEmits<{ close: [] }>();
defineProps<{ embedded?: boolean }>();
const { t, locale } = useI18n();

const PLATFORM_URLS: Record<string, string> = {
  youtube: 'https://accounts.google.com/signin',
  instagram: 'https://www.instagram.com/accounts/login/',
  tiktok: 'https://www.tiktok.com/login',
  snapchat: 'https://accounts.snapchat.com/accounts/v2/login',
  facebook: 'https://www.facebook.com/login',
  x: 'https://x.com/i/flow/login',
  whatsapp: 'https://web.whatsapp.com',
  threads: 'https://www.threads.net/login',
  linkedin: 'https://www.linkedin.com/login',
  strava: 'https://www.strava.com/login',
};

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
  { key: 'strava', name: 'Strava', icon: 'mdi-run', color: '#FC4C02' },
];

// --- Navigation ---
const currentView = ref<'list' | 'import' | 'login' | 'disconnect'>('list');

// --- State ---
const loading = ref(false);
const connectedPlatforms = ref<CookieRecord[]>([]);

const connectedCount = computed(() =>
  platformList.filter(p => isConnected(p.key)).length
);

// Login
const loginPlatform = ref<Platform | null>(null);
const loginLoading = ref(false);
const loginResult = ref<'success' | 'error' | 'timeout' | null>(null);
const loginErrorMessage = ref('');
const loginElapsed = ref(0);
let loginTimerInterval: ReturnType<typeof setInterval> | null = null;
let loginAbortController: AbortController | null = null;

// Import
const importPlatform = ref<Platform | null>(null);
const importJson = ref('');
const importing = ref(false);
const importError = ref('');
const importSuccess = ref('');

// Disconnect
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

function openPlatformSite(platform: Platform) {
  const url = PLATFORM_URLS[platform.key];
  if (url) window.open(url, '_blank');
}

// --- Login flow ---
function openLoginView(platform: Platform) {
  loginPlatform.value = platform;
  loginResult.value = null;
  loginErrorMessage.value = '';
  loginLoading.value = false;
  loginElapsed.value = 0;
  currentView.value = 'login';
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
  loginLoading.value = false;
  clearLoginTimer();
  loginAbortController = null;
  currentView.value = 'list';
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

// --- Import flow ---
function openImportView(platform: Platform) {
  importPlatform.value = platform;
  importJson.value = '';
  importError.value = '';
  importSuccess.value = '';
  importing.value = false;
  currentView.value = 'import';
}

async function doImportCookies() {
  if (!importPlatform.value || !importJson.value.trim()) return;
  importing.value = true;
  importError.value = '';
  importSuccess.value = '';

  try {
    let cookies: any[];
    try {
      cookies = JSON.parse(importJson.value.trim());
    } catch {
      importError.value = t('social.session.importJsonError');
      importing.value = false;
      return;
    }

    if (!Array.isArray(cookies)) {
      importError.value = t('social.session.importJsonError');
      importing.value = false;
      return;
    }

    const { data } = await api.post(`/social/cookies/${importPlatform.value.key}/import`, { cookies });
    importSuccess.value = t('social.session.importSuccessMsg', { count: data.cookieCount });
    await fetchStatus();
    setTimeout(() => { currentView.value = 'list'; }, 1500);
  } catch (err: any) {
    importError.value = err.response?.data?.message || t('social.session.importFailed');
  } finally {
    importing.value = false;
  }
}

// --- Disconnect flow ---
function openDisconnectView(platform: Platform) {
  disconnectPlatform.value = platform;
  disconnecting.value = false;
  currentView.value = 'disconnect';
}

async function doDisconnect() {
  if (!disconnectPlatform.value) return;
  disconnecting.value = true;
  try {
    await api.delete(`/social/cookies/${disconnectPlatform.value.key}`);
    await fetchStatus();
    currentView.value = 'list';
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

/* Platform actions row */
.ssm-platform-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ═══ Inline views (replace nested v-dialogs) ═══ */
.ssm-view {
  display: flex;
  flex-direction: column;
}
.ssm-view-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-elevated);
}
.ssm-view-header-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ssm-view-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--me-text-primary);
  flex: 1;
}
.ssm-view-body {
  padding: 24px;
}
.ssm-view-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--me-border);
}
.ssm-back-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}
.ssm-back-btn:hover {
  color: var(--me-text-primary);
  background: var(--me-bg-elevated);
  border-color: var(--me-border-hover);
}

/* Status (login view) */
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

/* Pulse animation */
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

/* Import */
.ssm-import-hint {
  font-size: 13px;
  color: var(--me-text-secondary);
  margin-bottom: 12px;
  line-height: 1.5;
}
.ssm-import-steps {
  font-size: 12px;
  color: var(--me-text-muted);
  margin: 0 0 16px 16px;
  line-height: 1.8;
  padding: 0;
}
.ssm-import-steps li {
  margin-bottom: 2px;
}
.ssm-import-link {
  color: var(--me-accent);
  text-decoration: none;
  font-weight: 600;
  margin-left: 4px;
}
.ssm-import-link:hover {
  text-decoration: underline;
}
.ssm-import-textarea {
  font-size: 11px !important;
}
.ssm-import-error {
  font-size: 12px;
  color: #f87171;
  margin-top: 8px;
}
.ssm-import-success {
  font-size: 12px;
  color: #34d399;
  margin-top: 8px;
}

/* Utilities */
.mr-1 { margin-right: 4px; }
.ml-1 { margin-left: 4px; }
</style>
