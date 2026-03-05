<template>
  <v-dialog v-model="dialog" max-width="480">
    <template #activator="{ props }">
      <button class="me-dropdown-item" v-bind="props">
        <v-icon size="16" class="mr-2">mdi-cog-outline</v-icon>
        Preferences
      </button>
    </template>

    <div class="glass-card settings-dialog">
      <div class="settings-header">
        <h3 class="mono">Preferences</h3>
        <button class="me-close-btn" @click="dialog = false">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>

      <div class="settings-body">
        <div class="settings-group">
          <label class="settings-label mono">Theme par defaut</label>
          <v-select
            v-model="prefs.defaultTheme"
            :items="themeOptions"
            density="compact"
            hide-details
          />
        </div>

        <div class="settings-group">
          <label class="settings-label mono">Largeur sidebar</label>
          <div class="settings-slider-row">
            <v-slider
              v-model="prefs.sidebarWidth"
              :min="200"
              :max="500"
              :step="10"
              hide-details
              thumb-label
              color="primary"
            />
            <span class="settings-value mono">{{ prefs.sidebarWidth }}px</span>
          </div>
        </div>

        <div class="settings-group">
          <label class="settings-label mono">Taille police editeur</label>
          <div class="settings-slider-row">
            <v-slider
              v-model="prefs.editorFontSize"
              :min="12"
              :max="24"
              :step="1"
              hide-details
              thumb-label
              color="primary"
            />
            <span class="settings-value mono">{{ prefs.editorFontSize }}px</span>
          </div>
        </div>
      </div>

      <div class="settings-footer">
        <button class="me-btn-ghost" @click="dialog = false">Annuler</button>
        <button class="me-btn-primary" @click="save">Sauvegarder</button>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import api from '../../services/api';

const dialog = ref(false);
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

// Load from localStorage first (fast), then sync from server
const saved = localStorage.getItem('userPreferences');
if (saved) {
  Object.assign(prefs, JSON.parse(saved));
}

onMounted(async () => {
  try {
    const { data } = await api.get('/auth/preferences');
    if (data && Object.keys(data).length) {
      Object.assign(prefs, data);
      localStorage.setItem('userPreferences', JSON.stringify(prefs));
    }
  } catch {
    // Server prefs not available, use localStorage
  }
});

async function save() {
  saving.value = true;
  try {
    localStorage.setItem('userPreferences', JSON.stringify(prefs));
    await api.put('/auth/preferences', { ...prefs });
  } catch {
    // Fallback: at least localStorage is saved
  } finally {
    saving.value = false;
    dialog.value = false;
  }
}
</script>

<style scoped>
.settings-dialog {
  padding: 0;
  overflow: hidden;
}
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--me-border);
}
.settings-header h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.me-close-btn {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}
.me-close-btn:hover {
  color: var(--me-text-primary);
  background: var(--me-accent-glow);
}
.settings-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.settings-group {}
.settings-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--me-text-muted);
  margin-bottom: 8px;
}
.settings-slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.settings-value {
  font-size: 12px;
  color: var(--me-accent);
  min-width: 48px;
  text-align: right;
}
.settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--me-border);
}
.me-btn-ghost {
  padding: 8px 16px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}
.me-btn-ghost:hover {
  border-color: var(--me-border-hover);
  color: var(--me-text-primary);
}
.me-btn-primary {
  padding: 8px 16px;
  border-radius: var(--me-radius-xs);
  background: var(--me-accent);
  border: none;
  color: var(--me-bg-deep);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
}
.me-btn-primary:hover {
  box-shadow: 0 0 16px var(--me-accent-glow);
}
.me-dropdown-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 12px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: none;
  color: var(--me-text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}
.me-dropdown-item:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
</style>
