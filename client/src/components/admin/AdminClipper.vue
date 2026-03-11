<template>
  <div class="admin-clipper">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-scissors-cutting</v-icon>
        Web Clipper
      </h2>
      <p class="admin-section-subtitle">{{ $t('admin.clipperSubtitle') }}</p>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <!-- Parametres du Web Clipper -->
    <div class="sec-card glass-card fade-in fade-in-delay-1">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-scissors-cutting</v-icon>
        <h3 class="sec-card-title mono">{{ $t('admin.clipperSettings') }}</h3>
      </div>
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.clipperTimeout') }}</p>
          <p class="sec-desc">{{ $t('admin.clipperTimeoutDesc') }}</p>
        </div>
        <v-text-field
          v-model.number="form.clipperTimeoutMs"
          type="number"
          density="compact"
          hide-details
          style="max-width: 120px;"
          :min="1000"
          :max="120000"
          @blur="save"
        />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.clipperQuality') }}</p>
          <p class="sec-desc">{{ $t('admin.clipperQualityDesc') }}</p>
        </div>
        <v-text-field
          v-model.number="form.clipperQuality"
          type="number"
          density="compact"
          hide-details
          style="max-width: 120px;"
          :min="10"
          :max="100"
          @blur="save"
        />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.clipperUserAgent') }}</p>
          <p class="sec-desc">{{ $t('admin.clipperUserAgentDesc') }}</p>
        </div>
        <v-text-field
          v-model="form.clipperUserAgent"
          density="compact"
          hide-details
          @blur="save"
        />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.clipperProxy') }}</p>
          <p class="sec-desc">{{ $t('admin.clipperProxyDesc') }}</p>
        </div>
        <v-text-field
          v-model="form.clipperProxy"
          density="compact"
          hide-details
          @blur="save"
        />
      </div>
    </div>

    <v-snackbar v-model="saved" :timeout="2000" color="success" location="bottom right">
      Parametres enregistres
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

const form = ref({
  clipperTimeoutMs: 30000,
  clipperQuality: 80,
  clipperUserAgent: '',
  clipperProxy: '',
});

onMounted(async () => {
  try {
    const { data } = await api.get('/settings/branding');
    form.value.clipperTimeoutMs = data.clipperTimeoutMs || 30000;
    form.value.clipperQuality = data.clipperQuality || 80;
    form.value.clipperUserAgent = data.clipperUserAgent || '';
    form.value.clipperProxy = data.clipperProxy || '';
  } catch {} finally {
    loading.value = false;
  }
});

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function save() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await api.put('/admin/settings', form.value);
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
</style>
