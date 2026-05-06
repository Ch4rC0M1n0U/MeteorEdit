<template>
  <div class="ext-page">
    <header class="ext-hero">
      <div class="ext-hero-icon">
        <i class="mdi mdi-puzzle-outline"></i>
      </div>
      <div>
        <h1 class="ext-title">{{ t('extension.title') }}</h1>
        <p class="ext-subtitle">{{ t('extension.subtitle') }}</p>
      </div>
      <div class="ext-version-badge">v{{ EXTENSION_VERSION }}</div>
    </header>

    <!-- Browser detection card -->
    <section class="ext-card">
      <div class="ext-detect">
        <div class="ext-detect-icon" :class="{ 'ext-detect-icon--ok': browser.supported, 'ext-detect-icon--ko': !browser.supported }">
          <i :class="browserIcon"></i>
        </div>
        <div class="ext-detect-text">
          <div class="ext-detect-label">{{ t('extension.detectedBrowser') }}</div>
          <div class="ext-detect-name">{{ browser.label }}</div>
          <div v-if="!browser.supported" class="ext-detect-warn">
            {{ t('extension.unsupportedBrowser') }}
          </div>
        </div>
      </div>

      <div class="ext-actions">
        <a v-if="browser.supported" :href="downloadUrl" class="me-btn me-btn-accent ext-download" download>
          <i class="pi pi-download"></i>
          <span>{{ t('extension.downloadFor', { browser: browser.label }) }}</span>
        </a>
        <a v-else :href="downloadUrl" class="me-btn me-btn-outlined" download>
          <i class="pi pi-download"></i>
          <span>{{ t('extension.downloadAnyway') }}</span>
        </a>
      </div>
    </section>

    <!-- Install steps -->
    <section class="ext-card">
      <h2 class="ext-section-title">
        <i class="mdi mdi-tools"></i>
        {{ t('extension.installTitle') }}
      </h2>
      <ol class="ext-steps">
        <li v-for="(step, i) in installSteps" :key="i" class="ext-step">
          <span class="ext-step-num">{{ i + 1 }}</span>
          <div class="ext-step-content">
            <strong>{{ step.title }}</strong>
            <p v-if="step.body" v-html="step.body"></p>
            <code v-if="step.command" class="ext-step-code">{{ step.command }}</code>
          </div>
        </li>
      </ol>
    </section>

    <!-- Configuration -->
    <section class="ext-card">
      <h2 class="ext-section-title">
        <i class="mdi mdi-key-variant"></i>
        {{ t('extension.configureTitle') }}
      </h2>
      <p class="ext-prose">{{ t('extension.configureBody') }}</p>
      <div class="ext-config-grid">
        <div class="ext-config-row">
          <label>{{ t('extension.instanceUrl') }}</label>
          <div class="ext-copy-row">
            <code class="ext-copy-val">{{ instanceUrl }}</code>
            <button class="me-btn me-btn-ghost" @click="copy(instanceUrl)" :title="t('common.copy')">
              <i class="pi pi-copy"></i>
            </button>
          </div>
        </div>
        <div class="ext-config-row">
          <label>{{ t('extension.tokenLabel') }}</label>
          <router-link to="/profile?section=api-tokens" class="ext-config-link">
            <i class="pi pi-external-link"></i>
            {{ t('extension.generateToken') }}
          </router-link>
        </div>
      </div>
    </section>

    <!-- Features grid -->
    <section class="ext-features">
      <article class="ext-feature">
        <div class="ext-feature-icon">🍪</div>
        <h3>{{ t('extension.features.sessions.title') }}</h3>
        <p>{{ t('extension.features.sessions.body') }}</p>
      </article>
      <article class="ext-feature ext-feature--highlight">
        <div class="ext-feature-icon">📋</div>
        <h3>{{ t('extension.features.clipper.title') }}</h3>
        <p>{{ t('extension.features.clipper.body') }}</p>
      </article>
      <article class="ext-feature">
        <div class="ext-feature-icon">⚙</div>
        <h3>{{ t('extension.features.settings.title') }}</h3>
        <p>{{ t('extension.features.settings.body') }}</p>
      </article>
    </section>

    <!-- Footer utility action -->
    <div class="ext-footer-actions">
      <button class="me-btn me-btn-ghost" @click="resetPromoBanner">
        <i class="pi pi-refresh" style="font-size: 12px; margin-right: 4px;"></i>
        {{ t('extension.resetBanner') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import { detectBrowser } from '../utils/browser';
import { SERVER_URL } from '../services/api';
import { EXTENSION_VERSION } from '../utils/extensionVersion';

const { t } = useI18n();
const toast = useToast();

const browser = computed(() => detectBrowser());
const downloadUrl = computed(() => `${SERVER_URL}/api/extension/download`);
const instanceUrl = computed(() => window.location.origin);

const browserIcon = computed(() => {
  switch (browser.value.id) {
    case 'chrome': return 'mdi mdi-google-chrome';
    case 'firefox': return 'mdi mdi-firefox';
    case 'edge': return 'mdi mdi-microsoft-edge';
    case 'brave': return 'mdi mdi-shield-half-full';
    case 'opera': return 'mdi mdi-opera';
    case 'safari': return 'mdi mdi-apple-safari';
    default: return 'mdi mdi-web';
  }
});

const installSteps = computed(() => {
  const id = browser.value.id;
  if (id === 'firefox') {
    return [
      { title: t('extension.steps.download'), body: t('extension.steps.downloadBody') },
      { title: t('extension.steps.firefoxOpen'), body: t('extension.steps.firefoxOpenBody'), command: 'about:debugging#/runtime/this-firefox' },
      { title: t('extension.steps.firefoxLoad'), body: t('extension.steps.firefoxLoadBody') },
      { title: t('extension.steps.configure'), body: t('extension.steps.configureBody') },
    ];
  }
  // Chromium-based default
  return [
    { title: t('extension.steps.download'), body: t('extension.steps.downloadBody') },
    { title: t('extension.steps.chromeOpen'), body: t('extension.steps.chromeOpenBody'), command: 'chrome://extensions' },
    { title: t('extension.steps.chromeDevMode'), body: t('extension.steps.chromeDevModeBody') },
    { title: t('extension.steps.chromeLoad'), body: t('extension.steps.chromeLoadBody') },
    { title: t('extension.steps.configure'), body: t('extension.steps.configureBody') },
  ];
});

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.add({ severity: 'success', summary: t('common.copy'), detail: text, life: 1500 });
  } catch {
    /* ignore */
  }
}

function resetPromoBanner(): void {
  try {
    localStorage.removeItem('extension_banner_dismissed');
    localStorage.removeItem('extension_banner_dismissed_v');
    toast.add({ severity: 'success', summary: t('extension.bannerResetTitle'), detail: t('extension.bannerResetBody'), life: 2500 });
  } catch { /* ignore */ }
}
</script>

<style scoped>
.ext-page { max-width: 980px; margin: 0 auto; padding: 32px 28px 60px; }

.ext-hero {
  display: flex; align-items: center; gap: 20px;
  margin-bottom: 28px;
}
.ext-hero-icon {
  width: 64px; height: 64px; border-radius: 16px;
  background: linear-gradient(135deg, var(--me-accent) 0%, var(--me-accent-light, #6366f1) 100%);
  color: #fff; font-size: 32px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.ext-title { font-size: 26px; font-weight: 800; margin: 0; color: var(--me-text-primary); }
.ext-subtitle { font-size: 14px; color: var(--me-text-muted); margin: 4px 0 0; max-width: 640px; }
.ext-version-badge {
  margin-left: auto;
  background: var(--me-accent-glow); color: var(--me-accent);
  padding: 4px 12px; border-radius: 12px;
  font-size: 12px; font-weight: 700; font-family: ui-monospace, monospace;
}

.ext-card {
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 16px;
}

.ext-detect {
  display: flex; align-items: center; gap: 16px;
  margin-bottom: 18px;
}
.ext-detect-icon {
  width: 48px; height: 48px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; flex-shrink: 0;
}
.ext-detect-icon--ok { background: rgba(34, 197, 94, 0.12); color: rgb(22, 163, 74); }
.ext-detect-icon--ko { background: rgba(239, 68, 68, 0.12); color: rgb(220, 38, 38); }
.ext-detect-label {
  font-size: 11px; color: var(--me-text-muted);
  text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;
}
.ext-detect-name { font-size: 18px; font-weight: 700; color: var(--me-text-primary); }
.ext-detect-warn { font-size: 12px; color: rgb(220, 38, 38); margin-top: 4px; }

.ext-actions { display: flex; gap: 8px; }
.ext-download { font-size: 14px; padding: 10px 18px; }
.ext-download i { margin-right: 6px; }

.ext-section-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 16px; font-weight: 700; color: var(--me-text-primary);
  margin: 0 0 16px;
}
.ext-section-title i { color: var(--me-accent); }

.ext-steps { list-style: none; padding: 0; margin: 0; }
.ext-step {
  display: flex; gap: 14px;
  padding: 12px 0;
  border-bottom: 1px dashed var(--me-border);
}
.ext-step:last-child { border-bottom: none; }
.ext-step-num {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--me-accent); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 13px; flex-shrink: 0;
}
.ext-step-content strong { display: block; font-size: 14px; color: var(--me-text-primary); margin-bottom: 4px; }
.ext-step-content p { margin: 0 0 6px; font-size: 13px; color: var(--me-text-secondary); line-height: 1.5; }
.ext-step-code {
  display: inline-block;
  background: var(--me-bg-elev1);
  border: 1px solid var(--me-border);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px; font-family: ui-monospace, monospace;
  color: var(--me-accent);
}

.ext-prose { font-size: 13px; color: var(--me-text-secondary); margin: 0 0 14px; line-height: 1.5; }
.ext-config-grid { display: flex; flex-direction: column; gap: 12px; }
.ext-config-row label {
  display: block; font-size: 11px; color: var(--me-text-muted);
  text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600;
  margin-bottom: 6px;
}
.ext-copy-row {
  display: flex; align-items: center; gap: 6px;
  background: var(--me-bg-elev1);
  border: 1px solid var(--me-border);
  border-radius: 8px;
  padding: 6px 10px;
}
.ext-copy-val {
  flex: 1; font-size: 13px; font-family: ui-monospace, monospace;
  color: var(--me-text-primary); word-break: break-all;
}
.ext-config-link {
  color: var(--me-accent); font-size: 13px; text-decoration: none;
  display: inline-flex; align-items: center; gap: 4px;
}
.ext-config-link:hover { text-decoration: underline; }

.ext-features {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  margin-top: 20px;
}
.ext-feature {
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  border-radius: 12px;
  padding: 18px;
}
.ext-feature--highlight { border-color: var(--me-accent); }
.ext-feature-icon { font-size: 28px; margin-bottom: 10px; }
.ext-feature h3 { font-size: 14px; font-weight: 700; margin: 0 0 6px; color: var(--me-text-primary); }
.ext-feature p { font-size: 12px; color: var(--me-text-muted); margin: 0; line-height: 1.5; }

.ext-footer-actions {
  display: flex; justify-content: center;
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px dashed var(--me-border);
}
</style>
