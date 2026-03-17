<template>
  <div class="admin-languagetool">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-spellcheck</v-icon>
        {{ $t('admin.languageTool') }}
      </h2>
      <p class="admin-section-subtitle">{{ $t('admin.ltSubtitle') }}</p>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <!-- Status -->
    <div class="sec-card glass-card fade-in fade-in-delay-1">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-server-network</v-icon>
        <h3 class="sec-card-title mono">{{ $t('admin.ltStatus') }}</h3>
      </div>
      <div class="sec-option">
        <div class="d-flex align-center ga-3">
          <span class="lt-status-dot" :class="ltAvailable ? 'lt-status-ok' : 'lt-status-off'" />
          <div>
            <p class="sec-label">{{ ltAvailable ? $t('admin.ltConnected') : $t('admin.ltDisconnected') }}</p>
            <p class="sec-desc" v-if="ltAvailable">{{ languageCount }} {{ $t('admin.ltLanguagesAvailable') }}</p>
            <p class="sec-desc" v-else>{{ $t('admin.ltDisconnectedDesc') }}</p>
          </div>
        </div>
        <v-btn size="small" variant="tonal" @click="checkStatus" :loading="checkingStatus">
          <v-icon size="16" start>mdi-refresh</v-icon>
          {{ $t('admin.ltRefresh') }}
        </v-btn>
      </div>
    </div>

    <!-- Configuration -->
    <div class="sec-card glass-card fade-in fade-in-delay-1">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-cog-outline</v-icon>
        <h3 class="sec-card-title mono">{{ $t('admin.configuration') }}</h3>
      </div>
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.ltEnabled') }}</p>
          <p class="sec-desc">{{ $t('admin.ltEnabledDesc') }}</p>
        </div>
        <v-switch v-model="form.enabled" color="primary" hide-details @update:model-value="save" />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.ltDefaultLang') }}</p>
          <p class="sec-desc">{{ $t('admin.ltDefaultLangDesc') }}</p>
        </div>
        <v-select
          v-model="form.defaultLanguage"
          :items="langOptions"
          density="compact"
          hide-details
          style="max-width: 180px;"
          @update:model-value="save"
        />
      </div>
    </div>

    <v-snackbar v-model="saved" :timeout="2000" color="success" location="bottom right">
      {{ $t('admin.ltSaved') }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';

const { t } = useI18n();

const loading = ref(true);
const saved = ref(false);
const ltAvailable = ref(false);
const languageCount = ref(0);
const checkingStatus = ref(false);

const form = ref({
  enabled: true,
  defaultLanguage: 'auto',
});

const langOptions = [
  { title: 'Auto-detect', value: 'auto' },
  { title: 'Français', value: 'fr' },
  { title: 'English (US)', value: 'en-US' },
  { title: 'English (GB)', value: 'en-GB' },
  { title: 'Nederlands', value: 'nl' },
  { title: 'Deutsch', value: 'de' },
  { title: 'Español', value: 'es' },
  { title: 'Italiano', value: 'it' },
  { title: 'Português', value: 'pt' },
];

async function checkStatus() {
  checkingStatus.value = true;
  try {
    const { data } = await api.get('/languagetool/status');
    ltAvailable.value = !!data.available;
    languageCount.value = data.languages?.length || 0;
  } catch {
    ltAvailable.value = false;
  } finally {
    checkingStatus.value = false;
  }
}

onMounted(async () => {
  try {
    const [settingsRes] = await Promise.all([
      api.get('/settings/branding'),
      checkStatus(),
    ]);
    const lt = settingsRes.data.languageTool || {};
    form.value.enabled = lt.enabled !== false;
    form.value.defaultLanguage = lt.defaultLanguage || 'auto';
  } catch {} finally {
    loading.value = false;
  }
});

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function save() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await api.put('/admin/settings', { languageTool: form.value });
      saved.value = true;
    } catch {}
  }, 300);
}
</script>

<style scoped>
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.admin-section-subtitle { font-size: 13px; color: var(--me-text-muted); margin-top: 4px; font-family: var(--me-font-mono); }

.sec-card { padding: 20px; margin-bottom: 16px; }
.sec-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--me-border); }
.sec-card-title { font-size: 14px; font-weight: 700; color: var(--me-text-primary); }

.sec-option { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 4px 0; }
.sec-label { font-size: 13px; font-weight: 600; color: var(--me-text-primary); }
.sec-desc { font-size: 12px; color: var(--me-text-muted); margin-top: 2px; }
.sec-divider { height: 1px; background: var(--me-border); margin: 10px 0; opacity: 0.5; }

.lt-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.lt-status-ok {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
}
.lt-status-off {
  background: #6b7280;
}
</style>
