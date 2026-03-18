<template>
  <div class="profile-prefs">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-cog-outline</v-icon>
        {{ $t('preferences.title') }}
      </h2>
    </div>

    <!-- Apparence -->
    <div class="branding-card glass-card fade-in fade-in-delay-1">
      <h3 class="section-title mono">
        <v-icon size="16" class="mr-1">mdi-palette-outline</v-icon>
        {{ $t('preferences.appearance') }}
      </h3>

      <div class="settings-group mt-3">
        <label class="settings-label mono">{{ $t('preferences.defaultTheme') }}</label>
        <v-select v-model="prefs.defaultTheme" :items="themeOptions" density="compact" hide-details />
      </div>

      <div class="settings-group mt-4">
        <label class="settings-label mono">{{ $t('preferences.displayDensity') }}</label>
        <v-btn-toggle v-model="prefs.displayDensity" mandatory density="compact" color="primary" class="density-toggle">
          <v-btn value="compact" size="small">{{ $t('preferences.compact') }}</v-btn>
          <v-btn value="comfortable" size="small">{{ $t('preferences.comfortable') }}</v-btn>
          <v-btn value="spacious" size="small">{{ $t('preferences.spacious') }}</v-btn>
        </v-btn-toggle>
      </div>

      <div class="settings-group mt-4">
        <label class="settings-label mono">{{ $t('preferences.sidebarWidth') }}</label>
        <div class="settings-slider-row">
          <v-slider v-model="prefs.sidebarWidth" :min="200" :max="500" :step="10" hide-details thumb-label color="primary" />
          <span class="settings-value mono">{{ prefs.sidebarWidth }}px</span>
        </div>
      </div>
    </div>

    <!-- Editeur -->
    <div class="branding-card glass-card fade-in fade-in-delay-2 mt-4">
      <h3 class="section-title mono">
        <v-icon size="16" class="mr-1">mdi-file-edit-outline</v-icon>
        {{ $t('preferences.editorSection') }}
      </h3>

      <div class="settings-group mt-3">
        <label class="settings-label mono">{{ $t('preferences.editorFontSize') }}</label>
        <div class="settings-slider-row">
          <v-slider v-model="prefs.editorFontSize" :min="12" :max="24" :step="1" hide-details thumb-label color="primary" />
          <span class="settings-value mono">{{ prefs.editorFontSize }}px</span>
        </div>
      </div>

      <div class="settings-group mt-4">
        <label class="settings-label mono">{{ $t('preferences.autoSaveInterval') }}</label>
        <v-select v-model="prefs.autoSaveInterval" :items="autoSaveOptions" density="compact" hide-details />
      </div>

      <div class="settings-group mt-4">
        <label class="settings-label mono">{{ $t('preferences.defaultNodeType') }}</label>
        <v-select v-model="prefs.defaultNodeType" :items="nodeTypeOptions" density="compact" hide-details />
      </div>
    </div>

    <!-- Correcteur orthographique -->
    <div class="branding-card glass-card fade-in fade-in-delay-3 mt-4">
      <h3 class="section-title mono">
        <v-icon size="16" class="mr-1">mdi-spellcheck</v-icon>
        {{ $t('preferences.spellChecker') }}
      </h3>

      <div class="settings-group mt-3 switch-row">
        <label class="settings-label mono mb-0">{{ $t('preferences.spellCheckEnabled') }}</label>
        <v-switch v-model="prefs.spellCheckEnabled" color="primary" density="compact" hide-details />
      </div>

      <div class="settings-group mt-4">
        <label class="settings-label mono">{{ $t('preferences.spellCheckLanguage') }}</label>
        <v-select v-model="prefs.spellCheckLanguage" :items="spellCheckLangOptions" density="compact" hide-details />
      </div>
    </div>

    <!-- Regional -->
    <div class="branding-card glass-card fade-in fade-in-delay-3 mt-4">
      <h3 class="section-title mono">
        <v-icon size="16" class="mr-1">mdi-earth</v-icon>
        {{ $t('preferences.regional') }}
      </h3>

      <div class="settings-group mt-3">
        <label class="settings-label mono">{{ $t('preferences.dateFormat') }}</label>
        <v-select v-model="prefs.dateFormat" :items="dateFormatOptions" density="compact" hide-details />
      </div>

      <div class="settings-group mt-4">
        <label class="settings-label mono">{{ $t('preferences.language') }}</label>
        <v-select v-model="prefs.language" :items="languageOptions" density="compact" hide-details>
          <template #selection="{ item }">
            <div class="lang-selection">
              <span class="lang-flag" v-html="getLangFlag(item.value)"></span>
              <span>{{ item.title }}</span>
            </div>
          </template>
          <template #item="{ item, props: itemProps }">
            <v-list-item v-bind="itemProps">
              <template #prepend>
                <span class="lang-flag mr-2" v-html="getLangFlag(item.value)"></span>
              </template>
            </v-list-item>
          </template>
        </v-select>
      </div>
    </div>

    <!-- Extension Cookie Bridge -->
    <div class="branding-card glass-card fade-in fade-in-delay-4 mt-4">
      <h3 class="section-title mono">
        <v-icon size="16" class="mr-1">mdi-cookie-outline</v-icon>
        {{ $t('preferences.cookieBridge') }}
      </h3>
      <p class="section-desc mt-2">{{ $t('preferences.cookieBridgeDesc') }}</p>

      <!-- Download extension -->
      <div class="settings-group mt-3">
        <label class="settings-label mono">{{ $t('preferences.downloadExtension') }}</label>
        <div class="bridge-actions">
          <v-btn color="primary" variant="outlined" size="small" prepend-icon="mdi-download" @click="downloadExtension">
            {{ $t('preferences.downloadZip') }}
          </v-btn>
        </div>
      </div>

      <!-- Instructions -->
      <div class="bridge-instructions mt-3">
        <h4 class="mono" style="font-size: 12px; opacity: 0.7; margin-bottom: 8px;">{{ $t('preferences.installSteps') }}</h4>
        <ol class="bridge-steps">
          <li>{{ $t('preferences.step1Download') }}</li>
          <li>{{ $t('preferences.step2Unzip') }}</li>
          <li>{{ $t('preferences.step3Chrome') }}</li>
          <li>{{ $t('preferences.step4DevMode') }}</li>
          <li>{{ $t('preferences.step5Load') }}</li>
        </ol>
      </div>

      <!-- Generate bridge token + QR -->
      <div class="settings-group mt-4">
        <label class="settings-label mono">{{ $t('preferences.configureExtension') }}</label>
        <v-btn color="primary" variant="tonal" size="small" prepend-icon="mdi-qrcode" @click="generateBridgeToken" :loading="bridgeLoading">
          {{ $t('preferences.generateQrCode') }}
        </v-btn>
      </div>

      <!-- QR Code display -->
      <div v-if="bridgeQrData" class="bridge-qr-section mt-3">
        <div class="bridge-qr-card glass-card">
          <img :src="bridgeQrData" alt="QR Code" class="bridge-qr-img" />
          <p class="bridge-qr-hint mono">{{ $t('preferences.scanQrHint') }}</p>
          <div class="bridge-url-row mt-2">
            <code class="bridge-url">{{ bridgeConfigUrl }}</code>
            <v-btn icon size="x-small" variant="text" @click="copyBridgeUrl">
              <v-icon size="14">mdi-content-copy</v-icon>
            </v-btn>
          </div>
          <p class="bridge-expiry mono mt-1">{{ $t('preferences.tokenExpiry24h') }}</p>
        </div>
      </div>

      <!-- Import cookies.txt -->
      <div class="settings-group mt-4">
        <label class="settings-label mono">{{ $t('preferences.importCookiesFile') }}</label>
        <p class="section-desc">{{ $t('preferences.cookiesFileDesc') }}</p>
        <div class="bridge-actions mt-2">
          <v-btn color="secondary" variant="outlined" size="small" prepend-icon="mdi-file-upload-outline" @click="cookiesFileInput?.click()">
            {{ $t('preferences.uploadCookiesTxt') }}
          </v-btn>
          <input ref="cookiesFileInput" type="file" accept=".txt" hidden @change="uploadCookiesFile" />
        </div>
        <v-alert v-if="cookiesUploadResult" :type="cookiesUploadResult.type" variant="tonal" density="compact" class="mt-2" closable @click:close="cookiesUploadResult = null">
          {{ cookiesUploadResult.message }}
        </v-alert>
      </div>
    </div>

    <!-- Comportement -->
    <div class="branding-card glass-card fade-in fade-in-delay-4 mt-4">
      <h3 class="section-title mono">
        <v-icon size="16" class="mr-1">mdi-toggle-switch-outline</v-icon>
        {{ $t('preferences.behavior') }}
      </h3>

      <div class="settings-group mt-3 switch-row">
        <label class="settings-label mono mb-0">{{ $t('preferences.confirmBeforeDelete') }}</label>
        <v-switch v-model="prefs.confirmBeforeDelete" color="primary" density="compact" hide-details />
      </div>
    </div>

    <div class="save-status fade-in fade-in-delay-4 mt-3" v-if="saveStatus">
      <span class="save-status-text mono" :class="{ 'save-error': saveStatus === 'error' }">
        {{ saveStatus === 'saved' ? $t('preferences.saved') : saveStatus === 'saving' ? $t('preferences.saving') : $t('preferences.saveError') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';

const { t, locale } = useI18n();

const saveStatus = ref<'saved' | 'saving' | 'error' | null>(null);
const bridgeLoading = ref(false);
const bridgeQrData = ref<string | null>(null);
const bridgeConfigUrl = ref('');
const cookiesFileInput = ref<HTMLInputElement | null>(null);
const cookiesUploadResult = ref<{ type: 'success' | 'error'; message: string } | null>(null);
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let statusTimeout: ReturnType<typeof setTimeout> | null = null;

const themeOptions = computed(() => [
  { title: t('preferences.themeDark'), value: 'dark' },
  { title: t('preferences.themeLight'), value: 'light' },
]);

const dateFormatOptions = [
  { title: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
  { title: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
  { title: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
];

const nodeTypeOptions = computed(() => [
  { title: t('nodeTypes.note'), value: 'note' },
  { title: t('nodeTypes.folder'), value: 'folder' },
  { title: t('nodeTypes.document'), value: 'document' },
  { title: t('nodeTypes.mindmap'), value: 'mindmap' },
  { title: t('nodeTypes.map'), value: 'map' },
  { title: t('nodeTypes.dataset'), value: 'dataset' },
]);

const autoSaveOptions = computed(() => [
  { title: t('preferences.seconds5'), value: 5000 },
  { title: t('preferences.seconds10'), value: 10000 },
  { title: t('preferences.seconds30'), value: 30000 },
  { title: t('preferences.seconds60'), value: 60000 },
  { title: t('preferences.disabled'), value: 0 },
]);

const spellCheckLangOptions = computed(() => [
  { title: t('preferences.spellCheckAuto'), value: 'auto' },
  { title: 'Français', value: 'fr' },
  { title: 'English (US)', value: 'en-US' },
  { title: 'English (GB)', value: 'en-GB' },
  { title: 'Nederlands', value: 'nl' },
  { title: 'Deutsch', value: 'de' },
  { title: 'Español', value: 'es' },
  { title: 'Italiano', value: 'it' },
  { title: 'Português', value: 'pt' },
]);

const LANG_FLAGS: Record<string, string> = {
  fr: '<svg viewBox="0 0 30 20" width="20" height="14" style="border-radius:2px;vertical-align:middle"><rect fill="#002654" width="10" height="20"/><rect fill="#fff" x="10" width="10" height="20"/><rect fill="#CE1126" x="20" width="10" height="20"/></svg>',
  en: '<svg viewBox="0 0 30 20" width="20" height="14" style="border-radius:2px;vertical-align:middle"><rect fill="#012169" width="30" height="20"/><path d="M0,0 L30,20 M30,0 L0,20" stroke="#fff" stroke-width="3"/><path d="M0,0 L30,20 M30,0 L0,20" stroke="#C8102E" stroke-width="1.5"/><path d="M15,0 V20 M0,10 H30" stroke="#fff" stroke-width="5"/><path d="M15,0 V20 M0,10 H30" stroke="#C8102E" stroke-width="3"/></svg>',
  nl: '<svg viewBox="0 0 30 20" width="20" height="14" style="border-radius:2px;vertical-align:middle"><rect fill="#AE1C28" width="30" height="7"/><rect fill="#fff" y="7" width="30" height="7"/><rect fill="#21468B" y="14" width="30" height="7"/></svg>',
};

function getLangFlag(code: string): string {
  return LANG_FLAGS[code] ?? '<svg viewBox="0 0 20 20" width="16" height="16" style="vertical-align:middle"><circle cx="10" cy="10" r="9" fill="none" stroke="#888" stroke-width="1.5"/><text x="10" y="14" text-anchor="middle" font-size="10" fill="#888">?</text></svg>';
}

const languageOptions = [
  { title: 'Français', value: 'fr' },
  { title: 'English', value: 'en' },
  { title: 'Nederlands', value: 'nl' },
];

const prefs = reactive({
  defaultTheme: 'dark',
  sidebarWidth: 300,
  editorFontSize: 16,
  dateFormat: 'DD/MM/YYYY',
  defaultNodeType: 'note',
  autoSaveInterval: 10000,
  confirmBeforeDelete: true,
  displayDensity: 'comfortable',
  language: 'fr',
  spellCheckEnabled: false,
  spellCheckLanguage: 'auto',
});

// Load from localStorage immediately
const saved = localStorage.getItem('userPreferences');
if (saved) {
  try {
    Object.assign(prefs, JSON.parse(saved));
  } catch {}
}

onMounted(async () => {
  try {
    const { data } = await api.get('/auth/preferences');
    if (data && Object.keys(data).length) {
      Object.assign(prefs, data);
      localStorage.setItem('userPreferences', JSON.stringify(prefs));
    }
  } catch {}
});

async function persistPrefs() {
  saveStatus.value = 'saving';
  try {
    localStorage.setItem('userPreferences', JSON.stringify(prefs));
    await api.put('/auth/preferences', { ...prefs });
    saveStatus.value = 'saved';
  } catch {
    saveStatus.value = 'error';
  }
  if (statusTimeout) clearTimeout(statusTimeout);
  statusTimeout = setTimeout(() => {
    saveStatus.value = null;
  }, 2000);
}

function debouncedSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    persistPrefs();
  }, 300);
}

// Watch all prefs for changes and debounce save
watch(prefs, () => {
  debouncedSave();
});

function downloadExtension() {
  const token = localStorage.getItem('accessToken') || '';
  window.open(`/api/social/extension-download?token=${encodeURIComponent(token)}`, '_blank');
}

async function generateBridgeToken() {
  bridgeLoading.value = true;
  try {
    const { data } = await api.post('/social/bridge-token');
    const serverUrl = window.location.origin;
    bridgeConfigUrl.value = `${serverUrl}/extension-config?url=${encodeURIComponent(serverUrl)}&token=${encodeURIComponent(data.token)}`;

    // Generate QR code using canvas
    const QRCode = await import('qrcode');
    bridgeQrData.value = await QRCode.toDataURL(bridgeConfigUrl.value, { width: 200, margin: 2, color: { dark: '#e2e8f0', light: '#111827' } });
  } catch {
    bridgeQrData.value = null;
  } finally {
    bridgeLoading.value = false;
  }
}

function copyBridgeUrl() {
  navigator.clipboard.writeText(bridgeConfigUrl.value);
}

async function uploadCookiesFile(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  const file = input.files[0]!;
  const formData = new FormData();
  formData.append('cookiesFile', file);
  try {
    const { data } = await api.post('/social/cookies-file', formData);
    cookiesUploadResult.value = { type: 'success', message: `${data.cookieCount} cookies ${data.platform} ${t('preferences.imported')}` };
  } catch (e: any) {
    cookiesUploadResult.value = { type: 'error', message: e.response?.data?.message || t('preferences.importError') };
  }
  input.value = '';
}

// Sync language with i18n
watch(() => prefs.language, (newLang) => {
  if (newLang && ['fr', 'en', 'nl'].includes(newLang)) {
    locale.value = newLang;
  }
});
</script>

<style scoped>
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.branding-card { padding: 20px; }
.section-title { font-size: 13px; font-weight: 600; color: var(--me-accent); text-transform: uppercase; letter-spacing: 1.5px; display: flex; align-items: center; }
.settings-group {}
.settings-label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--me-text-muted); margin-bottom: 8px; }
.settings-slider-row { display: flex; align-items: center; gap: 12px; }
.settings-value { font-size: 12px; color: var(--me-accent); min-width: 48px; text-align: right; }
.mt-3 { margin-top: 12px; }
.mt-4 { margin-top: 16px; }
.mb-0 { margin-bottom: 0 !important; }
.switch-row { display: flex; align-items: center; justify-content: space-between; }
.density-toggle { width: 100%; }
.density-toggle .v-btn { flex: 1; font-size: 12px; letter-spacing: 0.5px; }
.lang-selection { display: flex; align-items: center; gap: 8px; }
.lang-flag { font-size: 18px; line-height: 1; }
.save-status { text-align: right; }
.save-status-text { font-size: 11px; color: var(--me-accent); letter-spacing: 0.5px; }
.save-status-text.save-error { color: #f44336; }
.section-desc { font-size: 12px; color: var(--me-text-muted); line-height: 1.5; }
.bridge-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.bridge-steps { font-size: 12px; color: var(--me-text-secondary); line-height: 1.8; padding-left: 20px; }
.bridge-steps li { margin-bottom: 2px; }
.bridge-qr-section { display: flex; justify-content: center; }
.bridge-qr-card { padding: 16px; text-align: center; max-width: 280px; }
.bridge-qr-img { width: 200px; height: 200px; border-radius: 8px; }
.bridge-qr-hint { font-size: 11px; color: var(--me-text-muted); margin-top: 8px; }
.bridge-url-row { display: flex; align-items: center; gap: 4px; justify-content: center; }
.bridge-url { font-size: 10px; color: var(--me-accent); word-break: break-all; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
.bridge-expiry { font-size: 10px; color: var(--me-text-muted); }
</style>
