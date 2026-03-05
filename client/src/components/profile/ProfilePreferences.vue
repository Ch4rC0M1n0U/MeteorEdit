<template>
  <div class="profile-prefs">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-cog-outline</v-icon>
        Preferences
      </h2>
    </div>

    <div class="branding-card glass-card fade-in fade-in-delay-1">
      <div class="settings-group">
        <label class="settings-label mono">Theme par defaut</label>
        <v-select v-model="prefs.defaultTheme" :items="themeOptions" density="compact" hide-details />
      </div>

      <div class="settings-group mt-5">
        <label class="settings-label mono">Largeur sidebar</label>
        <div class="settings-slider-row">
          <v-slider v-model="prefs.sidebarWidth" :min="200" :max="500" :step="10" hide-details thumb-label color="primary" />
          <span class="settings-value mono">{{ prefs.sidebarWidth }}px</span>
        </div>
      </div>

      <div class="settings-group mt-5">
        <label class="settings-label mono">Taille police editeur</label>
        <div class="settings-slider-row">
          <v-slider v-model="prefs.editorFontSize" :min="12" :max="24" :step="1" hide-details thumb-label color="primary" />
          <span class="settings-value mono">{{ prefs.editorFontSize }}px</span>
        </div>
      </div>

      <div class="branding-actions mt-5">
        <button class="me-btn-primary" @click="save" :disabled="saving">Sauvegarder</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import api from '../../services/api';

const saving = ref(false);
const themeOptions = [
  { title: 'Sombre', value: 'dark' },
  { title: 'Clair', value: 'light' },
];

const prefs = reactive({
  defaultTheme: 'dark',
  sidebarWidth: 300,
  editorFontSize: 16,
});

const saved = localStorage.getItem('userPreferences');
if (saved) Object.assign(prefs, JSON.parse(saved));

onMounted(async () => {
  try {
    const { data } = await api.get('/auth/preferences');
    if (data && Object.keys(data).length) {
      Object.assign(prefs, data);
      localStorage.setItem('userPreferences', JSON.stringify(prefs));
    }
  } catch {}
});

async function save() {
  saving.value = true;
  try {
    localStorage.setItem('userPreferences', JSON.stringify(prefs));
    await api.put('/auth/preferences', { ...prefs });
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.branding-card { padding: 20px; }
.settings-group {}
.settings-label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--me-text-muted); margin-bottom: 8px; }
.settings-slider-row { display: flex; align-items: center; gap: 12px; }
.settings-value { font-size: 12px; color: var(--me-accent); min-width: 48px; text-align: right; }
.branding-actions { display: flex; justify-content: flex-end; }
.mt-5 { margin-top: 20px; }
.me-btn-primary { padding: 8px 16px; border-radius: var(--me-radius-xs); background: var(--me-accent); border: none; color: var(--me-bg-deep); cursor: pointer; font-size: 13px; font-weight: 600; }
.me-btn-primary:hover { box-shadow: 0 0 16px var(--me-accent-glow); }
.me-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
