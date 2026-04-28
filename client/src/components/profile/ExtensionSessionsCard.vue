<template>
  <div class="esc">
    <div class="esc-header">
      <i class="mdi mdi-puzzle-outline esc-icon" />
      <div class="esc-title">
        <h3>{{ $t('extension.sessions.title') }}</h3>
        <p>{{ $t('extension.sessions.subtitle') }}</p>
      </div>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import Button from 'primevue/button';
import SocialIcon from '../common/SocialIcon.vue';
import api from '../../services/api';

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
</style>
