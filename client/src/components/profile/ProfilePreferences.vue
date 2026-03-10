<template>
  <div class="profile-prefs">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-cog-outline</v-icon>
        Preferences
      </h2>
    </div>

    <!-- Apparence -->
    <div class="branding-card glass-card fade-in fade-in-delay-1">
      <h3 class="section-title mono">
        <v-icon size="16" class="mr-1">mdi-palette-outline</v-icon>
        Apparence
      </h3>

      <div class="settings-group mt-3">
        <label class="settings-label mono">Theme par defaut</label>
        <v-select v-model="prefs.defaultTheme" :items="themeOptions" density="compact" hide-details />
      </div>

      <div class="settings-group mt-4">
        <label class="settings-label mono">Densite d'affichage</label>
        <v-btn-toggle v-model="prefs.displayDensity" mandatory density="compact" color="primary" class="density-toggle">
          <v-btn value="compact" size="small">Compact</v-btn>
          <v-btn value="comfortable" size="small">Confortable</v-btn>
          <v-btn value="spacious" size="small">Spacieux</v-btn>
        </v-btn-toggle>
      </div>

      <div class="settings-group mt-4">
        <label class="settings-label mono">Largeur sidebar</label>
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
        Editeur
      </h3>

      <div class="settings-group mt-3">
        <label class="settings-label mono">Taille police editeur</label>
        <div class="settings-slider-row">
          <v-slider v-model="prefs.editorFontSize" :min="12" :max="24" :step="1" hide-details thumb-label color="primary" />
          <span class="settings-value mono">{{ prefs.editorFontSize }}px</span>
        </div>
      </div>

      <div class="settings-group mt-4">
        <label class="settings-label mono">Intervalle auto-sauvegarde</label>
        <v-select v-model="prefs.autoSaveInterval" :items="autoSaveOptions" density="compact" hide-details />
      </div>

      <div class="settings-group mt-4">
        <label class="settings-label mono">Type de node par defaut</label>
        <v-select v-model="prefs.defaultNodeType" :items="nodeTypeOptions" density="compact" hide-details />
      </div>
    </div>

    <!-- Regional -->
    <div class="branding-card glass-card fade-in fade-in-delay-3 mt-4">
      <h3 class="section-title mono">
        <v-icon size="16" class="mr-1">mdi-earth</v-icon>
        Regional
      </h3>

      <div class="settings-group mt-3">
        <label class="settings-label mono">Format de date</label>
        <v-select v-model="prefs.dateFormat" :items="dateFormatOptions" density="compact" hide-details />
      </div>

      <div class="settings-group mt-4">
        <label class="settings-label mono">Langue</label>
        <v-select v-model="prefs.language" :items="languageOptions" density="compact" hide-details>
          <template #item="{ item, props: itemProps }">
            <v-list-item v-bind="itemProps">
              <template #append>
                <span v-if="item.value !== 'fr'" class="lang-soon mono">(bientot disponible)</span>
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
        Comportement
      </h3>

      <div class="settings-group mt-3 switch-row">
        <label class="settings-label mono mb-0">Confirmation avant suppression</label>
        <v-switch v-model="prefs.confirmBeforeDelete" color="primary" density="compact" hide-details />
      </div>
    </div>

    <div class="save-status fade-in fade-in-delay-4 mt-3" v-if="saveStatus">
      <span class="save-status-text mono" :class="{ 'save-error': saveStatus === 'error' }">
        {{ saveStatus === 'saved' ? 'Preferences sauvegardees' : saveStatus === 'saving' ? 'Sauvegarde...' : 'Erreur lors de la sauvegarde' }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch, onMounted } from 'vue';
import api from '../../services/api';

const saveStatus = ref<'saved' | 'saving' | 'error' | null>(null);
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let statusTimeout: ReturnType<typeof setTimeout> | null = null;

const themeOptions = [
  { title: 'Sombre', value: 'dark' },
  { title: 'Clair', value: 'light' },
];

const dateFormatOptions = [
  { title: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
  { title: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
  { title: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
];

const nodeTypeOptions = [
  { title: 'Note', value: 'note' },
  { title: 'Dossier', value: 'folder' },
  { title: 'Document', value: 'document' },
  { title: 'Mindmap', value: 'mindmap' },
  { title: 'Carte', value: 'map' },
  { title: 'Dataset', value: 'dataset' },
];

const autoSaveOptions = [
  { title: '5 secondes', value: 5000 },
  { title: '10 secondes', value: 10000 },
  { title: '30 secondes', value: 30000 },
  { title: '60 secondes', value: 60000 },
  { title: 'Desactive', value: 0 },
];

const languageOptions = [
  { title: 'Francais', value: 'fr' },
  { title: 'English', value: 'en' },
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
.lang-soon { font-size: 10px; color: var(--me-text-muted); opacity: 0.7; margin-left: 8px; }
.save-status { text-align: right; }
.save-status-text { font-size: 11px; color: var(--me-accent); letter-spacing: 0.5px; }
.save-status-text.save-error { color: #f44336; }
</style>
