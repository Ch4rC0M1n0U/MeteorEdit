<template>
  <div class="esc">
    <div class="esc-header">
      <i class="mdi mdi-puzzle-outline esc-icon" />
      <div class="esc-title">
        <h3>{{ $t('extension.sessions.title') }}</h3>
        <p>{{ $t('extension.sessions.subtitle') }}</p>
      </div>
      <Button
        icon="pi pi-download"
        size="small"
        outlined
        :label="$t('extension.install.button')"
        @click="installOpen = true"
      />
      <Button
        icon="pi pi-refresh"
        size="small"
        text
        rounded
        :title="$t('common.refresh')"
        @click="load"
      />
    </div>

    <div v-if="loading" class="esc-empty">
      <i class="pi pi-spin pi-spinner" /> {{ $t('common.loading') }}
    </div>

    <div v-else-if="sessions.length === 0" class="esc-empty">
      <i class="mdi mdi-cookie-outline esc-empty-icon" />
      <span>{{ $t('extension.sessions.empty') }}</span>
      <a href="#" @click.prevent="goToTokens" class="esc-empty-link">
        {{ $t('extension.sessions.installHint') }}
      </a>
    </div>

    <ul v-else class="esc-list">
      <li v-for="s in sessions" :key="s.platform" class="esc-item">
        <div class="esc-item-icon">
          <SocialIcon :platform="s.platform" :size="22" />
        </div>
        <div class="esc-item-main">
          <div class="esc-item-name">{{ platformLabel(s.platform) }}</div>
          <div class="esc-item-meta">
            <span>{{ s.cookieCount }} cookies</span>
            <span class="esc-dot">·</span>
            <span>{{ $t('extension.sessions.updated') }} {{ formatDate(s.updatedAt) }}</span>
            <span v-if="s.updatedVia === 'extension'" class="esc-via">
              <i class="mdi mdi-puzzle" /> {{ $t('extension.sessions.viaExtension') }}
            </span>
          </div>
        </div>
        <Button
          icon="pi pi-trash"
          severity="danger"
          text
          rounded
          :title="$t('extension.sessions.clear')"
          :loading="clearing === s.platform"
          @click="onClear(s.platform)"
        />
      </li>
    </ul>

    <Dialog
      v-model:visible="installOpen"
      modal
      dismissable-mask
      :header="$t('extension.install.title')"
      :style="{ width: 'min(92vw, 620px)' }"
    >
      <div class="esc-install">
        <div class="esc-browser-tabs">
          <button
            v-for="b in browserOptions"
            :key="b.id"
            type="button"
            :class="['esc-browser-tab', { 'esc-browser-tab--active': selectedBrowser === b.id }]"
            @click="selectedBrowser = b.id"
          >
            <i :class="b.icon" />
            <span>{{ b.label }}</span>
            <span v-if="detectedBrowser === b.id" class="esc-browser-detected">
              {{ $t('extension.install.detected') }}
            </span>
          </button>
        </div>

        <p>{{ $t('extension.install.intro') }}</p>

        <ol class="esc-steps">
          <li>
            <strong>{{ $t('extension.install.step1') }}</strong>
            <Button
              :label="downloadLabel"
              icon="pi pi-download"
              size="small"
              :loading="downloading"
              @click="onDownload"
            />
          </li>
          <li>{{ $t('extension.install.step2') }}</li>
          <li v-html="step3Html" />
          <li v-html="step4Html" />
          <li>
            {{ $t('extension.install.step5') }}
            <a href="#" @click.prevent="goToTokens" class="esc-empty-link">{{ $t('extension.install.tokensLink') }}</a>
          </li>
          <li>{{ $t('extension.install.step6') }}</li>
        </ol>

        <div class="esc-install-warn">
          <i class="pi pi-info-circle" />
          <span>{{ devWarn }}</span>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import SocialIcon from '../common/SocialIcon.vue';
import api, { SERVER_URL } from '../../services/api';

interface ExtensionSession {
  platform: string;
  cookieCount: number;
  updatedAt: string;
  updatedVia: 'extension' | 'manual' | null;
}

const { t, locale } = useI18n();
const toast = useToast();
const confirm = useConfirm();
const router = useRouter();

const sessions = ref<ExtensionSession[]>([]);
const loading = ref(false);
const clearing = ref<string | null>(null);
const installOpen = ref(false);
const downloading = ref(false);

type BrowserId = 'chromium' | 'firefox';

function detectBrowser(): BrowserId {
  const ua = navigator.userAgent || '';
  if (/Firefox\//i.test(ua) && !/Seamonkey/i.test(ua)) return 'firefox';
  // Chrome / Edge / Brave / Opera all share the Chromium engine for extensions
  return 'chromium';
}

const detectedBrowser = ref<BrowserId>(detectBrowser());
const selectedBrowser = ref<BrowserId>(detectedBrowser.value);

const browserOptions = computed(() => [
  { id: 'chromium' as BrowserId, label: 'Chrome / Edge / Brave / Opera', icon: 'mdi mdi-google-chrome' },
  { id: 'firefox' as BrowserId, label: 'Firefox', icon: 'mdi mdi-firefox' },
]);

const downloadLabel = computed(() =>
  selectedBrowser.value === 'firefox'
    ? t('extension.install.downloadFirefox')
    : t('extension.install.downloadChromium')
);

const step3Html = computed(() =>
  selectedBrowser.value === 'firefox'
    ? t('extension.install.step3Firefox')
    : t('extension.install.step3Chromium')
);

const step4Html = computed(() =>
  selectedBrowser.value === 'firefox'
    ? t('extension.install.step4Firefox')
    : t('extension.install.step4Chromium')
);

const devWarn = computed(() =>
  selectedBrowser.value === 'firefox'
    ? t('extension.install.devWarnFirefox')
    : t('extension.install.devWarnChromium')
);

async function onDownload(): Promise<void> {
  downloading.value = true;
  try {
    const url = `${SERVER_URL.replace(/\/$/, '')}/api/extension/download`;
    // Trigger the browser to download the ZIP
    const a = document.createElement('a');
    a.href = url;
    a.download = `meteoredit-extension-${selectedBrowser.value}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: err.message,
      life: 5000,
    });
  } finally {
    downloading.value = false;
  }
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  threads: 'Threads',
  x: 'X / Twitter',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  reddit: 'Reddit',
  snapchat: 'Snapchat',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  mastodon: 'Mastodon',
  linktree: 'Linktree',
  paypal: 'PayPal',
  strava: 'Strava',
};

function platformLabel(p: string): string {
  return PLATFORM_LABELS[p] ?? p;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(locale.value, { dateStyle: 'medium', timeStyle: 'short' });
}

function goToTokens(): void {
  router.push('/profile?section=api-tokens');
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const { data } = await api.get<{ sessions: ExtensionSession[] }>('/extension/sessions');
    sessions.value = data.sessions;
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: err.response?.data?.message ?? err.message,
      life: 5000,
    });
  } finally {
    loading.value = false;
  }
}

function onClear(platform: string): void {
  confirm.require({
    message: t('extension.sessions.clearConfirm', { platform: platformLabel(platform) }),
    header: t('extension.sessions.clear'),
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: t('extension.sessions.clear'),
    rejectLabel: t('common.cancel'),
    accept: async () => {
      clearing.value = platform;
      try {
        await api.delete(`/extension/sessions/${platform}`);
        await load();
        toast.add({
          severity: 'success',
          summary: t('extension.sessions.cleared'),
          life: 3000,
        });
      } catch (err: any) {
        toast.add({
          severity: 'error',
          summary: t('common.error'),
          detail: err.response?.data?.message ?? err.message,
          life: 5000,
        });
      } finally {
        clearing.value = null;
      }
    },
  });
}

onMounted(load);
</script>

<style scoped>
.esc { padding: 16px 0; }
.esc-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
.esc-icon { font-size: 28px; color: var(--me-accent); flex-shrink: 0; }
.esc-title { flex: 1; min-width: 0; }
.esc-title h3 { margin: 0 0 2px; font-size: 15px; font-weight: 700; color: var(--me-text-primary); }
.esc-title p { margin: 0; font-size: 12px; color: var(--me-text-muted); }

.esc-empty {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 24px; color: var(--me-text-muted); font-size: 13px;
  background: var(--me-bg-surface); border-radius: var(--me-radius-sm); border: 1px dashed var(--me-border);
}
.esc-empty-icon { font-size: 32px; }
.esc-empty-link { color: var(--me-accent); font-size: 12px; text-decoration: none; }
.esc-empty-link:hover { text-decoration: underline; }

.esc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.esc-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; background: var(--me-bg-surface);
  border: 1px solid var(--me-border); border-radius: var(--me-radius-sm);
  transition: border-color 0.15s;
}
.esc-item:hover { border-color: var(--me-accent); }
.esc-item-icon { flex-shrink: 0; width: 32px; display: flex; align-items: center; justify-content: center; }
.esc-item-main { flex: 1; min-width: 0; }
.esc-item-name { font-size: 14px; font-weight: 600; color: var(--me-text-primary); margin-bottom: 2px; }
.esc-item-meta { font-size: 11px; color: var(--me-text-muted); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.esc-dot { color: var(--me-text-muted); }
.esc-via { display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px; border-radius: 8px; background: var(--me-accent-glow); color: var(--me-accent); font-weight: 600; }

.esc-install { display: flex; flex-direction: column; gap: 14px; padding: 4px 0; }
.esc-install p { margin: 0; color: var(--me-text-secondary); font-size: 13px; }
.esc-steps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 10px; color: var(--me-text-secondary); font-size: 13px; line-height: 1.55; }
.esc-steps li { padding-left: 4px; }
.esc-steps li strong { display: block; margin-bottom: 4px; color: var(--me-text-primary); }
.esc-install-warn { display: flex; gap: 8px; padding: 10px 12px; border-radius: var(--me-radius-sm); background: rgba(245, 158, 11, 0.12); color: #b45309; font-size: 12px; }
.esc-install-warn i { font-size: 16px; flex-shrink: 0; }

.esc-browser-tabs { display: flex; gap: 8px; margin-bottom: 4px; }
.esc-browser-tab {
  flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 10px 12px; border-radius: var(--me-radius-sm);
  background: var(--me-bg-surface); border: 1px solid var(--me-border);
  color: var(--me-text-secondary); cursor: pointer; font-size: 13px; transition: all 0.15s;
}
.esc-browser-tab:hover { color: var(--me-text-primary); border-color: var(--me-accent); }
.esc-browser-tab--active { color: var(--me-accent); border-color: var(--me-accent); background: var(--me-accent-glow); font-weight: 600; }
.esc-browser-tab i { font-size: 16px; }
.esc-browser-detected { font-size: 10px; padding: 1px 6px; border-radius: 8px; background: var(--me-success, #10b981); color: #fff; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
</style>
