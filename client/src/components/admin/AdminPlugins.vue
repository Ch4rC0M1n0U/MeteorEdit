<template>
  <div class="admin-plugins">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <span class="mdi mdi-puzzle-outline" style="font-size: 20px; margin-right: 8px;"></span>
        Plugins
      </h2>
      <p class="admin-section-subtitle">{{ $t('admin.pluginsSubtitle') }}</p>
    </div>

    <div class="plugins-grid fade-in fade-in-delay-1">
      <!-- Mapbox -->
      <div class="plugin-card glass-card">
        <div class="plugin-card-header">
          <div class="plugin-icon">
            <span class="mdi mdi-map-outline" style="font-size: 24px;"></span>
          </div>
          <div>
            <h3 class="plugin-card-title mono">Mapbox</h3>
            <p class="plugin-card-desc">{{ $t('admin.mapboxDesc') }}</p>
          </div>
          <span :class="['plugin-status', form.mapbox.apiKey ? 'plugin-status--active' : 'plugin-status--inactive']">
            {{ form.mapbox.apiKey ? $t('admin.activeModel') : $t('admin.notConfigured') }}
          </span>
        </div>

        <div class="plugin-fields">
          <div class="plugin-field">
            <label class="plugin-label mono">{{ $t('admin.apiKey') }}</label>
            <div class="api-key-row">
              <InputText v-model="form.mapbox.apiKey"
                :type="showApiKey ? 'text' : 'password'"
                placeholder="pk.eyJ..." />
              <button class="plugin-toggle-btn" @click="showApiKey = !showApiKey" :title="showApiKey ? $t('admin.hide') : $t('admin.show')">
                <span :class="['mdi', showApiKey ? 'mdi-eye-off-outline' : 'mdi-eye-outline']" style="font-size: 16px;"></span>
              </button>
            </div>
          </div>

          <div class="plugin-field">
            <label class="plugin-label mono">{{ $t('admin.defaultStyle') }}</label>
            <Select v-model="form.mapbox.defaultStyle"
              :options="mapStyles"
              optionLabel="label"
              optionValue="value" />
          </div>

          <div class="plugin-field-row">
            <div class="plugin-field" style="flex: 1;">
              <label class="plugin-label mono">{{ $t('admin.centerLongitude') }}</label>
              <InputText v-model.number="form.mapbox.defaultCenter[0]"
                type="number"
                step="0.0001" />
            </div>
            <div class="plugin-field" style="flex: 1;">
              <label class="plugin-label mono">{{ $t('admin.centerLatitude') }}</label>
              <InputText v-model.number="form.mapbox.defaultCenter[1]"
                type="number"
                step="0.0001" />
            </div>
            <div class="plugin-field" style="flex: 0.5;">
              <label class="plugin-label mono">{{ $t('admin.zoom') }}</label>
              <InputText v-model.number="form.mapbox.defaultZoom"
                type="number"
                min="1"
                max="20" />
            </div>
          </div>
        </div>
      </div>

      <!-- Shodan -->
      <div class="plugin-card glass-card">
        <div class="plugin-card-header">
          <div class="plugin-icon" style="background: rgba(239, 68, 68, 0.12); color: #ef4444;">
            <span class="mdi mdi-radar" style="font-size: 24px;"></span>
          </div>
          <div>
            <h3 class="plugin-card-title mono">Shodan</h3>
            <p class="plugin-card-desc">{{ $t('admin.shodanDesc') }}</p>
          </div>
          <span :class="['plugin-status', shodanStatus.available ? 'plugin-status--active' : shodanStatus.hasKey ? 'plugin-status--warning' : 'plugin-status--inactive']">
            {{ shodanStatus.available ? `${shodanStatus.plan} — ${shodanStatus.queryCredits} credits` : shodanStatus.hasKey ? $t('admin.connectionError') : $t('admin.notConfigured') }}
          </span>
        </div>

        <div class="plugin-fields">
          <div class="plugin-field">
            <label class="plugin-label mono">{{ $t('admin.apiKey') }}</label>
            <div class="api-key-row">
              <InputText v-model="form.shodan.apiKey"
                :type="showShodanKey ? 'text' : 'password'"
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" style="flex: 1;" />
              <button class="plugin-toggle-btn" @click="showShodanKey = !showShodanKey" :title="showShodanKey ? $t('admin.hide') : $t('admin.show')">
                <span :class="['mdi', showShodanKey ? 'mdi-eye-off-outline' : 'mdi-eye-outline']" style="font-size: 16px;"></span>
              </button>
              <button class="plugin-toggle-btn" @click="testShodan" :title="$t('admin.testConnection')">
                <span :class="['mdi', testingShodan ? 'mdi-loading mdi-spin' : 'mdi-connection']" style="font-size: 16px;"></span>
              </button>
            </div>
          </div>

          <div class="plugin-field">
            <label class="shodan-toggle-row">
              <input type="checkbox" v-model="form.shodan.enabled" class="shodan-checkbox" />
              <span class="plugin-label mono">{{ $t('admin.shodanEnabled') }}</span>
            </label>
          </div>

          <div v-if="shodanStatus.available" class="shodan-info">
            <div class="shodan-info-row">
              <span class="shodan-info-label">Plan</span>
              <span class="shodan-info-value">{{ shodanStatus.plan }}</span>
            </div>
            <div class="shodan-info-row">
              <span class="shodan-info-label">Query Credits</span>
              <span class="shodan-info-value">{{ shodanStatus.queryCredits }}</span>
            </div>
            <div class="shodan-info-row">
              <span class="shodan-info-label">Scan Credits</span>
              <span class="shodan-info-value">{{ shodanStatus.scanCredits }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Telegago (Google CSE) -->
      <div class="plugin-card glass-card">
        <div class="plugin-card-header">
          <div class="plugin-icon" style="background: rgba(59, 130, 246, 0.12); color: #3b82f6;">
            <span class="mdi mdi-telegram" style="font-size: 24px;"></span>
          </div>
          <div>
            <h3 class="plugin-card-title mono">Telegago</h3>
            <p class="plugin-card-desc">{{ $t('admin.telegagoDesc') }}</p>
          </div>
          <span :class="['plugin-status', form.telegago.apiKey ? 'plugin-status--active' : 'plugin-status--inactive']">
            {{ form.telegago.apiKey ? $t('admin.activeModel') : $t('admin.notConfigured') }}
          </span>
        </div>

        <div class="plugin-fields">
          <div class="plugin-field">
            <label class="plugin-label mono">{{ $t('admin.googleApiKey') }}</label>
            <p class="plugin-field-desc">
              {{ $t('admin.googleApiKeyDesc') }}
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" class="plugin-link">
                {{ $t('admin.getGoogleApiKey') }} ↗
              </a>
            </p>
            <div class="api-key-row">
              <InputText v-model="form.telegago.apiKey"
                :type="showTelegagoKey ? 'text' : 'password'"
                placeholder="AIza..." style="flex: 1;" />
              <button class="plugin-toggle-btn" @click="showTelegagoKey = !showTelegagoKey" :title="showTelegagoKey ? $t('admin.hide') : $t('admin.show')">
                <span :class="['mdi', showTelegagoKey ? 'mdi-eye-off-outline' : 'mdi-eye-outline']" style="font-size: 16px;"></span>
              </button>
            </div>
          </div>

          <div class="plugin-field">
            <label class="shodan-toggle-row">
              <input type="checkbox" v-model="form.telegago.enabled" class="shodan-checkbox" />
              <span class="plugin-label mono">{{ $t('admin.telegagoEnabled') }}</span>
            </label>
          </div>
        </div>
      </div>
      <!-- Onyphe -->
      <div class="plugin-card glass-card">
        <div class="plugin-card-header">
          <div class="plugin-icon" style="background: rgba(245, 158, 11, 0.12); color: #f59e0b;">
            <span class="mdi mdi-bee" style="font-size: 24px;"></span>
          </div>
          <div>
            <h3 class="plugin-card-title mono">Onyphe</h3>
            <p class="plugin-card-desc">{{ $t('admin.onypheDesc') }}</p>
          </div>
          <span :class="['plugin-status', onypheStatus.available ? 'plugin-status--active' : onypheStatus.hasKey ? 'plugin-status--warning' : 'plugin-status--inactive']">
            {{ onypheStatus.available ? `${onypheStatus.quota.remaining}/${onypheStatus.quota.total} req` : onypheStatus.hasKey ? $t('admin.connectionError') : $t('admin.notConfigured') }}
          </span>
        </div>

        <div class="plugin-fields">
          <div class="plugin-field">
            <label class="plugin-label mono">{{ $t('admin.apiKey') }}</label>
            <div class="api-key-row">
              <InputText v-model="form.onyphe.apiKey"
                :type="showOnypheKey ? 'text' : 'password'"
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" style="flex: 1;" />
              <button class="plugin-toggle-btn" @click="showOnypheKey = !showOnypheKey" :title="showOnypheKey ? $t('admin.hide') : $t('admin.show')">
                <span :class="['mdi', showOnypheKey ? 'mdi-eye-off-outline' : 'mdi-eye-outline']" style="font-size: 16px;"></span>
              </button>
              <button class="plugin-toggle-btn" @click="testOnyphe" :title="$t('admin.testConnection')">
                <span :class="['mdi', testingOnyphe ? 'mdi-loading mdi-spin' : 'mdi-connection']" style="font-size: 16px;"></span>
              </button>
            </div>
          </div>

          <div class="plugin-field">
            <label class="shodan-toggle-row">
              <input type="checkbox" v-model="form.onyphe.enabled" class="shodan-checkbox" />
              <span class="plugin-label mono">{{ $t('admin.onypheEnabled') }}</span>
            </label>
          </div>

          <div v-if="onypheStatus.available" class="shodan-info">
            <div class="shodan-info-row">
              <span class="shodan-info-label">Plan</span>
              <span class="shodan-info-value">{{ onypheStatus.plan }}</span>
            </div>
            <div class="shodan-info-row">
              <span class="shodan-info-label">{{ $t('admin.quotaRemaining') }}</span>
              <span class="shodan-info-value">{{ onypheStatus.quota.remaining }} / {{ onypheStatus.quota.total }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="plugins-actions fade-in fade-in-delay-2">
      <button class="me-btn-primary" @click="save" :disabled="saving">
        <i class="pi pi-save" style="font-size: 14px; margin-right: 4px;"></i>
        {{ saving ? $t('admin.savingSettings') : $t('admin.saveSettings') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';

const { t } = useI18n();

const saving = ref(false);
const showApiKey = ref(false);
const showShodanKey = ref(false);
const showTelegagoKey = ref(false);
const showOnypheKey = ref(false);
const testingShodan = ref(false);
const testingOnyphe = ref(false);
const shodanStatus = reactive({ available: false, hasKey: false, plan: '', queryCredits: 0, scanCredits: 0 });
const onypheStatus = reactive({ available: false, hasKey: false, plan: '', quota: { used: 0, remaining: 0, total: 0 } });

const form = reactive({
  mapbox: {
    apiKey: '',
    defaultStyle: 'mapbox://styles/mapbox/dark-v11',
    defaultCenter: [2.3522, 48.8566] as [number, number],
    defaultZoom: 5,
  },
  shodan: {
    apiKey: '',
    enabled: false,
  },
  telegago: {
    apiKey: '',
    enabled: true,
  },
  onyphe: {
    apiKey: '',
    enabled: false,
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
    if (data.shodan) {
      form.shodan.apiKey = data.shodan.hasKey ? data.shodan.apiKey : '';
      form.shodan.enabled = data.shodan.enabled || false;
      shodanStatus.hasKey = !!data.shodan.hasKey;
    }
    if (data.telegago) {
      form.telegago.apiKey = data.telegago.hasKey ? data.telegago.apiKey : '';
      form.telegago.enabled = data.telegago.enabled !== false;
    }
    if (data.onyphe) {
      form.onyphe.apiKey = data.onyphe.hasKey ? data.onyphe.apiKey : '';
      form.onyphe.enabled = data.onyphe.enabled || false;
      onypheStatus.hasKey = !!data.onyphe.hasKey;
    }
    await Promise.all([checkShodanStatus(), checkOnypheStatus()]);
  } catch (err) {
    console.error('Failed to load plugin settings:', err);
  }
}

async function checkShodanStatus() {
  try {
    const { data } = await api.get('/shodan/status');
    shodanStatus.available = data.available;
    shodanStatus.plan = data.plan || '';
    shodanStatus.queryCredits = data.queryCredits || 0;
    shodanStatus.scanCredits = data.scanCredits || 0;
  } catch {
    shodanStatus.available = false;
  }
}

async function testShodan() {
  testingShodan.value = true;
  try {
    await checkShodanStatus();
  } finally {
    testingShodan.value = false;
  }
}



async function checkOnypheStatus() {
  try {
    const { data } = await api.get('/onyphe/status');
    onypheStatus.available = data.available;
    onypheStatus.plan = data.plan || '';
    if (data.quota) {
      onypheStatus.quota.used = data.quota.used || 0;
      onypheStatus.quota.remaining = data.quota.remaining || 0;
      onypheStatus.quota.total = data.quota.total || 0;
    }
  } catch {
    onypheStatus.available = false;
  }
}

async function testOnyphe() {
  testingOnyphe.value = true;
  try { await checkOnypheStatus(); } finally { testingOnyphe.value = false; }
}

function cleanKey(key: string): string | undefined {
  // Don't send masked keys back to server (they contain • characters)
  if (!key || key.includes('•')) return undefined;
  return key;
}

async function save() {
  saving.value = true;
  try {
    await api.put('/admin/plugins', {
      mapbox: { ...form.mapbox, apiKey: cleanKey(form.mapbox.apiKey) ?? form.mapbox.apiKey },
      shodan: { ...form.shodan, apiKey: cleanKey(form.shodan.apiKey) },
      telegago: { ...form.telegago, apiKey: cleanKey(form.telegago.apiKey) },
      onyphe: { ...form.onyphe, apiKey: cleanKey(form.onyphe.apiKey) },
    });
    await Promise.all([checkShodanStatus(), checkOnypheStatus()]);
  } catch (err) {
    console.error('Failed to save plugin settings:', err);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
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
.plugin-status--warning {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
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
.shodan-toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.shodan-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--me-accent);
}
.shodan-info {
  background: var(--me-bg-deep);
  border-radius: var(--me-radius-xs);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.shodan-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.shodan-info-label {
  font-size: 12px;
  color: var(--me-text-muted);
  font-family: var(--me-font-mono);
}
.shodan-info-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-primary);
  font-family: var(--me-font-mono);
}
</style>
