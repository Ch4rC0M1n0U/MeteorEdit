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
</style>
