<template>
  <div class="profile-security-advanced">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-shield-check-outline</v-icon>
        Securite avancee
      </h2>
    </div>

    <!-- Security Score -->
    <div class="branding-card glass-card fade-in fade-in-delay-1">
      <h3 class="branding-card-title mono">
        <v-icon size="16" class="mr-1">mdi-speedometer</v-icon>
        Score de securite
      </h3>
      <div class="score-container">
        <div class="score-bar-wrapper">
          <div class="score-bar">
            <div
              class="score-bar-fill"
              :style="{ width: securityScore + '%', background: scoreColor }"
            />
          </div>
          <span class="score-value mono" :style="{ color: scoreColor }">{{ securityScore }}%</span>
        </div>
        <div class="score-details">
          <div v-for="item in scoreItems" :key="item.label" class="score-item">
            <v-icon size="16" :color="item.ok ? scoreColorOk : 'grey'">
              {{ item.ok ? 'mdi-check-circle' : 'mdi-circle-outline' }}
            </v-icon>
            <span :class="['score-item-label', { 'score-item-label--ok': item.ok }]">{{ item.label }}</span>
            <span class="score-item-points mono">+25%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Login History -->
    <div class="branding-card glass-card fade-in fade-in-delay-2">
      <h3 class="branding-card-title mono">
        <v-icon size="16" class="mr-1">mdi-history</v-icon>
        Historique de connexion (7 jours)
      </h3>
      <div v-if="historyLoading" class="section-loading">
        <v-progress-circular indeterminate size="24" color="primary" />
        <span class="mono">Chargement...</span>
      </div>
      <div v-else-if="loginHistory.length === 0" class="section-empty mono">
        Aucune connexion enregistree
      </div>
      <div v-else class="history-list">
        <div v-for="(entry, i) in loginHistory" :key="i" class="history-item">
          <div class="history-item-icon">
            <v-icon size="18" color="var(--me-text-muted)">{{ getBrowserIcon(entry.browser) }}</v-icon>
          </div>
          <div class="history-item-info">
            <span class="history-item-browser">{{ entry.browser }} / {{ entry.os }}</span>
            <span class="history-item-ip mono">{{ entry.ip }}</span>
          </div>
          <span class="history-item-time mono">{{ formatDate(entry.timestamp) }}</span>
        </div>
      </div>
    </div>

    <!-- Active Sessions -->
    <div class="branding-card glass-card fade-in fade-in-delay-3">
      <h3 class="branding-card-title mono">
        <v-icon size="16" class="mr-1">mdi-devices</v-icon>
        Sessions actives
      </h3>
      <div v-if="sessionsLoading" class="section-loading">
        <v-progress-circular indeterminate size="24" color="primary" />
        <span class="mono">Chargement...</span>
      </div>
      <div v-else-if="sessions.length === 0" class="section-empty mono">
        Aucune session active
      </div>
      <div v-else class="sessions-list">
        <div v-for="(session, i) in sessions" :key="i" class="session-card">
          <div class="session-card-header">
            <v-icon size="20" color="var(--me-text-muted)">{{ getDeviceIcon(session.os) }}</v-icon>
            <div class="session-card-info">
              <div class="session-card-browser">
                {{ session.browser }} / {{ session.os }}
                <v-chip
                  v-if="session.isCurrent"
                  size="x-small"
                  color="success"
                  variant="tonal"
                  class="ml-2"
                >
                  Session actuelle
                </v-chip>
              </div>
              <span class="session-card-ip mono">{{ session.ip }}</span>
            </div>
            <span class="session-card-time mono">{{ formatDate(session.timestamp) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth';
import { useEncryptionStore } from '../../stores/encryption';

const authStore = useAuthStore();
const encryptionStore = useEncryptionStore();

// --- Security Score ---
const hasEncryptionKeys = ref(false);
const passwordChangedRecently = ref(false);

interface ScoreItem {
  label: string;
  ok: boolean;
}

const scoreItems = computed<ScoreItem[]>(() => [
  { label: 'Mot de passe defini', ok: true },
  { label: '2FA activee', ok: !!authStore.user?.twoFactorEnabled },
  { label: 'Cles de chiffrement configurees', ok: hasEncryptionKeys.value },
  { label: 'Mot de passe change recemment (< 90j)', ok: passwordChangedRecently.value },
]);

const securityScore = computed(() => {
  return scoreItems.value.filter(i => i.ok).length * 25;
});

const scoreColor = computed(() => {
  const s = securityScore.value;
  if (s < 50) return '#f87171';
  if (s < 75) return '#fb923c';
  return '#4ade80';
});

const scoreColorOk = computed(() => '#4ade80');

// --- Login History ---
interface LoginHistoryEntry {
  ip: string;
  browser: string;
  os: string;
  timestamp: string;
}

const loginHistory = ref<LoginHistoryEntry[]>([]);
const historyLoading = ref(false);

// --- Active Sessions ---
interface SessionEntry {
  ip: string;
  browser: string;
  os: string;
  timestamp: string;
  isCurrent: boolean;
}

const sessions = ref<SessionEntry[]>([]);
const sessionsLoading = ref(false);

// --- User Agent Parsing ---
function parseBrowser(ua: string): string {
  if (!ua) return 'Inconnu';
  if (ua.includes('Edg/') || ua.includes('Edge/')) return 'Edge';
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
  if (ua.includes('Opera/') || ua.includes('OPR/')) return 'Opera';
  return 'Autre';
}

function parseOS(ua: string): string {
  if (!ua) return 'Inconnu';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS') || ua.includes('Macintosh')) return 'macOS';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iOS')) return 'iOS';
  if (ua.includes('Linux')) return 'Linux';
  return 'Autre';
}

function getBrowserIcon(browser: string): string {
  switch (browser) {
    case 'Chrome': return 'mdi-google-chrome';
    case 'Firefox': return 'mdi-firefox';
    case 'Safari': return 'mdi-apple-safari';
    case 'Edge': return 'mdi-microsoft-edge';
    case 'Opera': return 'mdi-opera';
    default: return 'mdi-web';
  }
}

function getDeviceIcon(os: string): string {
  switch (os) {
    case 'Windows': return 'mdi-microsoft-windows';
    case 'macOS': return 'mdi-apple';
    case 'Linux': return 'mdi-linux';
    case 'Android': return 'mdi-android';
    case 'iOS': return 'mdi-apple';
    default: return 'mdi-monitor';
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function parseRawEntries(raw: any[]): { browser: string; os: string; ip: string; timestamp: string; isCurrent?: boolean }[] {
  return raw.map(entry => ({
    ip: entry.ip || 'N/A',
    browser: parseBrowser(entry.userAgent || ''),
    os: parseOS(entry.userAgent || ''),
    timestamp: entry.timestamp || entry.lastActive || '',
    isCurrent: !!entry.isCurrent,
  }));
}

// --- Fetch data ---
async function fetchLoginHistory() {
  historyLoading.value = true;
  try {
    const { data } = await api.get('/auth/login-history');
    const entries = parseRawEntries(Array.isArray(data) ? data : []);
    loginHistory.value = entries.slice(0, 20);
  } catch {
    loginHistory.value = [];
  } finally {
    historyLoading.value = false;
  }
}

async function fetchSessions() {
  sessionsLoading.value = true;
  try {
    const { data } = await api.get('/auth/sessions');
    sessions.value = parseRawEntries(Array.isArray(data) ? data : []).slice(0, 20);
  } catch {
    sessions.value = [];
  } finally {
    sessionsLoading.value = false;
  }
}

async function checkEncryptionKeys() {
  try {
    hasEncryptionKeys.value = await encryptionStore.checkKeys();
  } catch {
    hasEncryptionKeys.value = false;
  }
}

async function checkPasswordAge() {
  try {
    const { data } = await api.get('/auth/me');
    if (data.passwordChangedAt) {
      const changed = new Date(data.passwordChangedAt);
      const now = new Date();
      const diffDays = (now.getTime() - changed.getTime()) / (1000 * 60 * 60 * 24);
      passwordChangedRecently.value = diffDays < 90;
    } else {
      // If no passwordChangedAt field, fall back to createdAt
      if (data.createdAt) {
        const created = new Date(data.createdAt);
        const now = new Date();
        const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        passwordChangedRecently.value = diffDays < 90;
      } else {
        passwordChangedRecently.value = false;
      }
    }
  } catch {
    passwordChangedRecently.value = false;
  }
}

onMounted(() => {
  checkEncryptionKeys();
  checkPasswordAge();
  fetchLoginHistory();
  fetchSessions();
});
</script>

<style scoped>
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.branding-card { padding: 20px; margin-bottom: 16px; }
.branding-card-title { font-size: 14px; font-weight: 700; color: var(--me-text-primary); margin-bottom: 12px; display: flex; align-items: center; }

/* Score */
.score-container { display: flex; flex-direction: column; gap: 16px; }
.score-bar-wrapper { display: flex; align-items: center; gap: 12px; }
.score-bar {
  flex: 1;
  height: 10px;
  background: var(--me-bg-elevated);
  border-radius: 5px;
  overflow: hidden;
  border: 1px solid var(--me-border);
}
.score-bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.6s ease, background 0.4s ease;
}
.score-value { font-size: 18px; font-weight: 700; min-width: 48px; text-align: right; }
.score-details { display: flex; flex-direction: column; gap: 8px; }
.score-item { display: flex; align-items: center; gap: 8px; }
.score-item-label { font-size: 13px; color: var(--me-text-muted); flex: 1; }
.score-item-label--ok { color: var(--me-text-primary); }
.score-item-points { font-size: 11px; color: var(--me-text-muted); }

/* Loading & empty */
.section-loading { display: flex; align-items: center; gap: 10px; padding: 16px 0; color: var(--me-text-muted); font-size: 13px; }
.section-empty { padding: 16px 0; color: var(--me-text-muted); font-size: 13px; }

/* Login history */
.history-list { display: flex; flex-direction: column; gap: 2px; }
.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: var(--me-radius-xs);
  transition: background 0.15s;
}
.history-item:hover { background: var(--me-bg-elevated); }
.history-item-icon { flex-shrink: 0; }
.history-item-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.history-item-browser { font-size: 13px; color: var(--me-text-primary); }
.history-item-ip { font-size: 11px; color: var(--me-text-muted); }
.history-item-time { font-size: 11px; color: var(--me-text-muted); flex-shrink: 0; }

/* Sessions */
.sessions-list { display: flex; flex-direction: column; gap: 8px; }
.session-card {
  padding: 12px;
  border-radius: var(--me-radius-xs);
  border: 1px solid var(--me-border);
  background: var(--me-bg-elevated);
}
.session-card-header { display: flex; align-items: center; gap: 12px; }
.session-card-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.session-card-browser { font-size: 13px; color: var(--me-text-primary); display: flex; align-items: center; }
.session-card-ip { font-size: 11px; color: var(--me-text-muted); }
.session-card-time { font-size: 11px; color: var(--me-text-muted); flex-shrink: 0; }

/* Utilities */
.mr-1 { margin-right: 4px; }
.mr-2 { margin-right: 8px; }
.ml-2 { margin-left: 8px; }
</style>
