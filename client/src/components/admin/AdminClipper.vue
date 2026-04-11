<template>
  <div class="admin-clipper">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <span class="mdi mdi-scissors-cutting" style="font-size: 20px; margin-right: 8px;"></span>
        Web Clipper
      </h2>
      <p class="admin-section-subtitle">{{ $t('admin.clipperSubtitle') }}</p>
    </div>

    <ProgressBar v-if="loading" mode="indeterminate" style="margin-bottom: 16px;" />

    <!-- Parametres du Web Clipper -->
    <div class="sec-card glass-card fade-in fade-in-delay-1">
      <div class="sec-card-header">
        <span class="mdi mdi-scissors-cutting" style="font-size: 18px; color: var(--me-accent);"></span>
        <h3 class="sec-card-title mono">{{ $t('admin.clipperSettings') }}</h3>
      </div>
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.clipperTimeout') }}</p>
          <p class="sec-desc">{{ $t('admin.clipperTimeoutDesc') }}</p>
        </div>
        <InputText v-model.number="form.clipperTimeoutMs"
          type="number"
          style="max-width: 120px;"
          :min="1000"
          :max="120000"
          @blur="save" />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.clipperQuality') }}</p>
          <p class="sec-desc">{{ $t('admin.clipperQualityDesc') }}</p>
        </div>
        <InputText v-model.number="form.clipperQuality"
          type="number"
          style="max-width: 120px;"
          :min="10"
          :max="100"
          @blur="save" />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.clipperUserAgent') }}</p>
          <p class="sec-desc">{{ $t('admin.clipperUserAgentDesc') }}</p>
        </div>
        <InputText v-model="form.clipperUserAgent"
          @blur="save" />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.clipperProxy') }}</p>
          <p class="sec-desc">{{ $t('admin.clipperProxyDesc') }}</p>
        </div>
        <InputText v-model="form.clipperProxy"
          @blur="save" />
      </div>
    </div>

    <!-- snackbar removed during migration -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';
import ProgressBar from 'primevue/progressbar';
import InputText from 'primevue/inputtext';

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
