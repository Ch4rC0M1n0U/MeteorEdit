<template>
  <div class="pa-dialog glass-card">
    <div class="pa-header">
      <span class="mdi mdi-account-search-outline pa-header-icon" style="font-size: 20px"></span>
      <span>{{ $t('social.profile.title') }}</span>
      <button class="pa-close" @click="$emit('close')">
        <i class="pi pi-times" style="font-size: 18px"></i>
      </button>
    </div>

    <div class="pa-body">
      <!-- URL input -->
      <div class="pa-field">
        <label class="pa-label">{{ $t('social.profile.urlLabel') }}</label>
        <input
          v-model="url"
          class="pa-input"
          :placeholder="$t('social.profile.urlPlaceholder')"
          @input="onUrlChange"
        />
      </div>

      <!-- Platform badge -->
      <div v-if="detectedPlatform" class="pa-platform-badge" :style="{ borderColor: platformColor }">
        <span :class="['mdi', platformIcon]" style="font-size: 16px; color: platformColor"></span>
        <span class="pa-platform-name" :style="{ color: platformColor }">{{ platformLabel }}</span>
        <span class="mdi mdi-check-circle" style="font-size: 14px; color: var(--me-accent)"></span>
      </div>

      <div v-else-if="url.trim()" class="pa-platform-unknown">
        <span class="mdi mdi-alert-circle-outline" style="font-size: 14px; color: #f87171"></span>
        <span>{{ $t('social.profile.unsupportedPlatform') }}</span>
      </div>

      <!-- Cookie status -->
      <div v-if="detectedPlatform && detectedPlatform !== 'whatsapp' && detectedPlatform !== 'mastodon'" class="pa-cookie-status">
        <div v-if="cookieLoading" class="pa-cookie-checking">
          <span class="mdi mdi-loading pa-spin" style="font-size: 14px"></span>
          <span>{{ $t('social.profile.checkingCookies') }}</span>
        </div>
        <div v-else-if="hasCookies" class="pa-cookie-ok">
          <span class="mdi mdi-cookie-check-outline" style="font-size: 14px; color: #4ade80"></span>
          <span>{{ $t('social.profile.cookiesFound') }}</span>
        </div>
        <div v-else class="pa-cookie-warn">
          <span class="mdi mdi-cookie-alert-outline" style="font-size: 14px; color: #fbbf24"></span>
          <span>{{ $t('social.profile.noCookies') }}</span>
        </div>
      </div>

      <!-- Parent folder selection -->
      <div class="pa-field">
        <label class="pa-label">{{ $t('social.profile.parentFolder') }}</label>
        <FolderPicker v-model="selectedParentId" />
      </div>

      <!-- Error -->
      <div v-if="errorMsg" class="pa-error">
        <span class="mdi mdi-alert-circle-outline" style="font-size: 14px"></span>
        {{ errorMsg }}
      </div>
    </div>

    <div class="pa-footer">
      <button class="pa-btn pa-btn--cancel" @click="$emit('close')">{{ $t('common.cancel') }}</button>
      <button
        class="pa-btn pa-btn--analyze"
        :disabled="!canAnalyze || scraping"
        @click="analyze"
      >
        <span class="mdi mdi-loading pa-spin" style="font-size: 14px" v-if="scraping"></span>
        <i class="pi pi-search" style="font-size: 14px" v-else></i>
        {{ scraping ? $t('social.profile.scraping') : $t('social.profile.analyze') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';
import { useDossierStore } from '../../stores/dossier';
import FolderPicker from '../common/FolderPicker.vue';

const { t } = useI18n();
const dossierStore = useDossierStore();

const props = defineProps<{
  dossierId: string;
  parentId?: string;
}>();

const emit = defineEmits<{
  'nodeCreated': [node: any];
  'close': [];
}>();

const url = ref('');
const detectedPlatform = ref<string | null>(null);
const selectedParentId = ref(props.parentId || '');
const scraping = ref(false);
const errorMsg = ref('');
const cookieLoading = ref(false);
const hasCookies = ref(false);
const userCookies = ref<Array<{ platform: string }>>([]);
const cookiesFetched = ref(false);

const PLATFORM_PATTERNS: Array<{ pattern: RegExp; platform: string }> = [
  { pattern: /snapchat\.com/i, platform: 'snapchat' },
  { pattern: /instagram\.com/i, platform: 'instagram' },
  { pattern: /tiktok\.com/i, platform: 'tiktok' },
  { pattern: /(?:youtube\.com|youtu\.be)/i, platform: 'youtube' },
  { pattern: /facebook\.com/i, platform: 'facebook' },
  { pattern: /(?:x\.com|twitter\.com)/i, platform: 'x' },
  { pattern: /(?:wa\.me|whatsapp)/i, platform: 'whatsapp' },
  { pattern: /threads\.(?:com|net)/i, platform: 'threads' },
  { pattern: /linkedin\.com/i, platform: 'linkedin' },
  { pattern: /linktr\.ee/i, platform: 'linktree' },
  { pattern: /(?:paypal\.me|paypalme)/i, platform: 'paypal' },
  { pattern: /(?:t\.me|telegram\.me|telegram\.org)/i, platform: 'telegram' },
  { pattern: /strava\.com/i, platform: 'strava' },
  { pattern: /mastodon\.|mstdn\.|piaille\.fr|framapiaf\.org|mamot\.fr|social\.tcit\.fr|toot\.|pouet\./i, platform: 'mastodon' },
];

const PLATFORM_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  snapchat: { icon: 'mdi-snapchat', color: '#FFFC00', label: 'Snapchat' },
  instagram: { icon: 'mdi-instagram', color: '#E4405F', label: 'Instagram' },
  tiktok: { icon: 'mdi-music-note', color: '#00F2EA', label: 'TikTok' },
  youtube: { icon: 'mdi-youtube', color: '#FF0000', label: 'YouTube' },
  facebook: { icon: 'mdi-facebook', color: '#1877F2', label: 'Facebook' },
  x: { icon: 'mdi-twitter', color: '#1DA1F2', label: 'X / Twitter' },
  whatsapp: { icon: 'mdi-whatsapp', color: '#25D366', label: 'WhatsApp' },
  threads: { icon: 'mdi-at', color: '#000000', label: 'Threads' },
  linkedin: { icon: 'mdi-linkedin', color: '#0A66C2', label: 'LinkedIn' },
  linktree: { icon: 'mdi-link-variant', color: '#43E55E', label: 'Linktree' },
  paypal: { icon: 'mdi-credit-card-outline', color: '#003087', label: 'PayPal' },
  telegram: { icon: 'mdi-send', color: '#0088cc', label: 'Telegram' },
  strava: { icon: 'mdi-run', color: '#FC4C02', label: 'Strava' },
  mastodon: { icon: 'mdi-mastodon', color: '#6364FF', label: 'Mastodon' },
};

const platformIcon = computed(() => detectedPlatform.value ? PLATFORM_CONFIG[detectedPlatform.value]?.icon || 'mdi-web' : 'mdi-web');
const platformColor = computed(() => detectedPlatform.value ? PLATFORM_CONFIG[detectedPlatform.value]?.color || 'var(--me-accent)' : 'var(--me-accent)');
const platformLabel = computed(() => detectedPlatform.value ? PLATFORM_CONFIG[detectedPlatform.value]?.label || detectedPlatform.value : '');

const canAnalyze = computed(() => {
  return url.value.trim() && detectedPlatform.value;
});

function detectPlatform(inputUrl: string): string | null {
  for (const { pattern, platform } of PLATFORM_PATTERNS) {
    if (pattern.test(inputUrl)) return platform;
  }
  // Generic fallback: if URL contains /@username, assume Mastodon instance
  try {
    const urlObj = new URL(inputUrl);
    if (/^\/@[^\/]+/.test(urlObj.pathname)) return 'mastodon';
  } catch { /* ignore invalid URLs */ }
  return null;
}

function onUrlChange() {
  errorMsg.value = '';
  detectedPlatform.value = detectPlatform(url.value);
}

// Fetch cookies once and check against detected platform
watch(detectedPlatform, async (platform) => {
  hasCookies.value = false;
  if (!platform || platform === 'whatsapp' || platform === 'mastodon') return;

  if (!cookiesFetched.value) {
    cookieLoading.value = true;
    try {
      const { data } = await api.get('/social/cookies');
      userCookies.value = data;
      cookiesFetched.value = true;
    } catch {
      userCookies.value = [];
      cookiesFetched.value = true;
    } finally {
      cookieLoading.value = false;
    }
  }

  hasCookies.value = userCookies.value.some(c => c.platform === platform);
});

async function analyze() {
  if (!canAnalyze.value || scraping.value) return;
  scraping.value = true;
  errorMsg.value = '';

  try {
    const { data } = await api.post('/social/scrape-profile', {
      url: url.value.trim(),
      dossierId: props.dossierId,
      parentId: selectedParentId.value || null,
    });

    // Add node to the dossier store
    if (data.node) {
      dossierStore.nodes.push(data.node);
      emit('nodeCreated', data.node);
    }
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message || err.response?.data?.error || t('social.profile.error');
  } finally {
    scraping.value = false;
  }
}
</script>

<style scoped>
.pa-dialog { padding: 0; border-radius: 12px; overflow: hidden; background: var(--me-bg-surface); border: 1px solid var(--me-border); }
.pa-header { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--me-border); font-size: 14px; font-weight: 600; color: var(--me-text-primary); }
.pa-header-icon { color: var(--me-accent); }
.pa-close { margin-left: auto; background: none; border: none; color: var(--me-text-muted); cursor: pointer; padding: 4px; border-radius: 6px; display: flex; transition: all 0.15s; }
.pa-close:hover { background: rgba(255,255,255,0.08); color: var(--me-text-primary); }

.pa-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
.pa-field { display: flex; flex-direction: column; gap: 4px; }
.pa-label { font-size: 12px; color: var(--me-text-secondary); font-weight: 500; }
.pa-input {
  padding: 8px 12px; border-radius: 8px; border: 1px solid var(--me-border);
  background: var(--me-bg-deep); color: var(--me-text-primary); font-size: 13px;
  outline: none; transition: border-color 0.15s; font-family: inherit; width: 100%;
}
.pa-input:focus { border-color: var(--me-accent); }

.pa-platform-badge {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 8px;
  background: var(--me-bg-deep); border: 1px solid var(--me-border);
}
.pa-platform-name { font-size: 13px; font-weight: 600; }

.pa-platform-unknown {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 10px; border-radius: 8px;
  background: rgba(248, 113, 113, 0.08); color: #f87171; font-size: 12px;
}

.pa-cookie-status { font-size: 12px; }
.pa-cookie-checking,
.pa-cookie-ok,
.pa-cookie-warn {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: 6px;
  background: var(--me-bg-deep);
}
.pa-cookie-checking { color: var(--me-text-muted); }
.pa-cookie-ok { color: #4ade80; }
.pa-cookie-warn { color: #fbbf24; }

.pa-error {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 10px; border-radius: 8px;
  background: rgba(244, 67, 54, 0.12); color: #ef5350; font-size: 12px;
}

.pa-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 12px 18px; border-top: 1px solid var(--me-border);
}
.pa-btn {
  padding: 7px 16px; border-radius: 8px; border: none;
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all 0.15s; display: flex; align-items: center; gap: 6px;
}
.pa-btn--cancel { background: none; color: var(--me-text-muted); }
.pa-btn--cancel:hover { background: rgba(255,255,255,0.06); color: var(--me-text-primary); }
.pa-btn--analyze { background: var(--me-accent); color: #fff; }
.pa-btn--analyze:hover:not(:disabled) { filter: brightness(1.15); }
.pa-btn--analyze:disabled { opacity: 0.5; cursor: not-allowed; }

@keyframes spin { to { transform: rotate(360deg); } }
.pa-spin { animation: spin 1s linear infinite; }
</style>
