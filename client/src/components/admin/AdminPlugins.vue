<template>
  <div class="admin-plugins">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-puzzle-outline</v-icon>
        Plugins
      </h2>
      <p class="admin-section-subtitle">Configuration des services externes</p>
    </div>

    <div class="plugins-grid fade-in fade-in-delay-1">
      <!-- Mapbox -->
      <div class="plugin-card glass-card">
        <div class="plugin-card-header">
          <div class="plugin-icon">
            <v-icon size="24">mdi-map-outline</v-icon>
          </div>
          <div>
            <h3 class="plugin-card-title mono">Mapbox</h3>
            <p class="plugin-card-desc">Cartographie interactive pour les dossiers</p>
          </div>
          <span :class="['plugin-status', form.mapbox.apiKey ? 'plugin-status--active' : 'plugin-status--inactive']">
            {{ form.mapbox.apiKey ? 'Actif' : 'Non configure' }}
          </span>
        </div>

        <div class="plugin-fields">
          <div class="plugin-field">
            <label class="plugin-label mono">Cle API</label>
            <div class="api-key-row">
              <v-text-field
                v-model="form.mapbox.apiKey"
                density="compact"
                hide-details
                :type="showApiKey ? 'text' : 'password'"
                placeholder="pk.eyJ..."
              />
              <button class="plugin-toggle-btn" @click="showApiKey = !showApiKey" :title="showApiKey ? 'Masquer' : 'Afficher'">
                <v-icon size="16">{{ showApiKey ? 'mdi-eye-off-outline' : 'mdi-eye-outline' }}</v-icon>
              </button>
            </div>
          </div>

          <div class="plugin-field">
            <label class="plugin-label mono">Style par defaut</label>
            <v-select
              v-model="form.mapbox.defaultStyle"
              :items="mapStyles"
              item-title="label"
              item-value="value"
              density="compact"
              hide-details
            />
          </div>

          <div class="plugin-field-row">
            <div class="plugin-field" style="flex: 1;">
              <label class="plugin-label mono">Centre (longitude)</label>
              <v-text-field
                v-model.number="form.mapbox.defaultCenter[0]"
                density="compact"
                hide-details
                type="number"
                step="0.0001"
              />
            </div>
            <div class="plugin-field" style="flex: 1;">
              <label class="plugin-label mono">Centre (latitude)</label>
              <v-text-field
                v-model.number="form.mapbox.defaultCenter[1]"
                density="compact"
                hide-details
                type="number"
                step="0.0001"
              />
            </div>
            <div class="plugin-field" style="flex: 0.5;">
              <label class="plugin-label mono">Zoom</label>
              <v-text-field
                v-model.number="form.mapbox.defaultZoom"
                density="compact"
                hide-details
                type="number"
                min="1"
                max="20"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="plugins-actions fade-in fade-in-delay-2">
      <button class="me-btn-primary" @click="save" :disabled="saving">
        <v-icon size="14" class="mr-1">mdi-content-save-outline</v-icon>
        {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import api from '../../services/api';

const saving = ref(false);
const showApiKey = ref(false);

const form = reactive({
  mapbox: {
    apiKey: '',
    defaultStyle: 'mapbox://styles/mapbox/dark-v11',
    defaultCenter: [2.3522, 48.8566] as [number, number],
    defaultZoom: 5,
  },
});

const mapStyles = [
  { label: 'Dark', value: 'mapbox://styles/mapbox/dark-v11' },
  { label: 'Streets', value: 'mapbox://styles/mapbox/streets-v12' },
  { label: 'Satellite', value: 'mapbox://styles/mapbox/satellite-v9' },
  { label: 'Satellite Streets', value: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { label: 'Light', value: 'mapbox://styles/mapbox/light-v11' },
  { label: 'Outdoors', value: 'mapbox://styles/mapbox/outdoors-v12' },
];

async function load() {
  try {
    const { data } = await api.get('/admin/plugins');
    if (data.mapbox) {
      form.mapbox.apiKey = data.mapbox.apiKey || '';
      form.mapbox.defaultStyle = data.mapbox.defaultStyle || 'mapbox://styles/mapbox/dark-v11';
      form.mapbox.defaultCenter = data.mapbox.defaultCenter || [2.3522, 48.8566];
      form.mapbox.defaultZoom = data.mapbox.defaultZoom || 5;
    }
  } catch (err) {
    console.error('Failed to load plugin settings:', err);
  }
}

async function save() {
  saving.value = true;
  try {
    await api.put('/admin/plugins', { mapbox: form.mapbox });
  } catch (err) {
    console.error('Failed to save plugin settings:', err);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.admin-plugins {
  max-width: 800px;
}
.admin-section-header {
  margin-bottom: 24px;
}
.admin-section-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--me-text-primary);
  display: flex;
  align-items: center;
}
.admin-section-subtitle {
  font-size: 13px;
  color: var(--me-text-muted);
  margin-top: 4px;
}
.plugins-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.plugin-card {
  padding: 20px;
}
.plugin-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.plugin-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--me-radius-xs);
  background: var(--me-accent-glow);
  color: var(--me-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.plugin-card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.plugin-card-desc {
  font-size: 12px;
  color: var(--me-text-muted);
  margin-top: 2px;
}
.plugin-status {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 10px;
  font-family: var(--me-font-mono);
}
.plugin-status--active {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}
.plugin-status--inactive {
  background: rgba(248, 113, 113, 0.1);
  color: #f87171;
}
.plugin-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.plugin-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.plugin-field-row {
  display: flex;
  gap: 12px;
}
.plugin-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--me-text-secondary);
}
.api-key-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.api-key-row .v-text-field {
  flex: 1;
}
.plugin-toggle-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-muted);
  cursor: pointer;
  flex-shrink: 0;
}
.plugin-toggle-btn:hover {
  border-color: var(--me-accent);
  color: var(--me-accent);
}
.plugins-actions {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}
.me-btn-primary {
  padding: 8px 20px;
  border-radius: var(--me-radius-xs);
  background: var(--me-accent);
  border: none;
  color: var(--me-bg-deep);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
}
.me-btn-primary:hover {
  box-shadow: 0 0 16px var(--me-accent-glow);
}
.me-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
