<template>
  <div v-if="visible" class="ext-banner" :class="`ext-banner--${browser.id}`" role="alert">
    <div class="ext-banner-icon">
      <i :class="browserIcon"></i>
    </div>
    <div class="ext-banner-text">
      <strong>{{ t('extensionBanner.title') }}</strong>
      <span>{{ message }}</span>
    </div>
    <div class="ext-banner-actions">
      <button class="ext-banner-cta" @click="install">
        <i class="pi pi-download"></i>
        {{ t('extensionBanner.cta') }}
      </button>
      <button class="ext-banner-close" @click="dismiss" :title="t('common.close')" aria-label="Fermer">
        <i class="pi pi-times"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { detectBrowser } from '../../utils/browser';
import { EXTENSION_VERSION } from '../../utils/extensionVersion';

// We tie the banner-dismiss flag to the extension version: every new
// release of the Companion automatically re-shows the banner once.
const BANNER_VERSION = EXTENSION_VERSION;
const STORAGE_KEY = 'extension_banner_dismissed_v';

const { t } = useI18n();
const router = useRouter();

const visible = ref(false);
const browser = computed(() => detectBrowser());

const browserIcon = computed(() => {
  switch (browser.value.id) {
    case 'chrome': return 'mdi mdi-google-chrome';
    case 'firefox': return 'mdi mdi-firefox';
    case 'edge': return 'mdi mdi-microsoft-edge';
    case 'brave': return 'mdi mdi-shield-half-full';
    case 'opera': return 'mdi mdi-opera';
    case 'safari': return 'mdi mdi-apple-safari';
    default: return 'mdi mdi-puzzle-outline';
  }
});

const message = computed(() => {
  if (!browser.value.supported) return t('extensionBanner.unsupportedMessage', { version: EXTENSION_VERSION });
  return t('extensionBanner.message', { browser: browser.value.label, version: EXTENSION_VERSION });
});

function dismiss(): void {
  visible.value = false;
  try { localStorage.setItem(STORAGE_KEY, BANNER_VERSION); } catch { /* ignore */ }
}

function install(): void {
  dismiss();
  router.push('/extension');
}

function shouldShow(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    // Only hide if the user already dismissed THIS exact version of the banner.
    // Bumping BANNER_VERSION re-shows the banner once, then it can be dismissed again.
    if (stored === BANNER_VERSION) return false;
  } catch { /* localStorage may throw in private mode */ }
  return true;
}

function isExcludedRoute(path: string): boolean {
  return path === '/extension'
    || path === '/login'
    || path === '/register'
    || path === '/setup'
    || path === '/maintenance';
}

onMounted(() => {
  // Wait for the next tick so router.currentRoute is fully resolved.
  // This avoids a race where mounted fires before the initial navigation completes.
  queueMicrotask(() => {
    const path = router.currentRoute.value.path || '';
    if (isExcludedRoute(path)) return;
    if (!shouldShow()) return;
    visible.value = true;
  });
});
</script>

<style scoped>
.ext-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
  background: linear-gradient(90deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.08) 100%);
  border-bottom: 1px solid var(--me-border);
  font-size: 13px;
}
.ext-banner-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: var(--me-accent); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}
.ext-banner--firefox .ext-banner-icon { background: linear-gradient(135deg, #ff9500 0%, #ff6611 100%); }
.ext-banner--chrome .ext-banner-icon,
.ext-banner--edge .ext-banner-icon,
.ext-banner--brave .ext-banner-icon,
.ext-banner--opera .ext-banner-icon { background: linear-gradient(135deg, #4285f4 0%, #34a853 50%, #fbbc05 100%); }

.ext-banner-text {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.ext-banner-text strong { color: var(--me-text-primary); font-size: 13px; }
.ext-banner-text span { color: var(--me-text-secondary); font-size: 12px; }

.ext-banner-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.ext-banner-cta {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px;
  background: var(--me-accent); color: #fff;
  border: none; border-radius: 8px;
  font-size: 12px; font-weight: 600; cursor: pointer;
  transition: filter 0.15s;
}
.ext-banner-cta:hover { filter: brightness(1.1); }
.ext-banner-cta i { font-size: 11px; }

.ext-banner-close {
  width: 28px; height: 28px; border-radius: 6px;
  background: transparent; border: none;
  color: var(--me-text-muted); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px;
  transition: background 0.15s, color 0.15s;
}
.ext-banner-close:hover { background: rgba(0,0,0,0.06); color: var(--me-text-primary); }

@media (max-width: 720px) {
  .ext-banner-text { flex-direction: column; gap: 2px; align-items: flex-start; }
  .ext-banner-cta span { display: none; }
}
</style>
